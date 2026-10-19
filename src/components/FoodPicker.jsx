import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Database, Globe, Barcode, PlusCircle, BookMarked, Star, Loader2, ChefHat, Trash2, Camera } from 'lucide-react';
import { Modal, Tabs, Input, Button, Field, Select, UnitInput, Badge, Empty } from './ui.jsx';
import { Donut } from './charts.jsx';
import { api } from '../lib/api.js';
import { useData } from '../lib/store.jsx';
import { useTheme } from '../lib/theme.jsx';
import { fmt } from '../lib/format.js';
import { NUTRIENTS } from '@shared/catalog.js';

export const NUTR_KEYS = Object.keys(NUTRIENTS);
export const scaleFood = (f, grams) => Object.fromEntries(NUTR_KEYS.map((k) => [k, f[k] != null ? (f[k] * grams) / 100 : null]));
const NOVA = { 1: ['Unprocessed', 'good'], 2: ['Culinary ingredient', 'info'], 3: ['Processed', 'warning'], 4: ['Ultra-processed', 'critical'] };

function useDebounced(v, ms = 250) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

function FoodRow({ f, onPick, i }) {
  return (
    <motion.button initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }} onClick={() => onPick(f)}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-raised">
      {f.image ? <img src={f.image} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-raised text-xs font-bold text-muted">{f.name[0]}</div>}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 truncate text-sm font-medium">{f.favorite ? <Star size={12} className="fill-warning text-warning" /> : null}{f.name}</div>
        <div className="truncate text-xs text-muted">{f.serving_name} · {f.category}{f.source && f.source !== 'seed' ? ` · ${f.source.toUpperCase()}` : ''}</div>
      </div>
      <div className="text-right text-xs">
        <div className="font-semibold tabular">{fmt(((f.kcal || 0) * (f.serving_g || 100)) / 100)} kcal</div>
        <div className="text-muted tabular">P {fmt(((f.protein || 0) * (f.serving_g || 100)) / 100)} · C {fmt(((f.carbs || 0) * (f.serving_g || 100)) / 100)} · F {fmt(((f.fat || 0) * (f.serving_g || 100)) / 100)}</div>
      </div>
    </motion.button>
  );
}

function FoodDetail({ food, onAdd, onBack, meal, setMeal }) {
  const { c } = useTheme();
  const [mode, setMode] = useState('serving');
  const [qty, setQty] = useState(1);
  const [grams, setGrams] = useState(food.serving_g || 100);
  const g = mode === 'serving' ? qty * (food.serving_g || 100) : Number(grams) || 0;
  const n = scaleFood(food, g);
  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
      <button onClick={onBack} className="mb-3 text-xs text-accent hover:underline">← Back to results</button>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><h3 className="text-lg font-semibold">{food.name}</h3><div className="text-xs text-muted">{food.category} · {food.cuisine} · source: {food.source}</div></div>
        {food.nova && <Badge tone={NOVA[food.nova][1]}>NOVA {food.nova}: {NOVA[food.nova][0]}</Badge>}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Meal" className="col-span-2 sm:col-span-1"><Select value={meal} onChange={(e) => setMeal(e.target.value)} options={[['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['snack', 'Snack'], ['dinner', 'Dinner']]} /></Field>
        <Field label="Amount by" className="col-span-2 sm:col-span-1"><Select value={mode} onChange={(e) => setMode(e.target.value)} options={[['serving', `Serving: ${food.serving_name}`], ['grams', 'Grams / mL']]} /></Field>
        {mode === 'serving'
          ? <Field label="Servings" className="col-span-2"><div className="flex items-center gap-2">{[0.5, 1, 1.5, 2, 3].map((q) => <Button key={q} size="sm" variant={qty === q ? 'primary' : 'soft'} onClick={() => setQty(q)}>{q}</Button>)}<Input type="number" step="0.25" value={qty} onChange={(e) => setQty(Number(e.target.value))} className="w-20" /></div></Field>
          : <Field label="Weight" className="col-span-2"><UnitInput unit="g" value={grams} onChange={(e) => setGrams(e.target.value)} /></Field>}
      </div>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Donut size={150} unit=" g" data={[{ name: 'Protein', value: n.protein || 0, color: c.series[0] }, { name: 'Carbs', value: n.carbs || 0, color: c.series[3] }, { name: 'Fat', value: n.fat || 0, color: c.series[1] }]}
          center={<><div className="text-xl font-bold tabular">{fmt(n.kcal)}</div><div className="text-[10px] text-muted">kcal · {fmt(g)} g</div></>} />
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {NUTR_KEYS.filter((k) => !['kcal', 'protein', 'carbs', 'fat'].includes(k)).map((k) => (
            <div key={k} className="flex justify-between border-b border-line/60 py-1"><span className="text-fg2">{NUTRIENTS[k].name}</span><span className="tabular font-medium">{n[k] == null ? '—' : `${fmt(n[k], NUTRIENTS[k].dec)} ${NUTRIENTS[k].unit}`}</span></div>
          ))}
          {food.micros && Object.entries(food.micros).slice(0, 12).map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-line/60 py-1"><span className="text-fg2">{k}</span><span className="tabular font-medium">{fmt((v * g) / 100, 1)}</span></div>
          ))}
        </div>
      </div>
      <div className="mt-6 flex justify-end"><Button icon={PlusCircle} onClick={() => onAdd(food, g)}>Add {fmt(n.kcal)} kcal to {meal}</Button></div>
    </motion.div>
  );
}

