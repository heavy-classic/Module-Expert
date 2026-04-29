const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const multer = require('multer');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');
const { generateModule } = require('./src/generator');
const { modifyModule } = require('./src/modifier');
const { researchCustomer } = require('./src/researcher');
const { getClarifyingQuestions } = require('./src/clarifier');
const { parseModuleFile } = require('./src/parser');
const { generateAllPDFs } = require('./src/pdfGenerator');
const { sendUsageNotification } = require('./src/mailer');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

// job store: jobId → { status, xml?, filename?, explanation?, sessionId?, files?, error?, createdAt }
const jobs = {};
// session store for docs PDFs: sessionId → { files, dir, createdAt }
const sessions = {};

// Clean up every 15 mins
setInterval(() => {
  const cutoff = Date.now() - 3600000;
  for (const [id, job] of Object.entries(jobs)) {
    if (job.createdAt < cutoff) delete jobs[id];
  }
  for (const [id, session] of Object.entries(sessions)) {
    if (session.createdAt < cutoff) {
      session.files.forEach(f => fs.unlink(f.path, () => {}));
      try { fs.rmdirSync(session.dir); } catch {}
      delete sessions[id];
    }
  }
}, 15 * 60 * 1000);

// ─── Generate ────────────────────────────────────────────────────────────────

app.post('/generate', (req, res) => {
  const {
    description, moduleName, moduleCode, identifierPrefix, category,
    hasWorkflow, sourceArea, reportingAuthorityCode, subscriberRoles,
    customerName, customerContext, answers,
  } = req.body;

  if (!description?.trim()) return res.status(400).json({ error: 'Description is required.' });
  if (!moduleName?.trim()) return res.status(400).json({ error: 'Module name is required.' });
  if (!moduleCode?.trim()) return res.status(400).json({ error: 'Module code is required.' });
  if (!identifierPrefix?.trim()) return res.status(400).json({ error: 'Identifier prefix is required.' });
  if (!category?.trim()) return res.status(400).json({ error: 'Category is required.' });

  const jobId = uuidv4();
  jobs[jobId] = { status: 'processing', createdAt: Date.now() };
  res.json({ jobId });

  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'] || '';

  const params = {
    description: description.trim(),
    moduleName: moduleName.trim(),
    moduleCode: moduleCode.trim().toUpperCase(),
    identifierPrefix: identifierPrefix.trim().toUpperCase(),
    category: category.trim(),
    hasWorkflow: !!hasWorkflow,
    sourceArea: (sourceArea || 'DWAYConfig.INVK').trim(),
    reportingAuthorityCode: (reportingAuthorityCode || 'RA1').trim(),
    subscriberRoles: Array.isArray(subscriberRoles) && subscriberRoles.length > 0
      ? subscriberRoles
      : [
          { code: 'INVK-A', name: 'Module Admin' },
          { code: 'INVK-C', name: 'Module Coordinator' },
          { code: 'INVK-D', name: 'Debug' },
          { code: 'INVK-P', name: 'Participant' },
        ],
    customerName: (customerName || '').trim(),
    customerContext: customerContext || null,
    answers: Array.isArray(answers) ? answers : [],
  };

  runGenerateJob(jobId, params, ip, userAgent).catch(err => {
    console.error(`[${jobId}] Generate failed:`, err.message);
    jobs[jobId] = { ...jobs[jobId], status: 'error', error: err.message };
  });
});

async function runGenerateJob(jobId, params, ip, userAgent) {
  console.log(`[${jobId}] Generating: ${params.moduleCode} — ${params.moduleName}`);

  let customerContext = params.customerContext;
  if (!customerContext && params.customerName) {
    console.log(`[${jobId}] Researching customer: ${params.customerName}`);
    customerContext = await researchCustomer(params.customerName, params.moduleName);
    console.log(`[${jobId}] Research done — scraped: ${customerContext.scraped}`);
  }

  const xml = await generateModule({ ...params, customerContext });
  const filename = `Module.${params.moduleCode}.xml`;

  jobs[jobId] = { ...jobs[jobId], status: 'done', xml, filename };
  console.log(`[${jobId}] Generate done. ${xml.length} chars`);

  sendUsageNotification({
    moduleName: params.moduleName, moduleCode: params.moduleCode,
    category: params.category, hasWorkflow: params.hasWorkflow, ip, userAgent,
  }).catch(() => {});
}

