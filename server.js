const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { generateModule } = require('./src/generator');
const { researchCustomer } = require('./src/researcher');
const { sendUsageNotification } = require('./src/mailer');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// job store: jobId → { status, xml?, filename?, error?, createdAt }
const jobs = {};

// Clean up old jobs every 15 mins
setInterval(() => {
  const cutoff = Date.now() - 3600000;
  for (const [id, job] of Object.entries(jobs)) {
    if (job.createdAt < cutoff) delete jobs[id];
  }
}, 15 * 60 * 1000);

// POST /generate — start generation job
app.post('/generate', (req, res) => {
  const {
    description,
    moduleName,
    moduleCode,
    identifierPrefix,
    category,
    hasWorkflow,
    sourceArea,
    reportingAuthorityCode,
    subscriberRoles,
    customerName,
  } = req.body;

  if (!description || !description.trim()) return res.status(400).json({ error: 'Description is required.' });
  if (!moduleName || !moduleName.trim()) return res.status(400).json({ error: 'Module name is required.' });
  if (!moduleCode || !moduleCode.trim()) return res.status(400).json({ error: 'Module code is required.' });
  if (!identifierPrefix || !identifierPrefix.trim()) return res.status(400).json({ error: 'Identifier prefix is required.' });
  if (!category || !category.trim()) return res.status(400).json({ error: 'Category is required.' });

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
  };

  runJob(jobId, params, ip, userAgent).catch(err => {
    console.error(`[${jobId}] Job failed:`, err.message);
    jobs[jobId] = { ...jobs[jobId], status: 'error', error: err.message };
  });
});

async function runJob(jobId, params, ip, userAgent) {
  console.log(`[${jobId}] Generating module: ${params.moduleCode} — ${params.moduleName}`);

  let customerContext = null;
  if (params.customerName) {
    console.log(`[${jobId}] Researching customer: ${params.customerName}`);
    customerContext = await researchCustomer(params.customerName, params.moduleName);
    console.log(`[${jobId}] Customer research done — scraped: ${customerContext.scraped}`);
  }

  const xml = await generateModule({ ...params, customerContext });
  const filename = `Module.${params.moduleCode}.xml`;

  jobs[jobId] = {
    ...jobs[jobId],
    status: 'done',
    xml,
    filename,
  };

  console.log(`[${jobId}] Done. XML length: ${xml.length} chars`);

  sendUsageNotification({
    moduleName: params.moduleName,
    moduleCode: params.moduleCode,
    category: params.category,
    hasWorkflow: params.hasWorkflow,
    ip,
    userAgent,
  }).catch(() => {});
}

// GET /job/:jobId — poll for status
app.get('/job/:jobId', (req, res) => {
  const job = jobs[req.params.jobId];
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status === 'error') return res.json({ status: 'error', error: job.error });
  if (job.status === 'done') return res.json({ status: 'done', filename: job.filename });
  return res.json({ status: 'processing' });
});

// GET /download/:jobId — download the XML file
app.get('/download/:jobId', (req, res) => {
  const job = jobs[req.params.jobId];
  if (!job || job.status !== 'done') return res.status(404).json({ error: 'Not ready or not found' });
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', `attachment; filename="${job.filename}"`);
  res.send(job.xml);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Module Expert running on port ${PORT}`));
