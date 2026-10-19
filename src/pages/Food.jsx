import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Utensils, Plus, Trash2, Coffee, Sun, Cookie, Moon, ChevronLeft, ChevronRight, Copy, BookmarkPlus, Droplets, Pill } from 'lucide-react';
import { PageHeader, Card, CardTitle, Stagger, Button, Progress, IconBtn, Badge, Input } from '../components/ui.jsx';
import { Ring, AnimatedNumber } from '../components/motion.jsx';
import { Donut, BarList } from '../components/charts.jsx';
import FoodPicker from '../components/FoodPicker.jsx';
import { useData } from '../lib/store.jsx';
import { useTheme } from '../lib/theme.jsx';
import { api } from '../lib/api.js';
import { addDays, todayISO, fmtDay, fmt } from '../lib/format.js';
import { NUTRIENTS } from '@shared/catalog.js';

const MEALS = [
  { key: 'breakfast', label: 'Breakfast', icon: Coffee },
  { key: 'lunch', label: 'Lunch', icon: Sun },
  { key: 'snack', label: 'Snacks', icon: Cookie },
  { key: 'dinner', label: 'Dinner', icon: Moon },
];
const NOVA_TONE = { 1: 'good', 2: 'info', 3: 'warning', 4: 'critical' };

export default function Food() {
  const { model: m, refresh, notify } = useData();
  const { c } = useTheme();
  const [date, setDate] = useState(todayISO());
  const [logs, setLogs] = useState([]);
  const [picker, setPicker] = useState(null);
  const [editing, setEditing] = useState(null);
  const load = useCallback(() => api.list('food_logs', { from: date, to: date }).then(setLogs), [date]);
  useEffect(() => { load(); }, [load]);
  const after = async () => { await load(); await refresh(); };

  const tot = Object.fromEntries(Object.keys(NUTRIENTS).map((k) => [k, logs.reduce((s, l) => s + (l[k] || 0), 0)]));
  const t = m.targets;
  const remaining = t.kcal - tot.kcal;
  const water = m.series('water')[date] || 0;
  const caffeine = m.series('caffeine')[date] || 0;

  const del = async (id) => { await api.remove('food_logs', id); after(); };
  const saveGrams = async (l, grams) => {
    const f = grams / (l.grams || 1);
    const patch = { grams };
    for (const k of Object.keys(NUTRIENTS)) if (l[k] != null) patch[k] = l[k] * f;
    await api.update('food_logs', l.id, patch); setEditing(null); after();
  };
  const copyYesterday = async (meal) => {
    const y = await api.list('food_logs', { from: addDays(date, -1), to: addDays(date, -1), meal });
    if (!y.length) return notify('Nothing logged for that meal yesterday', 'error');
    await api.add('food_logs', y.map(({ id, ...r }) => ({ ...r, date, created: new Date().toISOString() })));
    notify(`Copied ${y.length} items from yesterday`); after();
  };
  const saveAsMeal = async (meal) => {
    const items = logs.filter((l) => l.meal === meal).map((l) => ({ food_id: l.food_id, name: l.name, grams: Math.round(l.grams) }));
    if (!items.length) return;
    const name = prompt('Name this meal', `My ${meal}`);
    if (!name) return;
    await api.add('meals', { name, kind: 'meal', items }); notify(`Saved “${name}”`);
  };
  const addWater = async (ml) => { await api.add('entries', { metric: 'water', date, value: Math.max(0, water + ml) }); refresh(); };
  const addCaffeine = async (mg) => { await api.add('entries', { metric: 'caffeine', date, value: Math.max(0, caffeine + mg) }); refresh(); };

  const micro = ['fiber', 'potassium', 'calcium', 'iron', 'vitc'].map((k) => ({ name: NUTRIENTS[k].name, value: Math.round(((tot[k] || 0) / (k === 'fiber' ? t.fiber : NUTRIENTS[k].target)) * 100) }));
  const limits = ['sugar', 'satfat', 'sodium'].map((k) => ({ name: NUTRIENTS[k].name, value: Math.round(((tot[k] || 0) / NUTRIENTS[k].limit) * 100) }));

  return (
    <div>
      <PageHeader icon={Utensils} title="Food log" subtitle="Itemised logging with macros, micros and processing level, from your database, USDA, Open Food Facts or barcodes.">
        <div className="flex items-center gap-1 rounded-xl border border-line bg-card p-1">
          <button className="rounded-lg p-1.5 hover:bg-raised" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day"><ChevronLeft size={16} /></button>
          <Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} className="!w-40 !border-0 !bg-transparent !py-1" />
          <button className="rounded-lg p-1.5 hover:bg-raised disabled:opacity-30" disabled={date >= todayISO()} onClick={() => setDate(addDays(date, 1))} aria-label="Next day"><ChevronRight size={16} /></button>
        </div>
      </PageHeader>

      <Stagger className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card hover={false} className="lg:col-span-2">
          <div className="flex flex-col items-center gap-6 md:flex-row">
            <Ring value={tot.kcal / t.kcal} size={170} stroke={14} id="kcal" color={tot.kcal > t.kcal * 1.1 ? c.status.serious : undefined}>
              {m.prefs.hideCalories ? <span className="text-sm font-semibold">{logs.length} items</span> : <>
                <AnimatedNumber value={Math.abs(remaining)} className="text-3xl font-bold" />
                <span className="text-xs text-muted">{remaining >= 0 ? 'kcal remaining' : 'kcal over'}</span></>}
            </Ring>
            <div className="w-full flex-1 space-y-3">
              <div className="flex justify-between text-sm"><span className="text-fg2">Eaten <b className="text-fg tabular">{fmt(tot.kcal)}</b></span><span className="text-fg2">Target <b className="text-fg tabular">{fmt(t.kcal)}</b></span><span className="text-fg2">TDEE <b className="text-fg tabular">{fmt(m.tdee)}</b></span></div>
              {[['protein', 'Protein', c.series[0]], ['carbs', 'Carbs', c.series[3]], ['fat', 'Fat', c.series[1]], ['fiber', 'Fibre', c.series[2]]].map(([k, l, col]) => (
                <div key={k}>
                  <div className="mb-1 flex justify-between text-xs"><span className="font-medium">{l}</span><span className="tabular text-fg2">{fmt(tot[k])} / {t[k]} g</span></div>
                  <Progress value={tot[k]} max={t[k]} color={col} />
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card hover={false}>
          <CardTitle title="Macro split" sub="Share of calories" />
          <Donut size={150} unit=" kcal" data={[{ name: 'Protein', value: tot.protein * 4, color: c.series[0] }, { name: 'Carbs', value: tot.carbs * 4, color: c.series[3] }, { name: 'Fat', value: tot.fat * 9, color: c.series[1] }]}
            center={<><div className="text-lg font-bold tabular">{fmt(tot.kcal)}</div><div className="text-[10px] text-muted">kcal</div></>} />
        </Card>
      </Stagger>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Stagger className="space-y-4 xl:col-span-2" delay={0.1}>
          {MEALS.map((meal) => {
            const items = logs.filter((l) => l.meal === meal.key);
            const mk = items.reduce((s, l) => s + (l.kcal || 0), 0);
            return (
              <Card key={meal.key} hover={false} className="!p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-raised text-accent"><meal.icon size={16} /></div>
                  <div className="font-semibold">{meal.label}</div>
                  <span className="text-sm text-muted tabular">{fmt(mk)} kcal · P {fmt(items.reduce((s, l) => s + (l.protein || 0), 0))} g</span>
                  <div className="ml-auto flex gap-1">
                    <IconBtn icon={Copy} label="Copy from yesterday" size={15} onClick={() => copyYesterday(meal.key)} />
                    <IconBtn icon={BookmarkPlus} label="Save as meal" size={15} onClick={() => saveAsMeal(meal.key)} />
                    <Button size="sm" icon={Plus} onClick={() => setPicker(meal.key)}>Add</Button>
                  </div>
                </div>
                <AnimatePresence initial={false}>
                  {items.map((l) => (
                    <motion.div key={l.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0, x: -40 }}
                      className="group flex items-center gap-3 border-t border-line/60 py-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 truncate font-medium">{l.name}{l.nova === 4 && <Badge tone={NOVA_TONE[4]} className="!py-0 !text-[10px]">UPF</Badge>}</div>
                        {editing === l.id
                          ? <form className="mt-1 flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); saveGrams(l, Number(e.target.g.value)); }}><Input name="g" type="number" defaultValue={Math.round(l.grams)} className="!w-24 !py-1" autoFocus /><span className="text-xs text-muted">g</span><Button size="sm" type="submit">Save</Button></form>
                          : <button className="text-xs text-muted hover:text-accent" onClick={() => setEditing(l.id)}>{fmt(l.grams)} g · edit</button>}
                      </div>
                      <div className="hidden text-right text-xs text-muted tabular sm:block">P {fmt(l.protein)} · C {fmt(l.carbs)} · F {fmt(l.fat)}</div>
                      <div className="w-16 text-right font-semibold tabular">{fmt(l.kcal)}</div>
                      <IconBtn icon={Trash2} label="Remove" size={15} className="opacity-50 group-hover:opacity-100 hover:text-critical" onClick={() => del(l.id)} />
                    </motion.div>
                  ))}
                </AnimatePresence>
                {!items.length && <button onClick={() => setPicker(meal.key)} className="w-full rounded-xl border border-dashed border-line py-3 text-sm text-muted transition hover:border-accent hover:text-accent">+ Log {meal.label.toLowerCase()}</button>}
              </Card>
            );
          })}
        </Stagger>
        <Stagger className="space-y-4" delay={0.2}>
          <Card hover={false}>
            <CardTitle icon={Droplets} title="Water" sub={`${(water / 1000).toFixed(2)} / ${(t.water / 1000).toFixed(1)} L`} />
            <div className="mb-3 flex flex-wrap gap-1">
              {Array.from({ length: Math.ceil(t.water / 250) }).map((_, i) => (
                <motion.button key={i} whileTap={{ scale: 0.8 }} onClick={() => addWater(i < water / 250 ? -250 : 250)} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.02 }}
                  className={`h-9 w-7 rounded-b-lg rounded-t-sm border-2 transition-colors ${i < Math.floor(water / 250) ? 'border-accent bg-accent/70' : 'border-line'}`} title="250 mL" />
              ))}
            </div>
            <div className="flex gap-2"><Button size="sm" variant="soft" onClick={() => addWater(250)}>+250 mL</Button><Button size="sm" variant="soft" onClick={() => addWater(500)}>+500 mL</Button><Button size="sm" variant="ghost" onClick={() => addWater(-250)}>−250</Button></div>
          </Card>
          <Card hover={false}>
            <CardTitle icon={Coffee} title="Caffeine" sub={`${fmt(caffeine)} mg today · limit 400`} />
            <Progress value={caffeine} max={400} color={caffeine > 300 ? c.status.serious : c.series[3]} />
            <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="soft" onClick={() => addCaffeine(95)}>Coffee +95</Button><Button size="sm" variant="soft" onClick={() => addCaffeine(50)}>Tea +50</Button><Button size="sm" variant="soft" onClick={() => addCaffeine(64)}>Espresso +64</Button><Button size="sm" variant="ghost" onClick={() => addCaffeine(-50)}>−50</Button></div>
          </Card>
          <Card hover={false}>
            <CardTitle icon={Pill} title="Micronutrients" sub="% of daily target" />
            <BarList data={micro} unit="%" refLine={100} cellColor={(d) => (d.value >= 100 ? c.status.good : d.value >= 60 ? c.series[0] : c.status.serious)} />
            <div className="mt-3 text-xs font-medium text-fg2">Limits (% of max)</div>
            <BarList data={limits} unit="%" refLine={100} cellColor={(d) => (d.value > 100 ? c.status.critical : d.value > 80 ? c.status.warning : c.series[2])} />
          </Card>
        </Stagger>
      </div>

      <FoodPicker open={!!picker} meal={picker || 'breakfast'} date={date} onClose={() => setPicker(null)} onLogged={after} />
    </div>
  );
}