// ─── Clarify ─────────────────────────────────────────────────────────────────

app.post('/clarify/generate', async (req, res) => {
  const { params } = req.body;
  if (!params?.description) return res.status(400).json({ error: 'params required' });

  try {
    let customerContext = null;
    if (params.customerName) {
      customerContext = await researchCustomer(params.customerName, params.moduleName);
    }
    const questions = await getClarifyingQuestions('generate', { ...params, customerContext });
    res.json({ questions, customerContext });
  } catch (err) {
    console.error('Clarify generate error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/clarify/modify', upload.single('xmlFile'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'XML file is required.' });
  const changeDescription = (req.body.changeDescription || '').trim();
  if (!changeDescription) return res.status(400).json({ error: 'Change description is required.' });

  const xmlContent = req.file.buffer.toString('utf-8');
  if (!xmlContent.includes('<SubscriberModule')) {
    return res.status(400).json({ error: 'File does not appear to be a valid DevonWay module XML.' });
  }

  const tempId = uuidv4();
  jobs[tempId] = { status: 'awaiting-answers', xml: xmlContent, createdAt: Date.now() };

  try {
    const questions = await getClarifyingQuestions('modify', { changeDescription }, xmlContent);
    res.json({ tempId, questions });
  } catch (err) {
    delete jobs[tempId];
    console.error('Clarify modify error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Modify ──────────────────────────────────────────────────────────────────

app.post('/modify', (req, res) => {
  const { tempId, changeDescription, answers } = req.body;
  if (!tempId) return res.status(400).json({ error: 'tempId is required.' });

  const tempJob = jobs[tempId];
  if (!tempJob || tempJob.status !== 'awaiting-answers') {
    return res.status(400).json({ error: 'Invalid or expired session. Please re-upload your XML file.' });
  }

  const xmlContent = tempJob.xml;
  const desc = (changeDescription || '').trim();
  if (!desc) return res.status(400).json({ error: 'Change description is required.' });

  const jobId = uuidv4();
  jobs[jobId] = { status: 'processing', createdAt: Date.now() };
  delete jobs[tempId];
  res.json({ jobId });

  runModifyJob(jobId, xmlContent, desc, Array.isArray(answers) ? answers : []).catch(err => {
    console.error(`[${jobId}] Modify failed:`, err.message);
    jobs[jobId] = { ...jobs[jobId], status: 'error', error: err.message };
  });
});

async function runModifyJob(jobId, xmlContent, changeDescription, answers) {
  console.log(`[${jobId}] Modifying module...`);
  const { xml, explanation } = await modifyModule(xmlContent, changeDescription, answers);

  const codeMatch = xml.match(/ModuleCode="([^"]+)"/);
  const code = codeMatch ? codeMatch[1] : 'Modified';
  const filename = `Module.${code}.xml`;

  jobs[jobId] = { ...jobs[jobId], status: 'done', xml, filename, explanation };
  console.log(`[${jobId}] Modify done. XML: ${xml.length} chars`);
}

// ─── Docs ─────────────────────────────────────────────────────────────────────

app.post('/docs/upload', upload.single('module'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  const customerName = (req.body.customerName || '').trim();
  if (!customerName) return res.status(400).json({ error: 'Customer name is required.' });

  const jobId = uuidv4();
  jobs[jobId] = { status: 'processing', createdAt: Date.now() };
  res.json({ jobId });

  runDocsJob(jobId, req.file.buffer, req.file.originalname, customerName).catch(err => {
    console.error(`[${jobId}] Docs job failed:`, err.message);
    jobs[jobId] = { ...jobs[jobId], status: 'error', error: err.message };
  });
});

app.post('/docs/from-job', (req, res) => {
  const { sourceJobId, customerName } = req.body;
  const sourceJob = jobs[sourceJobId];
  if (!sourceJob || sourceJob.status !== 'done' || !sourceJob.xml) {
    return res.status(400).json({ error: 'Source job not found or not complete.' });
  }
  const name = (customerName || '').trim();
  if (!name) return res.status(400).json({ error: 'Customer name is required.' });

  const jobId = uuidv4();
  jobs[jobId] = { status: 'processing', createdAt: Date.now() };
  res.json({ jobId });

  const xmlBuffer = Buffer.from(sourceJob.xml, 'utf-8');
  runDocsJob(jobId, xmlBuffer, sourceJob.filename || 'module.xml', name).catch(err => {
    console.error(`[${jobId}] Docs from-job failed:`, err.message);
    jobs[jobId] = { ...jobs[jobId], status: 'error', error: err.message };
  });
});

async function runDocsJob(jobId, buffer, filename, customerName) {
  console.log(`[${jobId}] Generating docs for: ${filename} (customer: ${customerName})`);

  const moduleData = await parseModuleFile(buffer, filename);
  console.log(`[${jobId}] Parsed: ${moduleData.metadata.name} — ${moduleData.fields.length} fields`);

  const customerContext = await researchCustomer(customerName, moduleData.metadata.name);
  console.log(`[${jobId}] Customer context scraped: ${customerContext.scraped}`);

  const pdfs = await generateAllPDFs(moduleData, customerContext);
  console.log(`[${jobId}] Generated ${pdfs.length} PDFs`);

  const sessionId = uuidv4();
  const sessionDir = path.join(os.tmpdir(), `devonway-${sessionId}`);
  fs.mkdirSync(sessionDir, { recursive: true });

  const files = [];
  for (const pdf of pdfs) {
    const filePath = path.join(sessionDir, pdf.filename);
    fs.writeFileSync(filePath, pdf.buffer);
    files.push({ name: pdf.filename, title: pdf.title, description: pdf.description, path: filePath });
  }

  sessions[sessionId] = { files, dir: sessionDir, createdAt: Date.now() };
  jobs[jobId] = {
    ...jobs[jobId],
    status: 'done',
    sessionId,
    moduleName: moduleData.metadata.name,
    files: files.map(f => ({ name: f.name, title: f.title, description: f.description })),
  };

  console.log(`[${jobId}] Docs done. Session: ${sessionId}`);
}

app.get('/docs/download/:sessionId/:filename', (req, res) => {
  const session = sessions[req.params.sessionId];
  if (!session) return res.status(404).send('Session expired or not found.');
  const file = session.files.find(f => f.name === req.params.filename);
  if (!file) return res.status(404).send('File not found.');
  res.download(file.path, file.name);
});

app.get('/docs/download-all/:sessionId', (req, res) => {
  const session = sessions[req.params.sessionId];
  if (!session) return res.status(404).send('Session expired or not found.');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="module-documentation.zip"');
  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', err => res.status(500).send(err.message));
  archive.pipe(res);
  session.files.forEach(f => archive.file(f.path, { name: f.name }));
  archive.finalize();
});

// ─── Shared job poll & download ───────────────────────────────────────────────

app.get('/job/:jobId', (req, res) => {
  const job = jobs[req.params.jobId];
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status === 'error') return res.json({ status: 'error', error: job.error });
  if (job.status === 'done') return res.json({
    status: 'done',
    filename: job.filename,
    explanation: job.explanation || null,
    sessionId: job.sessionId || null,
    files: job.files || null,
    moduleName: job.moduleName || null,
  });
  return res.json({ status: 'processing' });
});

app.get('/download/:jobId', (req, res) => {
  const job = jobs[req.params.jobId];
  if (!job || job.status !== 'done') return res.status(404).json({ error: 'Not ready or not found' });
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', `attachment; filename="${job.filename}"`);
  res.send(job.xml);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Module Expert running on port ${PORT}`));
