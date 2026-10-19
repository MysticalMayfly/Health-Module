// SQLite storage (Node's built-in node:sqlite — no native build step).
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.LIFEOS_DATA || path.resolve('data');
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

export const db = new DatabaseSync(path.join(DATA_DIR, 'lifeos.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);

-- Generic time series: every scalar metric (weight, steps, hrv, bp, check-in scores, tests, custom...)
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY, metric TEXT NOT NULL, date TEXT NOT NULL, ts TEXT NOT NULL,
  value REAL, value2 REAL, text TEXT, source TEXT NOT NULL DEFAULT 'manual', meta TEXT,
  UNIQUE(metric, ts, source));
CREATE INDEX IF NOT EXISTS ix_entries_metric_date ON entries(metric, date);

CREATE TABLE IF NOT EXISTS metric_defs (
  key TEXT PRIMARY KEY, name TEXT, type TEXT, unit TEXT, layer INTEGER, domain TEXT,
  target REAL, direction TEXT, agg TEXT, min REAL, max REAL);

CREATE TABLE IF NOT EXISTS foods (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, aliases TEXT, category TEXT, cuisine TEXT,
  serving_name TEXT, serving_g REAL, kcal REAL, protein REAL, carbs REAL, fat REAL, fiber REAL,
  sugar REAL, satfat REAL, sodium REAL, potassium REAL, calcium REAL, iron REAL, vitc REAL,
  nova INTEGER, micros TEXT, source TEXT, barcode TEXT, ext_id TEXT, favorite INTEGER DEFAULT 0);
CREATE INDEX IF NOT EXISTS ix_foods_name ON foods(name);
CREATE UNIQUE INDEX IF NOT EXISTS ux_foods_ext ON foods(source, ext_id);

CREATE TABLE IF NOT EXISTS food_logs (
  id INTEGER PRIMARY KEY, date TEXT NOT NULL, meal TEXT, food_id INTEGER, name TEXT, grams REAL,
  kcal REAL, protein REAL, carbs REAL, fat REAL, fiber REAL, sugar REAL, satfat REAL, sodium REAL,
  potassium REAL, calcium REAL, iron REAL, vitc REAL, nova INTEGER, time TEXT, created TEXT);
CREATE INDEX IF NOT EXISTS ix_food_logs_date ON food_logs(date);

CREATE TABLE IF NOT EXISTS meals (id INTEGER PRIMARY KEY, name TEXT, kind TEXT, items TEXT, notes TEXT);

CREATE TABLE IF NOT EXISTS workouts (
  id INTEGER PRIMARY KEY, date TEXT NOT NULL, kind TEXT, title TEXT, duration REAL, rpe REAL,
  zone INTEGER, distance REAL, kcal REAL, notes TEXT, sets TEXT, source TEXT DEFAULT 'manual', ext_id TEXT);
CREATE INDEX IF NOT EXISTS ix_workouts_date ON workouts(date);

CREATE TABLE IF NOT EXISTS sleep (
  id INTEGER PRIMARY KEY, date TEXT NOT NULL UNIQUE, bed TEXT, wake TEXT, duration REAL,
  quality REAL, efficiency REAL, latency REAL, awakenings REAL, deep REAL, rem REAL,
  hygiene TEXT, source TEXT DEFAULT 'manual');

CREATE TABLE IF NOT EXISTS labs (
  id INTEGER PRIMARY KEY, date TEXT NOT NULL, marker TEXT NOT NULL, value REAL, lab TEXT, notes TEXT);
CREATE INDEX IF NOT EXISTS ix_labs_marker ON labs(marker, date);

-- Medical + misc. structured records (conditions, meds, symptoms, experiments, protocols...)
CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY, kind TEXT NOT NULL, date TEXT, data TEXT, active INTEGER DEFAULT 1);
CREATE INDEX IF NOT EXISTS ix_records_kind ON records(kind, date);

-- Daily action items (from onboarding) and their completion log
CREATE TABLE IF NOT EXISTS actions (
  id INTEGER PRIMARY KEY, key TEXT, title TEXT, domain TEXT, layer INTEGER, phase INTEGER,
  auto TEXT, why TEXT, active INTEGER DEFAULT 1, sort INTEGER DEFAULT 0, created TEXT);
CREATE TABLE IF NOT EXISTS action_logs (
  date TEXT NOT NULL, action_id INTEGER NOT NULL, done INTEGER, PRIMARY KEY(date, action_id));
CREATE TABLE IF NOT EXISTS med_logs (
  date TEXT NOT NULL, record_id INTEGER NOT NULL, done INTEGER, PRIMARY KEY(date, record_id));

CREATE TABLE IF NOT EXISTS photos (id INTEGER PRIMARY KEY, date TEXT, pose TEXT, file TEXT, notes TEXT);

CREATE TABLE IF NOT EXISTS ingest_runs (
  id INTEGER PRIMARY KEY, source TEXT, started TEXT, finished TEXT, status TEXT, counts TEXT, error TEXT);
`);

// Columns stored as JSON text, parsed on the way out.
export const JSON_COLS = {
  entries: ['meta'], foods: ['micros'], meals: ['items'], workouts: ['sets'],
  sleep: ['hygiene'], records: ['data'], ingest_runs: ['counts'],
};

export function parseRow(table, row) {
  if (!row) return row;
  for (const c of JSON_COLS[table] || []) {
    if (row[c] != null) try { row[c] = JSON.parse(row[c]); } catch { /* keep text */ }
  }
  return row;
}

export function serialize(table, obj) {
  const out = { ...obj };
  for (const c of JSON_COLS[table] || []) if (out[c] != null && typeof out[c] !== 'string') out[c] = JSON.stringify(out[c]);
  return out;
}

const colCache = {};
export function columns(table) {
  if (!colCache[table]) colCache[table] = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  return colCache[table];
}

export function insert(table, obj, { upsert = false } = {}) {
  const cols = columns(table);
  const row = serialize(table, obj);
  const keys = Object.keys(row).filter((k) => cols.includes(k) && row[k] !== undefined);
  const sql = `INSERT ${upsert ? 'OR REPLACE ' : ''}INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
  const r = db.prepare(sql).run(...keys.map((k) => row[k]));
  return Number(r.lastInsertRowid);
}

export function update(table, id, obj) {
  const cols = columns(table);
  const row = serialize(table, obj);
  const keys = Object.keys(row).filter((k) => cols.includes(k) && k !== 'id');
  if (!keys.length) return;
  db.prepare(`UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(',')} WHERE id = ?`).run(...keys.map((k) => row[k]), id);
}

export function getSetting(key, fallback = null) {
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return r ? JSON.parse(r.value) : fallback;
}
export function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
}

export function tx(fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}
