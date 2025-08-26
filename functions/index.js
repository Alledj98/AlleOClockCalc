const functions = require('firebase-functions');
const nodemailer = require('nodemailer');

exports.sendTimesheet = functions.region('europe-west1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  const { to, subject, body, pdfBase64, pdfUrl, filename } = data || {};
  if (!to) throw new functions.https.HttpsError('invalid-argument', 'Missing "to"');

  const cfg = functions.config().mail || {};
  if (!cfg.user || !cfg.pass) throw new functions.https.HttpsError('failed-precondition', 'Mail credentials not set');

  const transporter = nodemailer.createTransport({
    host: cfg.host || 'smtp.gmail.com',
    port: parseInt(cfg.port || '465', 10),
    secure: (cfg.secure || 'true') === 'true',
    auth: { user: cfg.user, pass: cfg.pass }
  });

  const mail = { from: cfg.from || cfg.user, to, subject: subject || 'Timesheet', text: (body || 'See PDF.') + (pdfUrl ? `\n\nLink: ${pdfUrl}` : '') };
  if (pdfBase64) mail.attachments = [{ filename: filename || 'timesheet.pdf', content: Buffer.from(pdfBase64,'base64'), contentType:'application/pdf' }];

  try { await transporter.sendMail(mail); return { ok:true }; }
  catch(e){ console.error(e); throw new functions.https.HttpsError('internal', e.message); }
});