// The canonical data contract every adapter must produce.
//   entries : { metric, date, ts, value, value2?, meta? }   (value in canonical unit below)
//   sleep   : { date, bed, wake, duration(h), deep(h)?, rem(h)?, efficiency(%)?, awakenings? }
//   workouts: { date, kind, title, duration(min), distance(km)?, kcal?, ext_id }
// Canonical units: kg, cm, %, mg/dL, mmHg, mL, mg, bpm, ms, kcal, steps.
// agg: how many raw samples collapse into one stored entry per day.
//   sum  → one entry per day (ts = date) holding the daily total
//   avg  → one entry per day holding the daily mean
//   each → every reading kept with its own timestamp
export const CANONICAL = {
  weight: { agg: 'each', min: 20, max: 400 },
  bodyfat: { agg: 'each', min: 2, max: 70 },
  waist: { agg: 'each', min: 30, max: 250 },
  steps: { agg: 'sum', min: 0, max: 150000 },
  active_kcal: { agg: 'sum', min: 0, max: 10000 },
  rhr: { agg: 'avg', min: 25, max: 150 },
  hrv: { agg: 'avg', min: 3, max: 300 },
  vo2max: { agg: 'each', min: 10, max: 95 },
  spo2: { agg: 'avg', min: 70, max: 100 },
  resp_rate: { agg: 'avg', min: 4, max: 40 },
  glucose: { agg: 'each', min: 20, max: 600 },
  bp: { agg: 'each', min: 50, max: 260 }, // value = systolic, value2 = diastolic
  water: { agg: 'sum', min: 0, max: 10000 },
  caffeine: { agg: 'sum', min: 0, max: 2000 },
  body_temp: { agg: 'avg', min: 30, max: 43 },
};

export const LB = 0.45359237;
export const GLUCOSE_MMOL = 18.016;

let TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
export function setTimezone(tz) { if (tz) TZ = tz; }

/** Local calendar date (YYYY-MM-DD) for any timestamp-ish value. */
export function localDate(ts) {
  const d = ts instanceof Date ? ts : new Date(typeof ts === 'number' ? ts : String(ts).replace(/ ([+-]\d{4})$/, '$1'));
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
export function iso(ts) {
  const d = ts instanceof Date ? ts : new Date(typeof ts === 'number' ? ts : String(ts).replace(/ ([+-]\d{4})$/, '$1'));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Collapse raw samples into stored entries according to each metric's agg rule. */
export function aggregate(samples) {
  const out = [];
  const buckets = new Map();
  for (const s of samples) {
    const def = CANONICAL[s.metric];
    if (!def || s.value == null || !Number.isFinite(s.value)) continue;
    const date = s.date || localDate(s.ts);
    if (!date) continue;
    if (def.agg === 'each') { out.push({ ...s, date, ts: iso(s.ts) || date }); continue; }
    const k = `${s.metric}|${date}`;
    const b = buckets.get(k) || { metric: s.metric, date, sum: 0, n: 0 };
    b.sum += s.value; b.n += 1;
    buckets.set(k, b);
  }
  for (const b of buckets.values()) {
    const agg = CANONICAL[b.metric].agg;
    out.push({ metric: b.metric, date: b.date, ts: b.date, value: agg === 'sum' ? b.sum : b.sum / b.n });
  }
  return out;
}

/** Drop out-of-range values; returns { ok, rejected }. */
export function validate(entries) {
  const ok = [], rejected = [];
  for (const e of entries) {
    const def = CANONICAL[e.metric];
    const inRange = (v) => v >= def.min && v <= def.max;
    if (def && inRange(e.value) && (e.value2 == null || inRange(e.value2))) ok.push(e); else rejected.push(e);
  }
  return { ok, rejected };
}
