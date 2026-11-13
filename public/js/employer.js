import {
  auth,
  db,
  fns,
  doc,
  getDoc,
  collection,
  getDocs,
  onAuthStateChanged,
  httpsCallable,
} from "./app.js";
import { showLoader, hideLoader, showError, showToast } from "./ui.js";

const codeEl = document.getElementById("myEmployerCode");
const listEl = document.getElementById("subs");
const copyBtn = document.getElementById("btnCopyCode");
let employerCode = "";

copyBtn?.addEventListener("click", async () => {
  if (!employerCode) return;
  try {
    await navigator.clipboard.writeText(employerCode);
    showToast("Codice copiato");
  } catch {
    showError("Impossibile copiare automaticamente il codice");
  }
});

function addText(tag, content, parent) {
  const node = document.createElement(tag);
  node.textContent = content;
  parent.appendChild(node);
  return node;
}

function safeReportUrl(value) {
  try {
    const url = new URL(value);
    // Non creare collegamenti eseguibili da dati Firestore non affidabili.
    return url.protocol === "https:" &&
      (url.hostname === "firebasestorage.googleapis.com" ||
        url.hostname === "storage.googleapis.com")
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function renderSubmissions(snapshots) {
  listEl.replaceChildren();
  if (!snapshots.length) {
    addText("p", "Nessun riepilogo ricevuto per il momento.", listEl);
    return;
  }
  for (const snapshot of snapshots) {
    const item = snapshot.data();
    const card = document.createElement("div");
    card.className = "box submission-card";
    addText("h4", item.workerEmail || "Lavoratore", card);
    addText(
      "p",
      `Periodo: ${item.fromMonth || "?"} → ${item.toMonth || "?"}`,
      card,
    );
    addText(
      "p",
      `Ore: ${
        typeof item.totalMinutes === "number"
          ? `${Math.floor(item.totalMinutes / 60)}.${String(item.totalMinutes % 60).padStart(2, "0")}`
          : "—"
      }`,
      card,
    );
    addText("p", `Stato: ${item.status || "pending"}`, card);
    if (item.schemaVersion === 2) {
      const download = addText("button", "Scarica report", card);
      download.className = "secondary";
      download.addEventListener("click", async () => {
        download.disabled = true;
        try {
          const result = await httpsCallable(
            fns,
            "getSubmissionReport",
          )({ submissionId: snapshot.id });
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
        } catch (error) {
          showError(error.message);
        } finally {
          download.disabled = false;
        }
      });
    }
    const reportUrl = safeReportUrl(item.pdfUrl);
    if (reportUrl) {
      const link = addText("a", "Apri PDF", card);
      link.href = reportUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    if ((item.status || "pending") === "pending") {
      const actions = document.createElement("div");
      actions.className = "grid grid-2";
      for (const [label, status] of [
        ["Approva", "approved"],
        ["Rifiuta", "rejected"],
      ]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = status === "rejected" ? "secondary" : "";
        button.textContent = label;
        button.addEventListener("click", async () => {
          actions.querySelectorAll("button").forEach((control) => {
            control.disabled = true;
          });
          try {
            const result = await httpsCallable(
              fns,
              "updateSubmissionStatus",
            )({ submissionId: snapshot.id, status });
            if (result.data.decisionEmailStatus === "failed")
              showToast(
                "Esito salvato, email al lavoratore non consegnata.",
                "warn",
                6000,
              );
            showToast(status === "approved" ? "Approvato" : "Rifiutato");
            await loadSubmissions();
          } catch (error) {
            showError(error.message);
            await loadSubmissions();
          }
        });
        actions.appendChild(button);
      }
      card.appendChild(actions);
    }
    listEl.appendChild(card);
  }
}

async function loadSubmissions() {
  const user = auth.currentUser;
  if (!user) return;
  showLoader();
  try {
    const documents = await getDocs(
      collection(db, `employers/${user.uid}/submissions`),
    );
    const sorted = [...documents.docs].sort(
      (a, b) =>
        Number(b.data().createdAt || 0) - Number(a.data().createdAt || 0),
    );
    renderSubmissions(sorted);
  } catch (error) {
    showError(`Impossibile caricare le approvazioni: ${error.message}`);
  } finally {
    hideLoader();
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.href = "index.html";
    return;
  }
  showLoader();
  try {
    const profile = await getDoc(doc(db, `users/${user.uid}`));
    if (profile.data()?.role !== "employer") {
      showError("La dashboard è riservata agli account datore");
      location.href = "monthly.html";
      return;
    }
    const employer = await getDoc(doc(db, `employers/${user.uid}`));
    employerCode = employer.data()?.code || "";
    codeEl.textContent = employerCode || "Codice non configurato";
    document.querySelectorAll(".auth-required").forEach((el) => {
      el.style.display = "block";
    });
    await loadSubmissions();
  } catch (error) {
    showError(`Errore dashboard datore: ${error.message}`);
  } finally {
    hideLoader();
  }
});
