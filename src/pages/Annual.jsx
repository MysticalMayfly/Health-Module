import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Mountain, CalendarDays, TestTube2, Dumbbell, HeartCrack, Lightbulb } from 'lucide-react';
import { PageHeader, Card, CardTitle, Stagger, Segmented, Table, StatusPill } from '../components/ui.jsx';
import { StatTile, AnimatedNumber } from '../components/motion.jsx';
import { TimeChart, CalendarHeatmap } from '../components/charts.jsx';
import { useData } from '../lib/store.jsx';
import { useTheme } from '../lib/theme.jsx';
import { addDays, dateRange, fmt, fmtDate, mean, sum, fmtSigned } from '../lib/format.js';
import { LAB_MARKERS } from '@shared/labs.js';

export default function Annual() {
  const { model: m, u } = useData();
  const { c } = useTheme();
  const years = [...new Set(Object.keys(m.series('action_score')).concat(Object.keys(m.sleepByDate)).map((d) => d.slice(0, 4)))].sort();
  const [y, setY] = useState('last365');
  const [from, to] = y === 'last365' ? [addDays(m.today, -364), m.today] : [`${y}-01-01`, `${y}-12-31` > m.today ? m.today : `${y}-12-31`];
  const days = dateRange(from, to);

  const months = useMemo(() => {
    const out = {};
    for (const d of days) {
      const k = d.slice(0, 7);
      const o = (out[k] ||= { date: `${k}-01`, label: fmtDate(`${k}-01`, 'MMM'), score: [], sleep: [], steps: [], weight: [], rhr: [], hrv: [], protein: [] });
      o.score.push(m.series('action_score')[d]); o.sleep.push(m.sleepByDate[d]?.duration); o.steps.push(m.series('steps')[d]);
      o.weight.push(m.trend[d]); o.rhr.push(m.series('rhr')[d]); o.hrv.push(m.series('hrv')[d]); o.protein.push(m.foodByDate[d]?.protein);
    }
    return Object.values(out).map((o) => ({ date: o.label, score: mean(o.score), sleep: mean(o.sleep), steps: mean(o.steps), weight: o.weight.some((v) => v != null) ? +u.from(mean(o.weight), 'mass').toFixed(1) : null, rhr: mean(o.rhr), hrv: mean(o.hrv), protein: mean(o.protein) }));
  }, [days, m, u]);

  const first = (k) => months.find((x) => x[k] != null)?.[k], last = (k) => [...months].reverse().find((x) => x[k] != null)?.[k];
  const startPos = m.positionHistory.find((p) => p.date >= from)?.position;
  const goodDays = days.filter((d) => m.series('action_score')[d] >= 80).length;
  const sessions = days.flatMap((d) => m.workoutsByDate[d] || []);
  const illness = (m.records.illness || []).filter((r) => r.date >= from && r.date <= to);
  const symptomDays = new Set((m.records.symptom || []).filter((r) => r.date >= from && r.date <= to).map((r) => r.date)).size;
  const labRows = Object.keys(m.labsByMarker).map((k) => {
    const arr = m.labsByMarker[k].filter((l) => l.date >= from && l.date <= to);
    if (!arr.length) return null;
    const mk = LAB_MARKERS[k];
    const a = arr[0], b = arr.at(-1);
    const better = mk?.good === 'down' ? b.value < a.value : mk?.good === 'up' ? b.value > a.value : null;
    return { id: k, name: mk?.name || k, a, b, better, unit: mk?.unit, dim: mk?.dim, status: m.labStatus(k, b.value) };
  }).filter(Boolean);
  const prs = Object.entries(m.lifts).map(([ex, arr]) => { const inY = arr.filter((x) => x.date >= from && x.date <= to); if (inY.length < 2) return null; return { ex, a: inY[0].e1rm, b: Math.max(...inY.map((x) => x.e1rm)) }; }).filter(Boolean);
  const heat = Object.fromEntries(days.map((d) => [d, m.series('action_score')[d]]).filter(([, v]) => v != null));

  return (
    <div>
      <PageHeader icon={Trophy} title="Annual health report" subtitle="The year in one page: what compounded, what moved, and what to carry forward.">
        <Segmented value={y} onChange={setY} options={[['last365', 'Last 365 days'], ...years.slice(-3).map((x) => [x, x])]} />
      </PageHeader>
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="relative mb-4 overflow-hidden rounded-3xl p-8 text-white grad-bg">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" style={{ animation: 'floaty 10s ease-in-out infinite' }} />
        <div className="relative grid grid-cols-2 gap-6 md:grid-cols-4">
          {[['Journey', startPos != null ? `${fmtSigned(startPos)} → ${fmtSigned(m.current.position)}` : fmtSigned(m.current.position)], ['Good days', goodDays], ['Training sessions', sessions.length], ['Trend weight', first('weight') != null ? `${fmtSigned(last('weight') - first('weight'), 1)} ${u.label('mass')}` : '—']].map(([l, v], i) => (
            <motion.div key={l} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 * i }}>
              <div className="text-sm opacity-80">{l}</div><div className="text-3xl font-bold tabular">{v}</div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatTile icon={CalendarDays} label="Avg daily actions" value={mean(months.map((x) => x.score))} unit="%" />
        <StatTile icon={Mountain} label="Avg sleep" value={mean(months.map((x) => x.sleep))} dec={1} unit="h" delta={first('sleep') != null ? last('sleep') - first('sleep') : null} />
        <StatTile icon={Mountain} label="Avg steps" value={mean(months.map((x) => x.steps))} delta={first('steps') != null ? last('steps') - first('steps') : null} deltaDec={0} />
        <StatTile icon={Mountain} label="Resting HR" value={last('rhr')} unit="bpm" delta={first('rhr') != null ? last('rhr') - first('rhr') : null} goodWhen="down" />
        <StatTile icon={HeartCrack} label="Sick days" value={sum(illness.map((i) => i.data?.daysLost || 1))} sub={`${illness.length} episodes`} />
        <StatTile icon={HeartCrack} label="Symptom days" value={symptomDays} />
      </Stagger>

      <Stagger className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2" delay={0.1}>
        <Card hover={false}>
          <CardTitle title="Monthly: daily actions & sleep" sub="Actions % (bars). Sleep has its own chart below." />
          <TimeChart data={months} xKey="date" unit="%" height={220} yDomain={[0, 100]} series={[{ key: 'score', name: 'Daily actions', type: 'bar', color: c.series[0] }]} />
          <TimeChart data={months} xKey="date" unit="h" dec={1} height={160} series={[{ key: 'sleep', name: 'Sleep', type: 'line', dot: true, color: c.series[6] }]} />
        </Card>
        <Card hover={false}>
          <CardTitle title="Monthly: trend weight, RHR & HRV" />
          <TimeChart data={months} xKey="date" unit={u.label('mass')} dec={1} height={180} series={[{ key: 'weight', name: 'Trend weight', type: 'area', color: c.series[1] }]} />
          <TimeChart data={months} xKey="date" height={200} series={[{ key: 'rhr', name: 'Resting HR (bpm)', type: 'line', dot: true, color: c.series[7] }, { key: 'hrv', name: 'HRV (ms)', type: 'line', dot: true, color: c.series[2] }]} />
        </Card>
        <Card hover={false}>
          <CardTitle icon={TestTube2} title="Labs: first vs latest this period" />
          <Table rows={labRows} columns={[
            { key: 'name', label: 'Marker' },
            { key: 'a', label: 'First', right: true, render: (r) => `${u.show(r.a.value, r.dim, LAB_MARKERS[r.id]?.dec || 0, false)}` },
            { key: 'b', label: 'Latest', right: true, render: (r) => `${u.show(r.b.value, r.dim, LAB_MARKERS[r.id]?.dec || 0, false)}` },
            { key: 'u', label: 'Unit', render: (r) => <span className="text-xs text-muted">{u.label(r.dim, r.unit)}</span> },
            { key: 's', label: '', render: (r) => <StatusPill status={r.status} /> },
            { key: 'bt', label: '', render: (r) => (r.better == null ? '' : r.better ? '↗ better' : '↘ worse') },
          ]} empty="No labs in this period" />
        </Card>
        <Card hover={false}>
          <CardTitle icon={Dumbbell} title="Strength gains" sub="Estimated 1RM, start vs best" />
          <Table rows={prs.map((p) => ({ ...p, id: p.ex }))} columns={[
            { key: 'ex', label: 'Lift' }, { key: 'a', label: 'Start', right: true, render: (r) => u.show(r.a, 'mass', 1) }, { key: 'b', label: 'Best', right: true, render: (r) => u.show(r.b, 'mass', 1) },
            { key: 'g', label: 'Gain', right: true, render: (r) => <b className="text-[#0a7d0a] dark:text-good">+{Math.round((r.b / r.a - 1) * 100)}%</b> },
          ]} empty="Log strength sessions to see gains" />
        </Card>
        <Card hover={false} className="xl:col-span-2">
          <CardTitle icon={CalendarDays} title="The year in daily actions" />
          <CalendarHeatmap values={heat} days={Math.min(371, days.length)} end={to} label="actions" />
        </Card>
        {m.insights.length > 0 && <Card hover={false} className="xl:col-span-2"><CardTitle icon={Lightbulb} title="Insights" /><ul className="grid gap-2 md:grid-cols-2">{m.insights.map((t) => <li key={t} className="rounded-xl bg-raised p-3 text-sm">💡 {t}</li>)}</ul></Card>}
      </Stagger>
    </div>
  );
}
