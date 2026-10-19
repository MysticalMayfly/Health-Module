import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Dumbbell, Footprints, HeartPulse, Timer, Activity, Plus, Trash2, Trophy, Bandage, CalendarRange, Gauge as GaugeIcon, Copy } from 'lucide-react';
import { PageHeader, Card, CardTitle, Stagger, Button, Tabs, Modal, Field, Input, Select, UnitInput, Progress, Badge, Table, IconBtn, StatusPill } from '../components/ui.jsx';
import { StatTile } from '../components/motion.jsx';
import { TimeChart, BarList, RadarView, Sparkline } from '../components/charts.jsx';
import RecordManager from '../components/RecordManager.jsx';
import { useData } from '../lib/store.jsx';
import { useTheme } from '../lib/theme.jsx';
import { api } from '../lib/api.js';
import { addDays, dateRange, fmt, fmtDate, weekStart, todayISO, sum } from '../lib/format.js';
import { muscleOf, e1rm } from '../lib/analytics.js';
import { METRICS, TEST_KEYS } from '@shared/catalog.js';

const KINDS = [['strength', 'Strength'], ['cardio', 'Cardio'], ['mobility', 'Mobility / yoga'], ['sport', 'Sport']];
const TEST_THRESH = { grip: (m) => (m ? 40 : 25), pushups: (m) => (m ? 20 : 10), pullups: () => 5, dead_hang: () => 30, plank: () => 60, sit_rise: () => 8, balance: () => 10, run_5k: () => 30, hr_recovery: () => 20, vo2max: (m) => (m ? 42 : 35) };

function WorkoutModal({ open, onClose, last }) {
  const { refresh, notify, u } = useData();
  const blank = { date: todayISO(), kind: 'strength', title: '', duration: 45, rpe: 7, zone: 2, distance: '', kcal: '', notes: '', sets: [{ exercise: '', weight: '', reps: '', rpe: '' }] };
  const [w, setW] = useState(blank);
  const set = (k) => (e) => setW({ ...w, [k]: e.target.value });
  const setSet = (i, k, v) => setW({ ...w, sets: w.sets.map((s, j) => (j === i ? { ...s, [k]: v } : s)) });
  const copyLast = () => { if (last) setW({ ...w, title: last.title, kind: last.kind, sets: (last.sets || []).map((s) => ({ ...s, weight: s.weight ? +u.from(s.weight, 'mass').toFixed(1) : '' })) }); };
  const save = async () => {
    const sets = w.kind === 'strength' ? w.sets.filter((s) => s.exercise).map((s) => ({ exercise: s.exercise, weight: s.weight === '' ? 0 : u.to(Number(s.weight), 'mass'), reps: Number(s.reps) || 0, rpe: s.rpe ? Number(s.rpe) : null })) : null;
    await api.add('workouts', { date: w.date, kind: w.kind, title: w.title || KINDS.find((k) => k[0] === w.kind)[1], duration: Number(w.duration), rpe: Number(w.rpe), zone: w.kind === 'cardio' ? Number(w.zone) : null, distance: w.distance ? Number(w.distance) : null, kcal: w.kcal ? Number(w.kcal) : null, notes: w.notes, sets });
    onClose(); setW(blank); await refresh(); notify('Workout logged 💪');
  };
  return (
    <Modal open={open} onClose={onClose} title="Log workout" wide footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save}>Save workout</Button></>}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="Date"><Input type="date" value={w.date} onChange={set('date')} /></Field>
        <Field label="Type"><Select value={w.kind} onChange={set('kind')} options={KINDS} /></Field>
        <Field label="Title" className="col-span-2"><Input value={w.title} onChange={set('title')} placeholder="Push day, Zone 2 ride…" /></Field>
        <Field label="Duration"><UnitInput unit="min" value={w.duration} onChange={set('duration')} /></Field>
        <Field label={`Session RPE: ${w.rpe}/10`}><input type="range" min="1" max="10" value={w.rpe} onChange={set('rpe')} className="mt-2 w-full" /></Field>
        {w.kind === 'cardio' && <>
          <Field label="HR zone"><Select value={w.zone} onChange={set('zone')} options={[[1, 'Z1 recovery'], [2, 'Z2 aerobic base'], [3, 'Z3 tempo'], [4, 'Z4 threshold'], [5, 'Z5 VO₂max']]} /></Field>
          <Field label="Distance"><UnitInput unit="km" value={w.distance} onChange={set('distance')} /></Field>
        </>}
      </div>
      {w.kind === 'strength' && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between"><span className="text-sm font-medium">Sets</span>{last && <Button size="sm" variant="soft" icon={Copy} onClick={copyLast}>Copy last session</Button>}</div>
          <div className="space-y-2">
            {w.sets.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-12 gap-2">
                <Input className="col-span-5" placeholder="Exercise" list="exercises" value={s.exercise} onChange={(e) => setSet(i, 'exercise', e.target.value)} />
                <UnitInput className="col-span-3" unit={u.label('mass')} value={s.weight} onChange={(e) => setSet(i, 'weight', e.target.value)} />
                <UnitInput className="col-span-2" unit="reps" value={s.reps} onChange={(e) => setSet(i, 'reps', e.target.value)} />
                <div className="col-span-2 flex gap-1"><Input placeholder="RPE" value={s.rpe} onChange={(e) => setSet(i, 'rpe', e.target.value)} /><IconBtn icon={Trash2} label="Remove set" size={14} onClick={() => setW({ ...w, sets: w.sets.filter((_, j) => j !== i) })} /></div>
              </motion.div>
            ))}
          </div>
          <datalist id="exercises">{['Squat', 'Bench press', 'Deadlift', 'Overhead press', 'Barbell row', 'Pull-up', 'Romanian deadlift', 'Lunge', 'Dip', 'Hip thrust', 'Lat pulldown', 'Bicep curl', 'Tricep extension', 'Plank'].map((x) => <option key={x} value={x} />)}</datalist>
          <Button size="sm" variant="soft" icon={Plus} className="mt-2" onClick={() => setW({ ...w, sets: [...w.sets, { ...(w.sets.at(-1) || {}), rpe: '' }] })}>Add set</Button>
        </div>
      )}
      <Field label="Notes" className="mt-3"><Input value={w.notes} onChange={set('notes')} /></Field>
    </Modal>
  );
}

