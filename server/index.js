import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { db, insert, update, parseRow, getSetting, setSetting, columns, tx, UPLOAD_DIR } from './db.js';
import { seedFoods } from './seed/foods.js';
import { loadDemo } from './seed/demo.js';
import { ingest, samplePayload, ADAPTERS } from './ingest/engine.js';
import { setTimezone } from './ingest/canonical.js';
import { parseCsv } from './ingest/adapters/csv.js';
import * as gfit from './ingest/adapters/googleFit.js';
import { searchUsda, searchOff, barcodeOff } from './foods-external.js';

seedFoods(db);
setTimezone(getSetting('prefs', {})?.timezone);

const app = express();
app.use(express.json({ limit: '50mb' }));
const upload = multer({ dest: path.join(UPLOAD_DIR, 'tmp'), limits: { fileSize: 2 * 1024 ** 3 } });
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => { console.error(e); res.status(500).json({ error: String(e.message || e) }); });

// ── Generic CRUD over whitelisted tables
const TABLES = ['entries', 'foods', 'food_logs', 'meals', 'workouts', 'sleep', 'labs', 'records', 'actions', 'action_logs', 'med_logs', 'photos', 'metric_defs', 'ingest_runs'];
const ensureTable = (t) => { if (!TABLES.includes(t)) throw Object.assign(new Error('bad table'), { status: 400 }); };

app.get('/api/t/:table', wrap((req, res) => {
  const { table } = req.params; ensureTable(table);
  const cols = columns(table);
  const where = [], args = [];
  if (req.query.from && cols.includes('date')) { where.push('date >= ?'); args.push(req.query.from); }
  if (req.query.to && cols.includes('date')) { where.push('date <= ?'); args.push(req.query.to); }
  for (const k of ['kind', 'metric', 'marker', 'meal', 'source', 'id']) if (req.query[k] && cols.includes(k)) { where.push(`${k} = ?`); args.push(req.query[k]); }
  const order = cols.includes('date') ? 'ORDER BY date, id' : cols.includes('id') ? 'ORDER BY id' : '';
  const lim = req.query.limit ? `LIMIT ${Number(req.query.limit)}` : '';
  const rows = db.prepare(`SELECT * FROM ${table} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ${order} ${lim}`).all(...args);
  res.json(rows.map((r) => parseRow(table, r)));
}));

app.post('/api/t/:table', wrap((req, res) => {
  const { table } = req.params; ensureTable(table);
  const items = Array.isArray(req.body) ? req.body : [req.body];
  const ids = tx(() => items.map((it) => {
    if (table === 'entries') {
      const e = { source: 'manual', ts: it.ts || it.date, ...it };
      db.prepare('DELETE FROM entries WHERE metric = ? AND ts = ? AND source = ?').run(e.metric, e.ts, e.source);
      return insert('entries', e);
    }
    if (table === 'sleep') { db.prepare('DELETE FROM sleep WHERE date = ?').run(it.date); return insert('sleep', { source: 'manual', ...it }); }
    if (table === 'action_logs' || table === 'med_logs') {
      const key = table === 'action_logs' ? 'action_id' : 'record_id';
      db.prepare(`INSERT OR REPLACE INTO ${table} (date, ${key}, done) VALUES (?,?,?)`).run(it.date, it[key], it.done ? 1 : 0);
      return null;
    }
    if (table === 'metric_defs') return insert(table, it, { upsert: true });
    return insert(table, it);
  }));
  res.json({ ids });
}));

app.put('/api/t/:table/:id', wrap((req, res) => { ensureTable(req.params.table); update(req.params.table, Number(req.params.id), req.body); res.json({ ok: true }); }));

app.delete('/api/t/:table/:id', wrap((req, res) => {
  const { table, id } = req.params; ensureTable(table);
  if (table === 'photos') {
    const p = db.prepare('SELECT file FROM photos WHERE id = ?').get(id);
    if (p) fs.rmSync(path.join(UPLOAD_DIR, p.file), { force: true });
  }
  if (table === 'metric_defs') db.prepare('DELETE FROM metric_defs WHERE key = ?').run(id);
  else db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(Number(id));
  if (table === 'actions') db.prepare('DELETE FROM action_logs WHERE action_id = ?').run(Number(id));
  res.json({ ok: true });
}));

app.post('/api/entries/delete', wrap((req, res) => {
  const { metric, date } = req.body;
  db.prepare('DELETE FROM entries WHERE metric = ? AND date = ? AND source = ?').run(metric, date, 'manual');
  res.json({ ok: true });
}));

