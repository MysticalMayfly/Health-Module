import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, ArrowRight, ArrowLeft, Sparkles, Check, Mountain, Moon, Utensils, Footprints, Wine, Stethoscope, User, Target, Zap } from 'lucide-react';
import { Button, Field, Input, Select, Segmented, Chip, UnitInput, Badge } from '../components/ui.jsx';
import IcebergSpectrum from '../components/IcebergSpectrum.jsx';
import { ScaleInput } from '../components/QuickLog.jsx';
import { useData } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { buildModel, ACTIVITY_LABEL } from '../lib/analytics.js';
import { recommendActions, zoneOf, CONDITIONS, FAMILY, GOALS } from '../lib/journey.js';
import { ACTION_BY_KEY, ACTIONS } from '@shared/actions.js';
import { DOMAINS } from '@shared/catalog.js';
import { todayISO, fmt } from '../lib/format.js';

const STEPS = [
  { key: 'welcome', icon: Mountain, title: 'Welcome' }, { key: 'you', icon: User, title: 'About you' }, { key: 'goal', icon: Target, title: 'Your goal' },
  { key: 'sleep', icon: Moon, title: 'Sleep & stress' }, { key: 'food', icon: Utensils, title: 'Food' }, { key: 'move', icon: Footprints, title: 'Movement' },
  { key: 'subs', icon: Wine, title: 'Substances' }, { key: 'health', icon: Stethoscope, title: 'Health status' }, { key: 'plan', icon: Zap, title: 'Your plan' },
];

function Q({ label, children, hint }) {
  return <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2"><div className="text-sm font-medium">{label}</div>{children}{hint && <div className="text-xs text-muted">{hint}</div>}</motion.div>;
}
function Options({ value, onChange, options, multi }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([k, l]) => <Chip key={k} active={multi ? (value || []).includes(k) : value === k} onClick={() => onChange(multi ? ((value || []).includes(k) ? value.filter((x) => x !== k) : [...(value || []).filter((x) => x !== 'none'), k].filter((x) => k !== 'none' || x === 'none')) : k)}>{l}</Chip>)}
    </div>
  );
}

