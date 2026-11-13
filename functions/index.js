"use strict";

const functions = require("firebase-functions/v1");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { getStorage } = require("firebase-admin/storage");
const nodemailer = require("nodemailer");
const { defineSecret } = require("firebase-functions/params");
const { createService } = require("./service");
initializeApp();
const MAIL_USER = defineSecret("MAIL_USER");
const MAIL_PASS = defineSecret("MAIL_PASS");
const callable = functions
  .region("europe-west1")
  .runWith({ maxInstances: 2, timeoutSeconds: 60 });
const mailCallable = functions.region("europe-west1").runWith({
  secrets: [MAIL_USER, MAIL_PASS],
  maxInstances: 2,
  timeoutSeconds: 120,
});
function makeTransport() {
  return nodemailer.createTransport({
    host: process.env.MAIL_HOST || "smtp.gmail.com",
    port: Number(process.env.MAIL_PORT || 465),
    secure: (process.env.MAIL_SECURE || "true") === "true",
    auth: { user: MAIL_USER.value(), pass: MAIL_PASS.value() },
    connectionTimeout: 15000,
    socketTimeout: 30000,
    greetingTimeout: 15000,
  });
}
const service = createService({
  db: getFirestore(),
  auth: getAuth(),
  from: process.env.MAIL_FROM || "AlleOClockCalc <alleoclockcalc@gmail.com>",
  sendMail: (message) => makeTransport().sendMail(message),
});
exports.ensureProfile = callable.https.onCall(service.ensureProfile);
exports.linkEmployer = callable.https.onCall(service.linkEmployer);
exports.sendTimesheet = mailCallable.https.onCall(service.sendTimesheet);
exports.getSubmissionReport = callable.https.onCall(
  service.getSubmissionReport,
);
exports.updateSubmissionStatus = mailCallable.https.onCall(
  service.updateSubmissionStatus,
);
exports.smtpTest = mailCallable.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.admin !== true) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Test SMTP riservato all’amministratore.",
    );
  }
  try {
    await makeTransport().verify();
    return { ok: true };
  } catch {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Verifica configurazione SMTP e segreti.",
    );
  }
});

// Existing scheduled function name is retained. Explicit opt-in is required after review.
exports.scheduledBackup = functions
  .region("europe-west1")
  .runWith({ maxInstances: 1, timeoutSeconds: 540, memory: "512MB" })
  .pubsub.schedule("0 2 * * *")
  .timeZone("Europe/Rome")
  .onRun(async () => {
    if (process.env.BACKUP_ENABLED !== "true") return null;
    const db = getFirestore();
    const bucket = getStorage().bucket();
    // Keep every run recoverable, including a manual check on the same day.
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const prefix = `backups/${stamp}`;
    const data = { users: {}, employers: {}, codes: {} };
    const users = await db.collection("users").get();
    for (const user of users.docs) {
      data.users[user.id] = { ...user.data() };
      for (const name of ["entries", "pdfs", "submissions"]) {
        const children = await user.ref.collection(name).get();
        data.users[user.id][name] = children.docs.map((document) => ({
          ...document.data(),
          id: document.id,
        }));
      }
    }
    const employers = await db.collection("employers").get();
    for (const employer of employers.docs) {
      const submissions = await employer.ref.collection("submissions").get();
      data.employers[employer.id] = {
        ...employer.data(),
        submissions: submissions.docs.map((document) => ({
          ...document.data(),
          id: document.id,
        })),
      };
    }
    const codes = await db.collection("codes").get();
    for (const code of codes.docs) data.codes[code.id] = code.data();
    await bucket
      .file(`${prefix}/firestore.json`)
      .save(JSON.stringify(data), {
        contentType: "application/json",
        resumable: false,
      });
    const [files] = await bucket.getFiles({ prefix: "users/" });
    for (const file of files) {
      if (!/\/reports\//.test(file.name)) continue;
      const target = bucket.file(`${prefix}/storage/${file.name}`);
      await file.copy(target);
      await target.setMetadata({
        metadata: { firebaseStorageDownloadTokens: null },
      });
    }
    // Cleanup is opt-in too: never delete existing archives during an ordinary deploy.
    const retention = Number(process.env.BACKUP_RETENTION_DAYS || 0);
    if (Number.isInteger(retention) && retention >= 7) {
      const cutoff = Date.now() - retention * 86400000;
      const [archives] = await bucket.getFiles({ prefix: "backups/" });
      for (const file of archives) {
        const match = /^backups\/(\d{4}-\d{2}-\d{2})(?:T[^/]+)?\//.exec(file.name);
        if (match && Date.parse(match[1]) < cutoff) await file.delete();
      }
    }
    return null;
  });
