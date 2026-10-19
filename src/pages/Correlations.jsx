import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Lightbulb } from 'lucide-react';
import { PageHeader, Card, CardTitle, Stagger, Select, Field, Segmented, Badge } from '../components/ui.jsx';
import { ScatterPlot, TimeChart } from '../components/charts.jsx';
import { useData } from '../lib/store.jsx';
import { useTheme } from '../lib/theme.jsx';
import { addDays, dateRange, mean, sd, fmt } from '../lib/format.js';
import { METRICS } from '@shared/catalog.js';

const DERIVED = {
  sleep_duration: 'Sleep duration (h)', sleep_quality: 'Sleep quality', sleep_efficiency: 'Sleep efficiency', bed_min: 'Bedtime (min after 18:00)', deep_pct: 'Deep sleep %',
  food_kcal: 'Calories', food_protein: 'Protein', food_carbs: 'Carbs', food_fat: 'Fat', food_fiber: 'Fibre', food_sugar: 'Sugar', food_sodium: 'Sodium', food_upf_pct: 'Ultra-processed %', food_plant_servings: 'Plant servings',
  training_load: 'Training load', training_min: 'Training minutes', readiness: 'Readiness', action_score: 'Daily actions %', bp_sys: 'Systolic BP', glucose_fasting: 'Fasting glucose',
};
const PRESETS = [['alcohol', 'hrv', 1], ['sleep_duration', 'energy', 0], ['steps', 'sleep_duration', 1], ['bed_min', 'sleep_quality', 0], ['caffeine', 'sleep_duration', 1], ['training_load', 'readiness', 1],
  ['stress', 'sleep_quality', 1], ['meditation', 'hrv', 1], ['food_sugar', 'energy', 0], ['food_upf_pct', 'hunger', 1], ['sleep_duration', 'hunger', 0], ['water', 'energy', 0], ['action_score', 'mood', 0], ['screen_bed', 'sleep_quality', 1], ['alcohol', 'rhr', 1], ['steps', 'mood', 0]];

const strength = (r) => (r == null ? 'n/a' : Math.abs(r) >= 0.5 ? 'strong' : Math.abs(r) >= 0.3 ? 'moderate' : Math.abs(r) >= 0.15 ? 'weak' : 'none');

export default function Correlations() {
  const { model: m } = useData();
  const { c } = useTheme();
  const options = useMemo(() => [...Object.keys(m.daily).filter((k) => METRICS[k] || DERIVED[k] || m.customDefs[k]).map((k) => [k, DERIVED[k] || METRICS[k]?.name || m.customDefs[k]?.name || k])].sort((a, b) => a[1].localeCompare(b[1])), [m]);
  const [x, setX] = useState('alcohol');
  const [y, setY] = useState('hrv');
  const [lag, setLag] = useState('1');
  const name = (k) => DERIVED[k] || METRICS[k]?.name || m.customDefs[k]?.name || k;
  const res = m.pearson(x, y, Number(lag), 180);
  const top = useMemo(() => PRESETS.map(([a, b, l]) => ({ a, b, l, ...m.pearson(a, b, l, 180) })).filter((p) => p.r != null).sort((p, q) => Math.abs(q.r) - Math.abs(p.r)), [m]);
  const z = (k, shift) => { const vals = dateRange(addDays(m.today, -89), m.today).map((d) => m.series(k)[addDays(d, shift)]); const mu = mean(vals), s = sd(vals); return vals.map((v) => (v == null || !s ? null : +((v - mu) / s).toFixed(2))); };
  const zx = z(x, 0), zy = z(y, Number(lag));
  const zData = dateRange(addDays(m.today, -89), m.today).map((d, i) => ({ date: d, x: zx[i], y: zy[i] }));

  return (
    <div>
      <PageHeader icon={Sparkles} title="Correlations lab" subtitle="Pick any two metrics and see how they move together, including next-day effects." />
      <Stagger className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card hover={false} className="xl:col-span-2">
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr_auto] md:items-end">
            <Field label="Cause (X)"><Select value={x} onChange={(e) => setX(e.target.value)} options={options} /></Field>
            <ArrowRight className="mx-auto mb-2 hidden text-muted md:block" />
            <Field label="Effect (Y)"><Select value={y} onChange={(e) => setY(e.target.value)} options={options} /></Field>
            <Field label="Y measured"><Segmented size="sm" value={lag} onChange={setLag} options={[['0', 'same day'], ['1', '+1 d'], ['2', '+2 d']]} /></Field>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <motion.div key={`${x}${y}${lag}`} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-4xl font-bold tabular grad-text">r = {res.r == null ? '—' : res.r.toFixed(2)}</motion.div>
            <Badge tone={res.r == null ? 'neutral' : Math.abs(res.r) >= 0.3 ? 'accent' : 'neutral'}>{strength(res.r)} {res.r != null && res.r !== 0 ? (res.r > 0 ? 'positive' : 'negative') : ''}</Badge>
            <span className="text-sm text-muted">n = {res.n} days</span>
          </div>
          {res.pts.length ? <ScatterPlot pts={res.pts} xName={name(x)} yName={name(y)} height={320} /> : <p className="py-16 text-center text-sm text-muted">Not enough overlapping days (need 8+).</p>}
        </Card>
        <Card hover={false}>
          <CardTitle icon={Lightbulb} title="Strongest relationships" sub="Auto-scanned common pairs, last 180 days" />
          <div className="space-y-1.5">
            {top.map((p, i) => (
              <motion.button key={`${p.a}${p.b}`} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} onClick={() => { setX(p.a); setY(p.b); setLag(String(p.l)); }}
                className="flex w-full items-center gap-2 rounded-xl p-2 text-left text-sm transition hover:bg-raised">
                <div className="w-12 text-right font-bold tabular" style={{ color: p.r > 0 ? c.series[2] : c.series[1] }}>{p.r.toFixed(2)}</div>
                <div className="min-w-0 flex-1 truncate">{name(p.a)} → {name(p.b)}{p.l ? <span className="text-muted"> (+{p.l} d)</span> : ''}</div>
              </motion.button>
            ))}
          </div>
        </Card>
        <Card hover={false} className="xl:col-span-3">
          <CardTitle title="Both over time" sub="Standardised (z-scores) on one shared axis, so different units compare fairly" />
          <TimeChart data={zData} height={240} dec={1} series={[{ key: 'x', name: name(x), type: 'line', color: c.series[0] }, { key: 'y', name: `${name(y)}${Number(lag) ? ` (+${lag} d)` : ''}`, type: 'line', color: c.series[1] }]} />
          <p className="mt-2 text-xs text-muted">Correlation is not causation. Spotted something? Test it properly in <a className="text-accent" href="/experiments">Experiments</a>.</p>
        </Card>
        {m.insights.length > 0 && (
          <Card hover={false} className="xl:col-span-3">
            <CardTitle icon={Lightbulb} title="Insights" sub="Rule-based observations from your data" />
            <ul className="grid gap-2 md:grid-cols-2">{m.insights.map((t) => <li key={t} className="rounded-xl bg-raised p-3 text-sm">💡 {t}</li>)}</ul>
          </Card>
        )}
      </Stagger>
    </div>
  );
}
