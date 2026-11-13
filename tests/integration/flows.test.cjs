const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");
const {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
} = require("firebase/firestore");
const { ref, uploadBytes, getBytes } = require("firebase/storage");
const requireFunctions = require("node:module").createRequire(
  require("node:path").resolve("functions/package.json"),
);
const { initializeApp, getApp, deleteApp } =
  requireFunctions("firebase-admin/app");
const { getFirestore, FieldValue } = requireFunctions(
  "firebase-admin/firestore",
);
const { createService } = require("../../functions/service");
const projectId = "demo-alleoclockcalc";
let environment, db, clock, deliveries, users, service;
const context = (uid) => ({ auth: { uid, token: {} } });
const reportId = "report_request_01";
const payload = {
  requestId: reportId,
  fromMonth: "2026-10",
  toMonth: "2026-10",
  to: "boss@example.com",
};
const entry = {
  uid: "worker",
  date: "2026-10-29",
  dayOff: false,
  morningIn: "09:00",
  morningOut: "13:30",
  eveningIn: "22:00",
  eveningOut: "01:00",
  hourlyRate: 10,
  totalMinutes: 999,
  totalPay: 9999,
  updatedAt: 1,
};
async function seed() {
  const batch = db.batch();
  batch.set(db.doc("users/worker"), {
    uid: "worker",
    role: "employee",
    email: "worker@example.com",
    hourlyRate: 10,
    employerUid: "boss",
  });
  batch.set(db.doc("users/boss"), {
    uid: "boss",
    role: "employer",
    email: "boss@example.com",
  });
  batch.set(db.doc("employers/boss"), { uid: "boss", code: "OLDCODE1" });
  batch.set(db.doc("codes/OLDCODE1"), { employerUid: "boss" });
  batch.set(db.doc("users/worker/entries/2026-10-29"), entry);
  await batch.commit();
}
test.before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules: fs.readFileSync("firestore.rules", "utf8") },
    storage: { rules: fs.readFileSync("storage.rules", "utf8") },
  });
  initializeApp({ projectId });
  db = getFirestore();
});
test.beforeEach(async () => {
  await environment.clearFirestore();
  await environment.clearStorage();
  clock = Date.parse("2026-11-08T12:00:00Z");
  deliveries = [];
  users = new Map(
    ["worker", "boss", "other"].map((uid) => [
      uid,
      { uid, email: `${uid}@example.com`, emailVerified: true },
    ]),
  );
  service = createService({
    db,
    auth: { getUser: async (uid) => users.get(uid) },
    from: "app@example.com",
    now: () => clock,
    sendMail: async (mail) => deliveries.push(mail),
  });
  await seed();
});
test.after(async () => {
  await environment.cleanup();
  await deleteApp(getApp());
});
test("client cannot promote role, change employer, forge approval or enumerate codes", async () => {
  const worker = environment.authenticatedContext("worker").firestore();
  await assertFails(
    updateDoc(doc(worker, "users/worker"), { role: "employer" }),
  );
  await assertFails(
    updateDoc(doc(worker, "users/worker"), { employerUid: "other" }),
  );
  await assertFails(getDoc(doc(worker, "codes/OLDCODE1")));
  await assertFails(
    setDoc(doc(worker, "codes/OLDCODE1"), { employerUid: "worker" }),
  );
  await assertFails(
    setDoc(doc(worker, "employers/boss/submissions/forged"), {
      workerUid: "worker",
    }),
  );
  await assertFails(
    setDoc(doc(worker, "users/worker/submissions/forged"), {
      status: "approved",
    }),
  );
  await assertFails(
    getDoc(
      doc(environment.unauthenticatedContext().firestore(), "users/worker"),
    ),
  );
  await assertSucceeds(
    updateDoc(doc(worker, "users/worker"), { hourlyRate: 0 }),
  );
});
test("legacy employer bootstrap preserves valid code and registration retry preserves existing role", async () => {
  const result = await service.ensureProfile(
    { role: "employee" },
    context("boss"),
  );
  assert.equal(result.role, "employer");
  assert.equal(result.code, "OLDCODE1");
  assert.equal((await db.doc("codes/OLDCODE1").get()).data().managed, true);
  const retry = await service.ensureProfile(
    { role: "employer" },
    context("worker"),
  );
  assert.equal(retry.role, "employee");
  assert.equal((await db.doc("users/worker").get()).data().employerUid, "boss");
});
test("new employer creation is retryable and code collision fails closed", async () => {
  users.set("newboss", {
    uid: "newboss",
    email: "newboss@example.com",
    emailVerified: true,
  });
  const one = await service.ensureProfile(
    { role: "employer" },
    context("newboss"),
  );
  const two = await service.ensureProfile(
    { role: "employer" },
    context("newboss"),
  );
  assert.equal(one.code, two.code);
  assert.match(one.code, /^[A-F0-9]{16}$/);
  await db.doc("codes/OLDCODE1").set({ employerUid: "intruder" });
  await assert.rejects(
    service.ensureProfile({}, context("boss")),
    (error) => error.code === "failed-precondition",
  );
});
test("link employer validates code ownership and applies a transactional throttle", async () => {
  await db.doc("users/worker").update({ employerUid: FieldValue.delete() });
  await service.linkEmployer({ code: "oldcode1" }, context("worker"));
  assert.equal((await db.doc("users/worker").get()).data().employerUid, "boss");
  await assert.rejects(
    service.linkEmployer({ code: "OLDCODE1" }, context("worker")),
    (error) => error.code === "resource-exhausted",
  );
  clock += 4000;
  await db.doc("employers/boss").update({ code: "DIFFERENT" });
  await assert.rejects(
    service.linkEmployer({ code: "OLDCODE1" }, context("worker")),
    (error) => error.code === "not-found",
  );
});
test("submission uses saved shifts, creates immutable copies and sends one canonical PDF", async () => {
  const result = await service.sendTimesheet(
    { ...payload, totalMinutes: 1, pdfBase64: "untrusted" },
    context("worker"),
  );
  assert.equal(result.emailStatus, "sent");
  assert.equal(deliveries.length, 1);
  assert.equal(
    deliveries[0].attachments[0].content.subarray(0, 5).toString(),
    "%PDF-",
  );
  const saved = (
    await db.doc(`employers/boss/submissions/${reportId}`).get()
  ).data();
  assert.equal(saved.totalMinutes, 450);
  assert.equal(saved.totalPay, 75);
  assert.equal(saved.entries.length, 1);
  await db
    .doc("users/worker/entries/2026-10-29")
    .update({ morningOut: "14:30" });
  assert.equal(
    (await db.doc(`users/worker/submissions/${reportId}`).get()).data()
      .totalMinutes,
    450,
  );
  const download = await service.getSubmissionReport(
    { submissionId: reportId },
    context("boss"),
  );
  assert.ok(download.pdfBase64.startsWith("JVBER"));
  await assert.rejects(
    service.getSubmissionReport({ submissionId: reportId }, context("other")),
    (error) => error.code === "not-found",
  );
});
test("concurrent identical requests send exactly once and retries return existing result", async () => {
  const results = await Promise.all([
    service.sendTimesheet(payload, context("worker")),
    service.sendTimesheet(payload, context("worker")),
  ]);
  assert.equal(deliveries.length, 1);
  assert.equal(results[0].submissionId, results[1].submissionId);
  await service.sendTimesheet(payload, context("worker"));
  assert.equal(deliveries.length, 1);
  await assert.rejects(
    service.sendTimesheet(
      { ...payload, to: "other@example.com" },
      context("worker"),
    ),
    (error) => error.code === "already-exists",
  );
});
test("employer-only approval updates worker receipt and rejects conflicting decisions", async () => {
  await service.sendTimesheet(payload, context("worker"));
  await assert.rejects(
    service.updateSubmissionStatus(
      { submissionId: reportId, status: "approved" },
      context("worker"),
    ),
    (error) => error.code === "permission-denied",
  );
  await service.updateSubmissionStatus(
    { submissionId: reportId, status: "approved" },
    context("boss"),
  );
  await service.updateSubmissionStatus(
    { submissionId: reportId, status: "approved" },
    context("boss"),
  );
  assert.equal(
    (await db.doc(`users/worker/submissions/${reportId}`).get()).data().status,
    "approved",
  );
  await assert.rejects(
    service.updateSubmissionStatus(
      { submissionId: reportId, status: "rejected" },
      context("boss"),
    ),
    (error) => error.code === "failed-precondition",
  );
  const worker = environment.authenticatedContext("worker").firestore();
  const boss = environment.authenticatedContext("boss").firestore();
  const other = environment.authenticatedContext("other").firestore();
  await assertSucceeds(
    getDoc(doc(worker, `users/worker/submissions/${reportId}`)),
  );
  await assertSucceeds(
    getDoc(doc(boss, `employers/boss/submissions/${reportId}`)),
  );
  await assertFails(
    getDoc(doc(other, `employers/boss/submissions/${reportId}`)),
  );
  await assertFails(
    updateDoc(doc(boss, `employers/boss/submissions/${reportId}`), {
      status: "pending",
    }),
  );
});
test("SMTP failure preserves dashboard and receipt, without automatic duplicate delivery", async () => {
  let attempts = 0;
  service = createService({
    db,
    auth: { getUser: async (uid) => users.get(uid) },
    from: "app@example.com",
    now: () => clock,
    sendMail: async () => {
      attempts++;
      throw Object.assign(new Error("secret smtp detail"), {
        code: "TEST_FAILURE",
      });
    },
  });
  const result = await service.sendTimesheet(payload, context("worker"));
  assert.equal(result.emailStatus, "failed");
  assert.equal(
    (await db.doc(`employers/boss/submissions/${reportId}`).get()).data()
      .status,
    "pending",
  );
  await service.sendTimesheet(payload, context("worker"));
  assert.equal(attempts, 1);
});
test("unverified user, invalid date, incomplete shift and wrong recipient are rejected", async () => {
  await assert.rejects(
    service.sendTimesheet(payload, {}),
    (error) => error.code === "unauthenticated",
  );
  users.get("worker").emailVerified = false;
  await assert.rejects(
    service.sendTimesheet(payload, context("worker")),
    (error) => error.code === "failed-precondition",
  );
  users.get("worker").emailVerified = true;
  await assert.rejects(
    service.sendTimesheet(
      { ...payload, fromMonth: "2025-01" },
      context("worker"),
    ),
    (error) => error.code === "invalid-argument",
  );
  await assert.rejects(
    service.sendTimesheet(
      { ...payload, to: "boss@example.com\nBCC: x@y.com" },
      context("worker"),
    ),
    (error) => error.code === "invalid-argument",
  );
  await assert.rejects(
    service.sendTimesheet(
      { ...payload, to: "stranger@example.com" },
      context("worker"),
    ),
    (error) => error.code === "failed-precondition",
  );
  await db.doc("users/worker/entries/2026-10-29").update({ morningOut: null });
  await assert.rejects(
    service.sendTimesheet(payload, context("worker")),
    (error) => error.code === "failed-precondition",
  );
});
test("rate limits enforce five sends per UTC day and zero pay is hidden in saved report", async () => {
  await db.doc("users/worker").update({ hourlyRate: 0 });
  for (let index = 0; index < 5; index++) {
    await service.sendTimesheet(
      { ...payload, requestId: `request_${index}` },
      context("worker"),
    );
    clock += 61000;
  }
  assert.equal(deliveries.length, 5);
  assert.equal(
    (await db.doc("users/worker/submissions/request_0").get()).data().totalPay,
    0,
  );
  await assert.rejects(
    service.sendTimesheet(
      { ...payload, requestId: "request_6" },
      context("worker"),
    ),
    (error) => error.code === "resource-exhausted",
  );
});
test("storage denies other users and backups, allows owner PDF creation but not overwrite", async () => {
  const worker = environment.authenticatedContext("worker").storage();
  const other = environment.authenticatedContext("other").storage();
  const path = "users/worker/reports/security-test.pdf";
  const file = ref(worker, path);
  await assertSucceeds(
    uploadBytes(file, Buffer.from("%PDF-test"), {
      contentType: "application/pdf",
    }),
  );
  await assertFails(
    uploadBytes(file, Buffer.from("%PDF-overwrite"), {
      contentType: "application/pdf",
    }),
  );
  await assertFails(getBytes(ref(other, path)));
  await assertFails(
    uploadBytes(ref(worker, "backups/test.pdf"), Buffer.from("x"), {
      contentType: "application/pdf",
    }),
  );
  await assertFails(
    uploadBytes(
      ref(worker, "users/worker/reports/script.pdf"),
      Buffer.from("x"),
      { contentType: "text/html" },
    ),
  );
});
test("per-worker send limit can be configured without limiting the company total", async () => {
  service = createService({
    db,
    auth: { getUser: async (uid) => users.get(uid) },
    from: "app@example.com",
    now: () => clock,
    limits: { dailySendLimit: 10, sendCooldownSeconds: 2 },
    sendMail: async (mail) => deliveries.push(mail),
  });
  for (let index = 0; index < 6; index++) {
    await service.sendTimesheet(
      { ...payload, requestId: `custom_request_${index}` },
      context("worker"),
    );
    clock += 3000;
  }
  assert.equal(deliveries.length, 6);
});
test("legacy totalHours survives merge saves but cannot be added or changed by clients", async () => {
  const worker = environment.authenticatedContext("worker").firestore();
  const legacyPath = "users/worker/entries/2026-10-29";
  await db.doc(legacyPath).update({ totalHours: 7.5 });
  await assertSucceeds(setDoc(doc(worker, legacyPath), {
    ...entry, totalMinutes: 450, totalPay: 75,
  }, { merge: true }));
  assert.equal((await db.doc(legacyPath).get()).data().totalHours, 7.5);
  await assertFails(updateDoc(doc(worker, legacyPath), { totalHours: 99 }));
  await assertFails(setDoc(doc(worker, "users/worker/entries/2026-10-30"), {
    ...entry, date: "2026-10-30", totalMinutes: 450, totalPay: 75, totalHours: 7.5,
  }));
});

test("owner may save daily/monthly entry and rate atomically, other clients cannot read it", async () => {
  const worker = environment.authenticatedContext("worker").firestore();
  const { writeBatch } = require("firebase/firestore");
  const batch = writeBatch(worker);
  batch.set(doc(worker, "users/worker/entries/2026-10-30"), {
    ...entry,
    date: "2026-10-30",
    totalMinutes: 450,
    totalPay: 75,
  });
  batch.update(doc(worker, "users/worker"), { hourlyRate: 10 });
  await assertSucceeds(batch.commit());
  await assertSucceeds(getDoc(doc(worker, "users/worker/entries/2026-10-30")));
  await assertFails(
    getDoc(
      doc(
        environment.authenticatedContext("boss").firestore(),
        "users/worker/entries/2026-10-30",
      ),
    ),
  );
});
