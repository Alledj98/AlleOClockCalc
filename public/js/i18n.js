export async function loadI18n(lang){ const res=await fetch('js/i18n.json'); const dict=await res.json(); return dict[lang]||dict['it']; }
export function applyI18n(map){
  document.querySelectorAll('[data-i18n]').forEach(el=>{ const k=el.getAttribute('data-i18n'); if(map[k]) el.textContent=map[k]; });
  document.querySelectorAll('[data-i18n-ph]').forEach(el=>{ const k=el.getAttribute('data-i18n-ph'); if(map[k]) el.setAttribute('placeholder', map[k]); });
}
export function currentLang(){ return localStorage.getItem('lang') || (navigator.language||'it').slice(0,2); }
export function setLang(lang){ localStorage.setItem('lang', lang); location.reload(); }