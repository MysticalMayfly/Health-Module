import { useState } from 'react';
import { HeartPulse, Syringe, Wind, Activity, Plus, Flower2, CheckCircle2, XCircle, HelpCircle, Droplet } from 'lucide-react';
import { PageHeader, Card, CardTitle, Stagger, Button, Tabs, StatusPill, Table, Segmented, Badge, Field, Input, Select } from '../components/ui.jsx';
import { StatTile } from '../components/motion.jsx';
import { TimeChart, Donut, CalendarHeatmap } from '../components/charts.jsx';
import QuickLog from '../components/QuickLog.jsx';
import { useData } from '../lib/store.jsx';
import { useTheme } from '../lib/theme.jsx';
import { api } from '../lib/api.js';
import { addDays, dateRange, fmt, fmtDate, fmtTime, mean, daysBetween, todayISO } from '../lib/format.js';

export function bpClass(s, d) {
  if (s == null) return null;
  if (s > 180 || d > 120) return ['Hypertensive crisis', 'critical'];
  if (s >= 140 || d >= 90) return ['Stage 2 hypertension', 'critical'];
  if (s >= 130 || d >= 80) return ['Stage 1 hypertension', 'serious'];
  if (s >= 120) return ['Elevated', 'warning'];
  return ['Normal', 'good'];
}

