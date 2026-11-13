"use strict";

const { randomBytes } = require("node:crypto");
const PDFDocument = require("pdfkit");
const { HttpsError } = require("firebase-functions/v1/https");

function fail(code, message) {
  throw new HttpsError(code, message);
}
function requireUser(context) {
  if (!context.auth) fail("unauthenticated", "Accedi per continuare.");
  return context.auth.uid;
}
function identifier(value, label = "ID") {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{8,100}$/.test(value)) {
    fail("invalid-argument", `${label} non valido.`);
  }
  return value;
}
function emailAddress(value) {
  if (
    typeof value !== "string" ||
    value.length > 254 ||
    !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(value)
  ) {
    fail("invalid-argument", "Indirizzo email non valido.");
  }
  return value.trim().toLowerCase();
}
function monthRange(fromMonth, toMonth) {
  const valid = (value) =>
    typeof value === "string" && /^(20\d{2})-(0[1-9]|1[0-2])$/.test(value);
  if (!valid(fromMonth) || !valid(toMonth))
    fail("invalid-argument", "Seleziona mesi validi (2000–2099).");
  const [fy, fm] = fromMonth.split("-").map(Number);
  const [ty, tm] = toMonth.split("-").map(Number);
  const length = (ty - fy) * 12 + tm - fm + 1;
  if (length < 1 || length > 12)
    fail("invalid-argument", "Seleziona un intervallo di massimo 12 mesi.");
  return {
    start: `${fromMonth}-01`,
    end: `${toMonth}-${new Date(ty, tm, 0).getDate()}`,
  };
}
function shiftMinutes(start, end) {
  if (!start && !end) return 0;
  const valid = (value) =>
    typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (!valid(start) || !valid(end))
    fail(
      "failed-precondition",
      "Un turno salvato ha orari incompleti o non validi. Correggilo prima di inviare.",
    );
  const minutes = (value) =>
    Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  return (minutes(end) - minutes(start) + 1440) % 1440;
}
function snapshotEntries(documents, hidePay) {
  if (!documents.length || documents.length > 366)
    fail(
      "failed-precondition",
      "Nessun turno disponibile o intervallo troppo ampio.",
    );
  return documents.map((document) => {
    const value = document.data();
    if (
      !/^20\d{2}-\d{2}-\d{2}$/.test(document.id) ||
      new Date(`${document.id}T00:00:00Z`).toISOString().slice(0, 10) !==
        document.id
    ) {
      fail("failed-precondition", "Data salvata non valida.");
    }
    const minutes = value.dayOff
      ? 0
      : shiftMinutes(value.morningIn, value.morningOut) +
        shiftMinutes(value.eveningIn, value.eveningOut);
    if (minutes > 1440)
      fail(
        "failed-precondition",
        "Un giorno supera le 24 ore. Controlla i turni.",
      );
    const rate = value.hourlyRate ?? 0;
    if (
      typeof rate !== "number" ||
      !Number.isFinite(rate) ||
      rate < 0 ||
      rate > 10000
    )
      fail("failed-precondition", "Paga salvata non valida.");
    return {
      date: document.id,
      dayOff: !!value.dayOff,
      morningIn: value.morningIn || "",
      morningOut: value.morningOut || "",
      eveningIn: value.eveningIn || "",
      eveningOut: value.eveningOut || "",
      totalMinutes: minutes,
      totalPay: hidePay ? 0 : (minutes / 60) * rate,
    };
  });
}
function hours(minutes) {
  return `${Math.floor(minutes / 60)}.${String(minutes % 60).padStart(2, "0")}`;
}
function reportPDF(report) {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: "A4", margin: 40 });
    const chunks = [];
    pdf.on("data", (chunk) => chunks.push(chunk));
    pdf.on("error", reject);
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.fontSize(18).text("AlleOClockCalc - Report ore");
    pdf.fontSize(10).text(report.workerEmail);
    pdf.text(`${report.fromMonth} - ${report.toMonth}`);
    pdf.text(`Invio ${report.id}`);
    pdf.moveDown();
    for (const entry of report.entries) {
      if (pdf.y > 740) pdf.addPage();
      const shifts = entry.dayOff
        ? "Riposo"
        : `${entry.morningIn || "-"} / ${entry.morningOut || "-"}   ${entry.eveningIn || "-"} / ${entry.eveningOut || "-"}`;
      pdf.text(
        `${entry.date}    ${shifts}    ${hours(entry.totalMinutes)}${report.hidePay ? "" : `    EUR ${entry.totalPay.toFixed(2)}`}`,
      );
    }
    pdf.moveDown().text(`Totale ore: ${hours(report.totalMinutes)}`);
    if (!report.hidePay) pdf.text(`Totale EUR: ${report.totalPay.toFixed(2)}`);
    pdf.end();
  });
}