export default function Onboarding() {
  const { settings, saveSettings, refresh, units, notify } = useData();
  const nav = useNavigate();
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [busy, setBusy] = useState(false);
  const [u, setUnits] = useState({ mass: units.mass, length: units.length });
  const [p, setP] = useState({ name: '', sex: 'male', birthYear: 1990, height: '', weight: '', activity: 'light', goal: 'fat_loss', targetWeight: '', rate: 0.5, bedtime: '23:00', wake: '07:00' });
  const [a, setA] = useState({ sleepHours: 7, sleepRegular: 'no', screens: 'yes', stress: 3, sunlight: 'sometimes', diet: 'fair', protein: 'some', veg: 2, processed: 'sometimes', sugaryDrinks: 'weekly', lateEating: 'no', water: 2, steps: '5to8k', exerciseDays: 2, strength: 0, desk: 'yes', pain: 'no', alcohol: 2, smoking: 'no', caffeine: 2, conditions: ['none'], meds: 'none', lastCheckup: '1to2y', lastBloods: '1to2y', family: [] });
  const [picked, setPicked] = useState(null);
  const [demoPos, setDemoPos] = useState(-60);
  useEffect(() => { if (i !== 0) return; const t = setInterval(() => setDemoPos((x) => (x >= 80 ? -70 : x + 30)), 1800); return () => clearInterval(t); }, [i]);

  const LB = 0.45359237;
  const kg = (v) => (v === '' ? null : u.mass === 'lb' ? Number(v) * LB : Number(v));
  const cm = (v) => (v === '' ? null : u.length === 'in' ? Number(v) * 2.54 : Number(v));
  const profile = { ...p, height: cm(p.height), weight: kg(p.weight), targetWeight: kg(p.targetWeight), birthYear: Number(p.birthYear), stepGoal: 8000, proteinPerKg: p.goal === 'muscle' ? 2 : 1.6 };
  const preview = useMemo(() => {
    const entries = profile.weight ? [{ metric: 'weight', date: todayISO(), ts: todayISO(), value: profile.weight, source: 'manual' }] : [];
    const records = (a.conditions || []).filter((c) => c !== 'none').map((c, n) => ({ id: -n - 1, kind: 'condition', date: todayISO(), active: 1, data: { name: c, status: 'active' } }));
    return buildModel({ entries, foodDaily: [], sleep: [], workouts: [], labs: [], records, actions: [], actionLogs: [], medLogs: [], metricDefs: [] }, { profile, onboarding: { answers: a, date: todayISO() } });
  }, [p, a, u]); // eslint-disable-line react-hooks/exhaustive-deps
  const rec = useMemo(() => recommendActions(a, profile), [a, p]); // eslint-disable-line react-hooks/exhaustive-deps
  const chosen = picked ?? rec;
  const set = (k) => (v) => setA((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));
  const go = (d) => { setDir(d); setI((x) => Math.max(0, Math.min(STEPS.length - 1, x + d))); };
  const canNext = i !== 1 || (p.height && p.weight && p.birthYear);

  const finish = async () => {
    setBusy(true);
    await saveSettings({
      units: { ...units, ...u },
      profile: { ...profile, weight: undefined },
      onboarding: { completed: true, date: todayISO(), answers: a, startPosition: preview.current.position },
    });
    if (profile.weight) await api.add('entries', { metric: 'weight', date: todayISO(), ts: `${todayISO()}T08:00:00`, value: profile.weight });
    const rows = chosen.map((k, n) => { const x = ACTION_BY_KEY[k]; return { key: x.key, title: x.title, domain: x.domain, layer: 1, phase: x.phase, auto: x.auto, why: x.why, sort: n, created: todayISO() }; });
    if (rows.length) await api.add('actions', rows);
    const conds = (a.conditions || []).filter((c) => c !== 'none');
    if (conds.length) await api.add('records', conds.map((c) => ({ kind: 'condition', date: todayISO(), data: { name: CONDITIONS.find((x) => x[0] === c)?.[1] || c, status: 'active' }, active: 1 })));
    const fam = (a.family || []).filter((c) => c !== 'none');
    if (fam.length) await api.add('records', fam.map((c) => ({ kind: 'family', data: { relative: 'Family member', condition: FAMILY.find((x) => x[0] === c)?.[1] || c } })));
    await refresh(); notify('Your health OS is ready 🚀'); nav('/');
  };
  const demo = async () => { setBusy(true); await api.demo(); await refresh(); nav('/'); };

  const step = STEPS[i];
  const zone = zoneOf(preview.current.position);
  return (
    <div className="relative min-h-full overflow-hidden">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 -left-40 h-[36rem] w-[36rem] rounded-full opacity-20 blur-3xl" style={{ background: 'var(--accent)', animation: 'floaty 16s ease-in-out infinite' }} />
        <div className="absolute -right-40 -bottom-40 h-[36rem] w-[36rem] rounded-full opacity-20 blur-3xl" style={{ background: 'var(--accent2)', animation: 'floaty 20s ease-in-out infinite reverse' }} />
      </div>
      <div className="relative mx-auto flex min-h-full max-w-4xl flex-col px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grad-bg flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-lg"><Activity size={22} /></div>
          <div><div className="font-bold">LifeOS Health</div><div className="text-xs text-muted">Setup · step {i + 1} of {STEPS.length}</div></div>
          <div className="ml-auto hidden gap-1 sm:flex">{STEPS.map((s, n) => <motion.div key={s.key} className={`h-1.5 rounded-full ${n <= i ? 'grad-bg' : 'bg-line'}`} animate={{ width: n === i ? 28 : 12 }} />)}</div>
        </div>

        <div className="flex-1">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div key={step.key} custom={dir} initial={{ opacity: 0, x: 60 * dir }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 * dir }} transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className="rounded-3xl border border-line bg-card/90 p-6 shadow-xl backdrop-blur md:p-8">
              <div className="mb-6 flex items-center gap-3">
                <motion.div initial={{ rotate: -30, scale: 0.5 }} animate={{ rotate: 0, scale: 1 }} className="grad-bg flex h-11 w-11 items-center justify-center rounded-2xl text-white"><step.icon size={22} /></motion.div>
                <h1 className="text-2xl font-bold">{step.title}</h1>
              </div>

              {step.key === 'welcome' && (
                <div className="grid items-center gap-8 md:grid-cols-2">
                  <div className="space-y-4">
                    <p className="text-lg leading-relaxed">Every disease is the <b>tip of an iceberg</b>: about 99 things go wrong before a symptom appears.</p>
                    <p className="text-fg2">Peak health is the same: <b>99 things done right</b> before the top 1% shows. This app takes you through the whole <b className="grad-text">198%</b>, from fixing the causes of disease to building the causes of health.</p>
                    <ul className="space-y-2 text-sm text-fg2">
                      {['A 3-minute assessment places you on the 198 spectrum', 'You get a small set of daily action items, not a giant checklist', 'Tracking reveals what is happening under the waterline', 'New phases unlock as the habits stick'].map((t, n) => (
                        <motion.li key={t} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + n * 0.15 }} className="flex items-center gap-2"><Check size={16} className="text-good" />{t}</motion.li>
                      ))}
                    </ul>
                  </div>
                  <IcebergSpectrum position={demoPos} compact height={360} />
                </div>
              )}

              {step.key === 'you' && (
                <div className="space-y-5">
                  <div className="flex flex-wrap gap-4"><Segmented value={u.mass} onChange={(v) => setUnits({ ...u, mass: v })} options={[['kg', 'kg'], ['lb', 'lb']]} /><Segmented value={u.length} onChange={(v) => setUnits({ ...u, length: v })} options={[['cm', 'cm'], ['in', 'in']]} /></div>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                    <Field label="First name"><Input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} autoFocus /></Field>
                    <Field label="Sex (for BMR & ranges)"><Select value={p.sex} onChange={(e) => setP({ ...p, sex: e.target.value })} options={[['male', 'Male'], ['female', 'Female']]} /></Field>
                    <Field label="Birth year"><Input type="number" value={p.birthYear} onChange={(e) => setP({ ...p, birthYear: e.target.value })} /></Field>
                    <Field label="Height"><UnitInput unit={u.length} value={p.height} onChange={(e) => setP({ ...p, height: e.target.value })} /></Field>
                    <Field label="Current weight"><UnitInput unit={u.mass} value={p.weight} onChange={(e) => setP({ ...p, weight: e.target.value })} /></Field>
                    <Field label="Activity level"><Select value={p.activity} onChange={(e) => setP({ ...p, activity: e.target.value })} options={Object.entries(ACTIVITY_LABEL)} /></Field>
                  </div>
                  {preview.formulaTDEE && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl bg-raised p-3 text-sm">Estimated BMR × activity = <b>{fmt(preview.formulaTDEE)} kcal/day</b> (Mifflin–St Jeor). This becomes adaptive once you log food and weight for ~3 weeks.</motion.div>}
                </div>
              )}

              {step.key === 'goal' && (
                <div className="space-y-5">
                  <div className="grid gap-2 md:grid-cols-2">
                    {GOALS.map(([k, l, d]) => (
                      <motion.button key={k} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={() => setP({ ...p, goal: k })} className={`rounded-2xl border p-4 text-left transition ${p.goal === k ? 'border-accent bg-accent/10 ring-2 ring-accent/30' : 'border-line hover:bg-raised'}`}>
                        <div className="font-semibold">{l}</div><div className="text-sm text-muted">{d}</div>
                      </motion.button>
                    ))}
                  </div>
                  {['fat_loss', 'muscle'].includes(p.goal) && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Target weight"><UnitInput unit={u.mass} value={p.targetWeight} onChange={(e) => setP({ ...p, targetWeight: e.target.value })} /></Field>
                      <Field label={`Rate: ${p.rate} kg / week`} hint="0.25–0.75 kg/week keeps muscle and is sustainable"><input type="range" min="0.1" max="1" step="0.05" value={p.rate} onChange={(e) => setP({ ...p, rate: Number(e.target.value) })} className="mt-3 w-full" /></Field>
                    </div>
                  )}
                  {preview.targets && <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[['Calories', `${fmt(preview.targets.kcal)} kcal`], ['Protein', `${preview.targets.protein} g`], ['Fibre', `${preview.targets.fiber} g`], ['Water', `${(preview.targets.water / 1000).toFixed(1)} L`]].map(([l, v]) => <div key={l} className="rounded-xl bg-raised p-3 text-center"><div className="text-xs text-muted">{l}</div><div className="font-bold">{v}</div></div>)}</div>}
                </div>
              )}

              {step.key === 'sleep' && (
                <div className="grid gap-5 md:grid-cols-2">
                  <Q label={`Average sleep: ${a.sleepHours} h`}><input type="range" min="4" max="10" step="0.5" value={a.sleepHours} onChange={(e) => set('sleepHours')(Number(e.target.value))} className="w-full" /></Q>
                  <Q label="Do you sleep and wake at about the same time every day?"><Options value={a.sleepRegular} onChange={set('sleepRegular')} options={[['yes', 'Yes, within 30 min'], ['no', 'No, it varies']]} /></Q>
                  <Q label="Usual bedtime / wake time"><div className="flex gap-2"><Input type="time" value={p.bedtime} onChange={(e) => setP({ ...p, bedtime: e.target.value })} /><Input type="time" value={p.wake} onChange={(e) => setP({ ...p, wake: e.target.value })} /></div></Q>
                  <Q label="Screens in the last hour before bed?"><Options value={a.screens} onChange={set('screens')} options={[['yes', 'Usually'], ['no', 'Rarely']]} /></Q>
                  <Q label="Stress level most days (1 = calm, 5 = overwhelmed)"><ScaleInput value={a.stress} onChange={set('stress')} /></Q>
                  <Q label="Morning sunlight outdoors?"><Options value={a.sunlight} onChange={set('sunlight')} options={[['rarely', 'Rarely'], ['sometimes', 'Sometimes'], ['daily', 'Daily']]} /></Q>
                </div>
              )}

              {step.key === 'food' && (
                <div className="grid gap-5 md:grid-cols-2">
                  <Q label="Overall diet quality"><Options value={a.diet} onChange={set('diet')} options={[['poor', 'Poor'], ['fair', 'Fair'], ['good', 'Good'], ['great', 'Great']]} /></Q>
                  <Q label="Protein (dal, eggs, paneer, meat, curd…) at meals?"><Options value={a.protein} onChange={set('protein')} options={[['low', 'Rarely'], ['some', 'Some meals'], ['most', 'Most meals']]} /></Q>
                  <Q label={`Fruit & vegetable servings / day: ${a.veg}${a.veg >= 6 ? '+' : ''}`}><input type="range" min="0" max="6" value={a.veg} onChange={(e) => set('veg')(Number(e.target.value))} className="w-full" /></Q>
                  <Q label="Packaged / ultra-processed food (chips, biscuits, instant noodles…)"><Options value={a.processed} onChange={set('processed')} options={[['rarely', 'Rarely'], ['sometimes', 'Sometimes'], ['often', 'Often']]} /></Q>
                  <Q label="Sugary drinks or packaged juice"><Options value={a.sugaryDrinks} onChange={set('sugaryDrinks')} options={[['never', 'Never'], ['weekly', 'Weekly'], ['daily', 'Daily']]} /></Q>
                  <Q label="Eat dinner within 2 h of bed?"><Options value={a.lateEating} onChange={set('lateEating')} options={[['no', 'No'], ['yes', 'Often']]} /></Q>
                  <Q label={`Water per day: ${a.water} L`}><input type="range" min="0.5" max="4" step="0.25" value={a.water} onChange={(e) => set('water')(Number(e.target.value))} className="w-full" /></Q>
                </div>
              )}

              {step.key === 'move' && (
                <div className="grid gap-5 md:grid-cols-2">
                  <Q label="Daily steps (roughly)"><Options value={a.steps} onChange={set('steps')} options={[['under5k', '< 5k'], ['5to8k', '5–8k'], ['8to12k', '8–12k'], ['over12k', '12k+']]} /></Q>
                  <Q label={`Exercise days / week: ${a.exerciseDays}`}><input type="range" min="0" max="7" value={a.exerciseDays} onChange={(e) => set('exerciseDays')(Number(e.target.value))} className="w-full" /></Q>
                  <Q label={`Strength sessions / week: ${a.strength}`}><input type="range" min="0" max="5" value={a.strength} onChange={(e) => set('strength')(Number(e.target.value))} className="w-full" /></Q>
                  <Q label="Desk job / long sitting?"><Options value={a.desk} onChange={set('desk')} options={[['yes', 'Yes'], ['no', 'No']]} /></Q>
                  <Q label="Any current pain or injury?"><Options value={a.pain} onChange={set('pain')} options={[['no', 'No'], ['yes', 'Yes']]} /></Q>
                </div>
              )}

              {step.key === 'subs' && (
                <div className="grid gap-5 md:grid-cols-2">
                  <Q label={`Alcoholic drinks / week: ${a.alcohol}${a.alcohol >= 20 ? '+' : ''}`}><input type="range" min="0" max="20" value={a.alcohol} onChange={(e) => set('alcohol')(Number(e.target.value))} className="w-full" /></Q>
                  <Q label="Smoking / tobacco"><Options value={a.smoking} onChange={set('smoking')} options={[['no', 'Never / quit'], ['occasionally', 'Occasionally'], ['daily', 'Daily']]} /></Q>
                  <Q label={`Cups of coffee / tea per day: ${a.caffeine}`}><input type="range" min="0" max="8" value={a.caffeine} onChange={(e) => set('caffeine')(Number(e.target.value))} className="w-full" /></Q>
                </div>
              )}

              {step.key === 'health' && (
                <div className="space-y-5">
                  <Q label="Diagnosed conditions" hint="These are the visible 1% tips. They start you deeper in the disease iceberg."><Options multi value={a.conditions} onChange={set('conditions')} options={CONDITIONS} /></Q>
                  <div className="grid gap-5 md:grid-cols-3">
                    <Q label="Medications or supplements?"><Options value={a.meds} onChange={set('meds')} options={[['none', 'None'], ['supplements', 'Supplements'], ['medications', 'Medications']]} /></Q>
                    <Q label="Last full check-up"><Options value={a.lastCheckup} onChange={set('lastCheckup')} options={[['under1y', '< 1 year'], ['1to2y', '1–2 years'], ['over2y', '> 2 years']]} /></Q>
                    <Q label="Last blood test"><Options value={a.lastBloods} onChange={set('lastBloods')} options={[['under1y', '< 1 year'], ['1to2y', '1–2 years'], ['over2y', '> 2 years']]} /></Q>
                  </div>
                  <Q label="Family history (parents / siblings)"><Options multi value={a.family} onChange={set('family')} options={FAMILY} /></Q>
                </div>
              )}

              {step.key === 'plan' && (
                <div className="grid gap-6 md:grid-cols-5">
                  <div className="md:col-span-2">
                    <div className="mb-2 text-center"><Badge tone={zone.status === 'neutral' ? 'info' : zone.status}>{zone.name}</Badge></div>
                    <IcebergSpectrum position={preview.current.position} good={preview.current.good} bad={preview.current.bad} unknown={preview.current.unknown} height={340} />
                  </div>
                  <div className="space-y-3 md:col-span-3">
                    <p className="text-sm text-fg2">Your starting position is <b className="text-fg">{preview.current.position > 0 ? '+' : ''}{preview.current.position}</b>. {zone.desc} Here are your first daily actions; tap to adjust. <b>Fewer is better</b>: you'll unlock more as they stick.</p>
                    <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                      {[...rec, ...ACTIONS.filter((x) => x.phase <= 2 && !rec.includes(x.key)).map((x) => x.key)].map((k, n) => {
                        const x = ACTION_BY_KEY[k]; const on = chosen.includes(k);
                        return (
                          <motion.button key={k} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: n * 0.03 }} onClick={() => setPicked(on ? chosen.filter((y) => y !== k) : [...chosen, k])}
                            className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${on ? 'border-accent bg-accent/10' : 'border-line opacity-70 hover:opacity-100'}`}>
                            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${on ? 'border-accent bg-accent text-white' : 'border-line'}`}>{on && <Check size={12} strokeWidth={3} />}</span>
                            <span><span className="block text-sm font-medium">{x.title} {rec.includes(k) && <Badge tone="info" className="ml-1">recommended</Badge>}</span><span className="block text-xs text-muted">{DOMAINS[x.domain]?.name} · {x.why}</span></span>
                          </motion.button>
                        );
                      })}
                    </div>
                    <div className="text-xs text-muted">{chosen.length} selected{chosen.length > 8 ? '. That is a lot; consider trimming to 5–7.' : ''}</div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          {i === 0 ? <Button variant="ghost" icon={Sparkles} onClick={demo} disabled={busy}>Explore with 180 days of demo data</Button> : <Button variant="ghost" icon={ArrowLeft} onClick={() => go(-1)}>Back</Button>}
          {i < STEPS.length - 1
            ? <Button size="lg" onClick={() => go(1)} disabled={!canNext}>{i === 0 ? 'Start my assessment' : 'Continue'} <ArrowRight size={18} /></Button>
            : <Button size="lg" onClick={finish} disabled={busy || !chosen.length}>Start my journey <ArrowRight size={18} /></Button>}
        </div>
      </div>
    </div>
  );
}
