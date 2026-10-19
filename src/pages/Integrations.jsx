import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PlugZap, Watch, Smartphone, Cloud, FileSpreadsheet, Database, Play, Upload, Link2, KeyRound, CheckCircle2, XCircle, Loader2, ArrowRight, Copy } from 'lucide-react';
import { PageHeader, Card, CardTitle, Stagger, Button, Field, Input, Select, Badge, Table, Textarea, Modal } from '../components/ui.jsx';
import { useData } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { fmtDate } from '../lib/format.js';
import { METRICS } from '@shared/catalog.js';

const STAGES = ['Source', 'Adapter', 'Normalize', 'Aggregate', 'Validate', 'Dedupe', 'Database'];

function Pipeline() {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {STAGES.map((s, i) => (
        <div key={s} className="flex items-center gap-1.5">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12 }}
            className={`relative overflow-hidden rounded-xl px-3 py-2 text-xs font-semibold ${i === 0 || i === STAGES.length - 1 ? 'grad-bg text-white' : 'bg-raised'}`}>
            {s}
            <motion.span className="absolute inset-0 bg-white/30" initial={{ x: '-100%' }} animate={{ x: '100%' }} transition={{ repeat: Infinity, duration: 2.2, delay: i * 0.3, repeatDelay: 1.5 }} />
          </motion.div>
          {i < STAGES.length - 1 && <motion.span animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.1 }}><ArrowRight size={14} className="text-muted" /></motion.span>}
        </div>
      ))}
    </div>
  );
}

