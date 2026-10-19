import { format, parseISO } from 'date-fns';

export const pad = (n) => String(n).padStart(2, '0');
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISO(new Date());
export const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
export const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 864e5);
export function dateRange(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
export const lastNDays = (n, end = todayISO()) => dateRange(addDays(end, -(n - 1)), end);
export function weekStart(iso) {
  const d = parseISO(iso);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return toISO(d);
}
export const fmtDate = (iso, f = 'd MMM') => (iso ? format(parseISO(iso), f) : '—');
export const fmtDay = (iso) => fmtDate(iso, 'EEE d MMM');
export const fmtTime = (ts) => (ts ? format(new Date(ts), 'HH:mm') : '—');

export function fmt(v, dec = 0) {
  if (v == null || Number.isNaN(v)) return '—';
  return Number(v).toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
export const fmtSigned = (v, dec = 0) => (v == null || Number.isNaN(v) ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : '±'}${fmt(Math.abs(v), dec)}`);
export const fmtHours = (h) => (h == null ? '—' : `${Math.floor(h)}h ${pad(Math.round((h % 1) * 60))}m`);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const mean = (a) => { const x = a.filter((v) => v != null && !Number.isNaN(v)); return x.length ? x.reduce((s, v) => s + v, 0) / x.length : null; };
export const sum = (a) => a.reduce((s, v) => s + (v || 0), 0);
export function sd(a) {
  const x = a.filter((v) => v != null);
  if (x.length < 2) return null;
  const m = mean(x);
  return Math.sqrt(x.reduce((s, v) => s + (v - m) ** 2, 0) / (x.length - 1));
}
export function slope(points) { // [[x,y]] least squares
  const p = points.filter(([, y]) => y != null);
  if (p.length < 2) return null;
  const mx = mean(p.map((q) => q[0])), my = mean(p.map((q) => q[1]));
  const num = p.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0);
  const den = p.reduce((s, [x]) => s + (x - mx) ** 2, 0);
  return den ? num / den : null;
}
/** Minutes after 18:00 of the evening before — makes bedtimes around midnight comparable. */
export function bedMinutes(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  let m = d.getHours() * 60 + d.getMinutes() - 18 * 60;
  if (m < 0) m += 24 * 60;
  return m;
}
export const minutesToClock = (m) => { if (m == null) return '—'; const t = (Math.round(m) + 18 * 60) % (24 * 60); return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`; };
export const clockToMinutes = (hhmm) => { if (!hhmm) return null; const [h, mi] = hhmm.split(':').map(Number); let m = h * 60 + mi - 18 * 60; if (m < 0) m += 1440; return m; };
export const wakeMinutes = (ts) => { if (!ts) return null; const d = new Date(ts); return d.getHours() * 60 + d.getMinutes(); };
