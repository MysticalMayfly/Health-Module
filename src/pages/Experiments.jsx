import { useState } from 'react';
import { motion } from 'framer-motion';
import { FlaskConical, Plus, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import { PageHeader, Card, CardTitle, Stagger, Button, Modal, Field, Input, Textarea, Select, Badge, Empty, Progress, Chip } from '../components/ui.jsx';
import { TimeChart } from '../components/charts.jsx';
import { useData } from '../lib/store.jsx';
import { useTheme } from '../lib/theme.jsx';
import { api } from '../lib/api.js';
import { addDays, dateRange, daysBetween, fmt, fmtDate, mean, sd, todayISO } from '../lib/format.js';
import { METRICS } from '@shared/catalog.js';

const DERIVED = { sleep_duration: 'Sleep duration', sleep_quality: 'Sleep quality', deep_pct: 'Deep sleep %', food_kcal: 'Calories', food_protein: 'Protein', food_upf_pct: 'Ultra-processed %', readiness: 'Readiness', action_score: 'Daily actions %', bed_min: 'Bedtime', glucose_fasting: 'Fasting glucose' };
const label = (k) => DERIVED[k] || METRICS[k]?.name || k;
const PICK = ['hrv', 'rhr', 'sleep_duration', 'sleep_quality', 'deep_pct', 'energy', 'mood', 'stress', 'focus', 'hunger', 'digestion', 'readiness', 'steps', 'weight', 'glucose_fasting', 'food_kcal', 'bed_min'];

/** Before/after comparison with a simple effect size (Cohen's d). */
function analyze(m, metric, start, end) {
  const len = Math.max(7, daysBetween(start, end || m.today));
  const pre = dateRange(addDays(start, -len), addDays(start, -1)).map((d) => m.series(metric)[d]).filter((v) => v != null);
  const dur = dateRange(start, end && end < m.today ? end : m.today).map((d) => m.series(metric)[d]).filter((v) => v != null);
  if (pre.length < 3 || dur.length < 3) return null;
  const a = mean(pre), b = mean(dur), pooled = Math.sqrt(((sd(pre) || 0) ** 2 + (sd(dur) || 0) ** 2) / 2);
  return { pre: a, during: b, delta: b - a, d: pooled ? (b - a) / pooled : null, n: [pre.length, dur.length] };
}

export default function Experiments() {
  const { model: m, refresh, notify } = useData();
  const { c } = useTheme();
  const [edit, setEdit] = useState(null);
  const list = (m.records.experiment || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const save = async () => {
    const { id, ...data } = edit;
    const row = { kind: 'experiment', date: data.start, data };
    if (id) await api.update('records', id, row); else await api.add('records', row);
    setEdit(null); await refresh(); notify('Experiment saved');
  };

  return (
    <div>
      <PageHeader icon={FlaskConical} title="Experiments (n = 1)" subtitle="Make one change, keep everything else the same, and let your own data decide.">
        <Button icon={Plus} onClick={() => setEdit({ title: '', hypothesis: '', intervention: '', start: todayISO(), end: addDays(todayISO(), 21), metrics: ['hrv', 'sleep_duration'], status: 'running', result: '' })}>New experiment</Button>
      </PageHeader>
      {!list.length && <Card hover={false}><Empty icon={FlaskConical} title="No experiments yet" text="Example: no caffeine after 12 pm for 21 days, then compare sleep and HRV against the 21 days before." /></Card>}
      <Stagger className="space-y-4">
        {list.map((r) => {
          const e = r.data;
          const total = Math.max(1, daysBetween(e.start, e.end || m.today));
          const elapsed = Math.min(total, Math.max(0, daysBetween(e.start, m.today)));
          const results = (e.metrics || []).map((k) => ({ k, ...analyze(m, k, e.start, e.end) }));
          const chartDays = dateRange(addDays(e.start, -total), e.end && e.end < m.today ? e.end : m.today);
          return (
            <Card key={r.id} hover={false}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2"><h3 className="text-lg font-semibold">{e.title}</h3><Badge tone={e.status === 'complete' ? 'good' : 'info'}>{e.status}</Badge></div>
                  <p className="text-sm text-fg2"><b>Hypothesis:</b> {e.hypothesis} · <b>Change:</b> {e.intervention}</p>
                  <p className="text-xs text-muted">{fmtDate(e.start)} → {e.end ? fmtDate(e.end) : 'open'} · baseline = the same number of days before the start</p>
                </div>
                <div className="flex gap-1"><Button size="sm" variant="soft" icon={Pencil} onClick={() => setEdit({ id: r.id, ...e })}>Edit</Button><Button size="sm" variant="danger" icon={Trash2} onClick={async () => { await api.remove('records', r.id); refresh(); }} /></div>
              </div>
              <div className="mt-3"><div className="mb-1 flex justify-between text-xs text-muted"><span>Day {elapsed} of {total}</span><span>{Math.round((elapsed / total) * 100)}%</span></div><Progress value={elapsed} max={total} /></div>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                {results.map((x) => (
                  <motion.div key={x.k} whileHover={{ y: -3 }} className="rounded-xl bg-raised p-3">
                    <div className="text-xs text-muted">{label(x.k)}</div>
                    {x.pre != null ? <>
                      <div className="mt-1 text-lg font-bold tabular">{fmt(x.pre, 1)} → {fmt(x.during, 1)}</div>
                      <div className="text-xs"><span className={x.delta > 0 ? 'text-[#0a7d0a] dark:text-good' : 'text-critical'}>{x.delta > 0 ? '+' : ''}{fmt(x.delta, 1)}</span> · effect size d = {x.d == null ? '—' : x.d.toFixed(2)} {x.d != null && Math.abs(x.d) >= 0.5 ? '(meaningful)' : '(small)'}</div>
                    </> : <div className="mt-1 text-sm text-muted">not enough data</div>}
                  </motion.div>
                ))}
              </div>
              {e.metrics?.[0] && <div className="mt-4"><TimeChart data={chartDays.map((d) => ({ date: d, v: m.series(e.metrics[0])[d] ?? null }))} height={170} refLines={[{ x: e.start, label: 'start' }]} series={[{ key: 'v', name: label(e.metrics[0]), type: 'line', color: c.series[0], dot: true }]} /></div>}
              {e.result && <div className="mt-3 flex items-start gap-2 rounded-xl bg-good/10 p-3 text-sm"><CheckCircle2 size={16} className="mt-0.5 text-good" />{e.result}</div>}
            </Card>
          );
        })}
      </Stagger>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit experiment' : 'New experiment'} wide footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save}>Save</Button></>}>
        {edit && <div className="grid grid-cols-2 gap-3">
          <Field label="Title" className="col-span-2"><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="No screens after 10 pm" /></Field>
          <Field label="Hypothesis" className="col-span-2"><Input value={edit.hypothesis} onChange={(e) => setEdit({ ...edit, hypothesis: e.target.value })} placeholder="Sleep quality and HRV improve" /></Field>
          <Field label="Intervention" className="col-span-2"><Textarea value={edit.intervention} onChange={(e) => setEdit({ ...edit, intervention: e.target.value })} /></Field>
          <Field label="Start"><Input type="date" value={edit.start} onChange={(e) => setEdit({ ...edit, start: e.target.value })} /></Field>
          <Field label="End"><Input type="date" value={edit.end || ''} onChange={(e) => setEdit({ ...edit, end: e.target.value })} /></Field>
          <Field label="Metrics to watch" className="col-span-2"><div className="flex flex-wrap gap-1.5">{PICK.map((k) => <Chip key={k} active={edit.metrics?.includes(k)} onClick={() => setEdit({ ...edit, metrics: edit.metrics?.includes(k) ? edit.metrics.filter((x) => x !== k) : [...(edit.metrics || []), k] })}>{label(k)}</Chip>)}</div></Field>
          <Field label="Status"><Select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} options={['planned', 'running', 'complete', 'abandoned']} /></Field>
          <Field label="Conclusion" className="col-span-2"><Textarea value={edit.result || ''} onChange={(e) => setEdit({ ...edit, result: e.target.value })} /></Field>
        </div>}
      </Modal>
    </div>
  );
}