export default function Vitals() {
  const { model: m, refresh, notify, u, bundle } = useData();
  const { c } = useTheme();
  const [tab, setTab] = useState('bp');
  const [log, setLog] = useState(null);
  const [range, setRange] = useState('90');
  const from = addDays(m.today, -Number(range));
  const bp = m.readings.bp.filter((r) => r.date >= from);
  const bpData = bp.map((r) => ({ date: r.date, sys: r.value, dia: r.value2 }));
  const last7 = m.readings.bp.slice(-7);
  const bpAvg = last7.length ? [mean(last7.map((r) => r.value)), mean(last7.map((r) => r.value2))] : [null, null];
  const cls = bpClass(...bpAvg);
  const glu = m.readings.glucose.filter((r) => r.date >= from);
  const gFast = glu.filter((r) => /fast/i.test(r.meta?.context || '')).map((r) => ({ date: r.date, fasting: +u.from(r.value, 'glucose').toFixed(1) }));
  const gPost = glu.filter((r) => /post/i.test(r.meta?.context || ''));
  const tir = glu.length ? Math.round((glu.filter((r) => r.value >= 70 && r.value <= 140).length / glu.length) * 100) : null;
  const ctxCounts = Object.entries(glu.reduce((o, r) => ((o[r.meta?.context || 'random'] = (o[r.meta?.context || 'random'] || 0) + 1), o), {})).map(([name, value]) => ({ name, value }));
  const heart = dateRange(from, m.today).map((d) => ({ date: d, rhr: m.series('rhr')[d] ?? null, hrv: m.series('hrv')[d] ?? null, spo2: m.series('spo2')[d] ?? null, resp: m.series('resp_rate')[d] ?? null }));

  // Metabolic syndrome criteria (Asian waist cut-offs optional)
  const male = m.profile.sex !== 'female';
  const asian = m.settings.prefs?.asianCutoffs ?? true;
  const waist = m.latest('waist')?.value;
  const tg = m.labLatest('triglycerides')?.value, hdl = m.labLatest('hdl')?.value;
  const fg = m.avgWin('glucose_fasting', m.today, 60) ?? m.labLatest('fasting_glucose')?.value;
  const crit = [
    { name: `Waist ≥ ${male ? (asian ? 90 : 102) : asian ? 80 : 88} cm`, met: waist == null ? null : waist >= (male ? (asian ? 90 : 102) : asian ? 80 : 88), v: waist && u.show(waist, 'length', 1) },
    { name: 'BP ≥ 130/85', met: bpAvg[0] == null ? null : bpAvg[0] >= 130 || bpAvg[1] >= 85, v: bpAvg[0] && `${Math.round(bpAvg[0])}/${Math.round(bpAvg[1])}` },
    { name: 'Triglycerides ≥ 150 mg/dL', met: tg == null ? null : tg >= 150, v: tg && u.show(tg, 'tg', 0) },
    { name: `HDL < ${male ? 40 : 50} mg/dL`, met: hdl == null ? null : hdl < (male ? 40 : 50), v: hdl && u.show(hdl, 'chol', 0) },
    { name: 'Fasting glucose ≥ 100 mg/dL', met: fg == null ? null : fg >= 100, v: fg && u.show(fg, 'glucose', 0) },
  ];
  const metCount = crit.filter((x) => x.met).length;

  // Cycle tracking
  const periodDays = Object.keys(m.series('period')).sort();
  const starts = periodDays.filter((d, i) => i === 0 || daysBetween(periodDays[i - 1], d) > 2);
  const lengths = starts.slice(1).map((d, i) => daysBetween(starts[i], d)).filter((x) => x > 15 && x < 60);
  const avgLen = lengths.length ? Math.round(mean(lengths)) : 28;
  const lastStart = starts.at(-1);
  const cycleDay = lastStart ? daysBetween(lastStart, m.today) + 1 : null;
  const nextStart = lastStart ? addDays(lastStart, avgLen) : null;
  const phase = cycleDay == null ? null : cycleDay <= 5 ? 'Menstrual' : cycleDay <= avgLen / 2 - 1 ? 'Follicular' : cycleDay <= avgLen / 2 + 2 ? 'Ovulatory' : 'Luteal';
  const [flow, setFlow] = useState({ date: todayISO(), value: 2 });

  return (
    <div>
      <PageHeader icon={HeartPulse} title="Vitals" subtitle="Blood pressure, glucose, heart, oxygen and cycle. Most of these markers drift silently for years before any symptoms.">
        <Segmented value={range} onChange={setRange} options={[['30', '30 d'], ['90', '90 d'], ['180', '180 d']]} />
        <Button icon={Plus} onClick={() => setLog(tab === 'glucose' ? 'glucose' : 'bp')}>Log {tab === 'glucose' ? 'glucose' : 'BP'}</Button>
      </PageHeader>
      <Tabs className="mb-5" value={tab} onChange={setTab} tabs={[{ key: 'bp', label: 'Blood pressure', icon: HeartPulse }, { key: 'glucose', label: 'Glucose', icon: Syringe }, { key: 'heart', label: 'Heart & oxygen', icon: Wind }, { key: 'metabolic', label: 'Metabolic syndrome', icon: Activity }, { key: 'cycle', label: 'Cycle', icon: Flower2 }]} />

      {tab === 'bp' && <>
        <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile icon={HeartPulse} label="7-reading average" value={bpAvg[0]} sub={bpAvg[1] ? `/ ${Math.round(bpAvg[1])} mmHg` : 'no readings'} />
          <Card hover={false} className="!p-4"><div className="text-xs font-medium text-fg2">Classification (ACC/AHA)</div><div className="mt-3">{cls ? <StatusPill status={cls[1]} label={cls[0]} /> : <StatusPill />}</div></Card>
          <StatTile icon={Activity} label="Readings" value={bp.length} sub={`last ${range} days`} />
          <StatTile icon={HeartPulse} label="Highest" value={bp.length ? Math.max(...bp.map((r) => r.value)) : null} sub="systolic" />
        </Stagger>
        <Stagger className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3" delay={0.1}>
          <Card hover={false} className="xl:col-span-2">
            <CardTitle icon={HeartPulse} title="Systolic & diastolic" sub="Target below 120/80. Measure seated, after 5 min rest, with your arm at heart level, twice a week." />
            <TimeChart data={bpData} unit="mmHg" height={300} refLines={[{ y: 120, label: '120' }, { y: 80, label: '80' }, { y: 130, color: c.status.serious }]} series={[{ key: 'sys', name: 'Systolic', type: 'line', dot: true, color: c.series[7] }, { key: 'dia', name: 'Diastolic', type: 'line', dot: true, color: c.series[0] }]} />
          </Card>
          <Card hover={false}>
            <CardTitle title="Recent readings" />
            <Table rows={m.readings.bp.slice(-12).reverse()} columns={[{ key: 'date', label: 'When', render: (r) => `${fmtDate(r.date)} ${fmtTime(r.ts)}` }, { key: 'v', label: 'BP', right: true, render: (r) => `${r.value}/${r.value2}` }, { key: 'c', label: '', render: (r) => { const k = bpClass(r.value, r.value2); return <StatusPill status={k[1]} label={k[0].replace(' hypertension', '')} />; } }]} />
          </Card>
        </Stagger>
      </>}

      {tab === 'glucose' && <>
        <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile icon={Syringe} label="Fasting (avg)" value={u.from(mean(gFast.map((g) => u.to(g.fasting, 'glucose'))), 'glucose')} dec={u.dec('glucose', 0)} unit={u.label('glucose')} sub="target < 100 mg/dL (5.6 mmol/L)" />
          <StatTile icon={Syringe} label="Post-meal (avg)" value={u.from(mean(gPost.map((g) => g.value)), 'glucose')} dec={u.dec('glucose', 0)} unit={u.label('glucose')} sub="target < 140 mg/dL (7.8)" />
          <StatTile icon={Activity} label="Time in range" value={tir} unit="%" sub="70–140 mg/dL" />
          <StatTile icon={Droplet} label="HbA1c (latest lab)" value={m.labLatest('hba1c')?.value} dec={1} unit="%" />
        </Stagger>
        <Stagger className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3" delay={0.1}>
          <Card hover={false} className="xl:col-span-2">
            <CardTitle icon={Syringe} title="Fasting glucose" sub="Drifting up while still under 100 is the iceberg forming." />
            <TimeChart data={gFast} unit={u.label('glucose')} dec={u.dec('glucose', 0)} height={280} refLines={[{ y: +u.from(100, 'glucose').toFixed(1), label: 'prediabetes threshold' }]} refAreas={[{ y1: +u.from(70, 'glucose').toFixed(1), y2: +u.from(90, 'glucose').toFixed(1), label: 'optimal' }]} series={[{ key: 'fasting', name: 'Fasting', type: 'area', color: c.series[3] }]} />
          </Card>
          <Card hover={false}>
            <CardTitle title="Readings by context" />
            <Donut data={ctxCounts} size={150} center={<><div className="text-lg font-bold">{glu.length}</div><div className="text-[10px] text-muted">readings</div></>} />
          </Card>
          <Card hover={false} className="xl:col-span-3">
            <CardTitle title="Food responses" sub="Post-meal readings matched to that day’s logged lunch / dinner" />
            <Table rows={gPost.slice(-12).reverse().map((r) => ({ ...r, id: r.id, food: m.foodByDate[r.date] }))} columns={[
              { key: 'date', label: 'When', render: (r) => `${fmtDate(r.date)} ${fmtTime(r.ts)}` }, { key: 'ctx', label: 'Context', render: (r) => r.meta?.context },
              { key: 'v', label: 'Reading', right: true, render: (r) => u.show(r.value, 'glucose', 0) },
              { key: 'carb', label: 'Day carbs', right: true, render: (r) => (r.food ? `${fmt(r.food.carbs)} g` : '—') },
              { key: 's', label: '', render: (r) => <StatusPill status={r.value < 140 ? 'good' : r.value < 180 ? 'warning' : 'critical'} label={r.value < 140 ? 'Normal' : r.value < 180 ? 'Spike' : 'High spike'} /> }]} />
            <p className="mt-2 text-xs text-muted">Using a CGM? Import readings via Apple Health / Health Connect (Integrations) and they land here automatically.</p>
          </Card>
        </Stagger>
      </>}

      {tab === 'heart' && (
        <Stagger className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {[['rhr', 'Resting heart rate', 'bpm', c.series[7]], ['hrv', 'Heart-rate variability', 'ms', c.series[2]], ['spo2', 'Blood oxygen (SpO₂)', '%', c.series[0]], ['resp', 'Respiratory rate', '/min', c.series[6]]].map(([k, t, unit, col]) => (
            <Card key={k} hover={false}>
              <CardTitle icon={HeartPulse} title={t} sub={`${range}-day trend · 7-day average ${fmt(mean(heart.slice(-7).map((x) => x[k])), 1)} ${unit}`} />
              <TimeChart data={heart} unit={unit} dec={k === 'resp' ? 1 : 0} height={220} series={[{ key: k, name: t, type: 'area', color: col }]} />
            </Card>
          ))}
        </Stagger>
      )}

      {tab === 'metabolic' && (
        <Stagger className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card hover={false} className="lg:col-span-2">
            <CardTitle icon={Activity} title="Metabolic syndrome criteria" sub={`3 or more of 5 = metabolic syndrome · ${asian ? 'South-Asian' : 'Western'} waist cut-offs (change in Settings)`} />
            <div className="space-y-2">
              {crit.map((x) => (
                <div key={x.name} className="flex items-center gap-3 rounded-xl border border-line p-3">
                  {x.met === true ? <XCircle className="text-critical" size={20} /> : x.met === false ? <CheckCircle2 className="text-good" size={20} /> : <HelpCircle className="text-muted" size={20} />}
                  <span className="flex-1 text-sm font-medium">{x.name}</span>
                  <span className="text-sm text-fg2 tabular">{x.v || 'no data'}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card hover={false} className="flex flex-col items-center justify-center text-center">
            <div className="text-6xl font-bold tabular" style={{ color: metCount >= 3 ? c.status.critical : metCount >= 1 ? c.status.warning : c.status.good }}>{metCount}<span className="text-2xl text-muted">/5</span></div>
            <div className="mt-2"><StatusPill status={metCount >= 3 ? 'critical' : metCount >= 1 ? 'warning' : 'good'} label={metCount >= 3 ? 'Meets metabolic syndrome criteria' : metCount >= 1 ? `${metCount} criterion met: watch` : 'No criteria met'} /></div>
            <p className="mt-3 text-xs text-muted">These five markers sit right at the waterline. Each one is driven by the inputs underneath.</p>
          </Card>
        </Stagger>
      )}

      {tab === 'cycle' && (
        <Stagger className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <StatTile icon={Flower2} label="Cycle day" value={cycleDay} sub={phase ? `${phase} phase` : 'Log a period to start'} />
          <StatTile icon={Flower2} label="Average cycle" value={avgLen} unit="days" sub={`${lengths.length} cycles tracked`} />
          <StatTile icon={Flower2} label="Next period (predicted)" value={nextStart ? daysBetween(m.today, nextStart) : null} unit="days" sub={nextStart ? fmtDate(nextStart, 'EEE d MMM') : '—'} />
          <Card hover={false} className="lg:col-span-2">
            <CardTitle icon={Flower2} title="Period calendar" sub="Cycle phase is used to explain swings in weight, HRV and energy" />
            <CalendarHeatmap values={Object.fromEntries(periodDays.map((d) => [d, (m.series('period')[d] / 3) * 100]))} label="flow" unit="%" />
          </Card>
          <Card hover={false}>
            <CardTitle title="Log flow" />
            <div className="space-y-3">
              <Field label="Date"><Input type="date" value={flow.date} onChange={(e) => setFlow({ ...flow, date: e.target.value })} /></Field>
              <Field label="Flow"><Select value={flow.value} onChange={(e) => setFlow({ ...flow, value: Number(e.target.value) })} options={[[1, 'Light'], [2, 'Medium'], [3, 'Heavy']]} /></Field>
              <Button className="w-full" onClick={async () => { await api.add('entries', { metric: 'period', date: flow.date, value: flow.value }); await refresh(); notify('Logged'); }}>Save</Button>
            </div>
          </Card>
        </Stagger>
      )}
      <QuickLog open={!!log} initial={log || 'bp'} key={log} onClose={() => setLog(null)} />
    </div>
  );
}
