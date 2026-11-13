
const KEY='lang'; let cache=null;
export function currentLang(){ return localStorage.getItem(KEY) || navigator.language?.slice(0,2) || 'it'; }
export async function loadI18n(lang=currentLang()){ const res=await fetch('./js/i18n.json'); const all=await res.json(); const map=all[lang]||all['it']; cache={lang,map}; return map; }
export function applyI18n(map){ document.querySelectorAll('[data-i18n]').forEach(el=>{ const k=el.getAttribute('data-i18n'); if(map[k]) el.textContent=map[k]; }); }
export async function setLang(lang){ localStorage.setItem(KEY,lang); const map=await loadI18n(lang); applyI18n(map); document.documentElement.lang=lang; }
(async()=>{ const map=await loadI18n(currentLang()); applyI18n(map); const sel=document.getElementById('langSelect'); if(sel){ sel.value=cache.lang; sel.addEventListener('change', e=> setLang(e.target.value)); }})();
export function t(key){ return (cache?.map && cache.map[key]) || key; }
