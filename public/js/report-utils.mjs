import { diffMinutes, minutesToHM } from './timeutil.js';

export function minutesForEntry(entry) {
  if (Number.isFinite(entry.totalMinutes)) return entry.totalMinutes;
  if (entry.dayOff) return 0;
  return diffMinutes(entry.morningIn, entry.morningOut)
    + diffMinutes(entry.eveningIn, entry.eveningOut);
}

export function rowsForExport(entries, hidePay) {
  const headers = ['Date', 'Morning IN', 'Morning OUT', 'Evening IN', 'Evening OUT', 'Hours'];
  if (!hidePay) headers.push('Pay');
  const rows = entries.map(entry => {
    const row = [entry.date, entry.morningIn || '', entry.morningOut || '',
      entry.eveningIn || '', entry.eveningOut || '', minutesToHM(minutesForEntry(entry))];
    if (!hidePay) row.push(Number(entry.totalPay || 0).toFixed(2));
    return row;
  });
  return [headers, ...rows];
}

// Protezione contro formule attive quando il CSV viene aperto in un foglio di calcolo.
export function csvCell(value) {
  let cell = String(value ?? '');
  if (/^[\s\t\r\n]*[=+@-]/.test(cell)) cell = `'${cell}`;
  if (/[",\r\n]/.test(cell)) cell = `"${cell.replace(/"/g, '""')}"`;
  return cell;
}

export function createCSV(rows) {
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}
