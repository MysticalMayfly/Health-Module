import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ClipboardCheck, Smile, Thermometer, Brain, Tags, HeartCrack, Search, Save, AlertTriangle } from 'lucide-react';
import { PageHeader, Card, CardTitle, Stagger, Button, Tabs, Field, Input, Badge, Select, StatusPill } from '../components/ui.jsx';
import { TimeChart, BarList, CalendarHeatmap } from '../components/charts.jsx';
import { ScaleInput } from '../components/QuickLog.jsx';
import RecordManager from '../components/RecordManager.jsx';
import { useData } from '../lib/store.jsx';
import { useTheme } from '../lib/theme.jsx';
import { api } from '../lib/api.js';
import { addDays, dateRange, fmt, fmtDate, mean, todayISO, weekStart } from '../lib/format.js';
import { METRICS, CHECKIN_KEYS } from '@shared/catalog.js';

const GAD7 = ['Feeling nervous, anxious or on edge', 'Not being able to stop or control worrying', 'Worrying too much about different things', 'Trouble relaxing', 'Being so restless that it is hard to sit still', 'Becoming easily annoyed or irritable', 'Feeling afraid, as if something awful might happen'];
const PHQ9 = ['Little interest or pleasure in doing things', 'Feeling down, depressed, or hopeless', 'Trouble falling or staying asleep, or sleeping too much', 'Feeling tired or having little energy', 'Poor appetite or overeating', 'Feeling bad about yourself, or that you are a failure or have let yourself or your family down', 'Trouble concentrating on things, such as reading or watching television', 'Moving or speaking so slowly that other people could have noticed, or the opposite: being fidgety or restless', 'Thoughts that you would be better off dead, or of hurting yourself'];
const OPTS = ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'];
const band = (score, kind) => (kind === 'gad7' ? (score < 5 ? ['Minimal', 'good'] : score < 10 ? ['Mild', 'warning'] : score < 15 ? ['Moderate', 'serious'] : ['Severe', 'critical'])
  : score < 5 ? ['Minimal', 'good'] : score < 10 ? ['Mild', 'warning'] : score < 15 ? ['Moderate', 'serious'] : score < 20 ? ['Moderately severe', 'critical'] : ['Severe', 'critical']);

function Questionnaire({ kind, items }) {
  const { refresh, notify, model: m } = useData();
  const [a, setA] = useState({});
  const score = Object.values(a).reduce((s, v) => s + v, 0);
  const complete = Object.keys(a).length === items.length;
  const [lbl, tone] = band(score, kind);
  const hist = Object.entries(m.series(kind)).sort().map(([date, v]) => ({ date, v }));
  return (
    <Card hover={false}>
      <CardTitle icon={Brain} title={kind === 'gad7' ? 'GAD-7 · anxiety' : 'PHQ-9 · mood'} sub="Over the last 2 weeks, how often have you been bothered by…" right={<StatusPill status={complete ? tone : null} label={complete ? `${score} · ${lbl}` : `${Object.keys(a).length}/${items.length}`} />} />
      <div className="space-y-3">
        {items.map((q, i) => (
          <div key={i}>
            <div className="mb-1.5 text-sm">{i + 1}. {q}</div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {OPTS.map((o, v) => <motion.button key={o} whileTap={{ scale: 0.95 }} onClick={() => setA({ ...a, [i]: v })} className={`rounded-lg px-2 py-1.5 text-xs transition ${a[i] === v ? 'grad-bg text-white' : 'bg-raised text-fg2 hover:bg-line'}`}>{o}</motion.button>)}
            </div>
          </div>
        ))}
      </div>
      {kind === 'phq9' && a[8] > 0 && (
        <div className="mt-4 flex gap-2 rounded-xl border border-critical/40 bg-critical/10 p-3 text-sm"><AlertTriangle className="shrink-0 text-critical" size={18} />
          <div>Please reach out now. Talk to someone you trust, or contact a crisis line. In India: Tele-MANAS <b>14416</b> or KIRAN <b>1800-599-0019</b>. In the US: <b>988</b>. Elsewhere: your local emergency number. You don’t have to handle this alone.</div></div>
      )}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-muted">A screening tool, not a diagnosis. Scores of 10 or more are worth discussing with a professional.</p>
        <Button icon={Save} disabled={!complete} onClick={async () => { await api.add('entries', { metric: kind, date: todayISO(), value: score }); setA({}); await refresh(); notify(`${kind.toUpperCase()} saved: ${score}`); }}>Save</Button>
      </div>
      {hist.length > 1 && <div className="mt-4"><TimeChart data={hist} height={150} yDomain={[0, kind === 'gad7' ? 21 : 27]} refLines={[{ y: 5 }, { y: 10 }]} series={[{ key: 'v', name: 'Score', type: 'line', dot: true }]} /></div>}
    </Card>
  );
}