// ── Bundle: everything the dashboards need, in one round-trip
app.get('/api/bundle', wrap((req, res) => {
  const from = req.query.from || '1900-01-01';
  const q = (sql, ...a) => db.prepare(sql).all(...a);
  const foodDaily = q(`SELECT l.date, COUNT(*) AS items, SUM(l.kcal) kcal, SUM(l.protein) protein, SUM(l.carbs) carbs, SUM(l.fat) fat,
      SUM(l.fiber) fiber, SUM(l.sugar) sugar, SUM(l.satfat) satfat, SUM(l.sodium) sodium, SUM(l.potassium) potassium,
      SUM(l.calcium) calcium, SUM(l.iron) iron, SUM(l.vitc) vitc,
      SUM(CASE WHEN l.nova = 4 THEN l.kcal ELSE 0 END) kcal_upf,
      SUM(CASE WHEN f.category IN ('Fruits','Vegetables','Salads') THEN l.grams / 80.0 ELSE 0 END) plant_servings,
      COUNT(DISTINCT CASE WHEN f.category IN ('Fruits','Vegetables','Salads','Legumes','Nuts & seeds') THEN l.food_id END) plant_variety,
      MAX(CASE WHEN l.meal = 'dinner' THEN l.time END) last_meal
    FROM food_logs l LEFT JOIN foods f ON f.id = l.food_id WHERE l.date >= ? GROUP BY l.date ORDER BY l.date`, from);
  const mealDaily = q(`SELECT date, meal, SUM(kcal) kcal, SUM(protein) protein FROM food_logs WHERE date >= ? GROUP BY date, meal`, from);
  res.json({
    entries: q('SELECT id, metric, date, ts, value, value2, text, source, meta FROM entries WHERE date >= ? ORDER BY ts', from).map((r) => parseRow('entries', r)),
    foodDaily, mealDaily,
    sleep: q('SELECT * FROM sleep WHERE date >= ? ORDER BY date', from).map((r) => parseRow('sleep', r)),
    workouts: q('SELECT * FROM workouts WHERE date >= ? ORDER BY date', from).map((r) => parseRow('workouts', r)),
    labs: q('SELECT * FROM labs ORDER BY date'),
    records: q('SELECT * FROM records ORDER BY date').map((r) => parseRow('records', r)),
    actions: q('SELECT * FROM actions ORDER BY sort, id'),
    actionLogs: q('SELECT * FROM action_logs WHERE date >= ?', from),
    medLogs: q('SELECT * FROM med_logs WHERE date >= ?', from),
    photos: q('SELECT * FROM photos ORDER BY date'),
    metricDefs: q('SELECT * FROM metric_defs'),
  });
}));

// ── Settings
app.get('/api/settings', wrap((req, res) => {
  res.json(Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map((r) => [r.key, JSON.parse(r.value)])));
}));
app.put('/api/settings', wrap((req, res) => {
  for (const [k, v] of Object.entries(req.body)) setSetting(k, v);
  if (req.body.prefs?.timezone) setTimezone(req.body.prefs.timezone);
  res.json({ ok: true });
}));

// ── Foods
app.get('/api/foods/search', wrap((req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (!q) {
    const recent = db.prepare(`SELECT f.*, COUNT(l.id) uses FROM foods f JOIN food_logs l ON l.food_id = f.id
      GROUP BY f.id ORDER BY f.favorite DESC, uses DESC LIMIT 30`).all();
    return res.json(recent.map((r) => parseRow('foods', r)));
  }
  const terms = q.split(/\s+/).filter(Boolean);
  const where = terms.map(() => "(LOWER(name) LIKE ? OR LOWER(IFNULL(aliases,'')) LIKE ?)").join(' AND ');
  const args = terms.flatMap((t) => [`%${t}%`, `%${t}%`]);
  const rows = db.prepare(`SELECT f.*, (SELECT COUNT(*) FROM food_logs l WHERE l.food_id = f.id) uses FROM foods f WHERE ${where} LIMIT 200`).all(...args);
  const score = (f) => {
    const n = f.name.toLowerCase();
    return (n === q ? 100 : 0) + (n.startsWith(q) ? 40 : 0) + (f.favorite ? 30 : 0) + Math.min(f.uses, 20) + (f.source === 'custom' ? 5 : 0) - n.length / 20;
  };
  res.json(rows.sort((a, b) => score(b) - score(a)).slice(0, 50).map((r) => parseRow('foods', r)));
}));