function Result({ r }) {
  if (!r) return null;
  if (r.loading) return <p className="mt-2 flex items-center gap-2 text-sm text-muted"><Loader2 size={14} className="animate-spin" />Running pipeline…</p>;
  if (r.error) return <p className="mt-2 flex items-center gap-2 text-sm text-critical"><XCircle size={14} />{r.error}</p>;
  return <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 flex items-center gap-2 text-sm text-[#0a7d0a] dark:text-good"><CheckCircle2 size={14} />{r.entries} entries · {r.sleep} nights · {r.workouts} workouts imported{r.skipped ? ` · ${r.skipped} skipped` : ''}{r.rejected ? ` · ${r.rejected} rejected (out of range)` : ''}</motion.p>;
}

export default function Integrations() {
  const { refresh, notify, settings, saveSettings } = useData();
  const [info, setInfo] = useState(null);
  const [res, setRes] = useState({});
  const [gf, setGf] = useState(settings.googleFit || {});
  const [csv, setCsv] = useState(null);
  const [foodCsv, setFoodCsv] = useState(null);
  const [payload, setPayload] = useState(null);
  const load = () => api.ingestSources().then(setInfo);
  useEffect(() => { load(); }, []);
  const origin = window.location.origin.replace(':5173', ':3001');
  const token = settings.prefs?.ingestToken;

  const run = async (key, fn) => {
    setRes((r) => ({ ...r, [key]: { loading: true } }));
    try { const out = await fn(); setRes((r) => ({ ...r, [key]: out })); await refresh(); load(); } catch (e) { setRes((r) => ({ ...r, [key]: { error: e.message } })); }
  };
  const sample = (s) => run(s, async () => api.ingest(s, await api.ingestSample(s)));
  const copy = (t) => { navigator.clipboard?.writeText(t); notify('Copied'); };

  const readCsv = (file, setter) => { const fr = new FileReader(); fr.onload = () => setter({ text: fr.result, name: file.name }); fr.readAsText(file); };
  const csvHeaders = csv ? csv.text.split(/\r?\n/)[0].split(',').map((h) => h.replace(/"/g, '').trim()) : [];
  const guess = (metric) => csvHeaders.find((h) => h.toLowerCase().includes((METRICS[metric]?.name || metric).toLowerCase().split(' ')[0])) || '';

  return (
    <div>
      <PageHeader icon={PlugZap} title="Integrations" subtitle="A small ingest engine: each source has an adapter that maps its data into LifeOS's canonical types before injecting it." />
      <Card hover={false} className="mb-4">
        <CardTitle icon={PlugZap} title="How data flows" sub="Adding a source = one adapter file in server/ingest/adapters exporting normalize(payload)" />
        <Pipeline />
        <p className="mt-3 text-xs text-muted">Canonical units: kg · cm · mg/dL · mL · bpm · ms. Daily totals (steps, water) are aggregated per day and source; across sources the app takes the max, so the same steps from a phone and a watch are not double-counted. Nights you logged by hand are never overwritten.</p>
      </Card>

      <Stagger className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card hover={false}>
          <CardTitle icon={Watch} title="Apple Health" sub="No web API exists, so there are two routes" right={<Badge tone="info">iPhone · Watch</Badge>} />
          <div className="space-y-3 text-sm">
            <div className="rounded-xl bg-raised p-3"><b>1 · Full export.</b> Health app → profile → <i>Export All Health Data</i> → unzip → upload <code>export.xml</code> (any size; streamed).
              <label className="mt-2 flex w-fit cursor-pointer items-center gap-2 rounded-lg bg-card px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-line"><Upload size={13} />Upload export.xml<input type="file" accept=".xml" className="hidden" onChange={(e) => { const f = e.target.files[0]; if (!f) return; const fd = new FormData(); fd.append('file', f); run('apple-xml', () => api.ingestAppleXml(fd)); }} /></label>
              <Result r={res['apple-xml']} />
            </div>
            <div className="rounded-xl bg-raised p-3"><b>2 · Automatic sync.</b> Use an exporter app (e.g. “Health Auto Export”) with a REST automation to POST JSON to:
              <div className="mt-2 flex items-center gap-2"><code className="flex-1 truncate rounded-lg bg-card px-2 py-1 text-xs">{origin}/api/ingest/apple-health{token ? `?token=${token}` : ''}</code><Button size="sm" variant="ghost" icon={Copy} onClick={() => copy(`${origin}/api/ingest/apple-health`)} /></div>
            </div>
            <div className="flex gap-2"><Button size="sm" variant="soft" icon={Play} onClick={() => sample('apple-health')}>Test with sample payload</Button><Button size="sm" variant="ghost" onClick={async () => setPayload(await api.ingestSample('apple-health'))}>View format</Button></div>
            <Result r={res['apple-health']} />
          </div>
        </Card>

        <Card hover={false}>
          <CardTitle icon={Smartphone} title="Android Health Connect" sub="On-device API, so a companion app or exporter POSTs records here" right={<Badge tone="good">Recommended for Android</Badge>} />
          <div className="space-y-3 text-sm">
            <p className="text-fg2">Health Connect gathers Samsung Health, Fitbit, Oura, Garmin, Withings and more on the phone. Any exporter (or a tiny companion app) can send records as JSON:</p>
            <div className="flex items-center gap-2"><code className="flex-1 truncate rounded-lg bg-raised px-2 py-1 text-xs">POST {origin}/api/ingest/health-connect</code><Button size="sm" variant="ghost" icon={Copy} onClick={() => copy(`${origin}/api/ingest/health-connect`)} /></div>
            <p className="text-xs text-muted">Supported records: Steps, Weight, BodyFat, RestingHeartRate, HeartRateVariabilityRmssd, SleepSession (with stages), ExerciseSession, BloodPressure, BloodGlucose, Hydration, OxygenSaturation, RespiratoryRate, Vo2Max, ActiveCaloriesBurned.</p>
            <div className="flex gap-2"><Button size="sm" variant="soft" icon={Play} onClick={() => sample('health-connect')}>Test with sample payload</Button><Button size="sm" variant="ghost" onClick={async () => setPayload(await api.ingestSample('health-connect'))}>View format</Button></div>
            <Result r={res['health-connect']} />
          </div>
        </Card>

        <Card hover={false}>
          <CardTitle icon={Cloud} title="Google Fit (REST)" sub="OAuth 2.0 + dataset:aggregate" right={<Badge tone={info?.googleFit.connected ? 'good' : 'neutral'}>{info?.googleFit.connected ? 'Connected' : 'Not connected'}</Badge>} />
          <div className="space-y-3 text-sm">
            <p className="rounded-xl bg-warning/15 p-3 text-xs">Google has deprecated the Fit APIs in favour of Health Connect. This adapter works while your Google Cloud project still has Fit API access; for new setups use Health Connect.</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="OAuth client ID"><Input value={gf.clientId || ''} onChange={(e) => setGf({ ...gf, clientId: e.target.value })} /></Field>
              <Field label="Client secret"><Input type="password" value={gf.clientSecret || ''} onChange={(e) => setGf({ ...gf, clientSecret: e.target.value })} /></Field>
            </div>
            <p className="text-xs text-muted">Redirect URI to register: <code>{origin}/api/integrations/google-fit/callback</code></p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="soft" icon={KeyRound} onClick={async () => { await saveSettings({ googleFit: { ...(settings.googleFit || {}), clientId: gf.clientId, clientSecret: gf.clientSecret } }); notify('Saved'); load(); }}>Save credentials</Button>
              <a href="/api/integrations/google-fit/auth"><Button size="sm" variant="soft" icon={Link2} disabled={!gf.clientId}>Connect</Button></a>
              <Button size="sm" icon={Play} disabled={!info?.googleFit.connected} onClick={() => run('google-fit-sync', () => api.googleFitSync(30))}>Sync 30 days</Button>
              <Button size="sm" variant="ghost" onClick={() => sample('google-fit')}>Test with sample</Button>
            </div>
            <Result r={res['google-fit-sync'] || res['google-fit']} />
          </div>
        </Card>

        <Card hover={false}>
          <CardTitle icon={FileSpreadsheet} title="CSV import" sub="Smart scales, InBody/DEXA, Oura/Whoop exports, spreadsheets" />
          <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg bg-raised px-3 py-1.5 text-sm font-medium hover:bg-line"><Upload size={14} />Choose CSV<input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files[0] && readCsv(e.target.files[0], (x) => setCsv({ ...x, dateColumn: '', map: {} }))} /></label>
          {csv && (
            <div className="mt-3 space-y-2">
              <div className="text-xs text-muted">{csv.name} · columns: {csvHeaders.join(', ')}</div>
              <Field label="Date column"><Select value={csv.dateColumn || csvHeaders.find((h) => /date|day|time/i.test(h)) || ''} onChange={(e) => setCsv({ ...csv, dateColumn: e.target.value })} options={['', ...csvHeaders]} /></Field>
              <div className="grid grid-cols-2 gap-2">
                {['weight', 'bodyfat', 'lean_mass', 'waist', 'steps', 'rhr', 'hrv', 'vo2max', 'spo2'].map((k) => (
                  <Field key={k} label={METRICS[k].name}><Select value={csv.map[k] ?? guess(k)} onChange={(e) => setCsv({ ...csv, map: { ...csv.map, [k]: e.target.value } })} options={['', ...csvHeaders]} /></Field>
                ))}
              </div>
              <Button size="sm" icon={Play} onClick={() => run('csv', () => {
                const columns = Object.fromEntries(['weight', 'bodyfat', 'lean_mass', 'waist', 'steps', 'rhr', 'hrv', 'vo2max', 'spo2'].map((k) => [k, csv.map[k] ?? guess(k)]).filter(([, v]) => v));
                return api.ingest('csv', { csv: csv.text, dateColumn: csv.dateColumn || csvHeaders.find((h) => /date|day|time/i.test(h)), columns });
              })}>Import</Button>
              <p className="text-xs text-muted">Values must already be in kg / cm.</p>
            </div>
          )}
          <Result r={res.csv} />
        </Card>

        <Card hover={false} className="xl:col-span-2">
          <CardTitle icon={Database} title="Food database import" sub="Bring in IFCT 2017, the Indian Nutrient Databank (INDB) recipes, or any nutrient table as CSV. Headers are detected automatically." />
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg bg-raised px-3 py-1.5 text-sm font-medium hover:bg-line"><Upload size={14} />Choose food CSV<input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files[0] && readCsv(e.target.files[0], async (x) => { const prev = await api.importFoodsCsv({ csv: x.text, preview: true }); setFoodCsv({ ...x, ...prev, label: x.name.replace(/\.csv$/i, '').toLowerCase().replace(/\W+/g, '-') }); })} /></label>
            <span className="text-xs text-muted">Values should be per 100 g. Sodium in mg (tick below if the file uses grams).</span>
          </div>
          {foodCsv && (
            <div className="mt-3 space-y-2 text-sm">
              <div>{foodCsv.count} rows · detected mapping:</div>
              <div className="flex flex-wrap gap-1.5">{Object.entries(foodCsv.mapping).map(([k, v]) => <Badge key={k} tone="info">{k} ← {v}</Badge>)}</div>
              <div className="flex flex-wrap items-center gap-3">
                <Field label="Source label"><Input value={foodCsv.label} onChange={(e) => setFoodCsv({ ...foodCsv, label: e.target.value })} className="!w-48" /></Field>
                <label className="mt-5 flex items-center gap-2 text-xs"><input type="checkbox" checked={!!foodCsv.sodiumG} onChange={(e) => setFoodCsv({ ...foodCsv, sodiumG: e.target.checked })} />Sodium is in grams</label>
                <Button size="sm" className="mt-5" icon={Play} onClick={async () => { const r = await api.importFoodsCsv({ csv: foodCsv.text, mapping: foodCsv.mapping, label: foodCsv.label, cuisine: 'Indian', sodiumInGrams: foodCsv.sodiumG }); notify(`${r.imported} foods imported`); setFoodCsv(null); load(); }}>Import foods</Button>
              </div>
            </div>
          )}
        </Card>

        <Card hover={false} className="xl:col-span-2">
          <CardTitle icon={KeyRound} title="Webhook security & run history" sub="Set an ingest token so only your devices can post data" />
          <div className="mb-4 flex flex-wrap items-end gap-2">
            <Field label="Ingest token (sent as X-LifeOS-Token header or ?token=)"><Input defaultValue={token || ''} id="tok" className="!w-80" /></Field>
            <Button size="sm" variant="soft" onClick={async () => { await saveSettings({ prefs: { ...(settings.prefs || {}), ingestToken: document.getElementById('tok').value || undefined } }); notify('Token saved'); }}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => { document.getElementById('tok').value = crypto.randomUUID().replace(/-/g, ''); }}>Generate</Button>
          </div>
          <Table rows={info?.runs || []} columns={[
            { key: 'started', label: 'When', render: (r) => `${fmtDate(r.started.slice(0, 10))} ${r.started.slice(11, 16)}` },
            { key: 'source', label: 'Source' },
            { key: 'status', label: 'Status', render: (r) => <Badge tone={r.status === 'ok' ? 'good' : r.status === 'error' ? 'critical' : 'info'}>{r.status}</Badge> },
            { key: 'counts', label: 'Imported', render: (r) => (r.counts ? `${r.counts.entries} entries · ${r.counts.sleep} nights · ${r.counts.workouts} workouts` : r.error) },
          ]} empty="No syncs yet" />
        </Card>
      </Stagger>
      <Modal open={!!payload} onClose={() => setPayload(null)} title="Example payload" wide><Textarea readOnly value={JSON.stringify(payload, null, 2)} className="h-96 font-mono text-xs" /></Modal>
    </div>
  );
}
