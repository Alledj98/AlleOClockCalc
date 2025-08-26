import { auth, gProvider, onAuthStateChanged, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, db, doc, getDoc, setDoc } from './app.js';
import { gateNav, showError } from './ui.js';

const email = document.getElementById('email');
const password = document.getElementById('password');
const roleSel = document.getElementById('role');
const empCode = document.getElementById('empCode');
const btnIn = document.getElementById('btnSignIn');
const btnUp = document.getElementById('btnSignUp');
const btnGoogle = document.getElementById('btnGoogle');
const btnSetEmployer = document.getElementById('btnSetEmployer');

btnIn?.addEventListener('click', async ()=>{
  try {
    await signInWithEmailAndPassword(auth, email.value, password.value);
    const prof = await getDoc(doc(db,`users/${auth.currentUser.uid}`));
    if (prof.data()?.role==='employer') window.location.href='employer.html'; else window.location.href='monthly.html';
  } catch(e){ showError(e.message); }
});
btnUp?.addEventListener('click', async ()=>{
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.value, password.value);
    const user = cred.user;
    const role = roleSel?.value || 'employee';
    await setDoc(doc(db,`users/${user.uid}`), { uid:user.uid, email:user.email, role, createdAt: Date.now() }, { merge:true });
    if (role==='employer') {
      const code = Math.random().toString(36).slice(2,10).toUpperCase();
      await setDoc(doc(db,`employers/${user.uid}`), { uid:user.uid, code, createdAt: Date.now() });
      await setDoc(doc(db,`codes/${code}`), { employerUid:user.uid });
      window.location.href='employer.html';
    } else {
      if (empCode?.value) {
        const snap = await getDoc(doc(db,`codes/${empCode.value.trim().toUpperCase()}`));
        if (snap.exists()) await setDoc(doc(db,`users/${user.uid}`), { employerUid: snap.data().employerUid }, { merge:true });
      }
      window.location.href='monthly.html';
    }
  } catch(e){ showError(e.message); }
});
btnGoogle?.addEventListener('click', async ()=>{
  try { const cred = await signInWithPopup(auth, gProvider);
    const user=cred.user; const exists = await getDoc(doc(db,`users/${user.uid}`));
    if (!exists.exists()) await setDoc(doc(db,`users/${user.uid}`), { uid:user.uid, email:user.email, role:'employee', createdAt: Date.now() });
    window.location.href='monthly.html';
  } catch(e){ showError(e.message); }
});

btnSetEmployer?.addEventListener('click', async ()=>{
  try{
    const user = auth.currentUser; if(!user) return;
    const code = (document.getElementById('empCodeProfile')?.value || '').trim().toUpperCase();
    if (!code) return showError(document.querySelector('[data-i18n="need_code"]').textContent || 'Enter employer code');
    const s = await getDoc(doc(db,`codes/${code}`));
    if (!s.exists()) return showError(document.querySelector('[data-i18n="invalid_code"]').textContent || 'Invalid employer code');
    await setDoc(doc(db,`users/${user.uid}`), { employerUid: s.data().employerUid }, { merge:true });
    alert(document.querySelector('[data-i18n="code_saved"]').textContent || 'Employer code linked');
  }catch(e){ showError(e.message); }
});

onAuthStateChanged(auth, async (user)=>{
  const authed = !!user; gateNav(authed);
  if (authed) {
    document.querySelectorAll('.auth-required').forEach(el=> el.style.display='block');
    document.querySelectorAll('.show-when-authed').forEach(el=> el.style.visibility='visible');
  }
});