import {
  auth,
  db,
  doc,
  getDoc,
  setDoc,
  writeBatch,
  onAuthStateChanged,
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "./app.js";
import { showLoader, hideLoader, showError, showToast } from "./ui.js";
import { diffMinutes, minutesToHM, validateShiftPair } from "./timeutil.js";
import * as I18N from "./i18n.js";

const monthPicker = document.getElementById("monthPicker");
const rateEl = document.getElementById("hourlyRate");
const tableWrap = document.getElementById("tableWrap");
const monthHoursEl = document.getElementById("monthHours");
const monthPayEl = document.getElementById("monthPay");
const saveBtn = document.getElementById("btnSave");
let loadedMonth = null;
let existingDates = new Set();
let requestVersion = 0;
saveBtn.disabled = true;

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}
function selectedMonth() {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(monthPicker.value);
  if (!match) throw new Error("Seleziona un mese valido.");
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    key: monthPicker.value,
  };
}
function build() {
  loadedMonth = null;
  existingDates = new Set();
  saveBtn.disabled = true;
  requestVersion++; // invalida eventuali letture di un mese precedente
  const { year, month } = selectedMonth();
  const table = document.createElement("table");
  table.className = "table";
  const title = (key) => I18N.t(key);
  table.innerHTML = `<thead><tr><th>${title("th_day")}</th><th>${title("th_off")}</th><th>${title("th_m_in")}</th><th>${title("th_m_out")}</th><th>${title("th_e_in")}</th><th>${title("th_e_out")}</th><th>${title("th_hours")}</th><th>${title("th_euro")}</th></tr></thead>`;
  const body = document.createElement("tbody");
  for (let day = 1; day <= daysInMonth(year, month - 1); day++) {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${day}</td><td><input type="checkbox" class="off"></td><td><input type="time" class="mi"></td><td><input type="time" class="mo"></td><td><input type="time" class="ei"></td><td><input type="time" class="eo"></td><td class="h">0.00</td><td class="p">0.00</td>`;
    body.appendChild(row);
  }
  table.appendChild(body);
  tableWrap.replaceChildren(table);
  table.addEventListener("input", recalc);
  recalc();
}
function recalc() {
  const rate = Math.max(0, Number(rateEl.value) || 0);
  let minutesTotal = 0;
  let payTotal = 0;
  tableWrap.querySelectorAll("tbody tr").forEach((row) => {
    const off = row.querySelector(".off").checked;
    const minutes = off
      ? 0
      : diffMinutes(
          row.querySelector(".mi").value,
          row.querySelector(".mo").value,
        ) +
        diffMinutes(
          row.querySelector(".ei").value,
          row.querySelector(".eo").value,
        );
    const pay = (minutes / 60) * rate;
    row.querySelector(".h").textContent = minutesToHM(minutes);
    row.querySelector(".p").textContent = pay.toFixed(2);
    minutesTotal += minutes;
    payTotal += pay;
  });
  monthHoursEl.textContent = minutesToHM(minutesTotal);
  monthPayEl.textContent = payTotal.toFixed(2);
  monthPayEl.parentElement.style.display = rate > 0 ? "" : "none";
  tableWrap.querySelector("table")?.classList.toggle("hide-pay", rate <= 0);
}
async function autoLoadMonth() {
  const user = auth.currentUser;
  if (!user) return;
  const { year, month, key } = selectedMonth();
  const version = ++requestVersion;
  loadedMonth = null;
  saveBtn.disabled = true;
  const start = `${key}-01`;
  const end = `${key}-${String(daysInMonth(year, month - 1)).padStart(2, "0")}`;
  showLoader();
  try {
    const entries = await getDocs(
      query(
        collection(db, `users/${user.uid}/entries`),
        where("date", ">=", start),
        where("date", "<=", end),
        orderBy("date", "asc"),
      ),
    );
    if (version !== requestVersion || monthPicker.value !== key) return;
    const values = new Map(
      entries.docs.map((entry) => [entry.id, entry.data()]),
    );
    existingDates = new Set(values.keys());
    tableWrap.querySelectorAll("tbody tr").forEach((row, index) => {
      const day = String(index + 1).padStart(2, "0");
      const entry = values.get(`${key}-${day}`);
      row.querySelector(".off").checked = !!entry?.dayOff;
      row.querySelector(".mi").value = entry?.morningIn || "";
      row.querySelector(".mo").value = entry?.morningOut || "";
      row.querySelector(".ei").value = entry?.eveningIn || "";
      row.querySelector(".eo").value = entry?.eveningOut || "";
    });
    recalc();
    loadedMonth = key;
    saveBtn.disabled = false;
  } catch (error) {
    if (version === requestVersion)
      showError(`Impossibile caricare il mese: ${error.message}`);
  } finally {
    hideLoader();
  }
}

monthPicker.addEventListener("change", () => {
  try {
    build();
    autoLoadMonth();
  } catch (error) {
    showError(error.message);
  }
});
rateEl.addEventListener("input", recalc);
document.getElementById("btnLoad").addEventListener("click", autoLoadMonth);
saveBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;
  if (loadedMonth !== monthPicker.value) {
    showError(
      "Carica prima il mese: impediamo di sovrascrivere turni non letti.",
    );
    return;
  }
  const { key } = selectedMonth();
  const rate = Number(rateEl.value);
  if (!Number.isFinite(rate) || rate < 0 || rate > 10000) {
    showError("Paga oraria non valida.");
    return;
  }
  saveBtn.disabled = true;
  [monthPicker,rateEl,document.getElementById("btnLoad"),...tableWrap.querySelectorAll("input")].forEach(input=>{input.disabled=true;});
  showLoader();
  try {
    const batch = writeBatch(db);
    let modifiedRows = 0;
    tableWrap.querySelectorAll("tbody tr").forEach((row, index) => {
      const date = `${key}-${String(index + 1).padStart(2, "0")}`;
      const off = row.querySelector(".off").checked;
      const mi = row.querySelector(".mi").value || null;
      const mo = row.querySelector(".mo").value || null;
      const ei = row.querySelector(".ei").value || null;
      const eo = row.querySelector(".eo").value || null;
      // Non creare documenti vuoti per tutti i giorni di un nuovo mese.
      // I giorni già registrati restano modificabili, anche per svuotarli.
      if (!off && !mi && !mo && !ei && !eo && !existingDates.has(date)) return;
      if (!off) {
        validateShiftPair(mi, mo, `Giorno ${index + 1}, mattina`);
        validateShiftPair(ei, eo, `Giorno ${index + 1}, sera`);
      }
      const minutes = off ? 0 : diffMinutes(mi, mo) + diffMinutes(ei, eo);
      if (minutes > 1440)
        throw new Error(`Giorno ${index + 1}: i turni superano le 24 ore.`);
      batch.set(
        doc(db, `users/${user.uid}/entries/${date}`),
        {
          uid: user.uid,
          date,
          dayOff: off,
          morningIn: mi,
          morningOut: mo,
          eveningIn: ei,
          eveningOut: eo,
          hourlyRate: rate,
          totalMinutes: minutes,
          totalPay: (minutes / 60) * rate,
          updatedAt: Date.now(),
        },
        { merge: true },
      );
      modifiedRows++;
    });
    batch.set(
      doc(db, `users/${user.uid}`),
      { hourlyRate: rate },
      { merge: true },
    );
    await batch.commit();
    showToast("Mese salvato ✅");
    await autoLoadMonth();
  } catch (error) {
    showError(error.message);
  } finally {
    [monthPicker,rateEl,document.getElementById("btnLoad"),...tableWrap.querySelectorAll("input")].forEach(input=>{input.disabled=false;});
    saveBtn.disabled = loadedMonth !== monthPicker.value;
    hideLoader();
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.href = "index.html";
    return;
  }
  document.querySelectorAll(".auth-required").forEach((el) => {
    el.style.display = "block";
  });
  try {
    const profile = await getDoc(doc(db, `users/${user.uid}`));
    rateEl.value = profile.data()?.hourlyRate ?? 10;
    const today = new Date();
    monthPicker.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    build();
    await autoLoadMonth();
  } catch (error) {
    showError(error.message);
  }
});
