import { auth, db, doc, getDoc, setDoc, collection, getDocs, query, where, orderBy } from './app.js';
import { showLoader, hideLoader, showError } from './ui.js';
import { httpsCallable, fns, storage, ref, uploadString, getDownloadURL } from './app.js';

const fromEl=document.getElementById('fromMonth');
const toEl=document.getElementById('toMonth');
const btnLoad=document.getElementById('btnLoad');
const btnPDF=document.getElementById('btnPDF');
const btnUpload=document.getElementById('btnUpload');
const btnSend=document.getElementById('btnSend');
const btnCSV=document.getElementById('btnCSV');
const btnExcel=document.getElementById('btnExcel');
const employerEmail=document.getElementById('employerEmail');
const rangeHoursEl=document.getElementById('rangeHours');
const rangePayEl=document.getElementById('rangePay');
const reportTable=document.getElementById('reportTable');

let cacheEntries=[]; let pdfBase64=null; let pdfUrl=null; let pdfStoragePath=null;

function ymRange(){ const [fy,fm]=fromEl.value.split('-').map(Number); const [ty,tm]=toEl.value.split('-').map(Number); const start=`${fy}-${String(fm).padStart(2,'0')}-01`; const end=`${ty}-${String(tm).padStart(2,'0')}-${new Date(ty,tm,0).getDate().toString().padStart(2,'0')}`; return {start,end}; }

function rowsForExport(){
  const header=['Date','Morning IN','Morning OUT','Evening IN','Evening OUT','Hours','Pay'];
  const rows = cacheEntries.map(e=>[e.date,e.morningIn||'',e.morningOut||'',e.eveningIn||'',e.eveningOut||'',(e.totalHours||0).toFixed(2),(e.totalPay||0).toFixed(2)]);
  return [header, ...rows];
}

function render(entries){
  if(!entries.length){
    reportTable.innerHTML='<p data-i18n="no_data">No data in range.</p>';
    import('./i18n.js').then(m=> m.loadI18n(m.currentLang()).then(map=> m.applyI18n(map)));
    rangeHoursEl.textContent='0.00'; rangePayEl.textContent='0.00'; return;
  }
  const groups={}; let H=0,P=0;
  for(const e of entries){ const ym=e.date.slice(0,7); (groups[ym]??=[]).push(e); H+=e.totalHours||0; P+=e.totalPay||0; }
  rangeHoursEl.textContent=H.toFixed(2); rangePayEl.textContent=P.toFixed(2);
  let html=''; Object.keys(groups).sort().forEach(m=>{ const rows=groups[m].map(e=>`<tr><td>${e.date}</td><td>${e.morningIn||'-'}</td><td>${e.morningOut||'-'}</td><td>${e.eveningIn||'-'}</td><td>${e.eveningOut||'-'}</td><td>${(e.totalHours||0).toFixed(2)}</td><td>€ ${(e.totalPay||0).toFixed(2)}</td></tr>`).join('');
    const mh=groups[m].reduce((s,x)=>s+(x.totalHours||0),0), mp=groups[m].reduce((s,x)=>s+(x.totalPay||0),0);
    html+=`<div class="box"><h3>${m}</h3><table class="table">
      <thead><tr><th data-i18n="date">Date</th><th data-i18n="th_m_in">M IN</th><th data-i18n="th_m_out">M OUT</th><th data-i18n="th_e_in">E IN</th><th data-i18n="th_e_out">E OUT</th><th data-i18n="th_hours">Hours</th><th data-i18n="th_euro">€</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><th colspan="5" style="text-align:right" data-i18n="tfoot_month_total">Month total</th><th>${mh.toFixed(2)}</th><th>€ ${mp.toFixed(2)}</th></tr></tfoot>
    </table></div>`; });
  reportTable.innerHTML=html;
  import('./i18n.js').then(m=> m.loadI18n(m.currentLang()).then(map=> m.applyI18n(map)));
}

async function loadData(){
  const u=auth.currentUser; if(!u) return;
  const {start,end}=ymRange();
  showLoader();
  try{
    const qref=query(collection(db,`users/${u.uid}/entries`), where('date','>=',start), where('date','<=',end), orderBy('date','asc'));
    const snaps=await getDocs(qref); cacheEntries=snaps.docs.map(d=>d.data());
    render(cacheEntries);
  }catch(e){ showError(e.message); }
  finally{ hideLoader(); }
}

