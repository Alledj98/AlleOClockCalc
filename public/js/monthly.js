import { auth, db, doc, getDoc, setDoc, writeBatch, onAuthStateChanged } from './app.js';
import { showLoader, hideLoader, showError, showToast } from './ui.js';

const monthPicker=document.getElementById('monthPicker');
const rateEl=document.getElementById('hourlyRate');
const tableWrap=document.getElementById('tableWrap');
const monthHoursEl=document.getElementById('monthHours');
const monthPayEl=document.getElementById('monthPay');

function daysInMonth(y,m){ return new Date(y,m+1,0).getDate(); }
function diff(a,b){ if(!a||!b) return 0; const [h1,m1]=a.split(':').map(Number),[h2,m2]=b.split(':').map(Number); let t1=h1*60+m1,t2=h2*60+m2; if(t2<t1)t2+=1440; return (t2-t1)/60; }

function headerHtml(){
  return `<thead><tr>
    <th data-i18n="th_day">Day</th>
    <th data-i18n="th_off">Off</th>
    <th data-i18n="th_m_in">M IN</th>
    <th data-i18n="th_m_out">M OUT</th>
    <th data-i18n="th_e_in">E IN</th>
    <th data-i18n="th_e_out">E OUT</th>
    <th data-i18n="th_hours">Hours</th>
    <th data-i18n="th_euro">€</th>
  </tr></thead>`;
}

function build(){
  tableWrap.innerHTML='';
  const [Y,M]=monthPicker.value.split('-').map(Number);
  const d=daysInMonth(Y,M-1);
  const t=document.createElement('table'); t.className='table';
  t.innerHTML=headerHtml();
  const tb=document.createElement('tbody');
  for(let i=1;i<=d;i++){ const tr=document.createElement('tr'); tr.innerHTML=`<td>${i}</td>
    <td><input type="checkbox" class="off"></td>
    <td><input type="time" class="mi"></td>
    <td><input type="time" class="mo"></td>
    <td><input type="time" class="ei"></td>
    <td><input type="time" class="eo"></td>
    <td class="h">0.00</td><td class="p">0.00</td>`; tb.appendChild(tr); }
  t.appendChild(tb); tableWrap.appendChild(t);
  t.addEventListener('input', recalc);
  recalc();
  import('./i18n.js').then(m=> m.loadI18n(m.currentLang()).then(map=> m.applyI18n(map)));
}

function recalc(){
  const r=parseFloat(rateEl.value)||0; let H=0,P=0;
  tableWrap.querySelectorAll('tbody tr').forEach(tr=>{
    const off=tr.querySelector('.off').checked; let h=0;
    if(!off){ h+=diff(tr.querySelector('.mi').value,tr.querySelector('.mo').value); h+=diff(tr.querySelector('.ei').value,tr.querySelector('.eo').value); }
    const p=h*r; tr.querySelector('.h').textContent=h.toFixed(2); tr.querySelector('.p').textContent=p.toFixed(2); H+=h; P+=p;
  });
  monthHoursEl.textContent=H.toFixed(2); monthPayEl.textContent=P.toFixed(2);
}

monthPicker.addEventListener('change', build);

document.getElementById('btnLoad').addEventListener('click', async ()=>{
  try{
    const u=auth.currentUser; if(!u) return; const [Y,M]=monthPicker.value.split('-').map(Number); const D=new Date(Y,M,0).getDate();
    showLoader();
    const rows = tableWrap.querySelectorAll('tbody tr');
    for(let i=1;i<=D;i++){ const date=`${Y}-${String(M).padStart(2,'0')}-${String(i).padStart(2,'0')}`; const s=await getDoc(doc(db,`users/${u.uid}/entries/${date}`));
      if(s.exists()){ const x=s.data(); const tr=rows[i-1]; tr.querySelector('.off').checked=!!x.dayOff;
        tr.querySelector('.mi').value=x.morningIn||''; tr.querySelector('.mo').value=x.morningOut||''; tr.querySelector('.ei').value=x.eveningIn||''; tr.querySelector('.eo').value=x.eveningOut||''; }
    }
    recalc(); showToast('Mese caricato ✅');
  }catch(e){ showError(e.message); }
  finally{ hideLoader(); }
});

document.getElementById('btnSave').addEventListener('click', async ()=>{
  try{
    const u=auth.currentUser; if(!u) return; const [Y,M]=monthPicker.value.split('-').map(Number); const r=parseFloat(rateEl.value)||0;
    showLoader();
    const wb=writeBatch(db); const rows=tableWrap.querySelectorAll('tbody tr');
    rows.forEach((tr,idx)=>{
      const i=idx+1; const date=`${Y}-${String(M).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
      const off=tr.querySelector('.off').checked, mi=tr.querySelector('.mi').value||null, mo=tr.querySelector('.mo').value||null, ei=tr.querySelector('.ei').value||null, eo=tr.querySelector('.eo').value||null;
      const h=parseFloat(tr.querySelector('.h').textContent)||0, p=parseFloat(tr.querySelector('.p').textContent)||0;
      const ref=doc(db,`users/${u.uid}/entries/${date}`);
      wb.set(ref,{ uid:u.uid,date,dayOff:off,morningIn:mi,morningOut:mo,eveningIn:ei,eveningOut:eo,hourlyRate:r,totalHours:h,totalPay:p,updatedAt:Date.now() },{merge:true});
    });
    await wb.commit(); await setDoc(doc(db,`users/${u.uid}`),{hourlyRate:r},{merge:true});
    showToast('Mese salvato ✅');
  }catch(e){ showError(e.message); }
  finally{ hideLoader(); }
});

onAuthStateChanged(auth, async (user)=>{
  try{
    if(!user){ window.location.href='index.html'; return; }
    document.querySelectorAll('.auth-required').forEach(el=> el.style.display='block');
    const prof=await getDoc(doc(db,`users/${user.uid}`)); rateEl.value=prof.data()?.hourlyRate ?? 10;
    const now=new Date(); monthPicker.value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`; build();
  }catch(e){ showError(e.message); }
});