export default function CheckIn() {
  const { model: m, refresh, notify } = useData();
  const { c } = useTheme();
  const [tab, setTab] = useState('checkin');
  const [date, setDate] = useState(todayISO());
  const existing = Object.fromEntries([...CHECKIN_KEYS, 'libido', 'bristol'].map((k) => [k, m.series(k)[date]]));
  const [v, setV] = useState({});
  const val = (k) => v[k] ?? (existing[k] != null ? Math.round(existing[k]) : undefined);
  const days = dateRange(addDays(m.today, -89), m.today);
  const trend = days.map((d) => ({ date: d, energy: m.series('energy')[d] ?? null, mood: m.series('mood')[d] ?? null, stress: m.series('stress')[d] ?? null }));
  const heat = Object.fromEntries(Object.entries(m.series('energy')).map(([d, e]) => [d, ((e - 1) / 4) * 100]));

  const save = async () => {
    const rows = Object.entries(v).filter(([, x]) => x != null).map(([metric, value]) => ({ metric, date, value }));
    if (rows.length) await api.add('entries', rows);
    setV({}); await refresh(); notify('Check-in saved');
  };

  // Symptom analytics
  const symptoms = m.records.symptom || [];
  const names = Object.entries(symptoms.reduce((o, s) => ((o[s.data?.name] = (o[s.data?.name] || 0) + 1), o), {})).sort((a, b) => b[1] - a[1]);
  const top = names.slice(0, 4).map(([n]) => n);
  const weekly = useMemo(() => {
    const w = {};
    for (let i = 25; i >= 0; i--) { const k = weekStart(addDays(m.today, -i * 7)); w[k] = { date: k, ...Object.fromEntries(top.map((t) => [t, 0])) }; }
    for (const s of symptoms) { const k = weekStart(s.date); if (w[k] && top.includes(s.data?.name)) w[k][s.data.name]++; }
    return Object.values(w);
  }, [symptoms, top, m.today]);
  const [sym, setSym] = useState(null);
  const trigger = useMemo(() => {
    const name = sym || top[0];
    if (!name) return [];
    const sd = new Set(symptoms.filter((s) => s.data?.name === name).map((s) => s.date));
    const vars = [['sleep_duration', 'Sleep (night before)', 0], ['alcohol', 'Alcohol (day before)', -1], ['food_sugar', 'Sugar (day before)', -1], ['food_upf_pct', 'Ultra-processed % (day before)', -1], ['stress', 'Stress (same day)', 0], ['caffeine', 'Caffeine (day before)', -1], ['water', 'Water (same day)', 0], ['steps', 'Steps (day before)', -1]];
    return vars.map(([k, label, lag]) => {
      const on = [], off = [];
      for (const d of days) { const x = m.series(k)[addDays(d, lag)]; if (x == null) continue; (sd.has(d) ? on : off).push(x); }
      if (on.length < 2 || off.length < 5) return null;
      const a = mean(on), b = mean(off);
      return { name: label, value: Math.round(((a - b) / (Math.abs(b) || 1)) * 100), a, b };
    }).filter(Boolean).sort((x, y) => Math.abs(y.value) - Math.abs(x.value));
  }, [sym, top, symptoms, days, m]);

  return (
    <div>
      <PageHeader icon={ClipboardCheck} title="Check-in & symptoms" subtitle="Subjective signals move before markers do. 30 seconds a day reveals patterns." />
      <Tabs className="mb-5" value={tab} onChange={setTab} tabs={[{ key: 'checkin', label: 'Daily check-in', icon: Smile }, { key: 'symptoms', label: 'Symptoms', icon: Thermometer }, { key: 'illness', label: 'Illness', icon: HeartCrack }, { key: 'mind', label: 'Mind questionnaires', icon: Brain }, { key: 'tags', label: 'Context tags', icon: Tags }]} />

      {tab === 'checkin' && (
        <Stagger className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <Card hover={false} className="xl:col-span-2">
            <CardTitle icon={Smile} title="How are you today?" sub="1 = low/none, 5 = great/high" right={<Input type="date" value={date} max={todayISO()} onChange={(e) => { setDate(e.target.value); setV({}); }} className="!w-40" />} />
            <div className="space-y-3">
              {[...CHECKIN_KEYS, 'libido'].map((k) => <Field key={k} label={METRICS[k].name}><ScaleInput value={val(k)} onChange={(x) => setV({ ...v, [k]: x })} /></Field>)}
              <Field label="Stool (Bristol type 1–7, where 3–4 is ideal)">
                <div className="flex gap-1">{[1, 2, 3, 4, 5, 6, 7].map((n) => <motion.button key={n} whileTap={{ scale: 0.85 }} onClick={() => setV({ ...v, bristol: n })} className={`h-9 flex-1 rounded-lg text-sm font-semibold ${val('bristol') === n ? 'grad-bg text-white' : n === 3 || n === 4 ? 'bg-good/10 text-fg2' : 'bg-raised text-fg2'}`}>{n}</motion.button>)}</div>
              </Field>
            </div>
            <Button className="mt-4 w-full" icon={Save} onClick={save} disabled={!Object.keys(v).length}>Save check-in</Button>
          </Card>
          <div className="space-y-4 xl:col-span-3">
            <Card hover={false}>
              <CardTitle icon={Smile} title="Energy, mood & stress" sub="90 days" />
              <TimeChart data={trend} height={250} yDomain={[1, 5]} series={[{ key: 'energy', name: 'Energy', type: 'line', color: c.series[2] }, { key: 'mood', name: 'Mood', type: 'line', color: c.series[0] }, { key: 'stress', name: 'Stress', type: 'line', color: c.series[1], dashed: true }]} />
            </Card>
            <Card hover={false}>
              <CardTitle icon={Smile} title="Energy calendar" />
              <CalendarHeatmap values={heat} label="energy" unit="%" />
            </Card>
          </div>
        </Stagger>
      )}

      {tab === 'symptoms' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <RecordManager kind="symptom" title="Symptom log" icon={Thermometer} sub={`${symptoms.length} entries`}
            fields={[{ key: 'name', label: 'Symptom' }, { key: '_date', label: 'Date', type: 'date', half: true }, { key: 'severity', label: 'Severity (0–10)', type: 'number', half: true }, { key: 'duration', label: 'Duration', half: true }, { key: 'triggers', label: 'Suspected trigger', half: true }, { key: 'notes', label: 'Notes', type: 'textarea' }]}
            defaults={{ severity: 3 }} compact
            summary={(r) => <div className="flex flex-wrap items-center gap-2"><b className="font-medium">{r.data.name}</b><Badge tone={r.data.severity >= 7 ? 'critical' : r.data.severity >= 4 ? 'warning' : 'neutral'}>{r.data.severity}/10</Badge><span className="text-xs text-muted">{fmtDate(r.date)}{r.data.duration ? ` · ${r.data.duration}` : ''}{r.data.triggers ? ` · ${r.data.triggers}` : ''}</span></div>}
            className="max-h-[720px] overflow-y-auto" />
          <div className="space-y-4">
            <Card hover={false}>
              <CardTitle icon={Thermometer} title="Symptom frequency" sub="Days per week, top symptoms" />
              <TimeChart data={weekly} height={230} series={top.map((t, i) => ({ key: t, name: t, type: 'bar', stack: 's', color: c.series[i] }))} />
            </Card>
            <Card hover={false}>
              <CardTitle icon={Search} title="Trigger finder" sub="Inputs on symptom days vs other days (% difference)" right={top.length > 0 && <Select value={sym || top[0]} onChange={(e) => setSym(e.target.value)} options={top} className="!w-44" />} />
              {trigger.length ? <BarList data={trigger} unit="%" refLine={0} cellColor={(d) => (d.value > 0 ? c.series[1] : c.series[0])} /> : <p className="text-sm text-muted">Log a few symptoms to see patterns.</p>}
              <p className="mt-2 text-xs text-muted">Correlation, not causation. Use Experiments to test a suspected trigger properly.</p>
            </Card>
          </div>
        </div>
      )}

      {tab === 'illness' && (
        <RecordManager kind="illness" title="Illness episodes" icon={HeartCrack} sub="How often you get sick is a strong sign of overall resilience"
          fields={[{ key: 'name', label: 'Illness' }, { key: '_date', label: 'Start', type: 'date', half: true }, { key: 'end', label: 'End', type: 'date', half: true }, { key: 'daysLost', label: 'Days lost (work / training)', type: 'number', half: true }, { key: 'notes', label: 'Notes', type: 'textarea' }]}
          summary={(r) => <div className="flex flex-wrap items-center gap-2"><b className="font-medium">{r.data.name}</b><span className="text-xs text-muted">{fmtDate(r.date)} → {r.data.end ? fmtDate(r.data.end) : 'ongoing'}</span><Badge>{r.data.daysLost ?? 0} days lost</Badge></div>} />
      )}

      {tab === 'mind' && <div className="grid grid-cols-1 gap-4 xl:grid-cols-2"><Questionnaire kind="gad7" items={GAD7} /><Questionnaire kind="phq9" items={PHQ9} /></div>}

      {tab === 'tags' && (
        <RecordManager kind="context" title="Context tags" icon={Tags} sub="Mark days as travel, sick, period, high-stress or fasting so analyses can explain or exclude them"
          fields={[{ key: '_date', label: 'Date', type: 'date' }, { key: 'tags', label: 'Tags (comma-separated)', type: 'tags', placeholder: 'travel, high-stress' }]}
          summary={(r) => <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-muted">{fmtDate(r.date, 'EEE d MMM yyyy')}</span>{(r.data.tags || []).map((t) => <Badge key={t} tone="info">{t}</Badge>)}</div>} />
      )}
    </div>
  );
}
