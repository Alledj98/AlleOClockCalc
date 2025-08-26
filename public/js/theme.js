const key='theme'; const root=document.documentElement;
export function applySavedTheme(){ const t=localStorage.getItem(key)||'dark'; root.setAttribute('data-theme', t); }
export function toggleTheme(){ const cur=root.getAttribute('data-theme')||'dark'; const next=cur==='dark'?'light':'dark'; root.setAttribute('data-theme',next); localStorage.setItem(key,next); }
applySavedTheme();