app.get('/api/foods/external', wrap(async (req, res) => {
  const { q, source } = req.query;
  const prefs = getSetting('prefs', {});
  const results = source === 'off' ? await searchOff(q) : await searchUsda(q, prefs.usdaKey || 'DEMO_KEY');
  res.json(results);
}));

app.get('/api/foods/barcode/:code', wrap(async (req, res) => {
  const local = db.prepare('SELECT * FROM foods WHERE barcode = ?').get(req.params.code);
  if (local) return res.json(parseRow('foods', local));
  const f = await barcodeOff(req.params.code);
  if (!f) return res.status(404).json({ error: 'Not found in Open Food Facts' });
  res.json(f);
}));

// Save an external/custom food (dedupes on source + ext_id); returns the local id
app.post('/api/foods/save', wrap((req, res) => {
  const f = req.body;
  if (f.ext_id) {
    const ex = db.prepare('SELECT id FROM foods WHERE source = ? AND ext_id = ?').get(f.source, f.ext_id);
    if (ex) return res.json({ id: ex.id });
  }
  res.json({ id: insert('foods', { source: 'custom', ...f, id: undefined }) });
}));

// Bulk import foods from CSV (IFCT / INDB / any nutrient table) with automatic header detection
const FOOD_HEADER_HINTS = {
  name: [/^(food[ _]?)?name$/i, /food_name|description|dish|item/i],
  kcal: [/energy.*kcal|kcal|calor/i, /^energy$/i],
  protein: [/protein/i], carbs: [/carb|cho/i], fat: [/^(total[ _]?)?fat|fat_g|lipid|fat \(g\)/i],
  fiber: [/fib/i], sugar: [/sugar/i], satfat: [/sat|sfa/i], sodium: [/sodium|\bna\b/i], potassium: [/potassium|\bk\b/i],
  calcium: [/calcium|\bca\b/i], iron: [/iron|\bfe\b/i], vitc: [/vit.*c|ascorb/i],
  serving_g: [/serving.*g|portion.*g/i], category: [/category|group/i],
};
export function detectFoodHeaders(headers) {
  const map = {};
  for (const [field, pats] of Object.entries(FOOD_HEADER_HINTS)) {
    for (const p of pats) {
      const h = headers.find((x) => p.test(x) && !Object.values(map).includes(x) && !(field === 'fat' && /sat|sfa|mufa|pufa|trans/i.test(x)));
      if (h) { map[field] = h; break; }
    }
  }
  return map;
}
app.post('/api/foods/import-csv', wrap((req, res) => {
  const rows = parseCsv(req.body.csv || '');
  if (!rows.length) return res.status(400).json({ error: 'Empty CSV' });
  const map = req.body.mapping || detectFoodHeaders(Object.keys(rows[0]));
  if (req.body.preview) return res.json({ mapping: map, headers: Object.keys(rows[0]), count: rows.length, sample: rows.slice(0, 3) });
  const label = req.body.label || 'csv';
  const toMg = req.body.sodiumInGrams ? 1000 : 1;
  let n = 0;
  tx(() => rows.forEach((r, i) => {
    const name = r[map.name];
    if (!name) return;
    const num = (k) => { const v = parseFloat(r[map[k]]); return Number.isFinite(v) ? v : null; };
    db.prepare('DELETE FROM foods WHERE source = ? AND ext_id = ?').run(label, `${label}-${i}`);
    insert('foods', { name, category: r[map.category] || 'Imported', cuisine: req.body.cuisine || null, serving_name: '100 g', serving_g: num('serving_g') || 100,
      kcal: num('kcal'), protein: num('protein'), carbs: num('carbs'), fat: num('fat'), fiber: num('fiber'), sugar: num('sugar'), satfat: num('satfat'),
      sodium: num('sodium') != null ? num('sodium') * toMg : null, potassium: num('potassium'), calcium: num('calcium'), iron: num('iron'), vitc: num('vitc'),
      source: label, ext_id: `${label}-${i}` });
    n++;
  }));
  res.json({ imported: n, mapping: map });
}));

app.get('/api/foods/stats', wrap((req, res) => {
  res.json(db.prepare('SELECT source, COUNT(*) n FROM foods GROUP BY source').all());
}));

// ── Photos
app.use('/uploads', express.static(UPLOAD_DIR));
app.post('/api/photos', upload.single('file'), wrap((req, res) => {
  const ext = path.extname(req.file.originalname || '.jpg').toLowerCase() || '.jpg';
  const name = `photo-${Date.now()}${ext}`;
  fs.renameSync(req.file.path, path.join(UPLOAD_DIR, name));
  res.json({ id: insert('photos', { date: req.body.date, pose: req.body.pose, notes: req.body.notes, file: name }) });
}));

