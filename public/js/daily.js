import { auth, db, doc, getDoc, setDoc, onAuthStateChanged } from './app.js';
import { showLoader, hideLoader, showError } from './ui.js';

const dateEl = document.getElementById('date');
const rateEl = document.getElementById('hourlyRate');
const dayOffEl = document.getElementById('dayOff');
const mInEl = document.getElementById('mIn');
const mOutEl = document.getElementById('mOut');
const eInEl = document.getElementById('eIn');
const eOutEl = document.getElementById('eOut');
const dailyHoursEl = document.getElementById('dailyHours');
const dailyPayEl = document.getElementById('dailyPay');

function diff(a,b){ if(!a||!b) return 0; const [h1,m1]=a.split(':').map(Number),[h2,m2]=b.split(':').map(Number); let t1=h1*60+m1,t2=h2*60+m2; if(t2<t1)t2+=1440; return (t2-t1)/60; }
function recalc(){ const r=parseFloat(rateEl.value)||0; let h=0; if(!dayOffEl.checked){ h+=diff(mInEl.value,mOutEl.value); h+=diff(eInEl.value,eOutEl.value);} dailyHoursEl.textContent=h.toFixed(2); dailyPayEl.textContent=(h*r).toFixed(2); }
[mInEl,mOutEl,eInEl,eOutEl,rateEl,dayOffEl].forEach(x=>x.addEventListener('input',recalc));

onAuthStateChanged(auth, async (user)=>{
  try{
    if(!user){ window.location.href='index.html'; return; }
    document.querySelectorAll('.auth-required').forEach(el=> el.style.display='block');
    const now=new Date(); dateEl.value=now.toISOString().slice(0,10);
    const prof=await getDoc(doc(db,`users/${user.uid}`)); rateEl.value=prof.data()?.hourlyRate ?? 10;
  }catch(e){ showError(e.message); }
});

document.getElementById('btnSave').addEventListener('click', async ()=>{
  try{
    const u=auth.currentUser; if(!u) return; const d=dateEl.value;
    const hours=parseFloat(dailyHoursEl.textContent)||0, pay=parseFloat(dailyPayEl.textContent)||0, rate=parseFloat(rateEl.value)||0;
    showLoader();
    await setDoc(doc(db,`users/${u.uid}/entries/${d}`),{ uid:u.uid,date:d, dayOff:dayOffEl.checked, morningIn:mInEl.value||null, morningOut:mOutEl.value||null, eveningIn:eInEl.value||null, eveningOut:eOutEl.value||null, hourlyRate:rate, totalHours:hours, totalPay:pay, updatedAt:Date.now() },{merge:true});
    await setDoc(doc(db,`users/${u.uid}`),{hourlyRate:rate},{merge:true});
    alert('Saved ✅');
  }catch(e){ showError(e.message); }
  finally{ hideLoader(); }
});

document.getElementById('btnLoad').addEventListener('click', async ()=>{
  try{
    const u=auth.currentUser; if(!u) return; const d=dateEl.value; showLoader();
    const s=await getDoc(doc(db,`users/${u.uid}/entries/${d}`));
    if(!s.exists()){ alert('No data for this date'); return; }
    const x=s.data(); dayOffEl.checked=!!x.dayOff; mInEl.value=x.morningIn||''; mOutEl.value=x.morningOut||''; eInEl.value=x.eveningIn||''; eOutEl.value=x.eveningOut||''; rateEl.value=x.hourlyRate ?? 10; recalc();
  }catch(e){ showError(e.message); }
  finally{ hideLoader(); }
});