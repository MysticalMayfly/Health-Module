// Generic CSV adapter: { csv, dateColumn, columns: { weight: 'Weight (kg)', steps: 'Steps', ... } }
// Works for spreadsheet exports, smart-scale apps, InBody/DEXA reports, Oura/Whoop CSVs.
import { localDate } from '../canonical.js';

export function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== '')) rows.push(row);
  const [header = [], ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i]?.trim()])));
}

export function normalizeCsv({ csv, dateColumn, columns = {} }) {
  const samples = [];
  for (const r of parseCsv(csv)) {
    const ts = r[dateColumn];
    const date = /^\d{4}-\d{2}-\d{2}$/.test(ts) ? ts : localDate(ts);
    if (!date) continue;
    for (const [metric, col] of Object.entries(columns)) {
      const v = parseFloat(r[col]);
      if (Number.isFinite(v)) samples.push({ metric, date, ts: ts.length > 10 ? ts : date, value: v });
    }
  }
  return { samples, sleep: [], workouts: [] };
}

export default { id: 'csv', name: 'CSV import', normalize: (p) => normalizeCsv(p) };
