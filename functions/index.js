const functions = require('firebase-functions');
const nodemailer = require('nodemailer');
const { defineSecret } = require('firebase-functions/params');
require('dotenv').config();

const MAIL_USER = defineSecret('MAIL_USER');
const MAIL_PASS = defineSecret('MAIL_PASS');

const MAIL_HOST = process.env.MAIL_HOST || 'smtp.gmail.com';
const MAIL_PORT = parseInt(process.env.MAIL_PORT || '465', 10);
const MAIL_SECURE = (process.env.MAIL_SECURE || 'true') === 'true';
const MAIL_FROM = process.env.MAIL_FROM || 'AlleOClockCalc <alleoclockcalc@gmail.com>';

function makeTransport(){
  return nodemailer.createTransport({
    host: MAIL_HOST, port: MAIL_PORT, secure: MAIL_SECURE,
    auth: { user: MAIL_USER.value(), pass: MAIL_PASS.value() }
  });
}

exports.smtpTest = functions.region('europe-west1').runWith({ secrets:[MAIL_USER, MAIL_PASS] }).https.onCall(async (data, context)=>{
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated','Auth required');
  try { const t = makeTransport(); await t.verify(); return { ok:true }; }
  catch(e){ console.error(e); throw new functions.https.HttpsError('failed-precondition', e.message); }
});

exports.sendTimesheet = functions.region('europe-west1').runWith({ secrets:[MAIL_USER, MAIL_PASS] }).https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  const { to, subject, body, pdfBase64, pdfUrl, filename } = data || {};
  if (!to) throw new functions.https.HttpsError('invalid-argument', 'Missing "to"');

  const transporter = makeTransport();
  const mail = { from: MAIL_FROM, to, subject: subject || 'Timesheet', text: (body || 'See PDF.') + (pdfUrl ? `\n\nLink: ${pdfUrl}` : '') };
  if (pdfBase64) mail.attachments = [{ filename: filename || 'timesheet.pdf', content: Buffer.from(pdfBase64,'base64'), contentType:'application/pdf' }];

  try { await transporter.sendMail(mail); return { ok:true }; }
  catch(e){ console.error(e); throw new functions.https.HttpsError('internal', e.message); }
});