function TestModal({ open, onClose }) {
  const { refresh, notify, u } = useData();
  const [v, setV] = useState({ date: todayISO() });
  const save = async () => {
    const rows = TEST_KEYS.filter((k) => v[k] !== undefined && v[k] !== '').map((k) => ({ metric: k, date: v.date, value: METRICS[k].dim ? u.to(Number(v[k]), METRICS[k].dim) : Number(v[k]) }));
    if (rows.length) await api.add('entries', rows);
    onClose(); await refresh(); notify(`${rows.length} test results saved`);
  };
  return (
    <Modal open={open} onClose={onClose} title="Fitness test battery" wide footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save}>Save results</Button></>}>
      <p className="mb-3 text-sm text-fg2">Test quarterly, fresh, after a warm-up. Fill in whichever you did.</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Field label="Date"><Input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></Field>
        {TEST_KEYS.map((k) => <Field key={k} label={METRICS[k].name}><UnitInput unit={METRICS[k].dim ? u.label(METRICS[k].dim) : METRICS[k].unit} value={v[k] ?? ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></Field>)}
      </div>
    </Modal>
  );
}

export default function Training() {
  const { model: m, refresh, u, notify } = useData();
  const { c } = useTheme();
  const [tab, setTab] = useState('overview');
  const [logOpen, setLogOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const ctx = m.current.ctx;
  const male = m.profile.sex !== 'female';
  const allW = Object.values(m.workoutsByDate).flat().sort((a, b) => b.date.localeCompare(a.date));
  const lastStrength = allW.find((w) => w.kind === 'strength');

  const weeks = useMemo(() => {
    const out = {};
    for (let i = 15; i >= 0; i--) out[weekStart(addDays(m.today, -i * 7))] = { date: weekStart(addDays(m.today, -i * 7)), strength: 0, cardio: 0, mobility: 0, sport: 0, sets: 0 };
    for (const w of allW) { const k = weekStart(w.date); if (out[k]) out[k][w.kind] = (out[k][w.kind] || 0) + (w.duration || 0); }
    return Object.values(out);
  }, [allW, m.today]);
  const thisWeek = weekStart(m.today);
  const wkW = allW.filter((w) => w.date >= thisWeek);
  const steps30 = dateRange(addDays(m.today, -29), m.today).map((d) => ({ date: d, steps: m.series('steps')[d] ?? null }));

  const topLifts = Object.entries(m.lifts).sort((a, b) => b[1].length - a[1].length).slice(0, 5);
  const liftDates = [...new Set(topLifts.flatMap(([, arr]) => arr.map((x) => x.date)))].sort();
  const liftData = liftDates.map((d) => Object.fromEntries([['date', d], ...topLifts.map(([ex, arr]) => [ex, arr.find((x) => x.date === d) ? +u.from(arr.find((x) => x.date === d).e1rm, 'mass').toFixed(1) : null])]));
  const recentWeeks = Object.keys(m.weeklySets).sort().slice(-4);
  const groupSets = {};
  for (const wk of recentWeeks) for (const [g, n] of Object.entries(m.weeklySets[wk])) groupSets[g] = (groupSets[g] || 0) + n / Math.max(1, recentWeeks.length);
  const loadData = dateRange(addDays(m.today, -55), m.today).map((d) => ({ date: d, load: m.series('training_load')[d] ?? 0 }));

  const tests = TEST_KEYS.map((k) => {
    const arr = Object.entries(m.series(k)).sort();
    const latest = arr.at(-1), prev = arr.at(-2);
    const th = TEST_THRESH[k](male);
    const lowerBetter = k === 'run_5k';
    const ok = latest ? (lowerBetter ? latest[1] < th : latest[1] >= th) : null;
    return { id: k, k, name: METRICS[k].name, unit: METRICS[k].dim ? u.label(METRICS[k].dim) : METRICS[k].unit, latest, prev, th, ok, hist: arr.map(([, v]) => v), score: latest ? Math.min(150, (lowerBetter ? th / latest[1] : latest[1] / th) * 100) : null };
  });

  const targets = [
    { label: 'Steps (avg this week)', v: m.avgWin('steps', m.today, ((new Date().getDay() + 6) % 7) + 1) || 0, t: m.targets.steps, unit: '' },
    { label: 'Zone-2 minutes', v: sum(wkW.filter((w) => w.kind === 'cardio' && (w.zone || 2) <= 3).map((w) => w.duration)), t: 150, unit: 'min' },
    { label: 'Strength sessions', v: wkW.filter((w) => w.kind === 'strength').length, t: 3, unit: '' },
    { label: 'Vigorous sessions', v: wkW.filter((w) => (w.zone || 0) >= 4 || (w.rpe || 0) >= 8).length, t: 1, unit: '' },
  ];

  return (
    <div>
      <PageHeader icon={Dumbbell} title="Training" subtitle="Strength, cardio and everyday movement. Strength and VO₂max are among the strongest predictors of longevity.">
        <Button variant="soft" icon={Trophy} onClick={() => setTestOpen(true)}>Log fitness tests</Button>
        <Button icon={Plus} onClick={() => setLogOpen(true)}>Log workout</Button>
      </PageHeader>
      <Tabs className="mb-5" value={tab} onChange={setTab} tabs={[{ key: 'overview', label: 'Overview', icon: Activity }, { key: 'strength', label: 'Strength', icon: Dumbbell }, { key: 'tests', label: 'Fitness tests', icon: Trophy }, { key: 'log', label: 'History', icon: CalendarRange }, { key: 'programs', label: 'Programs & injuries', icon: Bandage }]} />

      {tab === 'overview' && <>
        <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <StatTile icon={CalendarRange} label="Training days / wk" value={ctx.trainDaysPerWk} dec={1} sub="4-week average" />
          <StatTile icon={Dumbbell} label="Strength / wk" value={ctx.strengthPerWk} dec={1} sub="target ≥ 2–3" />
          <StatTile icon={HeartPulse} label="Zone-2 min / wk" value={ctx.z2PerWk} sub="target ≥ 150" />
          <StatTile icon={Footprints} label="Steps (14 d avg)" value={ctx.steps} spark={steps30.slice(-14).map((d) => d.steps)} sparkColor={c.series[2]} />
          <StatTile icon={GaugeIcon} label="Acute:chronic load" value={m.acwr} dec={2} sub={m.acwr == null ? '—' : m.acwr > 1.5 ? 'Spike: injury risk' : m.acwr < 0.8 ? 'Detraining' : 'Sweet spot 0.8–1.3'} />
          <StatTile icon={Activity} label="VO₂max" value={ctx.test('vo2max')} dec={1} unit="mL/kg/min" />
        </Stagger>
        <Stagger className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3" delay={0.1}>
          <Card hover={false}>
            <CardTitle icon={Timer} title="This week’s targets" sub="Weekly movement minimums" />
            <div className="space-y-4">
              {targets.map((t) => (
                <div key={t.label}><div className="mb-1 flex justify-between text-sm"><span>{t.label}</span><span className="tabular text-fg2">{fmt(t.v)} / {fmt(t.t)} {t.unit}</span></div><Progress value={t.v} max={t.t} color={t.v >= t.t ? c.status.good : undefined} /></div>
              ))}
            </div>
          </Card>
          <Card hover={false} className="xl:col-span-2">
            <CardTitle icon={CalendarRange} title="Weekly training minutes" sub="Stacked by type · 16 weeks" />
            <TimeChart data={weeks} unit="min" height={250} series={[{ key: 'strength', name: 'Strength', type: 'bar', stack: 'a', color: c.series[0] }, { key: 'cardio', name: 'Cardio', type: 'bar', stack: 'a', color: c.series[1] }, { key: 'mobility', name: 'Mobility', type: 'bar', stack: 'a', color: c.series[2] }, { key: 'sport', name: 'Sport', type: 'bar', stack: 'a', color: c.series[3] }]} />
          </Card>
          <Card hover={false} className="xl:col-span-2">
            <CardTitle icon={Footprints} title="Daily steps" sub={`Goal ${fmt(m.targets.steps)}`} />
            <TimeChart data={steps30} height={220} refLines={[{ y: m.targets.steps, label: 'goal' }]} series={[{ key: 'steps', name: 'Steps', type: 'bar', cells: (d) => (d.steps >= m.targets.steps ? c.series[2] : c.series[0]) }]} />
          </Card>
          <Card hover={false}>
            <CardTitle icon={GaugeIcon} title="Training load" sub="Session RPE × minutes, per day" />
            <TimeChart data={loadData} height={220} series={[{ key: 'load', name: 'Load (AU)', type: 'area', color: c.series[6] }]} />
          </Card>
        </Stagger>
      </>}

      {tab === 'strength' && (
        <Stagger className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card hover={false} className="xl:col-span-2">
            <CardTitle icon={Dumbbell} title="Estimated 1-rep max" sub="Epley: weight × (1 + reps/30), best set per session" />
            {liftData.length ? <TimeChart data={liftData} unit={u.label('mass')} dec={1} height={320} series={topLifts.map(([ex], i) => ({ key: ex, name: ex, type: 'line', color: c.series[i], dot: true }))} /> : <p className="py-10 text-center text-sm text-muted">Log strength sets to see progression.</p>}
          </Card>
          <Card hover={false}>
            <CardTitle icon={Activity} title="Weekly sets per muscle group" sub="4-week average · 10–20 sets is a common hypertrophy range" />
            <BarList data={Object.entries(groupSets).map(([name, value]) => ({ name, value: +value.toFixed(1) })).sort((a, b) => b.value - a.value)} dec={1} refLine={10} cellColor={(d) => (d.value >= 10 ? c.status.good : c.series[0])} />
          </Card>
          <Card hover={false} className="xl:col-span-3">
            <CardTitle icon={Trophy} title="Personal records" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {topLifts.map(([ex, arr]) => { const best = arr.reduce((b, x) => (x.e1rm > b.e1rm ? x : b), arr[0]); return (
                <motion.div key={ex} whileHover={{ y: -3 }} className="rounded-xl bg-raised p-3"><div className="text-xs text-muted">{ex}</div><div className="text-xl font-bold tabular">{u.show(best.e1rm, 'mass', 1)}</div><div className="text-[11px] text-muted">e1RM · {fmtDate(best.date)}</div><div className="mt-1 h-8"><Sparkline data={arr.map((x) => x.e1rm)} /></div></motion.div>); })}
            </div>
          </Card>
        </Stagger>
      )}

      {tab === 'tests' && (
        <Stagger className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card hover={false} className="xl:col-span-2">
            <CardTitle icon={Trophy} title="Fitness test battery" sub="Quarterly · thresholds are healthy-adult benchmarks" right={<Button size="sm" icon={Plus} onClick={() => setTestOpen(true)}>Log tests</Button>} />
            <Table rows={tests} columns={[
              { key: 'name', label: 'Test' },
              { key: 'latest', label: 'Latest', right: true, render: (r) => (r.latest ? `${fmt(METRICS[r.k].dim ? u.from(r.latest[1], METRICS[r.k].dim) : r.latest[1], METRICS[r.k].dec)} ${r.unit}` : '—') },
              { key: 'chg', label: 'Change', right: true, render: (r) => (r.latest && r.prev ? `${r.latest[1] - r.prev[1] > 0 ? '+' : ''}${fmt(r.latest[1] - r.prev[1], 1)}` : '—') },
              { key: 'th', label: 'Benchmark', right: true, render: (r) => `${r.k === 'run_5k' ? '<' : '≥'} ${r.th}` },
              { key: 'ok', label: 'Status', render: (r) => <StatusPill status={r.ok == null ? null : r.ok ? 'good' : 'warning'} label={r.ok == null ? 'Not tested' : r.ok ? 'Healthy' : 'Below'} /> },
              { key: 'h', label: 'Trend', render: (r) => <div className="h-6 w-24">{r.hist.length > 1 && <Sparkline data={r.hist} />}</div> },
            ]} />
          </Card>
          <Card hover={false}>
            <CardTitle icon={Activity} title="Capacity profile" sub="% of benchmark (100 = healthy threshold)" />
            <RadarView data={tests.filter((t) => t.score != null).map((t) => ({ name: t.name.split(' (')[0].replace('Single-leg balance', 'Balance'), score: Math.round(t.score) }))} max={150} />
          </Card>
        </Stagger>
      )}

      {tab === 'log' && (
        <Card hover={false}>
          <CardTitle icon={CalendarRange} title="Workout history" sub={`${allW.length} sessions`} />
          <Table rows={allW.slice(0, 80)} columns={[
            { key: 'date', label: 'Date', render: (r) => fmtDate(r.date, 'EEE d MMM') },
            { key: 'title', label: 'Session', render: (r) => <span className="font-medium">{r.title}</span> },
            { key: 'kind', label: 'Type', render: (r) => <Badge tone={r.kind === 'strength' ? 'info' : r.kind === 'cardio' ? 'warning' : 'good'}>{r.kind}</Badge> },
            { key: 'duration', label: 'Min', right: true },
            { key: 'rpe', label: 'RPE', right: true },
            { key: 'detail', label: 'Detail', render: (r) => <span className="text-xs text-muted">{r.sets?.length ? `${r.sets.length} sets · ${[...new Set(r.sets.map((s) => s.exercise))].join(', ')}` : r.distance ? `${r.distance} km · Z${r.zone || '?'}` : r.zone ? `Z${r.zone}` : ''}</span> },
            { key: 'source', label: 'Source', render: (r) => <span className="text-xs text-muted">{r.source}</span> },
            { key: 'x', label: '', render: (r) => <IconBtn icon={Trash2} size={14} label="Delete" onClick={async () => { await api.remove('workouts', r.id); refresh(); notify('Deleted'); }} /> },
          ]} />
        </Card>
      )}

      {tab === 'programs' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <RecordManager kind="program" title="Training programs" icon={CalendarRange} sub="Weekly templates"
            fields={[{ key: 'name', label: 'Name' }, { key: 'goal', label: 'Goal', half: true }, { key: 'weeks', label: 'Length (weeks)', type: 'number', half: true }, { key: 'days', label: 'Schedule (one line per day)', type: 'list', placeholder: 'Mon: Strength A (squat, bench, row)\nTue: Zone 2 40 min' }]}
            summary={(r) => <div><div className="font-medium">{r.data.name} <span className="text-xs text-muted">{r.data.goal}</span></div><ul className="mt-1 text-xs text-muted">{(r.data.days || []).map((d) => <li key={d}>{d}</li>)}</ul></div>}
            empty="e.g. a 3-day full-body split + 2 Zone-2 sessions." />
          <RecordManager kind="injury" title="Injuries" icon={Bandage} sub="Body part, cause, rehab, return to training" activeField="Still active"
            fields={[{ key: 'part', label: 'Body part', half: true }, { key: '_date', label: 'Date', type: 'date', half: true }, { key: 'cause', label: 'Cause' }, { key: 'severity', label: 'Severity', type: 'select', options: ['mild', 'moderate', 'severe'], half: true }, { key: 'status', label: 'Status', type: 'select', options: ['active', 'rehab', 'recovered'], half: true }, { key: 'rehab', label: 'Rehab plan', type: 'textarea' }]}
            defaults={{ severity: 'mild', status: 'active' }}
            summary={(r) => <div><div className="flex items-center gap-2 font-medium">{r.data.part}<Badge tone={r.data.status === 'recovered' ? 'good' : 'warning'}>{r.data.status}</Badge></div><div className="text-xs text-muted">{fmtDate(r.date)} · {r.data.cause}{r.data.rehab ? ` · ${r.data.rehab}` : ''}</div></div>} />
        </div>
      )}

      <WorkoutModal open={logOpen} onClose={() => setLogOpen(false)} last={lastStrength} />
      <TestModal open={testOpen} onClose={() => setTestOpen(false)} />
    </div>
  );
}
