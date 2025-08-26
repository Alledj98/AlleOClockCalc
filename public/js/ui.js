export function showLoader(){ document.getElementById('loader')?.classList.remove('hidden'); }
export function hideLoader(){ document.getElementById('loader')?.classList.add('hidden'); }
export function gateNav(isAuthed){
  document.querySelectorAll('.requires-auth').forEach(a=>{
    if(isAuthed){ a.classList.remove('disabled'); a.removeAttribute('aria-disabled'); }
    else { a.classList.add('disabled'); a.setAttribute('aria-disabled','true'); }
  });
}
export function showError(msg){
  const b=document.getElementById('errorBanner'); if(!b) return alert(msg);
  b.textContent = msg; b.classList.add('show'); setTimeout(()=> b.classList.remove('show'), 5000);
}
window.addEventListener('error', e=> showError(e.message||'Unknown error'));
window.addEventListener('unhandledrejection', e=> showError(e.reason?.message || String(e.reason) || 'Promise rejected'));