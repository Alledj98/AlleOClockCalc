import {
  auth,
  db,
  doc,
  getDoc,
  setDoc,
  onAuthStateChanged,
  writeBatch,
} from "./app.js";
import { showLoader, hideLoader, showError, showToast } from "./ui.js";
import { diffMinutes, minutesToHM, validateShiftPair } from "./timeutil.js";
const dateEl = document.getElementById("date"),
  rateEl = document.getElementById("hourlyRate"),
  dayOffEl = document.getElementById("dayOff");
const mInEl = document.getElementById("mIn"),
  mOutEl = document.getElementById("mOut"),
  eInEl = document.getElementById("eIn"),
  eOutEl = document.getElementById("eOut");
const dailyHoursEl = document.getElementById("dailyHours"),
  dailyPayEl = document.getElementById("dailyPay");
const saveBtn = document.getElementById("btnSave");
let loadedDate = null,
  loadVersion = 0;
function rate() {
  const value = Number(rateEl.value);
  if (!Number.isFinite(value) || value < 0 || value > 10000)
    throw new Error("Paga oraria non valida.");
  return value;
}
function recalc() {
  const value = Math.max(0, Number(rateEl.value) || 0);
  const minutes = dayOffEl.checked
    ? 0
    : diffMinutes(mInEl.value, mOutEl.value) +
      diffMinutes(eInEl.value, eOutEl.value);
  dailyHoursEl.textContent = minutesToHM(minutes);
  dailyPayEl.textContent = ((minutes / 60) * value).toFixed(2);
  dailyPayEl.parentElement.style.display = value > 0 ? "" : "none";
}
[mInEl, mOutEl, eInEl, eOutEl, rateEl, dayOffEl].forEach((input) =>
  input.addEventListener("input", recalc),
);
async function loadDay() {
  const user = auth.currentUser;
  if (!user) return;
  const date = dateEl.value;
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(date)) {
    showError("Seleziona una data valida.");
    return;
  }
  const version = ++loadVersion;
  loadedDate = null;
  saveBtn.disabled = true;
  showLoader();
  try {
    const snapshot = await getDoc(doc(db, `users/${user.uid}/entries/${date}`));
    if (version !== loadVersion || dateEl.value !== date) return;
    const entry = snapshot.data() || {};
    dayOffEl.checked = !!entry.dayOff;
    mInEl.value = entry.morningIn || "";
    mOutEl.value = entry.morningOut || "";
    eInEl.value = entry.eveningIn || "";
    eOutEl.value = entry.eveningOut || "";
    if (entry.hourlyRate != null) rateEl.value = entry.hourlyRate;
    loadedDate = date;
    saveBtn.disabled = false;
    recalc();
  } catch (error) {
    showError(error.message);
  } finally {
    hideLoader();
  }
}
dateEl.addEventListener("change", loadDay);
document.getElementById("btnLoad").addEventListener("click", loadDay);
saveBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;
  if (loadedDate !== dateEl.value) {
    showError("Carica prima la data selezionata.");
    return;
  }
  saveBtn.disabled = true;
  [dateEl,rateEl,dayOffEl,mInEl,mOutEl,eInEl,eOutEl,document.getElementById("btnLoad")].forEach(input=>{input.disabled=true;});
  showLoader();
  try {
    const hourlyRate = rate();
    if (!dayOffEl.checked) {
      validateShiftPair(mInEl.value, mOutEl.value, "Mattina");
      validateShiftPair(eInEl.value, eOutEl.value, "Sera");
    }
    const minutes = dayOffEl.checked
      ? 0
      : diffMinutes(mInEl.value, mOutEl.value) +
        diffMinutes(eInEl.value, eOutEl.value);
    if (minutes > 1440) throw new Error("I turni superano le 24 ore.");
    const batch = writeBatch(db);
    batch.set(
      doc(db, `users/${user.uid}/entries/${dateEl.value}`),
      {
        uid: user.uid,
        date: dateEl.value,
        dayOff: dayOffEl.checked,
        morningIn: mInEl.value || null,
        morningOut: mOutEl.value || null,
        eveningIn: eInEl.value || null,
        eveningOut: eOutEl.value || null,
        hourlyRate,
        totalMinutes: minutes,
        totalPay: (minutes / 60) * hourlyRate,
        updatedAt: Date.now(),
      },
      { merge: true },
    );
    batch.set(doc(db, `users/${user.uid}`), { hourlyRate }, { merge: true });
    await batch.commit();
    showToast("Giorno salvato");
  } catch (error) {
    showError(error.message);
  } finally {
    [dateEl,rateEl,dayOffEl,mInEl,mOutEl,eInEl,eOutEl,document.getElementById("btnLoad")].forEach(input=>{input.disabled=false;});
    saveBtn.disabled = loadedDate !== dateEl.value;
    hideLoader();
  }
});
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.href = "index.html";
    return;
  }
  showLoader();
  try {
    const profile = await getDoc(doc(db, `users/${user.uid}`));
    rateEl.value = profile.data()?.hourlyRate ?? 10;
    const now = new Date();
    dateEl.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    await loadDay();
  } catch (error) {
    showError(error.message);
  } finally {
    hideLoader();
  }
});
