import {
  auth,
  db,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "./app.js";
import {
  httpsCallable,
  fns,
  storage,
  ref,
  uploadString,
  getBlob,
} from "./app.js";
import { showLoader, hideLoader, showError, showToast } from "./ui.js";
import { diffMinutes, minutesToHM } from "./timeutil.js";
import * as I18N from "./i18n.js";
import { rowsForExport, createCSV } from "./report-utils.mjs";
const fromEl = document.getElementById("fromMonth"),
  toEl = document.getElementById("toMonth");
const btnLoad = document.getElementById("btnLoad"),
  btnPDF = document.getElementById("btnPDF"),
  btnUpload = document.getElementById("btnUpload"),
  btnSend = document.getElementById("btnSend"),
  btnCSV = document.getElementById("btnCSV"),
  btnExcel = document.getElementById("btnExcel");
const employerEmail = document.getElementById("employerEmail");
const rangeHoursEl = document.getElementById("rangeHours"),
  rangePayEl = document.getElementById("rangePay");
const reportTable = document.getElementById("reportTable");
let cacheEntries = [],
  pdfBase64 = null,
  pdfUrl = null,
  pdfStoragePath = null,
  HIDE_PAY = false,
  USER_RATE = 0,
  loadedRange = null,
  loadVersion = 0,
  sendRequestId = null;
function invalidatePDF() {
  pdfBase64 = null;
  pdfUrl = null;
  pdfStoragePath = null;
}
function invalidateRange() {
  loadVersion++;
  sendRequestId = null;
  invalidatePDF();
  loadedRange = null;
  cacheEntries = [];
  reportTable.textContent = "Seleziona Carica dati per questo intervallo.";
}
fromEl.addEventListener("change", invalidateRange);
toEl.addEventListener("change", invalidateRange);
function rangeIsReady() {
  let start, end;
  try {
    ({ start, end } = ymRange());
  } catch (error) {
    showError(error.message);
    return false;
  }
  if (loadedRange !== `${start}:${end}` || !cacheEntries.length) {
    showError("Carica prima i dati per l’intervallo selezionato.");
    return false;
  }
  return true;
}
function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}
function ymRange() {
  const valid = (value) => /^(20\d{2})-(0[1-9]|1[0-2])$/.test(value);
  if (!valid(fromEl.value) || !valid(toEl.value))
    throw new Error("Seleziona mesi validi.");
  const [fy, fm] = fromEl.value.split("-").map(Number),
    [ty, tm] = toEl.value.split("-").map(Number);
  const length = (ty - fy) * 12 + tm - fm + 1;
  if (length < 1 || length > 12)
    throw new Error("Seleziona un intervallo di massimo 12 mesi.");
  return {
    start: `${fromEl.value}-01`,
    end: `${toEl.value}-${new Date(ty, tm, 0).getDate()}`,
  };
}
function ensureMinutes(e) {
  if (e.totalMinutes != null) return e.totalMinutes;
  let m = 0;
  if (!e.dayOff) {
    m += diffMinutes(e.morningIn, e.morningOut);
    m += diffMinutes(e.eveningIn, e.eveningOut);
  }
  return m;
}
function render(entries) {
  const t = (k) => I18N.t(k);
  if (!entries.length) {
    reportTable.innerHTML = `<p>${t("no_data")}</p>`;
    rangeHoursEl.textContent = "0.00";
    rangePayEl.textContent = "0.00";
    return;
  }
  const groups = Object.create(null);
  let M = 0,
    P = 0;
  for (const e of entries) {
    const ym = e.date.slice(0, 7);
    (groups[ym] ??= []).push(e);
    const mins = ensureMinutes(e);
    M += mins;
    P += Number(e.totalPay || 0);
  }
  rangeHoursEl.textContent = minutesToHM(M);
  rangePayEl.parentElement.style.display = HIDE_PAY ? "none" : "block";
  rangePayEl.textContent = P.toFixed(2);
  let html = "";
  Object.keys(groups)
    .sort()
    .forEach((m) => {
      const [y, mm] = m.split("-").map(Number);
      const monthName = new Date(y, mm - 1, 1).toLocaleString(
        I18N.currentLang() || "it",
        { month: "long", year: "numeric" },
      );
      const rows = groups[m]
        .map((e) => {
          const mins = ensureMinutes(e);
          const cols = [
            e.date,
            e.morningIn || "-",
            e.morningOut || "-",
            e.eveningIn || "-",
            e.eveningOut || "-",
            minutesToHM(mins),
          ];
          if (!HIDE_PAY) cols.push(`€ ${Number(e.totalPay || 0).toFixed(2)}`);
          return `<tr>${cols.map((c) => `<td>${escapeHTML(c)}</td>`).join("")}</tr>`;
        })
        .join("");
      const mh = groups[m].reduce((s, x) => s + ensureMinutes(x), 0),
        mp = groups[m].reduce((s, x) => s + Number(x.totalPay || 0), 0);
      html += `<div class="box"><h3>${monthName}</h3><table class="table"><thead><tr><th>Date</th><th>M IN</th><th>M OUT</th><th>E IN</th><th>E OUT</th><th>${I18N.t("th_hours")}</th>${HIDE_PAY ? "" : "<th>€</th>"}</tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="5" style="text-align:right">${I18N.t("month_total")}</th><th>${minutesToHM(mh)}</th>${HIDE_PAY ? "" : `<th>€ ${mp.toFixed(2)}</th>`}</tr></tfoot></table></div>`;
    });
  reportTable.innerHTML = html;
}
async function loadData() {
  const user = auth.currentUser;
  if (!user) return;
  const version = ++loadVersion;
  loadedRange = null;
  invalidatePDF();
  sendRequestId = null;
  showLoader();
  try {
    const { start, end } = ymRange();
    const profile = await getDoc(doc(db, `users/${user.uid}`));
    const results = await getDocs(
      query(
        collection(db, `users/${user.uid}/entries`),
        where("date", ">=", start),
        where("date", "<=", end),
        orderBy("date", "asc"),
      ),
    );
    if (
      version !== loadVersion ||
      !auth.currentUser ||
      auth.currentUser.uid !== user.uid
    )
      return;
    USER_RATE = profile.data()?.hourlyRate || 0;
    HIDE_PAY = USER_RATE <= 0;
    cacheEntries = results.docs.map((document) => document.data());
    loadedRange = `${start}:${end}`;
    render(cacheEntries);
    showToast("Dati caricati");
  } catch (error) {
    if (version === loadVersion) showError(error.message);
  } finally {
    hideLoader();
  }
}
function genPDF() {
  if (!rangeIsReady()) return;
  if (!window.jspdf?.jsPDF) {
    showError("Libreria PDF non caricata. Controlla la connessione.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFontSize(16);
  doc.text("AlleOClockCalc - Hours report", 40, 40);
  const { start, end } = ymRange();
  doc.setFontSize(10);
  doc.text(`${I18N.t("from")} ${start} ${I18N.t("to")} ${end}`, 40, 60);
  const head = HIDE_PAY
    ? [
        [
          I18N.t("date") || "Date",
          "M IN",
          "M OUT",
          "E IN",
          "E OUT",
          I18N.t("th_hours") || "Hours",
        ],
      ]
    : [
        [
          I18N.t("date") || "Date",
          "M IN",
          "M OUT",
          "E IN",
          "E OUT",
          I18N.t("th_hours") || "Hours",
          "€",
        ],
      ];
  const body = cacheEntries.map((e) => {
    const mins = ensureMinutes(e);
    const row = [
      e.date,
      e.morningIn || "-",
      e.morningOut || "-",
      e.eveningIn || "-",
      e.eveningOut || "-",
      minutesToHM(mins),
    ];
    if (!HIDE_PAY) row.push(Number(e.totalPay || 0).toFixed(2));
    return row;
  });
  doc.autoTable({ startY: 80, head: head, body });
  const M = cacheEntries.reduce((s, x) => s + ensureMinutes(x), 0),
    P = cacheEntries.reduce((s, x) => s + Number(x.totalPay || 0), 0);
  let y = doc.lastAutoTable.finalY + 24;
  if (y > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage();
    y = 40;
  }
  doc.text(
    `${I18N.t("totals")} — ${I18N.t("th_hours") || "Hours"}: ${minutesToHM(M)}${HIDE_PAY ? "" : ` | € ${P.toFixed(2)}`}`,
    40,
    y,
  );
  const dataUri = doc.output("datauristring");
  pdfBase64 = dataUri.split(",")[1];
  doc.save("alleoclockcalc-report.pdf");
  showToast("PDF generato ✅");
}
async function uploadPDF() {
  if (!rangeIsReady()) return;
  if (!pdfBase64) {
    showError("Genera PDF prima");
    return;
  }
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  btnUpload.disabled = true;
  const fn = `report-${Date.now()}.pdf`;
  showLoader();
  try {
    const r = ref(storage, `users/${uid}/reports/${fn}`);
    await uploadString(r, pdfBase64, "base64", {
      contentType: "application/pdf",
    });
    pdfUrl = null;
    pdfStoragePath = r.fullPath;
    const { start, end } = ymRange();
    const M = cacheEntries.reduce((s, x) => s + ensureMinutes(x), 0);
    const P = HIDE_PAY
      ? 0
      : cacheEntries.reduce((s, x) => s + Number(x.totalPay || 0), 0);
    await setDoc(doc(db, `users/${uid}/pdfs/${Date.now()}`), {
      createdAt: Date.now(),
      fromMonth: start.slice(0, 7),
      toMonth: end.slice(0, 7),
      totalMinutes: M,
      totalHoursText: minutesToHM(M),
      totalPay: P,
      pdfUrl,
      storagePath: pdfStoragePath,
    });
    showToast("Caricato su Storage ✅");
  } catch (e) {
    showError(e.message);
  } finally {
    btnUpload.disabled = false;
    hideLoader();
  }
}
async function sendEmail() {
  if (!rangeIsReady() || !auth.currentUser || btnSend.disabled) return;
  const to = employerEmail.value.trim();
  if (!to) {
    showError("Inserisci l’email del destinatario.");
    return;
  }
  sendRequestId ||= crypto.randomUUID();
  btnSend.disabled = true;
  fromEl.disabled = true;
  toEl.disabled = true;
  employerEmail.disabled = true;
  showLoader();
  try {
    const result = await httpsCallable(
      fns,
      "sendTimesheet",
    )({
      requestId: sendRequestId,
      to,
      fromMonth: fromEl.value,
      toMonth: toEl.value,
    });
    const state = result.data.emailStatus;
    showToast(
      state === "sent"
        ? "Report salvato ed email inviata."
        : state === "sending"
          ? "Invio già registrato. La consegna email è ancora da verificare nello storico."
          : "Report salvato, email non consegnata. Controlla lo storico prima di effettuare un nuovo invio.",
      state === "sent" ? "ok" : "warn",
      8000,
    );
    await loadHistory();
  } catch (error) {
    showError(error.message);
  } finally {
    btnSend.disabled = false;
    fromEl.disabled = false;
    toEl.disabled = false;
    employerEmail.disabled = false;
    hideLoader();
  }
}
// Retain the same request ID after network errors; only an explicit new attempt gets a new ID.
employerEmail.addEventListener("input", () => {
  sendRequestId = null;
});
document.getElementById("btnNewSend").addEventListener("click", () => {
  if (
    !btnSend.disabled &&
    confirm(
      "Creare un nuovo invio? Controlla prima lo storico per evitare email duplicate.",
    )
  ) {
    sendRequestId = null;
    showToast("Nuovo invio pronto. Premi Invia quando vuoi procedere.");
  }
});
async function downloadSnapshot(id) {
  const result = await httpsCallable(
    fns,
    "getSubmissionReport",
  )({ submissionId: id });
  const bytes = Uint8Array.from(atob(result.data.pdfBase64), (char) =>
    char.charCodeAt(0),
  );
  const url = URL.createObjectURL(
    new Blob([bytes], { type: "application/pdf" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "alleoclockcalc-report.pdf";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function loadHistory() {
  const user = auth.currentUser;
  if (!user) return;
  const container = document.getElementById("reportHistory");
  container.textContent = "Caricamento…";
  try {
    const documents = await getDocs(
      collection(db, `users/${user.uid}/submissions`),
    );
    container.replaceChildren();
    for (const snapshot of [...documents.docs].sort(
      (a, b) => b.data().createdAt - a.data().createdAt,
    )) {
      const report = snapshot.data();
      const card = document.createElement("div");
      card.className = "box";
      const text = document.createElement("p");
      text.textContent = `${report.fromMonth} → ${report.toMonth} · ${minutesToHM(report.totalMinutes)} ore · ${report.employerUid ? report.status : "Solo email"} · Email: ${report.emailStatus} · ${new Date(report.createdAt).toLocaleString()}`;
      const button = document.createElement("button");
      button.className = "secondary";
      button.textContent = "Scarica copia inviata";
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          await downloadSnapshot(snapshot.id);
        } catch (error) {
          showError(error.message);
        } finally {
          button.disabled = false;
        }
      });
      card.append(text, button);
      container.append(card);
    }
    if (documents.empty)
      container.textContent = "Nessun report inviato con la nuova versione.";
    const legacy = await getDocs(collection(db, `users/${user.uid}/pdfs`));
    for (const snapshot of [...legacy.docs].sort(
      (a, b) => (b.data().createdAt || 0) - (a.data().createdAt || 0),
    )) {
      const item = snapshot.data();
      if (!item.storagePath?.startsWith(`users/${user.uid}/reports/`)) continue;
      const button = document.createElement("button");
      button.className = "secondary";
      button.textContent = `PDF archiviato: ${item.fromMonth || ""} → ${item.toMonth || ""}`;
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          const blob = await getBlob(ref(storage, item.storagePath));
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "alleoclockcalc-report.pdf";
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error) {
          showError(error.message);
        } finally {
          button.disabled = false;
        }
      });
      container.append(button);
    }
  } catch (error) {
    container.textContent = `Storico non disponibile: ${error.message}`;
  }
}
document.getElementById("btnHistory").addEventListener("click", loadHistory);

