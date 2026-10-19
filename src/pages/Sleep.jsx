import { useState } from 'react';
import { BedDouble, Moon, AlarmClock, Hourglass, Gauge as GaugeIcon, Brain, Plus, ListChecks } from 'lucide-react';
import { PageHeader, Card, CardTitle, Stagger, Button, Segmented, Modal, Field, Input, Toggle } from '../components/ui.jsx';
import { StatTile } from '../components/motion.jsx';
import { TimeChart, BarList, CalendarHeatmap } from '../components/charts.jsx';
import { ScaleInput } from '../components/QuickLog.jsx';
import { useData } from '../lib/store.jsx';
import { useTheme } from '../lib/theme.jsx';
import { api } from '../lib/api.js';
import { addDays, dateRange, fmt, fmtHours, mean, sd, minutesToClock, todayISO, pad } from '../lib/format.js';

const HYGIENE = [['dark', 'Dark room'], ['cool', 'Cool room (17–19 °C)'], ['noScreens', 'No screens 30 min before'], ['windDown', 'Wind-down routine'], ['noCaffeinePM', 'No caffeine after noon'], ['noAlcohol', 'No alcohol']];

export default function Sleep() {
  const { model: m, refresh, notify } = useData();
  const { c } = useTheme();
  const [range, setRange] = useState('30');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ date: todayISO(), bed: '23:00', wake: '06:45', latency: 15, quality: 3, awakenings: 1, hygiene: {} });
  const days = dateRange(addDays(m.today, -Number(range) + 1), m.today);
  const S = m.sleepByDate;
  const target = m.targets.sleep;
  const data = days.map((d) => ({ date: d, duration: S[d]?.duration ?? null, bed: m.series('bed_min')[d] ?? null, wake: m.series('wake_min')[d] != null ? m.series('wake_min')[d] - 360 + 720 : null,
    deep: S[d]?.deep ?? null, rem: S[d]?.rem ?? null, light: S[d]?.duration && S[d]?.deep != null ? +(S[d].duration - S[d].deep - (S[d].rem || 0)).toFixed(2) : null, quality: S[d]?.quality ?? null }));
  let debt = 0;
  const debtData = days.map((d) => { if (S[d]) debt = Math.max(0, debt + (target - S[d].duration)); return { date: d, debt: +debt.toFixed(2) }; });
  const last = S[m.today] || S[addDays(m.today, -1)];
  const c14 = m.current.ctx;
  const hyg = HYGIENE.map(([k, l]) => { const nights = days.map((d) => S[d]?.hygiene).filter(Boolean); return { name: l, value: nights.length ? Math.round((nights.filter((h) => h[k]).length / nights.length) * 100) : 0 }; });
  const heat = Object.fromEntries(Object.entries(S).map(([d, s]) => [d, Math.min(100, (s.duration / 9) * 100)]));

  const save = async () => {
    const wakeD = new Date(`${f.date}T${f.wake}:00`);
    const bedD = new Date(`${f.date}T${f.bed}:00`); if (bedD >= wakeD) bedD.setDate(bedD.getDate() - 1);
    const inBed = (wakeD - bedD) / 3.6e6;
    const duration = Math.max(0, inBed - Number(f.latency || 0) / 60 - Number(f.awakenings || 0) * 0.08);
    await api.add('sleep', { date: f.date, bed: bedD.toISOString(), wake: wakeD.toISOString(), duration: +duration.toFixed(2), quality: f.quality, latency: Number(f.latency), awakenings: Number(f.awakenings), efficiency: Math.round((duration / inBed) * 100), hygiene: f.hygiene });
    setOpen(false); await refresh(); notify('Sleep logged');
  };

  return (
    <div>
      <PageHeader icon={BedDouble} title="Sleep" subtitle="Duration, regularity, debt and stages. Sleep sets the conditions for almost every other signal.">
        <Segmented value={range} onChange={setRange} options={[['14', '14 d'], ['30', '30 d'], ['90', '90 d']]} />
        <Button icon={Plus} onClick={() => setOpen(true)}>Log sleep</Button>
      </PageHeader>
      <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatTile icon={Moon} label="Last night" value={last?.duration} dec={1} unit="h" sub={last ? `${minutesToClock(m.series('bed_min')[last.date])} → ${new Date(last.wake).toTimeString().slice(0, 5)}` : 'not logged'} />
        <StatTile icon={BedDouble} label="7-day average" value={m.avgWin('sleep_duration', m.today, 7)} dec={1} unit="h" delta={(m.avgWin('sleep_duration', m.today, 7) ?? 0) - (m.avgWin('sleep_duration', addDays(m.today, -7), 30) ?? 0)} deltaDec={1} goodWhen="up" spark={days.slice(-14).map((d) => S[d]?.duration ?? null)} sparkColor={c.series[6]} />
        <StatTile icon={AlarmClock} label="Bedtime regularity" value={c14.bedSd} unit="min SD" sub={`Avg bedtime ${minutesToClock(c14.bedAvg)}`} />
        <StatTile icon={Hourglass} label="Sleep debt (14 d)" value={c14.sleepDebt} dec={1} unit="h" sub={`vs ${target} h need`} />
        <StatTile icon={GaugeIcon} label="Efficiency" value={c14.efficiency} unit="%" sub={`Falls asleep in ${fmt(c14.latency)} min`} />
        <StatTile icon={Brain} label="Deep / REM" value={c14.deepPct} unit="%" sub={`REM ${fmt(c14.remPct)}%`} />
      </Stagger>

      <Stagger className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2" delay={0.1}>
        <Card hover={false}>
          <CardTitle icon={Moon} title="Duration" sub={`Target ${target} h · aqua = 7 h+, orange = under 6 h`} />
          <TimeChart data={data} unit="h" dec={1} height={250} refLines={[{ y: target, label: 'target' }]} series={[{ key: 'duration', name: 'Sleep', type: 'bar', cells: (d) => (d.duration == null ? null : d.duration >= 7 ? c.series[2] : d.duration < 6 ? c.series[1] : c.series[0]) }]} />
        </Card>
        <Card hover={false}>
          <CardTitle icon={AlarmClock} title="Bed & wake times" sub="A flat line is a regular rhythm" />
          <TimeChart data={data} height={250} yFmt={minutesToClock} valueFmt={(v) => minutesToClock(v)} yDomain={['auto', 'auto']}
            series={[{ key: 'bed', name: 'Bedtime', type: 'line', color: c.series[6], dot: true }, { key: 'wake', name: 'Wake time', type: 'line', color: c.series[3], dot: true }]} />
        </Card>
        <Card hover={false}>
          <CardTitle icon={Brain} title="Sleep stages" sub="From your wearable: deep, REM, light (hours)" />
          <TimeChart data={data} unit="h" dec={1} height={250} series={[{ key: 'deep', name: 'Deep', type: 'bar', stack: 's', color: c.series[6] }, { key: 'rem', name: 'REM', type: 'bar', stack: 's', color: c.series[0] }, { key: 'light', name: 'Light', type: 'bar', stack: 's', color: c.seq[1] }]} />
        </Card>
        <Card hover={false}>
          <CardTitle icon={Hourglass} title="Running sleep debt" sub="Accumulates when under target; repaid by longer nights" />
          <TimeChart data={debtData} unit="h" dec={1} height={250} series={[{ key: 'debt', name: 'Sleep debt', type: 'area', color: c.series[1] }]} />
        </Card>
      </Stagger>

      <Stagger className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3" delay={0.2}>
        <Card hover={false} className="xl:col-span-2">
          <CardTitle icon={BedDouble} title="Sleep calendar" sub="Darker = longer sleep (26 weeks)" />
          <CalendarHeatmap values={heat} label="of 9 h" unit="%" />
          <div className="mt-4"><TimeChart data={data} height={160} yDomain={[1, 5]} series={[{ key: 'quality', name: 'Quality (1–5)', type: 'area', color: c.series[2] }]} /></div>
        </Card>
        <Card hover={false}>
          <CardTitle icon={ListChecks} title="Sleep hygiene adherence" sub={`% of nights · last ${range} d`} />
          <BarList data={hyg} unit="%" cellColor={(d) => (d.value >= 80 ? c.status.good : d.value >= 50 ? c.series[0] : c.status.serious)} />
        </Card>
      </Stagger>

      <Modal open={open} onClose={() => setOpen(false)} title="Log sleep" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Morning of (wake date)" className="col-span-2"><Input type="date" value={f.date} max={todayISO()} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Went to bed"><Input type="time" value={f.bed} onChange={(e) => setF({ ...f, bed: e.target.value })} /></Field>
          <Field label="Woke up"><Input type="time" value={f.wake} onChange={(e) => setF({ ...f, wake: e.target.value })} /></Field>
          <Field label="Minutes to fall asleep"><Input type="number" value={f.latency} onChange={(e) => setF({ ...f, latency: e.target.value })} /></Field>
          <Field label="Wake-ups"><Input type="number" value={f.awakenings} onChange={(e) => setF({ ...f, awakenings: e.target.value })} /></Field>
          <Field label="How rested do you feel?" className="col-span-2"><ScaleInput value={f.quality} onChange={(v) => setF({ ...f, quality: v })} /></Field>
          <div className="col-span-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {HYGIENE.map(([k, l]) => <Toggle key={k} checked={!!f.hygiene[k]} onChange={(v) => setF({ ...f, hygiene: { ...f.hygiene, [k]: v } })} label={l} />)}
          </div>
        </div>
      </Modal>
    </div>
  );
}
