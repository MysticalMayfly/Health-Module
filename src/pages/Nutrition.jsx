import { useState } from 'react';
import { Salad, Beef, Wheat, Leaf, Factory, Clock, Droplets, Award } from 'lucide-react';
import { PageHeader, Card, CardTitle, Stagger, Segmented, Progress } from '../components/ui.jsx';
import { StatTile, Ring, AnimatedNumber } from '../components/motion.jsx';
import { TimeChart, Donut, BarList, CalendarHeatmap } from '../components/charts.jsx';
import { useData } from '../lib/store.jsx';
import { useTheme } from '../lib/theme.jsx';
import { addDays, dateRange, fmt, mean, clamp } from '../lib/format.js';
import { NUTRIENTS } from '@shared/catalog.js';

/** Daily food-quality score 0–100 (H-15): beyond calories. */
export function qualityScore(f, t) {
  if (!f) return null;
  const parts = [
    clamp(f.protein / t.protein, 0, 1) * 20,
    clamp(f.fiber / 30, 0, 1) * 20,
    clamp(f.plant_servings / 5, 0, 1) * 20,
    clamp(1 - (f.upf_pct || 0) / 40, 0, 1) * 20,
    clamp(1 - Math.max(0, f.sugar - 25) / 50, 0, 1) * 10,
    clamp(1 - Math.max(0, f.sodium - 1500) / 2000, 0, 1) * 10,
  ];
  return Math.round(parts.reduce((s, v) => s + v, 0));
}

