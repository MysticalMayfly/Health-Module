import { useMemo, useState } from 'react';
import { CalendarCheck, ChevronLeft, ChevronRight, Trophy, TrendingDown, Target, NotebookPen, Bell, Star, Frown } from 'lucide-react';
import { PageHeader, Card, CardTitle, Stagger, Button, Table, Field, Textarea, StatusPill } from '../components/ui.jsx';
import { StatTile, Ring, AnimatedNumber } from '../components/motion.jsx';
import { TimeChart, RadarView } from '../components/charts.jsx';
import { useData } from '../lib/store.jsx';
import { useTheme } from '../lib/theme.jsx';
import { api } from '../lib/api.js';
import { addDays, dateRange, fmt, fmtDate, mean, sum, weekStart, fmtSigned } from '../lib/format.js';
import { DOMAINS } from '@shared/catalog.js';

function weekStats(m, ws) {
  const days = dateRange(ws, addDays(ws, 6)).filter((d) => d <= m.today);
  const f = days.map((d) => m.foodByDate[d]).filter(Boolean);
  const w = days.flatMap((d) => m.workoutsByDate[d] || []);
  return {
    days,
    score: mean(days.map((d) => m.series('action_score')[d])),
    sleep: mean(days.map((d) => m.sleepByDate[d]?.duration)),
    kcal: mean(f.map((x) => x.kcal)), protein: mean(f.map((x) => x.protein)), fiber: mean(f.map((x) => x.fiber)),
    steps: mean(days.map((d) => m.series('steps')[d])),
    sessions: w.length, strength: w.filter((x) => x.kind === 'strength').length, z2: sum(w.filter((x) => x.kind === 'cardio').map((x) => x.duration)),
    weight: m.trend[days.at(-1)] != null && m.trend[addDays(ws, -1)] != null ? m.trend[days.at(-1)] - m.trend[addDays(ws, -1)] : null,
    rhr: mean(days.map((d) => m.series('rhr')[d])), hrv: mean(days.map((d) => m.series('hrv')[d])),
    energy: mean(days.map((d) => m.series('energy')[d])), alcohol: sum(days.map((d) => m.series('alcohol')[d] || 0)),
  };
}