function exportCSV() {
  if (!rangeIsReady()) return;
  const rows = rowsForExport(cacheEntries, HIDE_PAY);
  const csv = createCSV(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "alleoclockcalc-report.csv";
  a.click();
  URL.revokeObjectURL(url);
  showToast("CSV esportato");
}
async function exportExcel() {
  if (!rangeIsReady()) return;
  if (!window.ExcelJS) {
    showError("Libreria Excel non disponibile.");
    return;
  }
  btnExcel.disabled = true;
  try {
    const workbook = new window.ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Report");
    sheet.addRows(rowsForExport(cacheEntries, HIDE_PAY));
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((column) => {
      column.width = 18;
    });
    const buffer = await workbook.xlsx.writeBuffer();
    const url = URL.createObjectURL(
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "alleoclockcalc-report.xlsx";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Excel esportato");
  } catch (error) {
    showError(`Esportazione Excel non riuscita: ${error.message}`);
  } finally {
    btnExcel.disabled = false;
  }
}
btnLoad.addEventListener("click", loadData);
btnPDF.addEventListener("click", genPDF);
btnUpload.addEventListener("click", uploadPDF);
btnSend.addEventListener("click", sendEmail);
btnCSV.addEventListener("click", exportCSV);
btnExcel.addEventListener("click", exportExcel);
import { onAuthStateChanged } from "./app.js";
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.href = "index.html";
    return;
  }
  document
    .querySelectorAll(".auth-required")
    .forEach((el) => (el.style.display = "block"));
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  fromEl.value = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
  toEl.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  await loadHistory();
});
