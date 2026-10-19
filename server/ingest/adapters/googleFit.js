// Google Fit REST adapter (OAuth2 + dataset:aggregate + sessions).
// NOTE: Google has deprecated the Fit APIs in favour of Android Health Connect (on-device). This adapter
// works for accounts that still have Fit API access; for Android going forward use the health-connect adapter
// with a small companion app / exporter that POSTs records to /api/ingest/health-connect.
import { GLUCOSE_MMOL, localDate } from '../canonical.js';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/fitness/v1/users/me';
export const SCOPES = [
  'https://www.googleapis.com/auth/fitness.activity.read',
  'https://www.googleapis.com/auth/fitness.body.read',
  'https://www.googleapis.com/auth/fitness.heart_rate.read',
  'https://www.googleapis.com/auth/fitness.sleep.read',
  'https://www.googleapis.com/auth/fitness.blood_pressure.read',
  'https://www.googleapis.com/auth/fitness.blood_glucose.read',
  'https://www.googleapis.com/auth/fitness.oxygen_saturation.read',
  'https://www.googleapis.com/auth/fitness.nutrition.read',
];

// Fit data type → [canonical metric, value extractor]
const TYPES = {
  'com.google.step_count.delta': ['steps', (v) => v[0].intVal],
  'com.google.weight.summary': ['weight', (v) => v[0].fpVal], // aggregate of com.google.weight → [avg,max,min]
  'com.google.weight': ['weight', (v) => v[0].fpVal],
  'com.google.calories.expended': ['active_kcal', (v) => v[0].fpVal],
  'com.google.body.fat.percentage.summary': ['bodyfat', (v) => v[0].fpVal],
  'com.google.hydration': ['water', (v) => v[0].fpVal * 1000],
  'com.google.oxygen_saturation.summary': ['spo2', (v) => v[0].fpVal],
  'com.google.blood_glucose.summary': ['glucose', (v) => v[0].fpVal * GLUCOSE_MMOL],
};
const AGG_TYPES = ['com.google.step_count.delta', 'com.google.weight', 'com.google.calories.expended',
  'com.google.body.fat.percentage', 'com.google.hydration', 'com.google.blood_pressure', 'com.google.blood_glucose',
  'com.google.oxygen_saturation', 'com.google.heart_rate.bpm'];

export function authUrl({ clientId, redirectUri }) {
  const p = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code',
    access_type: 'offline', prompt: 'consent', scope: SCOPES.join(' ') });
  return `${AUTH_URL}?${p}`;
}

export async function exchangeCode({ clientId, clientSecret, redirectUri, code }) {
  const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }) });
  if (!r.ok) throw new Error(`Token exchange failed: ${r.status} ${await r.text()}`);
  const t = await r.json();
  return { ...t, expires_at: Date.now() + t.expires_in * 1000 };
}

async function accessToken(cfg, saveTokens) {
  const t = cfg.tokens;
  if (!t) throw new Error('Google Fit is not connected yet — click Connect first.');
  if (t.expires_at > Date.now() + 60000) return t.access_token;
  const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, refresh_token: t.refresh_token, grant_type: 'refresh_token' }) });
  if (!r.ok) throw new Error(`Token refresh failed: ${r.status}`);
  const n = await r.json();
  const tokens = { ...t, ...n, expires_at: Date.now() + n.expires_in * 1000 };
  saveTokens(tokens);
  return tokens.access_token;
}

/** Pull `days` of data from the Fit API and return the raw responses (normalize() turns them canonical). */
export async function fetchFit(cfg, days, saveTokens) {
  const token = await accessToken(cfg, saveTokens);
  const end = Date.now(), start = end - days * 864e5;
  const h = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const agg = await fetch(`${API}/dataset:aggregate`, { method: 'POST', headers: h, body: JSON.stringify({
    aggregateBy: AGG_TYPES.map((dataTypeName) => ({ dataTypeName })),
    bucketByTime: { durationMillis: 864e5 }, startTimeMillis: start, endTimeMillis: end }) });
  if (!agg.ok) throw new Error(`Fit aggregate failed: ${agg.status} ${await agg.text()}`);
  const sessions = await fetch(`${API}/sessions?activityType=72&startTime=${new Date(start).toISOString()}&endTime=${new Date(end).toISOString()}`, { headers: h });
  const workouts = await fetch(`${API}/sessions?startTime=${new Date(start).toISOString()}&endTime=${new Date(end).toISOString()}`, { headers: h });
  return { aggregate: await agg.json(), sleepSessions: sessions.ok ? await sessions.json() : { session: [] }, sessions: workouts.ok ? await workouts.json() : { session: [] } };
}

/** Pure transform: Fit API responses → canonical. Testable offline with a saved response. */
export function normalizeFit({ aggregate, sleepSessions, sessions }) {
  const samples = [], sleep = [], workouts = [];
  for (const b of aggregate?.bucket || []) {
    const date = localDate(Number(b.startTimeMillis));
    for (const ds of b.dataset || []) {
      for (const p of ds.point || []) {
        const t = p.dataTypeName;
        if (t === 'com.google.blood_pressure.summary') {
          samples.push({ metric: 'bp', date, ts: new Date(Number(p.startTimeNanos) / 1e6).toISOString(), value: p.value[0].fpVal, value2: p.value[3].fpVal });
        } else if (t === 'com.google.heart_rate.summary') {
          // [avg, max, min] — the daily minimum is a reasonable proxy for resting HR when no RHR source exists
          samples.push({ metric: 'rhr', date, value: p.value[2].fpVal });
        } else if (TYPES[t]) {
          const [metric, get] = TYPES[t];
          samples.push({ metric, date, ts: new Date(Number(p.startTimeNanos) / 1e6).toISOString(), value: get(p.value) });
        }
      }
    }
  }
  for (const s of sleepSessions?.session || []) {
    const bed = new Date(Number(s.startTimeMillis)), wake = new Date(Number(s.endTimeMillis));
    sleep.push({ date: localDate(wake), bed: bed.toISOString(), wake: wake.toISOString(), duration: +((wake - bed) / 3.6e6).toFixed(2) });
  }
  for (const s of sessions?.session || []) {
    if (s.activityType === 72) continue;
    const st = new Date(Number(s.startTimeMillis)), en = new Date(Number(s.endTimeMillis));
    workouts.push({ date: localDate(st), kind: [80, 97, 113, 114].includes(s.activityType) ? 'strength' : 'cardio',
      title: s.name || 'Workout', duration: (en - st) / 6e4, ext_id: `gfit-${s.id}` });
  }
  return { samples, sleep, workouts };
}

export default { id: 'google-fit', name: 'Google Fit', normalize: (payload) => normalizeFit(payload) };