export default function Weekly() {
  const { model: m, refresh, notify, u } = useData();
  const { c } = useTheme();
  const [ws, setWs] = useState(weekStart(m.today));
  const cur = useMemo(() => weekStats(m, ws), [m, ws]);
  const prev = useMemo(() => weekStats(m, addDays(ws, -7)), [m, ws]);
  const review = (m.records.review || []).find((r) => r.date === ws);
  const [notes, setNotes] = useState(null);
  const n = notes ?? review?.data ?? { wins: '', lessons: '', focus: '' };

  const dayData = dateRange(ws, addDays(ws, 6)).map((d) => ({ date: fmtDate(d, 'EEE'), score: m.series('action_score')[d] ?? null, sleep: m.sleepByDate[d]?.duration ?? null }));
  const scored = cur.days.filter((d) => m.series('action_score')[d] != null);
  const best = scored.sort((a, b) => m.series('action_score')[b] - m.series('action_score')[a])[0];
  const worst = scored.at(-1);
  // Per-action adherence this week → focus suggestion
  const perAction = m.actions.map((a) => ({ a, pct: mean(cur.days.filter((d) => !a.created || a.created <= d).map((d) => (m.actionDone(a, d) ? 100 : 0))) })).filter((x) => x.pct != null);
  const weakest = perAction.sort((x, y) => x.pct - y.pct)[0];
  const domainAdh = Object.entries(perAction.reduce((o, x) => ((o[x.a.domain] ||= []).push(x.pct), o), {})).map(([d, arr]) => ({ name: DOMAINS[d]?.name, score: Math.round(mean(arr)) }));

  const rows = [
    ['Daily actions', cur.score, prev.score, '%', 0, 'up'], ['Sleep', cur.sleep, prev.sleep, 'h', 1, 'up'], ['Calories', cur.kcal, prev.kcal, 'kcal', 0, null],
    ['Protein', cur.protein, prev.protein, 'g', 0, 'up'], ['Fibre', cur.fiber, prev.fiber, 'g', 0, 'up'], ['Steps', cur.steps, prev.steps, '', 0, 'up'],
    ['Sessions', cur.sessions, prev.sessions, '', 0, 'up'], ['Zone-2 / cardio min', cur.z2, prev.z2, 'min', 0, 'up'], ['Resting HR', cur.rhr, prev.rhr, 'bpm', 0, 'down'],
    ['HRV', cur.hrv, prev.hrv, 'ms', 0, 'up'], ['Energy', cur.energy, prev.energy, '/5', 1, 'up'], ['Alcohol', cur.alcohol, prev.alcohol, 'units', 1, 'down'],
  ].map(([name, a, b, unit, dec, good], i) => ({ id: i, name, a, b, unit, dec, good }));

  const saveReview = async () => {
    const row = { kind: 'review', date: ws, data: n };
    if (review) await api.update('records', review.id, row); else await api.add('records', row);
    setNotes(null); await refresh(); notify('Weekly review saved');
  };

  return (
    <div>
      <PageHeader icon={CalendarCheck} title="Weekly review" subtitle="The engine of the system: look back, learn, and choose one thing to improve.">
        <div className="flex items-center gap-1 rounded-xl border border-line bg-card p-1">
          <button className="rounded-lg p-1.5 hover:bg-raised" onClick={() => { setWs(addDays(ws, -7)); setNotes(null); }} aria-label="Previous week"><ChevronLeft size={16} /></button>
          <span className="min-w-40 text-center text-sm font-medium">{fmtDate(ws)} – {fmtDate(addDays(ws, 6))}</span>
          <button className="rounded-lg p-1.5 hover:bg-raised disabled:opacity-30" disabled={addDays(ws, 7) > m.today} onClick={() => { setWs(addDays(ws, 7)); setNotes(null); }} aria-label="Next week"><ChevronRight size={16} /></button>
        </div>
      </PageHeader>

      <Stagger className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Card hover={false} className="flex flex-col items-center justify-center">
          <Ring value={(cur.score || 0) / 100} size={150} stroke={13} id="week"><AnimatedNumber value={cur.score} suffix="%" className="text-3xl font-bold" /><span className="text-xs text-muted">daily actions</span></Ring>
          <div className="mt-2 text-sm text-fg2">{cur.score != null && prev.score != null ? `${fmtSigned(cur.score - prev.score)} pts vs last week` : ''}</div>
        </Card>
        <div className="grid grid-cols-2 gap-4 lg:col-span-3 lg:grid-cols-3">
          <StatTile icon={TrendingDown} label="Trend weight change" value={cur.weight != null ? u.from(cur.weight, 'mass') : null} dec={2} unit={u.label('mass')} goodWhen={m.direction < 0 ? 'down' : 'up'} />
          <StatTile icon={Target} label="Avg sleep" value={cur.sleep} dec={1} unit="h" delta={cur.sleep != null && prev.sleep != null ? cur.sleep - prev.sleep : null} />
          <StatTile icon={Target} label="Avg protein" value={cur.protein} unit={`/ ${m.targets.protein} g`} delta={cur.protein != null && prev.protein != null ? cur.protein - prev.protein : null} deltaDec={0} />
          <StatTile icon={Star} label="Best day" value={best ? m.series('action_score')[best] : null} unit="%" sub={best ? fmtDate(best, 'EEEE') : '—'} />
          <StatTile icon={Frown} label="Toughest day" value={worst ? m.series('action_score')[worst] : null} unit="%" sub={worst ? fmtDate(worst, 'EEEE') : '—'} />
          <StatTile icon={Trophy} label="Training sessions" value={cur.sessions} sub={`${cur.strength} strength · ${fmt(cur.z2)} cardio min`} />
        </div>
      </Stagger>

      <Stagger className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3" delay={0.1}>
        <Card hover={false} className="xl:col-span-2">
          <CardTitle icon={CalendarCheck} title="Day by day" sub="Action completion (%)" />
          <TimeChart data={dayData} xKey="date" unit="%" height={230} yDomain={[0, 100]} refLines={[{ y: 80, label: 'good day' }]} series={[{ key: 'score', name: 'Actions', type: 'bar', cells: (d) => (d.score >= 80 ? c.series[2] : d.score >= 50 ? c.series[0] : c.series[1]) }]} />
        </Card>
        <Card hover={false}>
          <CardTitle icon={Target} title="Adherence by domain" />
          {domainAdh.length > 2 ? <RadarView data={domainAdh} height={230} /> : <p className="text-sm text-muted">Needs actions in 3+ domains.</p>}
        </Card>
      </Stagger>

      <Stagger className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3" delay={0.2}>
        <Card hover={false} className="xl:col-span-2">
          <CardTitle title="This week vs last week" />
          <Table rows={rows} columns={[
            { key: 'name', label: 'Metric' },
            { key: 'a', label: 'This week', right: true, render: (r) => `${fmt(r.a, r.dec)} ${r.unit}` },
            { key: 'b', label: 'Last week', right: true, render: (r) => `${fmt(r.b, r.dec)} ${r.unit}` },
            { key: 'd', label: 'Change', right: true, render: (r) => { if (r.a == null || r.b == null) return '—'; const d = r.a - r.b; const good = r.good === 'up' ? d > 0 : r.good === 'down' ? d < 0 : null; return <span className={Math.abs(d) < 1e-6 ? '' : good === true ? 'font-semibold text-[#0a7d0a] dark:text-good' : good === false ? 'font-semibold text-critical' : ''}>{fmtSigned(d, r.dec)}</span>; } },
          ]} />
        </Card>
        <div className="space-y-4">
          <Card hover={false}>
            <CardTitle icon={Target} title="Suggested focus for next week" />
            {weakest ? <div className="rounded-xl bg-accent/10 p-3 text-sm"><b>{weakest.a.title}</b> was done on only {Math.round(weakest.pct)}% of days.<div className="mt-1 text-xs text-muted">{weakest.a.why}</div></div> : <p className="text-sm text-muted">No actions yet.</p>}
          </Card>
          <Card hover={false}>
            <CardTitle icon={Bell} title="Drift this week" />
            <div className="space-y-1.5">{m.alerts.slice(0, 4).map((a, i) => <div key={i} className="flex items-start gap-2 text-sm"><StatusPill status={a.severity} /><span className="leading-snug">{a.title}</span></div>)}{!m.alerts.length && <p className="text-sm text-muted">Nothing drifting.</p>}</div>
          </Card>
        </div>
      </Stagger>

      <Card hover={false} className="mt-4">
        <CardTitle icon={NotebookPen} title="Reflection" sub="Saved with this week" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="🏆 Wins"><Textarea value={n.wins} onChange={(e) => setNotes({ ...n, wins: e.target.value })} placeholder="What went well?" /></Field>
          <Field label="📚 Lessons"><Textarea value={n.lessons} onChange={(e) => setNotes({ ...n, lessons: e.target.value })} placeholder="What got in the way?" /></Field>
          <Field label="🎯 One focus for next week"><Textarea value={n.focus} onChange={(e) => setNotes({ ...n, focus: e.target.value })} placeholder={weakest ? weakest.a.title : ''} /></Field>
        </div>
        <div className="mt-3 flex justify-end"><Button onClick={saveReview}>Save review</Button></div>
      </Card>
    </div>
  );
}