function CustomFood({ onCreated }) {
  const { notify } = useData();
  const [mode, setMode] = useState('manual');
  const [f, setF] = useState({ name: '', serving_name: '1 serving', serving_g: 100, basis: '100', category: 'Custom', cuisine: 'Home', nova: 1 });
  const [ings, setIngs] = useState([]);
  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  const [cooked, setCooked] = useState('');
  useEffect(() => { if (q.length > 1) api.searchFoods(q).then((r) => setRes(r.slice(0, 6))); else setRes([]); }, [q]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const saveManual = async () => {
    const factor = f.basis === 'serving' ? 100 / Number(f.serving_g || 100) : 1;
    const row = { name: f.name, category: f.category, cuisine: f.cuisine, serving_name: f.serving_name, serving_g: Number(f.serving_g), nova: Number(f.nova), source: 'custom' };
    for (const k of NUTR_KEYS) if (f[k] !== undefined && f[k] !== '') row[k] = Number(f[k]) * factor;
    const { id } = await api.saveFood(row);
    notify(`${f.name} added to your database`); onCreated({ ...row, id });
  };
  const recipeTotals = useMemo(() => {
    const t = Object.fromEntries(NUTR_KEYS.map((k) => [k, 0]));
    let raw = 0;
    for (const it of ings) { raw += Number(it.grams) || 0; const n = scaleFood(it.food, Number(it.grams) || 0); for (const k of NUTR_KEYS) t[k] += n[k] || 0; }
    return { t, raw };
  }, [ings]);
  const saveRecipe = async () => {
    const total = Number(cooked) || recipeTotals.raw;
    const row = { name: f.name, category: 'Recipes', cuisine: f.cuisine, serving_name: f.serving_name, serving_g: Number(f.serving_g), nova: Math.max(...ings.map((i) => i.food.nova || 1)), source: 'custom' };
    for (const k of NUTR_KEYS) row[k] = (recipeTotals.t[k] / total) * 100;
    const { id } = await api.saveFood(row);
    await api.add('meals', { name: f.name, kind: 'recipe', items: ings.map((i) => ({ food_id: i.food.id, name: i.food.name, grams: Number(i.grams) })), notes: `Cooked weight ${total} g` });
    notify(`Recipe “${f.name}” saved`); onCreated({ ...row, id });
  };

  return (
    <div>
      <div className="mb-4 flex gap-2"><Button size="sm" variant={mode === 'manual' ? 'primary' : 'soft'} icon={PlusCircle} onClick={() => setMode('manual')}>From nutrition label</Button><Button size="sm" variant={mode === 'recipe' ? 'primary' : 'soft'} icon={ChefHat} onClick={() => setMode('recipe')}>Recipe builder</Button></div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" className="col-span-2"><Input value={f.name} onChange={set('name')} placeholder={mode === 'recipe' ? "Mom's rajma" : 'Brand protein bar'} /></Field>
        <Field label="Serving name"><Input value={f.serving_name} onChange={set('serving_name')} /></Field>
        <Field label="Serving weight"><UnitInput unit="g" value={f.serving_g} onChange={set('serving_g')} /></Field>
      </div>
      {mode === 'manual' ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Values are per"><Select value={f.basis} onChange={set('basis')} options={[['100', '100 g'], ['serving', 'serving']]} /></Field>
            <Field label="Processing (NOVA)"><Select value={f.nova} onChange={set('nova')} options={[[1, '1 · Unprocessed'], [2, '2 · Culinary ingredient'], [3, '3 · Processed'], [4, '4 · Ultra-processed']]} /></Field>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {NUTR_KEYS.map((k) => <Field key={k} label={NUTRIENTS[k].name}><UnitInput unit={NUTRIENTS[k].unit} value={f[k] ?? ''} onChange={set(k)} /></Field>)}
          </div>
          <div className="mt-5 flex justify-end"><Button disabled={!f.name || f.kcal === undefined} onClick={saveManual}>Save food</Button></div>
        </>
      ) : (
        <>
          <Field label="Add ingredient" className="mt-3"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ingredients…" /></Field>
          <div className="mt-1">{res.map((r) => <button key={r.id} className="block w-full rounded-lg px-2 py-1 text-left text-sm hover:bg-raised" onClick={() => { setIngs([...ings, { food: r, grams: r.serving_g || 100 }]); setQ(''); }}>{r.name} <span className="text-muted">· {fmt(r.kcal)} kcal/100 g</span></button>)}</div>
          <div className="mt-3 space-y-2">
            {ings.map((it, i) => (
              <div key={i} className="flex items-center gap-2 text-sm"><span className="flex-1 truncate">{it.food.name}</span><UnitInput unit="g" className="w-28" value={it.grams} onChange={(e) => setIngs(ings.map((x, j) => (j === i ? { ...x, grams: e.target.value } : x)))} /><button onClick={() => setIngs(ings.filter((_, j) => j !== i))} className="text-muted hover:text-critical"><Trash2 size={15} /></button></div>
            ))}
          </div>
          {ings.length > 0 && (
            <div className="mt-4 rounded-xl bg-raised p-3 text-sm">
              <div className="flex flex-wrap gap-4"><span>Raw total <b>{fmt(recipeTotals.raw)} g</b></span><span><b>{fmt(recipeTotals.t.kcal)}</b> kcal</span><span>P <b>{fmt(recipeTotals.t.protein)}</b></span><span>C <b>{fmt(recipeTotals.t.carbs)}</b></span><span>F <b>{fmt(recipeTotals.t.fat)}</b></span></div>
              <Field label="Cooked weight (optional; water lost or gained in cooking)" className="mt-2"><UnitInput unit="g" value={cooked} onChange={(e) => setCooked(e.target.value)} placeholder={String(recipeTotals.raw)} /></Field>
            </div>
          )}
          <div className="mt-5 flex justify-end"><Button disabled={!f.name || !ings.length} onClick={saveRecipe}>Save recipe as food</Button></div>
        </>
      )}
    </div>
  );
}

