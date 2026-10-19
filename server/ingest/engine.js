// Ingest pipeline: adapter.normalize → aggregate → validate → dedupe/inject → log run.
// Adding a new source = drop a file in ./adapters exporting { id, name, normalize(payload) } and register it below.
import { db, insert, tx } from '../db.js';
import { aggregate, validate } from './canonical.js';
import appleHealth from './adapters/appleHealth.js';
import googleFit from './adapters/googleFit.js';
import healthConnect from './adapters/healthConnect.js';
import csv from './adapters/csv.js';

export const ADAPTERS = Object.fromEntries([appleHealth, googleFit, healthConnect, csv].map((a) => [a.id, a]));

export async function ingest(source, payload) {
  const adapter = ADAPTERS[source];
  if (!adapter) throw new Error(`Unknown source "${source}"`);
  const started = new Date().toISOString();
  const runId = insert('ingest_runs', { source, started, status: 'running' });
  try {
    const { samples = [], sleep = [], workouts = [] } = await adapter.normalize(payload);
    const { ok, rejected } = validate(aggregate(samples));
    const counts = tx(() => inject(source, ok, sleep, workouts));
    counts.rejected = rejected.length;
    db.prepare('UPDATE ingest_runs SET finished = ?, status = ?, counts = ? WHERE id = ?')
      .run(new Date().toISOString(), 'ok', JSON.stringify(counts), runId);
    return { runId, ...counts };
  } catch (e) {
    db.prepare('UPDATE ingest_runs SET finished = ?, status = ?, error = ? WHERE id = ?')
      .run(new Date().toISOString(), 'error', String(e.message || e), runId);
    throw e;
  }
}

function inject(source, entries, sleep, workouts) {
  const counts = { entries: 0, sleep: 0, workouts: 0, skipped: 0 };
  // Entries: (metric, ts, source) is unique, so re-syncing the same window just overwrites.
  const up = db.prepare(`INSERT INTO entries (metric, date, ts, value, value2, source, meta) VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(metric, ts, source) DO UPDATE SET value = excluded.value, value2 = excluded.value2`);
  for (const e of entries) {
    up.run(e.metric, e.date, e.ts, e.value, e.value2 ?? null, source, e.meta ? JSON.stringify(e.meta) : null);
    counts.entries++;
  }
  // Sleep: one row per night; never overwrite a night the user logged by hand.
  const getSleep = db.prepare('SELECT id, source FROM sleep WHERE date = ?');
  for (const s of sleep) {
    if (!s.date) continue;
    const ex = getSleep.get(s.date);
    if (ex?.source === 'manual') { counts.skipped++; continue; }
    if (ex) db.prepare('DELETE FROM sleep WHERE id = ?').run(ex.id);
    insert('sleep', { ...s, source });
    counts.sleep++;
  }
  // Workouts: dedupe on (source, ext_id).
  const getW = db.prepare('SELECT id FROM workouts WHERE source = ? AND ext_id = ?');
  for (const w of workouts) {
    if (!w.date || getW.get(source, w.ext_id)) { counts.skipped++; continue; }
    insert('workouts', { ...w, source });
    counts.workouts++;
  }
  return counts;
}

/** Example payloads per source so the UI can dry-run the pipeline without a device. */
export function samplePayload(source) {
  const now = Date.now();
  const day = (d, h = 8) => new Date(now - d * 864e5 + h * 3.6e6 - (now % 864e5)).toISOString();
  if (source === 'health-connect') {
    const records = [];
    for (let d = 0; d < 7; d++) {
      records.push({ type: 'Steps', count: 6000 + Math.round(Math.random() * 5000), startTime: day(d, 9), endTime: day(d, 21) });
      records.push({ type: 'RestingHeartRate', beatsPerMinute: 58 + Math.round(Math.random() * 6), time: day(d, 7) });
      records.push({ type: 'HeartRateVariabilityRmssd', heartRateVariabilityMillis: 45 + Math.round(Math.random() * 20), time: day(d, 7) });
      records.push({ type: 'SleepSession', startTime: day(d + 1, 23), endTime: day(d, 6.5), stages: [] });
    }
    records.push({ type: 'Weight', weight: { inKilograms: 78.4 }, time: day(0, 7) });
    records.push({ type: 'BloodPressure', systolic: { inMillimetersOfMercury: 118 }, diastolic: { inMillimetersOfMercury: 76 }, time: day(0, 8) });
    records.push({ type: 'ExerciseSession', exerciseType: 'RUNNING', title: 'Morning run', startTime: day(1, 7), endTime: day(1, 7.6), distanceKm: 5.2 });
    return { records };
  }
  if (source === 'apple-health') {
    const fmt = (iso) => iso.replace('T', ' ').replace(/\.\d+Z$/, ' +0000');
    return { data: {
      metrics: [
        { name: 'step_count', units: 'count', data: [0, 1, 2, 3, 4].map((d) => ({ date: fmt(day(d, 12)), qty: 7000 + d * 500 })) },
        { name: 'weight_body_mass', units: 'kg', data: [{ date: fmt(day(0, 7)), qty: 78.3 }] },
        { name: 'resting_heart_rate', units: 'count/min', data: [0, 1, 2].map((d) => ({ date: fmt(day(d, 7)), qty: 59 + d })) },
        { name: 'heart_rate_variability', units: 'ms', data: [0, 1, 2].map((d) => ({ date: fmt(day(d, 7)), qty: 52 - d })) },
        { name: 'sleep_analysis', units: 'hr', data: [{ date: fmt(day(0, 7)), asleep: 7.1, deep: 1.2, rem: 1.6, sleepStart: fmt(day(1, 23)), sleepEnd: fmt(day(0, 6.75)) }] },
      ],
      workouts: [{ name: 'Traditional Strength Training', start: fmt(day(2, 18)), duration: 3300 }],
    } };
  }
  if (source === 'google-fit') {
    const ms = (d) => String(now - d * 864e5);
    return {
      aggregate: { bucket: [0, 1, 2].map((d) => ({ startTimeMillis: ms(d), endTimeMillis: ms(d - 1), dataset: [
        { point: [{ dataTypeName: 'com.google.step_count.delta', startTimeNanos: ms(d) + '000000', value: [{ intVal: 8000 + d * 300 }] }] },
        { point: [{ dataTypeName: 'com.google.weight.summary', startTimeNanos: ms(d) + '000000', value: [{ fpVal: 78.5 + d * 0.1 }, { fpVal: 0 }, { fpVal: 0 }] }] },
        { point: [{ dataTypeName: 'com.google.heart_rate.summary', startTimeNanos: ms(d) + '000000', value: [{ fpVal: 72 }, { fpVal: 140 }, { fpVal: 57 }] }] },
      ] })) },
      sleepSessions: { session: [{ startTimeMillis: String(now - 864e5 - 8 * 3.6e6), endTimeMillis: String(now - 864e5 - 0.5 * 3.6e6), activityType: 72 }] },
      sessions: { session: [] },
    };
  }
  if (source === 'csv') {
    return { dateColumn: 'Date', columns: { weight: 'Weight (kg)', bodyfat: 'Body fat %' },
      csv: 'Date,Weight (kg),Body fat %\n' + [0, 7, 14].map((d) => `${new Date(now - d * 864e5).toISOString().slice(0, 10)},${(78 + d * 0.05).toFixed(1)},${(19 + d * 0.02).toFixed(1)}`).join('\n') };
  }
  return {};
}
