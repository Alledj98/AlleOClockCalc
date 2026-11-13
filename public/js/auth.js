import {
  auth,
  fns,
  gProvider,
  onAuthStateChanged,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  httpsCallable,
  sendEmailVerification,
  sendPasswordResetEmail,
} from "./app.js";
import { gateNav, showError, showToast } from "./ui.js";
const email = document.getElementById("email");
const password = document.getElementById("password");
const role = document.getElementById("role");

async function finishLogin(user) {
  const profile = await httpsCallable(
    fns,
    "ensureProfile",
  )({ role: role?.value || "employee" });
  const code = document.getElementById("empCode")?.value.trim();
  if (code && profile.data.role === "employee") {
    try {
      await httpsCallable(fns, "linkEmployer")({ code });
    } catch (error) {
      showError(
        `Accesso riuscito, collegamento datore non completato: ${error.message}`,
      );
      return;
    }
  }
  if (!user.emailVerified) {
    showToast(
      "Account pronto. Verifica l’email prima di inviare report. Puoi richiedere il messaggio da questa pagina.",
      "warn",
      8000,
    );
    return;
  }
  location.href =
    profile.data.role === "employer" ? "employer.html" : "monthly.html";
}
async function action(button, task) {
  button.disabled = true;
  try {
    await task();
  } catch (error) {
    showError(error.message);
  } finally {
    button.disabled = false;
  }
}
document.getElementById("btnSignIn")?.addEventListener("click", (event) =>
  action(event.currentTarget, async () => {
    const result = await signInWithEmailAndPassword(
      auth,
      email.value.trim(),
      password.value,
    );
    await finishLogin(result.user);
  }),
);
document.getElementById("btnSignUp")?.addEventListener("click", (event) =>
  action(event.currentTarget, async () => {
    const result = await createUserWithEmailAndPassword(
      auth,
      email.value.trim(),
      password.value,
    );
    await finishLogin(result.user);
    try {
      await sendEmailVerification(result.user);
      showToast("Email di verifica inviata.", "ok", 6000);
    } catch {
      showError(
        "Account creato. Richiedi nuovamente l’email di verifica con il pulsante dedicato.",
      );
    }
  }),
);
document.getElementById("btnGoogle")?.addEventListener("click", (event) =>
  action(event.currentTarget, async () => {
    const result = await signInWithPopup(auth, gProvider);
    await finishLogin(result.user);
  }),
);
document.getElementById("btnVerifyEmail")?.addEventListener("click", (event) =>
  action(event.currentTarget, async () => {
    if (!auth.currentUser)
      throw new Error("Accedi prima di richiedere la verifica.");
    await auth.currentUser.reload();
    if (auth.currentUser.emailVerified) {
      await auth.currentUser.getIdToken(true);
      showToast("Email verificata.");
      return;
    }
    await sendEmailVerification(auth.currentUser);
    showToast(
      "Email inviata. Dopo la verifica, esci e accedi nuovamente.",
      "ok",
      7000,
    );
  }),
);
document
  .getElementById("btnResetPassword")
  ?.addEventListener("click", (event) =>
    action(event.currentTarget, async () => {
      if (!email.value.trim())
        throw new Error("Inserisci il tuo indirizzo email.");
      await sendPasswordResetEmail(auth, email.value.trim());
      showToast(
        "Se l’account esiste, riceverai le istruzioni per reimpostare la password.",
      );
    }),
  );
document.getElementById("btnSignOut")?.addEventListener("click", async () => {
  await signOut(auth);
  location.href = "index.html";
});
document.getElementById("btnSetEmployer")?.addEventListener("click", (event) =>
  action(event.currentTarget, async () => {
    const code = document.getElementById("empCodeProfile").value.trim();
    await httpsCallable(fns, "linkEmployer")({ code });
    showToast("Datore collegato.");
  }),
);
onAuthStateChanged(auth, (user) => {
  gateNav(!!user);
  document.querySelectorAll(".auth-required").forEach((element) => {
    element.style.display = user ? "block" : "none";
  });
});
