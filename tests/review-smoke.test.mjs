import test from 'node:test';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { rowsForExport, createCSV, minutesForEntry } from '../public/js/report-utils.mjs';
import { diffMinutes, minutesToHM, validateShiftPair } from '../public/js/timeutil.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
test('turni notturni e sessantesimi', () => {
  assert.equal(diffMinutes('22:30', '02:15'), 225);
  assert.equal(minutesToHM(225), '3.45');
  assert.equal(minutesForEntry({ morningIn: '22:30', morningOut: '02:15' }), 225);
});
test('turno incompleto viene rifiutato prima del salvataggio', () => {
  assert.throws(() => validateShiftPair('10:00', '', 'Mattina'), /Mattina/);
  assert.throws(() => validateShiftPair('', '15:00', 'Sera'), /Sera/);
  assert.doesNotThrow(() => validateShiftPair('10:00', '15:00'));
});
test('export con paga: nessun errore append, colonne coerenti', () => {
  const rows = rowsForExport([{ date: '2026-11-05', totalMinutes: 485, totalPay: 62.5 }], false);
  assert.equal(rows[0].length, 7);
  assert.deepEqual(rows[1], ['2026-11-05', '', '', '', '', '8.05', '62.50']);
});
test('export senza paga nasconde importi', () => {
  const rows = rowsForExport([{ date: '2026-11-05', totalMinutes: 485, totalPay: 62.5 }], true);
  assert.equal(rows[0].length, 6);
  assert.equal(rows[1].length, 6);
});
test('CSV: caratteri speciali e formule pericolose', () => {
  const csv = createCSV([['Name', 'Hours'], ['="EXEC"', '8.05'], ['a,b', '2.30']]);
  assert.match(csv, /^Name,Hours\r\n"'=""EXEC"""/, 'formula neutralizzata e virgola escapata');
  assert.match(csv, /"a,b",2\.30/);
});
test('dashboard datore e modulo report esistono', () => {
  assert.ok(existsSync(resolve(root, 'public/js/employer.js')));
  assert.ok(existsSync(resolve(root, 'public/js/report-utils.mjs')));
  assert.match(read('public/employer.html'), /\.\/js\/employer\.js/);
});
test('backup Storage inaccessibile agli account client', () => {
  const rules = read('storage.rules');
  assert.match(rules, /match \/backups\/\{path=\*\*\}\s*\{\s*allow read, write: if false;/);
});
test('protezione salvataggio mensile e date locali', () => {
  const month = read('public/js/monthly.js');
  const day = read('public/js/daily.js');
  assert.match(month, /loadedMonth !== monthPicker\.value/);
  assert.match(month, /saveBtn\.disabled = true/);
  assert.match(month, /existingDates\.has\(date\)/);
  assert.doesNotMatch(day, /toISOString\(\)\.slice\(0,10\)/);
});
test('service worker offline: HTML only for navigation, never modules or Firebase helper', async () => {
  const handlers = {};
  vm.runInNewContext(read('public/sw.js'), {
    self: { location: {origin:'https://example.com'}, addEventListener:(name,fn)=>{handlers[name]=fn;} },
    URL, Response,
    fetch: async()=>{throw new Error('offline');},
    caches: {match:async path=>path==='/index.html'?new Response('<html>offline</html>'):undefined}
  });
  let result;
  handlers.fetch({request:{method:'GET',url:'https://example.com/js/missing.js',mode:'cors'},respondWith:value=>{result=value;}});
  assert.equal((await result).type,'error');
  handlers.fetch({request:{method:'GET',url:'https://example.com/monthly',mode:'navigate'},respondWith:value=>{result=value;}});
  assert.match(await (await result).text(),/offline/);
  let intercepted=false;
  handlers.fetch({request:{method:'GET',url:'https://example.com/__/auth/handler',mode:'navigate'},respondWith:()=>{intercepted=true;}});
  assert.equal(intercepted,false);
});

test('configurazione isolata sul progetto AlleOClockCalc', () => {
  assert.match(read('.firebaserc'), /alleoclockcalc/);
  assert.doesNotMatch(read('.firebaserc'), /alle-tech-portfolio/);
});
