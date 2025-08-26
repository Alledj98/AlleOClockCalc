export function showLoader(){ document.getElementById('loader')?.classList.remove('hidden'); }
export function hideLoader(){ document.getElementById('loader')?.classList.add('hidden'); }
export function showToast(msg, type='ok', ms=2600){
  let w=document.getElementById('toastWrap'); if(!w){ w=document.createElement('div'); w.id='toastWrap'; document.body.appendChild(w); }
  const t=document.createElement('div'); t.className='toast'+(type==='error'?' error': type==='warn'?' warn':'');
  t.textContent=msg; w.appendChild(t); setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateY(6px)'; setTimeout(()=> t.remove(), 220); }, ms);
}
export function showError(msg){ showToast(msg || 'Errore', 'error', 3200); }
export function gateNav(isAuthed){
  document.querySelectorAll('.requires-auth').forEach(a=>{
    if(isAuthed){ a.classList.remove('disabled'); a.removeAttribute('aria-disabled'); }
    else { a.classList.add('disabled'); a.setAttribute('aria-disabled','true'); }
  });
}