function createService({
  db,
  auth,
  sendMail,
  from,
  now = Date.now,
  limits = {},
}) {
  const dailySendLimit = Number(
    limits.dailySendLimit ?? process.env.MAIL_DAILY_LIMIT_PER_USER ?? 5,
  );
  const sendCooldownMs =
    Number(
      limits.sendCooldownSeconds ??
        process.env.MAIL_SEND_COOLDOWN_SECONDS ??
        60,
    ) * 1000;
  if (
    !Number.isInteger(dailySendLimit) ||
    dailySendLimit < 1 ||
    dailySendLimit > 1000 ||
    !Number.isFinite(sendCooldownMs) ||
    sendCooldownMs < 1000 ||
    sendCooldownMs > 3600000
  ) {
    throw new Error("Invalid mail rate-limit configuration");
  }
  // Transactions make the quota shared across instances and concurrent requests.
  async function consumeQuota(uid, kind, limit, cooldownMs) {
    const reference = db.doc(`operationLimits/${uid}_${kind}`);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const value = snapshot.data() || {};
      const time = now();
      const day = new Date(time).toISOString().slice(0, 10);
      const count = value.day === day ? value.count || 0 : 0;
      if (count >= limit || (value.lastAt && time - value.lastAt < cooldownMs))
        fail(
          "resource-exhausted",
          "Troppe richieste. Attendi prima di riprovare.",
        );
      transaction.set(reference, { day, count: count + 1, lastAt: time });
    });
  }

  async function ensureProfile(data, context) {
    const uid = requireUser(context);
    const user = await auth.getUser(uid);
    const requestedRole = data?.role || "employee";
    if (!["employee", "employer"].includes(requestedRole))
      fail("invalid-argument", "Ruolo non valido.");
    const profileRef = db.doc(`users/${uid}`);
    const employerRef = db.doc(`employers/${uid}`);
    const candidateCode = randomBytes(8).toString("hex").toUpperCase();
    return db.runTransaction(async (transaction) => {
      const profile = await transaction.get(profileRef);
      const role = profile.exists
        ? profile.data().role || "employee"
        : requestedRole;
      if (!["employee", "employer"].includes(role))
        fail("failed-precondition", "Profilo da verificare con assistenza.");
      let code = null;
      if (role === "employer") {
        const employer = await transaction.get(employerRef);
        const legacyCode = employer.data()?.code;
        code =
          typeof legacyCode === "string" && /^[A-Z0-9]{6,32}$/.test(legacyCode)
            ? legacyCode
            : candidateCode;
        const codeRef = db.doc(`codes/${code}`);
        const owner = await transaction.get(codeRef);
        if (owner.exists && owner.data().employerUid !== uid) {
          fail(
            "failed-precondition",
            "Codice datore in conflitto: richiedi una verifica prima di migrare.",
          );
        }
        transaction.set(
          employerRef,
          { uid, code, createdAt: employer.data()?.createdAt || now() },
          { merge: true },
        );
        transaction.set(codeRef, { employerUid: uid, managed: true });
      }
      transaction.set(
        profileRef,
        {
          uid,
          email: user.email || "",
          role,
          createdAt: profile.data()?.createdAt || now(),
          managed: true,
        },
        { merge: true },
      );
      return { role, code };
    });
  }

  async function linkEmployer(data, context) {
    const uid = requireUser(context);
    const code = String(data?.code || "")
      .trim()
      .toUpperCase();
    if (!/^[A-Z0-9]{6,32}$/.test(code))
      fail("invalid-argument", "Codice datore non valido.");
    await consumeQuota(uid, "link", 20, 3000);
    return db.runTransaction(async (transaction) => {
      const profileRef = db.doc(`users/${uid}`);
      const profile = await transaction.get(profileRef);
      const mapping = await transaction.get(db.doc(`codes/${code}`));
      if (!profile.exists || profile.data().role !== "employee")
        fail(
          "permission-denied",
          "Solo un lavoratore può collegarsi a un datore.",
        );
      const employerUid = mapping.data()?.employerUid;
      if (!employerUid || employerUid === uid)
        fail("not-found", "Codice datore non valido.");
      const employer = await transaction.get(
        db.doc(`employers/${employerUid}`),
      );
      const employerProfile = await transaction.get(
        db.doc(`users/${employerUid}`),
      );
      if (
        employer.data()?.code !== code ||
        employerProfile.data()?.role !== "employer"
      )
        fail("not-found", "Codice datore non valido.");
      transaction.update(profileRef, { employerUid, updatedAt: now() });
      return { ok: true };
    });
  }

  async function sendTimesheet(data, context) {
    const uid = requireUser(context);
    const requestId = identifier(data?.requestId, "Identificativo invio");
    const { fromMonth, toMonth } = data || {};
    const { start, end } = monthRange(fromMonth, toMonth);
    const recipient = emailAddress(data?.to);
    const worker = await auth.getUser(uid);
    if (!worker.email || !worker.emailVerified)
      fail(
        "failed-precondition",
        "Verifica il tuo indirizzo email dalla pagina iniziale e accedi nuovamente prima di inviare.",
      );
    const reference = db.doc(`users/${uid}/submissions/${requestId}`);
    // An existing request is returned without sending another email, even after a timeout.
    const result = await db.runTransaction(async (transaction) => {
      const previous = await transaction.get(reference);
      if (previous.exists) {
        const value = previous.data();
        if (
          value.fromMonth !== fromMonth ||
          value.toMonth !== toMonth ||
          value.to !== recipient
        )
          fail(
            "already-exists",
            "Identificativo invio già usato per un altro report.",
          );
        return { report: value, existing: true };
      }
      const profile = await transaction.get(db.doc(`users/${uid}`));
      if (!profile.exists || profile.data().role !== "employee")
        fail("permission-denied", "Profilo lavoratore richiesto.");
      const employerUid = profile.data().employerUid || null;
      if (employerUid) {
        const employer = await transaction.get(db.doc(`users/${employerUid}`));
        if (
          employer.data()?.role !== "employer" ||
          employer.data()?.email?.toLowerCase() !== recipient
        ) {
          fail(
            "failed-precondition",
            "Usa l’email dell’account datore collegato oppure aggiorna il collegamento.",
          );
        }
      }
      const entries = await transaction.get(
        db
          .collection(`users/${uid}/entries`)
          .where("date", ">=", start)
          .where("date", "<=", end)
          .orderBy("date"),
      );
      const hidePay = !(profile.data().hourlyRate > 0);
      const rows = snapshotEntries(entries.docs, hidePay);
      const quotaRef = db.doc(`operationLimits/${uid}_send`);
      const quota = (await transaction.get(quotaRef)).data() || {};
      const time = now();
      const day = new Date(time).toISOString().slice(0, 10);
      const count = quota.day === day ? quota.count || 0 : 0;
      if (
        count >= dailySendLimit ||
        (quota.lastAt && time - quota.lastAt < sendCooldownMs)
      )
        fail(
          "resource-exhausted",
          `Limite per lavoratore: ${dailySendLimit} invii al giorno, attesa ${sendCooldownMs / 1000} secondi tra invii.`,
        );
      const report = {
        id: requestId,
        workerUid: uid,
        workerEmail: worker.email,
        employerUid,
        fromMonth,
        toMonth,
        to: recipient,
        entries: rows,
        hidePay,
        totalMinutes: rows.reduce((sum, row) => sum + row.totalMinutes, 0),
        totalPay:
          Math.round(rows.reduce((sum, row) => sum + row.totalPay, 0) * 100) /
          100,
        status: "pending",
        createdAt: time,
        updatedAt: time,
        emailStatus: "sending",
        schemaVersion: 2,
      };
      transaction.set(quotaRef, { day, count: count + 1, lastAt: time });
      transaction.create(reference, report);
      if (employerUid)
        transaction.create(
          db.doc(`employers/${employerUid}/submissions/${requestId}`),
          report,
        );
      return { report, existing: false };
    });
    if (result.existing)
      return {
        ok: true,
        submissionId: requestId,
        emailStatus: result.report.emailStatus,
        employerLinked: !!result.report.employerUid,
      };
    let emailStatus = "sent";
    try {
      const pdf = await reportPDF(result.report);
      await sendMail({
        from,
        to: recipient,
        subject: "AlleOClockCalc - Report ore",
        text: `Report di ${worker.email}, periodo ${fromMonth} - ${toMonth}. Invio ${requestId}.`,
        attachments: [
          {
            filename: "alleoclockcalc-report.pdf",
            content: pdf,
            contentType: "application/pdf",
          },
        ],
      });
    } catch (error) {
      // Never disclose SMTP errors, credentials or provider internals to the client.
      emailStatus = "failed";
      console.error("Timesheet delivery failed", {
        code: String(error.code || "unknown"),
      });
    }
    const batch = db.batch();
    batch.update(reference, { emailStatus });
    if (result.report.employerUid)
      batch.update(
        db.doc(
          `employers/${result.report.employerUid}/submissions/${requestId}`,
        ),
        { emailStatus },
      );
    await batch.commit();
    return {
      ok: true,
      submissionId: requestId,
      emailStatus,
      employerLinked: !!result.report.employerUid,
    };
  }

  async function getSubmissionReport(data, context) {
    const uid = requireUser(context);
    const id = identifier(data?.submissionId, "Invio");
    await consumeQuota(uid, "download", 100, 500);
    let snapshot = await db.doc(`users/${uid}/submissions/${id}`).get();
    if (!snapshot.exists)
      snapshot = await db.doc(`employers/${uid}/submissions/${id}`).get();
    if (!snapshot.exists) fail("not-found", "Report non disponibile.");
    const report = snapshot.data();
    if (report.schemaVersion !== 2 || !Array.isArray(report.entries))
      fail(
        "failed-precondition",
        "Report precedente alla revisione: usa il collegamento storico, se presente.",
      );
    return { pdfBase64: (await reportPDF(report)).toString("base64") };
  }

  async function updateSubmissionStatus(data, context) {
    const uid = requireUser(context);
    const id = identifier(data?.submissionId, "Invio");
    const status = data?.status;
    if (!["approved", "rejected"].includes(status))
      fail("invalid-argument", "Stato non valido.");
    const decision = await db.runTransaction(async (transaction) => {
      const employer = await transaction.get(db.doc(`users/${uid}`));
      const reference = db.doc(`employers/${uid}/submissions/${id}`);
      const snapshot = await transaction.get(reference);
      if (employer.data()?.role !== "employer")
        fail("permission-denied", "Solo il datore può approvare.");
      if (!snapshot.exists) fail("not-found", "Invio non trovato.");
      const report = snapshot.data();
      if (report.status === status) return null;
      if ((report.status || "pending") !== "pending")
        fail("failed-precondition", "Report già valutato. Aggiorna la pagina.");
      let receipt;
      if (report.schemaVersion === 2) {
        receipt = db.doc(`users/${report.workerUid}/submissions/${id}`);
        const original = await transaction.get(receipt);
        if (!original.exists || original.data().employerUid !== uid)
          fail(
            "failed-precondition",
            "Invio non coerente: richiedi assistenza.",
          );
      }
      const change = {
        status,
        updatedAt: now(),
        decisionEmailStatus: receipt ? "sending" : "not-applicable",
      };
      transaction.update(reference, change);
      if (receipt) transaction.update(receipt, change);
      return receipt ? report : null;
    });
    let decisionEmailStatus = null;
    if (decision) {
      decisionEmailStatus = "sent";
      try {
        const worker = await auth.getUser(decision.workerUid);
        if (!worker?.email) throw new Error("Worker email unavailable");
        await sendMail({
          from,
          to: worker.email,
          subject: "AlleOClockCalc - Esito report",
          text: `Il report ${decision.fromMonth} - ${decision.toMonth} è stato ${status === "approved" ? "approvato" : "rifiutato"}. Invio ${id}.`,
        });
      } catch (error) {
        decisionEmailStatus = "failed";
        console.error("Decision notification failed", {
          code: String(error.code || "unknown"),
        });
      }
      const batch = db.batch();
      batch.update(db.doc(`employers/${uid}/submissions/${id}`), {
        decisionEmailStatus,
      });
      batch.update(db.doc(`users/${decision.workerUid}/submissions/${id}`), {
        decisionEmailStatus,
      });
      await batch.commit();
    }
    return { ok: true, decisionEmailStatus };
  }

  return {
    ensureProfile,
    linkEmployer,
    sendTimesheet,
    getSubmissionReport,
    updateSubmissionStatus,
  };
}
module.exports = {
  createService,
  monthRange,
  shiftMinutes,
  snapshotEntries,
  reportPDF,
};
