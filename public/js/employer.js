import { auth, db, doc, getDoc, collection, getDocs, query, orderBy } from './app.js';
import { showLoader, hideLoader, showError, showToast } from './ui.js';

const subsDiv = document.getElementById('subs');
document.getElementById('btnCopyCode')?.addEventListener('click', ()=>{
  const code = document.getElementById('myEmployerCode')?.textContent || '';
  navigator.clipboard.writeText(code).then(()=> showToast('Copiato'));
});

async function loadSubs(){
  const user = auth.currentUser; if(!user) return;
  showLoader();
  try{
    const qref = query(collection(db,`employers/${user.uid}/submissions`), orderBy('createdAt','desc'));
    const snaps = await getDocs(qref);
    if (snaps.empty) { subsDiv.innerHTML = '<p data-i18n="no_data">No data in range.</p>'; return; }
    let html=''; snaps.forEach(d=>{
      const x=d.data();
      html += `<div class="box"><b>${x.workerEmail||x.workerUid}</b> — ${x.fromMonth} → ${x.toMonth} — Hours: ${x.totalHours} — € ${x.totalPay}`
           + (x.pdfUrl ? ` — <a target="_blank" href="${x.pdfUrl}">PDF</a>` : '') + `</div>`;
    });
    subsDiv.innerHTML = html;
  }catch(e){ showError(e.message); }
  finally{ hideLoader(); }
}

auth.onAuthStateChanged(async (user)=>{
  try{
    if(!user){ window.location.href='index.html'; return; }
    const udoc = await getDoc(doc(db,`users/${user.uid}`));
    if ((udoc.data()?.role || 'employee') !== 'employer') { window.location.href='index.html'; return; }
    document.querySelectorAll('.auth-required').forEach(el=> el.style.display='block');
    const emp = await getDoc(doc(db,`employers/${user.uid}`));
    document.getElementById('myEmployerCode').textContent = emp.data()?.code || '—';
    await loadSubs();
  }catch(e){ showError(e.message); }
});