function genPDF(){
  if(!cacheEntries.length){ showError('Load data first'); return; }
  const { jsPDF } = window.jspdf; const doc=new jsPDF({unit:'pt',format:'a4'});
  doc.setFontSize(16); doc.text('AlleOClockCalc - Hours report',40,40);
  const {start,end}=ymRange(); doc.setFontSize(10); doc.text(`Range: ${start} → ${end}`,40,60);
  const body=cacheEntries.map(e=>[e.date,e.morningIn||'-',e.morningOut||'-',e.eveningIn||'-',e.eveningOut||'-',(e.totalHours||0).toFixed(2),(e.totalPay||0).toFixed(2)]);
  doc.autoTable({ startY:80, head:[['Date','M IN','M OUT','E IN','E OUT','Hours','€']], body });
  const H=cacheEntries.reduce((s,x)=>s+(x.totalHours||0),0), P=cacheEntries.reduce((s,x)=>s+(x.totalPay||0),0);
  doc.text(`Totals — Hours: ${H.toFixed(2)} | € ${P.toFixed(2)}`,40, doc.lastAutoTable.finalY+24);
  const dataUri = doc.output('datauristring');
  pdfBase64 = dataUri.split(',')[1];
  doc.save('alleoclockcalc-report.pdf');
}

async function uploadPDF(){
  if(!pdfBase64){ showError('Generate PDF first'); return; }
  const uid = auth.currentUser?.uid || 'anonymous';
  const fn = `report-${Date.now()}.pdf`;
  showLoader();
  try{
    const r = ref(storage, `users/${uid}/reports/${fn}`);
    await uploadString(r, pdfBase64, 'base64', { contentType: 'application/pdf' });
    pdfUrl = await getDownloadURL(r);
    pdfStoragePath = r.fullPath;
    const {start,end}=ymRange();
    const H=parseFloat(rangeHoursEl.textContent)||0, P=parseFloat(rangePayEl.textContent)||0;
    await setDoc(doc(db,`users/${uid}/pdfs/${Date.now()}`),{
      createdAt: Date.now(), fromMonth: start.slice(0,7), toMonth: end.slice(0,7),
      totalHours: H, totalPay: P, pdfUrl, storagePath: pdfStoragePath
    });
    alert(document.querySelector('[data-i18n="history_saved"]')?.textContent || 'PDF history saved');
  }catch(e){ showError(e.message); }
  finally{ hideLoader(); }
}

async function sendEmail(){
  const u=auth.currentUser; if(!u) return;
  const to=employerEmail.value.trim(); if(!to){ showError('Set employer email'); return; }
  if(!pdfBase64 && !pdfUrl){ showError('Generate PDF or upload first'); return; }
  showLoader();
  try{
    const call=httpsCallable(fns,'sendTimesheet');
    const payload = pdfUrl ? { to, subject:'Working hours report', body:'See link below.', pdfUrl, filename:'alleoclockcalc-report.pdf' } : { to, subject:'Working hours report', body:'See attached PDF.', pdfBase64, filename:'alleoclockcalc-report.pdf' };
    await call(payload);
    const udoc = await getDoc(doc(db,`users/${u.uid}`));
    const employerUid = udoc.data()?.employerUid;
    const {start,end}=ymRange();
    const meta = {
      workerUid: u.uid, workerEmail: u.email, fromMonth: start.slice(0,7), toMonth: end.slice(0,7),
      totalHours: parseFloat(rangeHoursEl.textContent)||0, totalPay: parseFloat(rangePayEl.textContent)||0,
      pdfUrl: pdfUrl || null, storagePath: pdfStoragePath || null, attached: !!(!pdfUrl && pdfBase64), createdAt: Date.now()
    };
    if (employerUid) {
      const id = `${u.uid}_${Date.now()}`;
      await setDoc(doc(db,`employers/${employerUid}/submissions/${id}`), meta);
    }
    // store always in user's pdfs as well (if not already uploaded)
    await setDoc(doc(db,`users/${u.uid}/pdfs/${Date.now()}`), meta);
    alert('Email sent ✅');
  }catch(e){ showError(e.message); }
  finally{ hideLoader(); }
}

function exportCSV(){
  if(!cacheEntries.length){ showError('Load data first'); return; }
  const rows = rowsForExport();
  const csv = rows.map(r=> r.map(v=> /[",\n]/.test(v)? '"'+String(v).replace(/"/g,'""')+'"' : v).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='alleoclockcalc-report.csv'; a.click();
  URL.revokeObjectURL(url);
}

function exportExcel(){
  if(!cacheEntries.length){ showError('Load data first'); return; }
  const rows = rowsForExport();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  XLSX.writeFile(wb, 'alleoclockcalc-report.xlsx');
}

document.getElementById('btnLoad').addEventListener('click', loadData);
document.getElementById('btnPDF').addEventListener('click', genPDF);
document.getElementById('btnUpload').addEventListener('click', uploadPDF);
document.getElementById('btnSend').addEventListener('click', sendEmail);
document.getElementById('btnCSV').addEventListener('click', exportCSV);
document.getElementById('btnExcel').addEventListener('click', exportExcel);

import { onAuthStateChanged } from './app.js';
onAuthStateChanged(auth, async (user)=>{
  if(!user){ window.location.href='index.html'; return; }
  document.querySelectorAll('.auth-required').forEach(el=> el.style.display='block');
  const now=new Date(); const start=new Date(now.getFullYear(),0,1);
  fromEl.value=`${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}`;
  toEl.value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
});