// ── Integrations / ingest engine
const tokenOk = (req) => {
  const t = getSetting('prefs', {})?.ingestToken;
  return !t || req.get('x-lifeos-token') === t || req.query.token === t;
};
app.get('/api/ingest/sources', wrap((req, res) => {
  const runs = db.prepare('SELECT * FROM ingest_runs ORDER BY id DESC LIMIT 50').all().map((r) => parseRow('ingest_runs', r));
  const gf = getSetting('googleFit', {});
  res.json({ sources: Object.values(ADAPTERS).map((a) => ({ id: a.id, name: a.name })), runs, googleFit: { configured: !!gf.clientId, connected: !!gf.tokens } });
}));
app.get('/api/ingest/sample/:source', wrap((req, res) => res.json(samplePayload(req.params.source))));
app.post('/api/ingest/apple-health/upload', upload.single('file'), wrap(async (req, res) => {
  try { res.json(await ingest('apple-health', { filePath: req.file.path })); } finally { fs.rmSync(req.file.path, { force: true }); }
}));
app.post('/api/ingest/:source', wrap(async (req, res) => {
  if (!tokenOk(req)) return res.status(401).json({ error: 'Bad ingest token' });
  res.json(await ingest(req.params.source, req.body));
}));

app.get('/api/integrations/google-fit/auth', wrap((req, res) => {
  const cfg = getSetting('googleFit', {});
  if (!cfg.clientId) return res.status(400).send('Add your Google OAuth client ID & secret in Integrations first.');
  res.redirect(gfit.authUrl({ clientId: cfg.clientId, redirectUri: `${req.protocol}://${req.get('host')}/api/integrations/google-fit/callback` }));
}));
app.get('/api/integrations/google-fit/callback', wrap(async (req, res) => {
  const cfg = getSetting('googleFit', {});
  const tokens = await gfit.exchangeCode({ ...cfg, code: req.query.code, redirectUri: `${req.protocol}://${req.get('host')}/api/integrations/google-fit/callback` });
  setSetting('googleFit', { ...cfg, tokens });
  res.redirect('/integrations?connected=google-fit');
}));
app.post('/api/integrations/google-fit/sync', wrap(async (req, res) => {
  const cfg = getSetting('googleFit', {});
  const raw = await gfit.fetchFit(cfg, req.body.days || 30, (tokens) => setSetting('googleFit', { ...cfg, tokens }));
  res.json(await ingest('google-fit', raw));
}));

// ── Data management
const ALL = ['settings', ...TABLES];
app.get('/api/export', wrap((req, res) => {
  const out = { app: 'lifeos-health', version: 1, exported: new Date().toISOString() };
  for (const t of ALL) out[t] = db.prepare(`SELECT * FROM ${t}`).all();
  res.setHeader('content-disposition', `attachment; filename="lifeos-health-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(out);
}));
app.post('/api/import', wrap((req, res) => {
  const data = req.body;
  if (data.app !== 'lifeos-health') return res.status(400).json({ error: 'Not a LifeOS export file' });
  tx(() => {
    for (const t of ALL) {
      if (!Array.isArray(data[t])) continue;
      db.exec(`DELETE FROM ${t}`);
      for (const row of data[t]) {
        const keys = Object.keys(row);
        db.prepare(`INSERT INTO ${t} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map((k) => row[k]));
      }
    }
  });
  res.json({ ok: true });
}));
app.post('/api/reset', wrap((req, res) => {
  tx(() => {
    for (const t of ['entries', 'food_logs', 'meals', 'workouts', 'sleep', 'labs', 'records', 'actions', 'action_logs', 'med_logs', 'photos', 'metric_defs', 'ingest_runs']) db.exec(`DELETE FROM ${t}`);
    db.exec("DELETE FROM settings WHERE key IN ('onboarding','profile')");
    if (!req.body?.keepFoods) db.exec("DELETE FROM foods WHERE source <> 'seed'");
  });
  res.json({ ok: true });
}));
app.post('/api/demo', wrap((req, res) => res.json(loadDemo())));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// ── Production: serve the built client
const dist = path.resolve('dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => (req.method === 'GET' ? res.sendFile(path.join(dist, 'index.html')) : next()));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`LifeOS Health API on http://localhost:${PORT}`));
