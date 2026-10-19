import { useState } from 'react';
import { BatteryCharging, HeartPulse, Activity, Wind, SunMedium, Gauge as GaugeIcon, Flame } from 'lucide-react';
import { PageHeader, Card, CardTitle, Stagger, Segmented, StatusPill } from '../components/ui.jsx';
import { StatTile } from '../components/motion.jsx';
import { TimeChart, Gauge } from '../components/charts.jsx';
import { useData } from '../lib/store.jsx';
import { useTheme } from '../lib/theme.jsx';
import { addDays, dateRange, fmt, mean, sd } from '../lib/format.js';

export default function Recovery() {
  const { model: m } = useData();
  const { c } = useTheme();
  const [range, setRange] = useState('60');
  const days = dateRange(addDays(m.today, -Number(range) + 1), m.today);
  const band = (k) => days.map((d) => {
    const base = []; for (let i = 1; i <= 30; i++) { const v = m.series(k)[addDays(d, -i)]; if (v != null) base.push(v); }
    const mu = mean(base), s = sd(base);
    return { date: d, v: m.series(k)[d] ?? null, base: mu != null ? +mu.toFixed(1) : null, hi: mu != null && s ? +(mu + s).toFixed(1) : null, lo: mu != null && s ? +(mu - s).toFixed(1) : null };
  });
  const r = m.readiness[m.today] ?? m.readiness[addDays(m.today, -1)];
  const rData = days.map((d) => ({ date: d, readiness: m.readiness[d] ?? null }));
  const load = days.map((d) => ({
    date: d,
    training: +((m.series('training_load')[d] || 0) / 100).toFixed(2),
    life: m.series('stress')[d] != null ? +(m.series('stress')[d] - 1).toFixed(2) : 0,
    sleep: m.sleepByDate[d] ? +Math.max(0, m.targets.sleep - m.sleepByDate[d].duration).toFixed(2) : 0,
  }));
  const inputs = days.map((d) => ({ date: d, meditation: m.series('meditation')[d] ?? null, sunlight: m.series('sunlight')[d] ?? null }));
  const hb = m.baseline('hrv'), rb = m.baseline('rhr');

  return (
    <div>
      <PageHeader icon={BatteryCharging} title="Recovery" subtitle="Readiness, HRV and resting HR against your own baseline, plus your total stress load.">
        <Segmented value={range} onChange={setRange} options={[['30', '30 d'], ['60', '60 d'], ['120', '120 d']]} />
      </PageHeader>
      <Stagger className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Card hover={false} className="lg:row-span-2">
          <CardTitle icon={GaugeIcon} title="Readiness today" />
          <Gauge value={r} label="out of 100" size={220} />
          <div className="mt-4 text-center"><StatusPill status={r == null ? null : r >= 75 ? 'good' : r >= 50 ? 'warning' : 'serious'} label={r == null ? 'No data' : r >= 75 ? 'Push: go hard today' : r >= 50 ? 'Maintain: train as planned' : 'Recover: easy day'} /></div>
          <p className="mt-4 text-xs text-muted">Score = 65 + HRV z-score (40%) − RHR z-score (30%) + sleep vs need (30%) − soreness − stress − the last 2 days of training load. Compared with <i>your</i> 30-day baseline, not population norms.</p>
        </Card>
        <StatTile icon={Activity} label="HRV (7 d)" value={hb.recent} unit="ms" delta={hb.delta} deltaDec={0} goodWhen="up" sub={`baseline ${fmt(hb.mean)} ± ${fmt(hb.sd)}`} />
        <StatTile icon={HeartPulse} label="Resting HR (7 d)" value={rb.recent} unit="bpm" delta={rb.delta} goodWhen="down" sub={`baseline ${fmt(rb.mean, 1)}`} />
        <StatTile icon={Flame} label="Acute:chronic load" value={m.acwr} dec={2} sub="0.8–1.3 is the sweet spot" />
        <Card hover={false} className="lg:col-span-3">
          <CardTitle icon={GaugeIcon} title="Readiness history" />
          <TimeChart data={rData} height={190} yDomain={[0, 100]} refAreas={[{ y1: 75, y2: 100, color: c.status.good }, { y1: 0, y2: 50, color: c.status.serious }]} series={[{ key: 'readiness', name: 'Readiness', type: 'area', color: c.series[0] }]} />
        </Card>
      </Stagger>
      <Stagger className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2" delay={0.1}>
        <Card hover={false}>
          <CardTitle icon={Activity} title="HRV vs your baseline" sub="Dashed lines: 30-day baseline ± 1 SD" />
          <TimeChart data={band('hrv')} unit="ms" height={250} series={[{ key: 'v', name: 'HRV', type: 'line', color: c.series[2], dot: true }, { key: 'base', name: 'Baseline', type: 'line', color: c.muted }, { key: 'hi', name: '+1 SD', type: 'line', color: c.muted, dashed: true }, { key: 'lo', name: '−1 SD', type: 'line', color: c.muted, dashed: true }]} />
        </Card>
        <Card hover={false}>
          <CardTitle icon={HeartPulse} title="Resting HR vs your baseline" sub="A sustained rise of 3+ bpm often comes before illness or overreaching" />
          <TimeChart data={band('rhr')} unit="bpm" height={250} series={[{ key: 'v', name: 'RHR', type: 'line', color: c.series[7], dot: true }, { key: 'base', name: 'Baseline', type: 'line', color: c.muted }, { key: 'hi', name: '+1 SD', type: 'line', color: c.muted, dashed: true }, { key: 'lo', name: '−1 SD', type: 'line', color: c.muted, dashed: true }]} />
        </Card>
        <Card hover={false}>
          <CardTitle icon={Flame} title="Total stress load" sub="Training load (÷100) + life stress (check-in) + sleep deficit (h)" />
          <TimeChart data={load} height={250} series={[{ key: 'training', name: 'Training', type: 'bar', stack: 'l', color: c.series[0] }, { key: 'life', name: 'Life stress', type: 'bar', stack: 'l', color: c.series[1] }, { key: 'sleep', name: 'Sleep deficit', type: 'bar', stack: 'l', color: c.series[6] }]} />
        </Card>
        <Card hover={false}>
          <CardTitle icon={Wind} title="Recovery inputs" sub="Minutes of meditation / breathwork and morning sunlight" />
          <TimeChart data={inputs} unit="min" height={250} series={[{ key: 'meditation', name: 'Meditation', type: 'bar', color: c.series[6] }, { key: 'sunlight', name: 'Sunlight', type: 'bar', color: c.series[3] }]} />
        </Card>
      </Stagger>
    </div>
  );
}