export default function Nutrition() {
  const { model: m, bundle } = useData();
  const { c } = useTheme();
  const [range, setRange] = useState('30');
  const days = dateRange(addDays(m.today, -Number(range) + 1), m.today);
  const F = m.foodByDate, t = m.targets;
  const logged = days.map((d) => F[d]).filter(Boolean);
  const avg = (k) => mean(logged.map((f) => f[k]));
  const q = days.map((d) => ({ date: d, quality: qualityScore(F[d], t) }));
  const qAvg = mean(q.map((x) => x.quality));
  const macro = days.map((d) => ({ date: d, protein: F[d] ? Math.round(F[d].protein * 4) : null, carbs: F[d] ? Math.round(F[d].carbs * 4) : null, fat: F[d] ? Math.round(F[d].fat * 9) : null }));
  const upf = days.map((d) => ({ date: d, upf: F[d] ? +F[d].upf_pct.toFixed(1) : null }));
  const plants = days.map((d) => ({ date: d, servings: F[d] ? +F[d].plant_servings.toFixed(1) : null, fiber: F[d] ? +F[d].fiber.toFixed(0) : null }));
  const mealSplit = ['breakfast', 'lunch', 'snack', 'dinner'].map((meal) => {
    const rows = (bundle.mealDaily || []).filter((r) => r.meal === meal && r.date >= days[0]);
    return { name: meal[0].toUpperCase() + meal.slice(1), value: logged.length ? rows.reduce((s2, r) => s2 + r.kcal, 0) / logged.length : 0 };
  });
  const lastMeal = days.map((d) => ({ date: d, hour: F[d]?.last_meal ? Number(F[d].last_meal.split(':')[0]) + Number(F[d].last_meal.split(':')[1]) / 60 : null }));
  const micro = Object.entries(NUTRIENTS).filter(([, n]) => n.target).map(([k, n]) => ({ name: n.name, value: Math.round(((avg(k) || 0) / (k === 'fiber' ? t.fiber : n.target)) * 100) }));
  const limits = Object.entries(NUTRIENTS).filter(([, n]) => n.limit).map(([k, n]) => ({ name: n.name, value: Math.round(((avg(k) || 0) / n.limit) * 100) }));
  const heat = Object.fromEntries(Object.entries(F).map(([d, f]) => [d, qualityScore(f, t)]));

  return (
    <div>
      <PageHeader icon={Salad} title="Nutrition quality" subtitle="Calories set the quantity. This page scores the quality: protein, fibre, plants, processing, sugar and sodium.">
        <Segmented value={range} onChange={setRange} options={[['14', '14 d'], ['30', '30 d'], ['90', '90 d']]} />
      </PageHeader>
      <Stagger className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Card hover={false} className="flex flex-col items-center justify-center">
          <Ring value={(qAvg || 0) / 100} size={150} stroke={13} id="nq"><AnimatedNumber value={qAvg} className="text-3xl font-bold" /><span className="text-xs text-muted">quality score</span></Ring>
          <p className="mt-3 text-center text-xs text-muted">Protein 20 · fibre 20 · plants 20 · low ultra-processed 20 · sugar 10 · sodium 10</p>
        </Card>
        <div className="grid grid-cols-2 gap-4 lg:col-span-3 lg:grid-cols-3">
          <StatTile icon={Beef} label="Protein (avg)" value={avg('protein')} unit={`/ ${t.protein} g`} sub={`${fmt((avg('protein') || 0) / (m.trendNow || 70), 1)} g/kg`} />
          <StatTile icon={Wheat} label="Fibre (avg)" value={avg('fiber')} unit={`/ ${t.fiber} g`} />
          <StatTile icon={Leaf} label="Plant servings" value={avg('plant_servings')} dec={1} unit="/ 5" sub={`${fmt(avg('plant_variety'), 1)} different plants / day`} />
          <StatTile icon={Factory} label="Ultra-processed" value={avg('upf_pct')} unit="% kcal" sub="target < 10–20%" />
          <StatTile icon={Droplets} label="Sodium (avg)" value={avg('sodium')} unit="mg" sub="limit 2,300" />
          <StatTile icon={Clock} label="Logged days" value={logged.length} unit={`/ ${days.length}`} />
        </div>
      </Stagger>
      <Stagger className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3" delay={0.1}>
        <Card hover={false} className="xl:col-span-2">
          <CardTitle icon={Award} title="Daily quality score" />
          <TimeChart data={q} height={230} yDomain={[0, 100]} refLines={[{ y: 70, label: 'good' }]} series={[{ key: 'quality', name: 'Quality', type: 'bar', cells: (d) => (d.quality >= 70 ? c.series[2] : d.quality >= 50 ? c.series[0] : c.series[1]) }]} />
        </Card>
        <Card hover={false}>
          <CardTitle title="Average macro split" sub="% of calories" />
          <Donut size={150} unit=" kcal" data={[{ name: 'Protein', value: (avg('protein') || 0) * 4, color: c.series[0] }, { name: 'Carbs', value: (avg('carbs') || 0) * 4, color: c.series[3] }, { name: 'Fat', value: (avg('fat') || 0) * 9, color: c.series[1] }]} center={<><div className="text-lg font-bold">{fmt(avg('kcal'))}</div><div className="text-[10px] text-muted">kcal/day</div></>} />
        </Card>
        <Card hover={false} className="xl:col-span-2">
          <CardTitle title="Calories by macro" sub="Stacked, kcal per day" />
          <TimeChart data={macro} unit="kcal" height={240} series={[{ key: 'protein', name: 'Protein', type: 'bar', stack: 'm', color: c.series[0] }, { key: 'carbs', name: 'Carbs', type: 'bar', stack: 'm', color: c.series[3] }, { key: 'fat', name: 'Fat', type: 'bar', stack: 'm', color: c.series[1] }]} />
        </Card>
        <Card hover={false}>
          <CardTitle title="Micronutrients" sub="Average % of daily target" />
          <BarList data={micro} unit="%" refLine={100} cellColor={(d) => (d.value >= 100 ? c.status.good : d.value >= 60 ? c.series[0] : c.status.serious)} />
          <div className="mt-2 text-xs font-medium text-fg2">Limits (% of max)</div>
          <BarList data={limits} unit="%" refLine={100} cellColor={(d) => (d.value > 100 ? c.status.critical : c.series[2])} />
        </Card>
        <Card hover={false}>
          <CardTitle icon={Factory} title="Ultra-processed share" sub="% of calories from NOVA-4 foods" />
          <TimeChart data={upf} unit="%" height={210} refLines={[{ y: 20 }]} series={[{ key: 'upf', name: 'Ultra-processed', type: 'area', color: c.series[1] }]} />
        </Card>
        <Card hover={false}>
          <CardTitle icon={Leaf} title="Plants & fibre" />
          <TimeChart data={plants} height={210} series={[{ key: 'servings', name: 'Plant servings', type: 'bar', color: c.series[5] }, { key: 'fiber', name: 'Fibre (g)', type: 'line', color: c.series[2] }]} />
        </Card>
        <Card hover={false}>
          <CardTitle title="Calories by meal" sub="Average per logged day" />
          <Donut size={140} unit=" kcal" data={mealSplit} center={<><div className="text-lg font-bold">{fmt(mealSplit.reduce((a, b) => a + b.value, 0))}</div><div className="text-[10px] text-muted">kcal</div></>} />
        </Card>
        <Card hover={false} className="xl:col-span-2">
          <CardTitle icon={Clock} title="Last meal time" sub={`Bedtime target ${t.bedtime}: aim to finish 3 h before`} />
          <TimeChart data={lastMeal} height={210} yDomain={[17, 24]} yFmt={(h) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`} valueFmt={(h) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`} series={[{ key: 'hour', name: 'Last meal', type: 'line', dot: true, color: c.series[6] }]} />
        </Card>
        <Card hover={false} className="xl:col-span-3">
          <CardTitle icon={Award} title="Quality calendar" sub="Darker = higher food-quality score" />
          <CalendarHeatmap values={heat} label="quality" unit="" />
        </Card>
      </Stagger>
    </div>
  );
}
