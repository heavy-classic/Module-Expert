const { Resend } = require('resend');

const NOTIFY_TO = 'mattsacks@yahoo.com';

let client = null;

function getClient() {
  if (client) return client;
  if (!process.env.RESEND_API_KEY) {
    console.log('[mailer] RESEND_API_KEY not set — notifications disabled');
    return null;
  }
  client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

async function sendUsageNotification({ moduleName, moduleCode, category, hasWorkflow, ip, userAgent }) {
  const c = getClient();
  if (!c) return;

  const now = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short' });

  console.log('[mailer] Sending notification for module:', moduleName, moduleCode);

  const html = buildHtml({ moduleName, moduleCode, category, hasWorkflow, ip, userAgent, now });

  try {
    const { error } = await c.emails.send({
      from: 'Module Expert <onboarding@resend.dev>',
      to: NOTIFY_TO,
      subject: `New module generated: ${moduleName} (${moduleCode})`,
      html,
    });
    if (error) {
      console.error('[mailer] Failed to send notification:', error.message || JSON.stringify(error));
    } else {
      console.log('[mailer] Notification sent to', NOTIFY_TO);
    }
  } catch (err) {
    console.error('[mailer] Failed to send notification:', err.message);
  }
}

function buildHtml({ moduleName, moduleCode, category, hasWorkflow, ip, userAgent, now }) {
  return '<div style="font-family:-apple-system,\'Segoe UI\',sans-serif;max-width:560px;margin:0 auto;background:#f8faff;padding:24px;border-radius:12px;">' +
    '<div style="background:linear-gradient(135deg,#0F2447,#1B3A6B);border-radius:8px;padding:20px 24px;margin-bottom:20px;">' +
      '<div style="color:rgba(255,255,255,0.6);font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:6px;">Module Expert</div>' +
      '<div style="color:white;font-size:20px;font-weight:800;">New Module Generated</div>' +
      '<div style="color:rgba(255,255,255,0.65);font-size:13px;margin-top:4px;">' + esc(now) + ' ET</div>' +
    '</div>' +
    '<div style="background:white;border:1px solid #D1E0F7;border-radius:8px;padding:20px;margin-bottom:16px;">' +
      '<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#64748B;margin-bottom:12px;">Module</div>' +
      '<div style="font-size:22px;font-weight:900;color:#1B3A6B;margin-bottom:6px;">' + esc(moduleName) + '</div>' +
      '<span style="background:#1B3A6B;color:white;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;">' + esc(moduleCode) + '</span>' +
      '<table style="width:100%;margin-top:14px;border-collapse:collapse;font-size:13px;">' +
        row('Category', esc(category)) +
        row('Workflow', hasWorkflow ? 'Yes' : 'No') +
      '</table>' +
    '</div>' +
    '<div style="background:white;border:1px solid #D1E0F7;border-radius:8px;padding:16px;font-size:12px;color:#475569;">' +
      '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#94A3B8;margin-bottom:8px;">Request Info</div>' +
      '<div><strong>IP:</strong> ' + esc(ip || 'unknown') + '</div>' +
      '<div style="margin-top:4px;word-break:break-all;"><strong>Browser:</strong> ' + esc((userAgent || 'unknown').substring(0, 120)) + '</div>' +
    '</div>' +
  '</div>';
}

function row(label, value) {
  return '<tr>' +
    '<td style="padding:5px 0;color:#94A3B8;font-weight:600;width:110px;vertical-align:top;">' + label + '</td>' +
    '<td style="padding:5px 0;color:#1A202C;">' + value + '</td>' +
  '</tr>';
}

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

module.exports = { sendUsageNotification };
