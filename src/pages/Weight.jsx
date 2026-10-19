import { useMemo, useState } from 'react';
import { Scale, TrendingDown, Flame, Target, CalendarClock, Gauge as GaugeIcon, Info, Plus, Droplets, Layers3, Repeat, Trash2 } from 'lucide-react';
import { PageHeader, Card, CardTitle, Stagger, Button, Segmented, Field, UnitInput, Badge, Table, IconBtn } from '../components/ui.jsx';
import { StatTile } from '../components/motion.jsx';
import { TimeChart } from '../components/charts.jsx';
import RecordManager from '../components/RecordManager.jsx';
import QuickLog from '../components/QuickLog.jsx';
import { useData } from '../lib/store.jsx';
import { useTheme } from '../lib/theme.jsx';
import { api } from '../lib/api.js';
import { addDays, dateRange, fmt, fmtDate, fmtSigned, mean } from '../lib/format.js';
import { KCAL_PER_KG } from '@shared/units.js';

export default function Weight() {
  const { model: m, u, saveSettings, refresh, notify } = useData();
  const { c } = useTheme();
  const [range, setRange] = useState('90');
  const [log, setLog] = useState(false);
  const [goal, setGoal] = useState({ targetWeight: m.profile.targetWeight ? u.from(m.profile.targetWeight, 'mass').toFixed(1) : '', rate: m.profile.rate ?? 0.5 });
  const from = range === 'all' ? Object.keys(m.series('weight')).sort()[0] || m.today : addDays(m.today, -Number(range));
  const days = dateRange(from, m.today);
  const W = m.series('weight');
  const data = days.map((d) => ({ date: d, scale: W[d] != null ? +u.from(W[d], 'mass').toFixed(1) : null, trend: m.trend[d] != null ? +u.from(m.trend[d], 'mass').toFixed(2) : null }));
  const latestScale = m.latest('weight');
  const tdeeData = m.tdeeSeries.filter((x) => x.date >= from).map((x) => ({ ...x, target: m.targets.kcal }));

  // Forecast curve with band
  const fc = m.forecast;
  const fcData = fc ? fc.slow.pts.map((p, i) => ({ date: addDays(m.today, p.i), mid: fc.mid.pts[i] ? +u.from(fc.mid.pts[i].w, 'mass').toFixed(2) : null, fast: fc.fast.pts[i] ? +u.from(fc.fast.pts[i].w, 'mass').toFixed(2) : null, slow: +u.from(p.w, 'mass').toFixed(2) })) : [];

  // Water-weight annotations: days where scale sits ≥0.8 kg above trend, with likely causes
  const notes = useMemo(() => {
    const out = [];
    const avgCarb = mean(Object.values(m.foodByDate).map((f) => f.carbs));
    for (const d of days.slice(-60)) {
      if (W[d] == null || m.trend[d] == null || W[d] - m.trend[d] < 0.8) continue;
      const y = addDays(d, -1), f = m.foodByDate[y] || {}, why = [];
      if (f.sodium > 3000) why.push(`high sodium yesterday (${fmt(f.sodium)} mg)`);
      if (avgCarb && f.carbs > avgCarb * 1.25) why.push(`high carbs yesterday (${fmt(f.carbs)} g)`);
      if (m.series('alcohol')[y] > 0) why.push('alcohol yesterday');
      if (m.series('training_load')[y] > 350) why.push('hard training (inflammation & glycogen)');
      if (m.series('period')[d] || m.series('period')[y]) why.push('menstrual cycle');
      for (const t of m.contextByDate[d] || []) why.push(`tag: ${t}`);
      out.push({ date: d, over: W[d] - m.trend[d], why: why.length ? why.join(', ') : 'normal daily water fluctuation' });
    }
    return out.reverse();
  }, [m, days, W]);

  // Body-composition split (fat vs lean) from body-fat measurements
  const bf = Object.entries(m.series('bodyfat')).sort();
  const split = bf.length >= 2 && W ? (() => {
    const [d0, b0] = bf[0], [d1, b1] = bf.at(-1);
    const w0 = m.trend[d0] ?? W[d0], w1 = m.trend[d1] ?? W[d1];
    if (!w0 || !w1) return null;
    const f0 = (w0 * b0) / 100, f1 = (w1 * b1) / 100;
    return { from: d0, to: d1, total: w1 - w0, fat: f1 - f0, lean: (w1 - f1) - (w0 - f0) };
  })() : null;

  const saveGoal = async () => {
    await saveSettings({ profile: { ...m.profile, targetWeight: u.to(Number(goal.targetWeight), 'mass'), rate: Number(goal.rate) } });
    notify('Goal updated');
  };
  const weighins = Object.entries(W).sort().reverse().slice(0, 30).map(([date, v]) => ({ id: date, date, v, trend: m.trend[date] }));

  return (
    <div>
      <PageHeader icon={Scale} title="Weight & energy balance" subtitle="Trend weight, adaptive TDEE and a forecast. Calories decide how much weight changes; protein and training decide whether it's fat or muscle.">
        <Segmented value={range} onChange={setRange} options={[['30', '30 d'], ['90', '90 d'], ['180', '180 d'], ['all', 'All']]} />
        <Button icon={Plus} onClick={() => setLog(true)}>Log weight</Button>
      </PageHeader>

      <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatTile icon={Scale} label="Latest scale" value={u.from(latestScale?.value, 'mass')} dec={1} unit={u.label('mass')} sub={latestScale ? fmtDate(latestScale.date, 'EEE d MMM') : 'no weigh-ins'} />
        <StatTile icon={TrendingDown} label="Trend weight" value={u.from(m.trendNow, 'mass')} dec={2} unit={u.label('mass')} sub="EMA, α = 0.1" tone="grad" />
        <StatTile icon={Repeat} label="Weekly rate" value={m.weeklyRate != null ? u.from(m.weeklyRate, 'mass') : null} dec={2} unit={`${u.label('mass')}/wk`} sub={`Plan ${m.direction < 0 ? '−' : m.direction > 0 ? '+' : '±'}${m.rate} kg/wk`} />
        <StatTile icon={Flame} label={`TDEE (${m.tdeeSource})`} value={m.tdee} unit="kcal" sub={`Formula estimate ${fmt(m.formulaTDEE)} kcal`} />
        <StatTile icon={Target} label="Daily target" value={m.targets.kcal} unit="kcal" sub={`Protein ${m.targets.protein} g`} />
        <StatTile icon={CalendarClock} label="Goal ETA" value={fc?.mid.days} unit="days" sub={fc?.eta ? `${fmtDate(fc.eta, 'd MMM yyyy')} at plan` : 'Set a goal weight'} />
      </Stagger>

      <Stagger className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3" delay={0.1}>
        <Card hover={false} className="xl:col-span-2">
          <CardTitle icon={Scale} title="Scale vs trend" sub="Dots are daily weigh-ins (noisy: water, salt, glycogen). The line is your true trend." />
          <TimeChart data={data} unit={u.label('mass')} dec={1} height={300} syncId="w"
            refLines={m.profile.targetWeight ? [{ y: +u.from(m.profile.targetWeight, 'mass').toFixed(1), label: 'goal' }] : []}
            series={[{ key: 'scale', name: 'Scale weight', type: 'line', color: c.series[0], width: 0, dot: true }, { key: 'trend', name: 'Trend weight', type: 'line', color: c.series[1], width: 3 }]} />
        </Card>
        <Card hover={false}>
          <CardTitle icon={Target} title="Goal" sub="Drives your calorie & protein targets" />
          <div className="space-y-3">
            <Field label="Target weight"><UnitInput unit={u.label('mass')} value={goal.targetWeight} onChange={(e) => setGoal({ ...goal, targetWeight: e.target.value })} /></Field>
            <Field label={`Rate: ${goal.rate} kg/week (${m.trendNow ? ((goal.rate / m.trendNow) * 100).toFixed(2) : '—'}% body weight)`} hint="0.5–1% of body weight per week preserves muscle while cutting.">
              <input type="range" min="0" max="1" step="0.05" value={goal.rate} onChange={(e) => setGoal({ ...goal, rate: Number(e.target.value) })} className="w-full" />
            </Field>
            <div className="rounded-xl bg-raised p-3 text-sm">
              Daily target = TDEE {fmt(m.tdee)} {m.direction <= 0 ? '−' : '+'} {fmt((goal.rate * KCAL_PER_KG) / 7)} = <b>{fmt(Math.max(m.targets.floorKcal, m.tdee + (m.direction || -1) * (goal.rate * KCAL_PER_KG) / 7))} kcal</b>
              <div className="mt-1 text-xs text-muted">1 kg of fat ≈ 7,700 kcal. Calorie floor {m.targets.floorKcal} kcal.</div>
            </div>
            <Button onClick={saveGoal} className="w-full">Save goal</Button>
          </div>
        </Card>
      </Stagger>

      <Stagger className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2" delay={0.15}>
        <Card hover={false}>
          <CardTitle icon={Flame} title="Intake vs expenditure" sub="Adaptive TDEE = avg intake − Δtrend × 7700 / 21 days. It corrects for logging errors and metabolic adaptation." />
          {tdeeData.length ? <TimeChart data={tdeeData} unit="kcal" height={270} series={[
            { key: 'intake', name: 'Logged intake', type: 'bar', color: c.series[0] }, { key: 'adaptive', name: 'Adaptive TDEE', type: 'line', color: c.series[1], width: 2.5 },
            { key: 'formula', name: 'Formula TDEE', type: 'line', color: c.series[6], dashed: true }, { key: 'target', name: 'Target', type: 'line', color: c.muted, dashed: true },
          ]} /> : <p className="py-10 text-center text-sm text-muted">Needs ~3 weeks of food logs and weigh-ins.</p>}
        </Card>
        <Card hover={false}>
          <CardTitle icon={CalendarClock} title="Forecast to goal" sub={fc ? `At plan: ${fc.eta ? fmtDate(fc.eta, 'd MMM yyyy') : '>18 months'} · at current pace: ${fc.paceEta ? fmtDate(fc.paceEta, 'd MMM yyyy') : '—'}` : 'Set a goal weight and fat-loss or muscle goal'} />
          {fc ? <TimeChart data={fcData} unit={u.label('mass')} dec={1} height={270} refLines={[{ y: +u.from(m.profile.targetWeight, 'mass').toFixed(1), label: 'goal' }]} series={[
            { key: 'fast', name: 'If 25% more deficit', type: 'line', color: c.series[2], dashed: true }, { key: 'mid', name: 'At plan', type: 'line', color: c.series[0], width: 3 },
            { key: 'slow', name: 'If 25% less deficit', type: 'line', color: c.series[3], dashed: true }]} /> : null}
          <p className="mt-2 text-xs text-muted">The model lowers TDEE as you lose weight (BMR × activity), so the curve flattens near the goal. Recalculated every time you log.</p>
        </Card>
      </Stagger>

      <Stagger className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3" delay={0.2}>
        <Card hover={false}>
          <CardTitle icon={GaugeIcon} title="Logging accuracy check" sub="Does logged intake explain the scale?" />
          {m.logging ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-fg2">Avg logged intake (21 d)</span><b className="tabular">{fmt(m.logging.logged)} kcal</b></div>
              <div className="flex justify-between"><span className="text-fg2">Intake implied by trend</span><b className="tabular">{fmt(m.logging.implied)} kcal</b></div>
              <div className="flex justify-between"><span className="text-fg2">Gap</span><b className="tabular">{fmtSigned(m.logging.gap)} kcal/day</b></div>
              <div className={`mt-2 rounded-xl p-3 ${m.logging.flag === 'ok' ? 'bg-good/10' : 'bg-warning/15'}`}>
                {m.logging.flag === 'under' ? 'Likely under-logging (oils, drinks, bites, weekends) or activity set too high. The adaptive TDEE already compensates.'
                  : m.logging.flag === 'over' ? 'Your expenditure is higher than the formula assumes, or you are over-logging. Adaptive TDEE compensates.'
                    : 'Logging and weight trend agree. 👍'}
              </div>
            </div>
          ) : <p className="text-sm text-muted">Needs 10+ logged days and 3 weeks of weigh-ins.</p>}
        </Card>
        <Card hover={false}>
          <CardTitle icon={Layers3} title="What did you lose?" sub="Fat vs lean split from body-fat measurements" />
          {split ? (
            <div className="space-y-3 text-sm">
              <div className="text-xs text-muted">{fmtDate(split.from)} → {fmtDate(split.to)}</div>
              {[['Total', split.total, c.series[0]], ['Fat mass', split.fat, c.series[1]], ['Lean mass', split.lean, c.series[2]]].map(([l, v, col]) => (
                <div key={l} className="flex items-center gap-3"><span className="h-3 w-3 rounded" style={{ background: col }} /><span className="flex-1 text-fg2">{l}</span><b className="tabular">{fmtSigned(u.from(v, 'mass'), 1)} {u.label('mass')}</b></div>
              ))}
              <p className="text-xs text-muted">{split.total < 0 && split.lean / split.total < 0.25 ? 'Over 75% of the loss is fat: protein and training are working.' : 'A high lean share means you may need more protein, more resistance training or a slower rate.'}</p>
            </div>
          ) : <p className="text-sm text-muted">Log body fat % at least twice (Body page).</p>}
        </Card>
        <Card hover={false}>
          <CardTitle icon={Droplets} title="Water-weight annotations" sub="Scale spikes ≥ 0.8 kg above trend, explained" />
          <div className="max-h-56 space-y-2 overflow-y-auto">
            {notes.map((n) => <div key={n.date} className="rounded-xl bg-raised p-2 text-xs"><b>{fmtDate(n.date, 'EEE d MMM')}</b> · +{u.from(n.over, 'mass').toFixed(1)} {u.label('mass')}<div className="text-muted">{n.why}</div></div>)}
            {!notes.length && <p className="text-sm text-muted">No big spikes in the last 60 days.</p>}
          </div>
        </Card>
      </Stagger>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecordManager kind="phase" title="Diet phases" icon={Repeat} sub="Cut · maintenance · bulk · diet breaks"
          fields={[{ key: 'kind', label: 'Phase', type: 'select', options: [['cut', 'Cut'], ['maintain', 'Maintenance'], ['bulk', 'Lean bulk'], ['diet_break', 'Diet break'], ['reverse', 'Reverse diet']], half: true },
            { key: 'targetRate', label: 'Target rate (kg/wk)', type: 'number', half: true }, { key: '_date', label: 'Start', type: 'date', half: true }, { key: 'end', label: 'End', type: 'date', half: true }, { key: 'notes', label: 'Notes', type: 'textarea' }]}
          defaults={{ kind: 'cut', targetRate: 0.5 }}
          summary={(r) => <div className="flex items-center gap-2"><Badge tone={r.data.kind === 'cut' ? 'info' : r.data.kind === 'bulk' ? 'good' : 'neutral'}>{r.data.kind?.replace('_', ' ')}</Badge><span>{fmtDate(r.date)} → {r.data.end ? fmtDate(r.data.end) : 'ongoing'}</span><span className="text-muted">{r.data.targetRate} kg/wk</span>{r.data.notes && <span className="truncate text-muted">· {r.data.notes}</span>}</div>} />
        <Card hover={false}>
          <CardTitle icon={Info} title="Recent weigh-ins" />
          <Table rows={weighins} columns={[
            { key: 'date', label: 'Date', render: (r) => fmtDate(r.date, 'EEE d MMM') },
            { key: 'v', label: 'Scale', right: true, render: (r) => u.show(r.v, 'mass', 1) },
            { key: 'trend', label: 'Trend', right: true, render: (r) => u.show(r.trend, 'mass', 2) },
            { key: 'diff', label: 'vs trend', right: true, render: (r) => fmtSigned(u.from(r.v - r.trend, 'mass'), 1) },
            { key: 'x', label: '', render: (r) => <IconBtn icon={Trash2} label="Delete" size={14} onClick={async () => { await api.removeEntry('weight', r.date); refresh(); }} /> },
          ]} />
        </Card>
      </div>
      <QuickLog open={log} onClose={() => setLog(false)} initial="weight" />
    </div>
  );
}