function BarcodeTab({ onFound }) {
  const [code, setCode] = useState('');
  const [state, setState] = useState(null);
  const video = useRef(null);
  const [scanning, setScanning] = useState(false);
  const lookup = async (c) => {
    setState('loading');
    try { const f = await api.barcode(c); setState(null); onFound(f); } catch (e) { setState(e.message); }
  };
  const scan = async () => {
    if (!('BarcodeDetector' in window)) { setState('Camera scanning needs a browser with the BarcodeDetector API (Chrome on Android/desktop). Type the number instead.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setScanning(true);
      video.current.srcObject = stream; await video.current.play();
      const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
      const tick = async () => {
        if (!video.current?.srcObject) return;
        const codes = await det.detect(video.current).catch(() => []);
        if (codes[0]) { stream.getTracks().forEach((t) => t.stop()); setScanning(false); setCode(codes[0].rawValue); lookup(codes[0].rawValue); } else requestAnimationFrame(tick);
      };
      tick();
    } catch (e) { setState(e.message); }
  };
  return (
    <div className="space-y-3">
      <div className="flex gap-2"><Input placeholder="EAN / UPC number, e.g. 8901058000290" value={code} onChange={(e) => setCode(e.target.value)} /><Button onClick={() => lookup(code)} disabled={!code}>Look up</Button></div>
      <Button variant="soft" icon={Camera} onClick={scan}>Scan with camera</Button>
      <video ref={video} className={`w-full rounded-xl ${scanning ? '' : 'hidden'}`} muted playsInline />
      {state === 'loading' ? <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="animate-spin" size={14} /> Looking up Open Food Facts…</p> : state && <p className="text-sm text-critical">{state}</p>}
      <p className="text-xs text-muted">Barcodes are matched against your database first, then Open Food Facts (~3 M packaged products worldwide).</p>
    </div>
  );
}

export default function FoodPicker({ open, onClose, meal: initialMeal = 'breakfast', date, onLogged }) {
  const { notify } = useData();
  const [tab, setTab] = useState('local');
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [picked, setPicked] = useState(null);
  const [meal, setMeal] = useState(initialMeal);
  const [meals, setMeals] = useState([]);
  useEffect(() => { setMeal(initialMeal); }, [initialMeal, open]);
  useEffect(() => { if (open && tab === 'meals') api.list('meals').then(setMeals); }, [open, tab]);
  useEffect(() => {
    if (!open || !['local', 'usda', 'off'].includes(tab)) return;
    let live = true; setErr(null);
    if (tab === 'local') { api.searchFoods(dq).then((r) => live && setResults(r)); return () => { live = false; }; }
    if (dq.length < 2) { setResults([]); return; }
    setLoading(true);
    api.externalFoods(dq, tab).then((r) => live && setResults(r)).catch((e) => live && setErr(e.message)).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [dq, tab, open]);

  const add = async (food, grams) => {
    let id = food.id;
    if (!id) id = (await api.saveFood(food)).id; // cache external foods locally
    await api.add('food_logs', { date, meal, food_id: id, name: food.name, grams, nova: food.nova, time: new Date().toTimeString().slice(0, 5), created: new Date().toISOString(), ...scaleFood(food, grams) });
    notify(`${food.name} logged`); setPicked(null); onLogged?.();
  };
  const logMeal = async (sm) => {
    const foods = await Promise.all(sm.items.map((it) => (it.food_id ? api.list('foods', { id: it.food_id }).then((r) => r[0]) : null)));
    const rows = sm.items.map((it, i) => foods[i] && ({ date, meal, food_id: it.food_id, name: it.name, grams: it.grams, nova: foods[i].nova, time: new Date().toTimeString().slice(0, 5), created: new Date().toISOString(), ...scaleFood(foods[i], it.grams) })).filter(Boolean);
    await api.add('food_logs', rows); notify(`${sm.name} logged (${rows.length} items)`); onLogged?.();
  };
  const toggleFav = async (f) => { if (f.id) { await api.update('foods', f.id, { favorite: f.favorite ? 0 : 1 }); setResults(results.map((r) => (r.id === f.id ? { ...r, favorite: f.favorite ? 0 : 1 } : r))); } };

  return (
    <Modal open={open} onClose={() => { setPicked(null); onClose(); }} title={`Add food · ${meal[0].toUpperCase() + meal.slice(1)}`} wide>
      <AnimatePresence mode="wait">
        {picked ? <FoodDetail key="d" food={picked} onAdd={add} onBack={() => setPicked(null)} meal={meal} setMeal={setMeal} /> : (
          <motion.div key="s" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Tabs className="mb-4" value={tab} onChange={(t) => { setTab(t); setResults([]); }} tabs={[
              { key: 'local', label: 'My database', icon: Database }, { key: 'usda', label: 'USDA', icon: Globe }, { key: 'off', label: 'Open Food Facts', icon: Globe },
              { key: 'barcode', label: 'Barcode', icon: Barcode }, { key: 'meals', label: 'Saved meals', icon: BookMarked }, { key: 'custom', label: 'Create', icon: PlusCircle }]} />
            {['local', 'usda', 'off'].includes(tab) && (
              <>
                <div className="relative mb-3"><Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" /><Input autoFocus className="pl-9" placeholder={tab === 'local' ? 'Search dal, roti, paneer, oats… (empty = your frequent foods)' : 'Search the online database…'} value={q} onChange={(e) => setQ(e.target.value)} /></div>
                {loading && <p className="flex items-center gap-2 p-3 text-sm text-muted"><Loader2 size={14} className="animate-spin" /> Searching…</p>}
                {err && <p className="rounded-xl bg-critical/10 p-3 text-sm text-critical">{err}</p>}
                <div className="max-h-[50vh] space-y-0.5 overflow-y-auto">
                  {results.map((f, i) => (
                    <div key={f.id || f.ext_id || i} className="group relative">
                      <FoodRow f={f} i={i} onPick={setPicked} />
                      {f.id && <button onClick={() => toggleFav(f)} className="absolute top-1/2 right-[-6px] hidden -translate-y-1/2 rounded p-1 text-muted group-hover:block hover:text-warning" title="Favourite"><Star size={13} className={f.favorite ? 'fill-warning text-warning' : ''} /></button>}
                    </div>
                  ))}
                  {!loading && !err && !results.length && <Empty icon={Search} title={q ? 'No matches' : 'Start typing'} text={tab === 'local' ? 'Not here? Try USDA or Open Food Facts, or create it yourself.' : 'Results are cached into your database when you log them.'} />}
                </div>
              </>
            )}
            {tab === 'barcode' && <BarcodeTab onFound={setPicked} />}
            {tab === 'custom' && <CustomFood onCreated={(f) => { setPicked(f); setTab('local'); }} />}
            {tab === 'meals' && (
              <div className="space-y-2">
                {meals.map((sm) => (
                  <div key={sm.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
                    <div className="min-w-0 flex-1"><div className="text-sm font-medium">{sm.name} <Badge>{sm.kind}</Badge></div><div className="truncate text-xs text-muted">{sm.items.map((i) => `${i.name} ${i.grams} g`).join(' · ')}</div></div>
                    <Button size="sm" onClick={() => logMeal(sm)}>Log</Button>
                    <button onClick={async () => { await api.remove('meals', sm.id); setMeals(meals.filter((x) => x.id !== sm.id)); }} className="text-muted hover:text-critical"><Trash2 size={15} /></button>
                  </div>
                ))}
                {!meals.length && <Empty icon={BookMarked} title="No saved meals" text="Use “Save as meal” on any meal in your diary to reuse it in one tap." />}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
