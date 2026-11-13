import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('history renders submissions and archived PDFs using the browser document', async () => {
  const source = await readFile(new URL('../public/js/report.js', import.meta.url), 'utf8');
  const start = source.indexOf('async function loadHistory()');
  const end = source.indexOf('document.getElementById("btnHistory")', start);
  const node = () => ({ children: [], textContent: '', append(...items) { this.children.push(...items); }, replaceChildren() { this.children = []; }, addEventListener() {} });
  const container = node();
  const report = { fromMonth: '2026-10', toMonth: '2026-10', totalMinutes: 855, employerUid: 'employer', status: 'approved', emailStatus: 'sent', createdAt: 1 };
  const context = vm.createContext({
    auth: { currentUser: { uid: 'worker' } }, db: {},
    document: { getElementById: () => container, createElement: node },
    collection: (_, path) => path,
    getDocs: async (path) => ({ empty: false, docs: [{ id: 'test-report', data: () => path.endsWith('/submissions') ? report : { storagePath: 'users/worker/reports/example.pdf', fromMonth: '2026-10', toMonth: '2026-10' } }] }),
    minutesToHM: () => '14.15',
  });
  await vm.runInContext(`${source.slice(start, end)}; loadHistory()`, context);
  assert.equal(container.children.length, 2);
  assert.match(container.children[0].children[0].textContent, /approved/);
  assert.equal(container.children[0].children[1].textContent, 'Scarica copia inviata');
  assert.match(container.children[1].textContent, /PDF archiviato/);
});
