import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scale, Droplets, Smile, HeartPulse, Syringe, Thermometer, Wine, Coffee, SunMedium, Wind, Footprints, Cigarette } from 'lucide-react';
import { Modal, Button, Field, Input, UnitInput, Select, Chip } from './ui.jsx';
import { useData } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { todayISO } from '../lib/format.js';
import { METRICS, CHECKIN_KEYS } from '@shared/catalog.js';

const KINDS = [
  { key: 'weight', label: 'Weight', icon: Scale },
  { key: 'water', label: 'Water', icon: Droplets },
  { key: 'checkin', label: 'Check-in', icon: Smile },
  { key: 'bp', label: 'Blood pressure', icon: HeartPulse },
  { key: 'glucose', label: 'Glucose', icon: Syringe },
  { key: 'symptom', label: 'Symptom', icon: Thermometer },
  { key: 'alcohol', label: 'Alcohol', icon: Wine },
  { key: 'caffeine', label: 'Caffeine', icon: Coffee },
  { key: 'sunlight', label: 'Sunlight', icon: SunMedium },
  { key: 'meditation', label: 'Meditation', icon: Wind },
  { key: 'steps', label: 'Steps', icon: Footprints },
  { key: 'cigarettes', label: 'Cigarettes', icon: Cigarette },
];

export function ScaleInput({ value, onChange, labels = ['1', '2', '3', '4', '5'] }) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <motion.button key={n} type="button" whileTap={{ scale: 0.85 }} whileHover={{ y: -2 }} onClick={() => onChange(n)}
          className={`h-10 flex-1 rounded-xl text-sm font-semibold transition-colors ${value === n ? 'grad-bg text-white shadow-md' : 'bg-raised text-fg2 hover:bg-line'}`}>{labels[n - 1]}</motion.button>
      ))}
    </div>
  );
}

export default function QuickLog({ open, onClose, initial = 'weight' }) {
  const { refresh, u, notify } = useData();
  const [kind, setKind] = useState(initial);
  const [date, setDate] = useState(todayISO());
  const [v, setV] = useState({});
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e?.target ? e.target.value : e }));

  const save = async () => {
    const now = new Date();
    const ts = date === todayISO() ? `${date}T${now.toTimeString().slice(0, 8)}` : `${date}T12:00:00`;
    if (kind === 'weight') await api.add('entries', { metric: 'weight', date, ts, value: u.to(Number(v.weight), 'mass') });
    else if (kind === 'checkin') await api.add('entries', CHECKIN_KEYS.filter((k) => v[k]).map((k) => ({ metric: k, date, value: v[k] })));
    else if (kind === 'bp') await api.add('entries', { metric: 'bp', date, ts, value: Number(v.sys), value2: Number(v.dia) });
    else if (kind === 'glucose') await api.add('entries', { metric: 'glucose', date, ts, value: u.to(Number(v.glucose), 'glucose'), meta: { context: v.context || 'fasting' } });
    else if (kind === 'symptom') await api.add('records', { kind: 'symptom', date, data: { name: v.name, severity: Number(v.severity || 3), duration: v.duration, triggers: v.triggers } });
    else {
      // additive daily totals: add to today's existing value
      const existing = (await api.list('entries', { metric: kind, from: date, to: date })).filter((e) => e.source === 'manual').reduce((s, e) => s + e.value, 0);
      await api.add('entries', { metric: kind, date, value: existing + Number(v.amount || 0) });
    }
    await refresh();
    notify(`${KINDS.find((k) => k.key === kind).label} logged`);
    setV({});
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Quick log" wide>
      <div className="mb-5 flex flex-wrap gap-2">
        {KINDS.map((k) => <Chip key={k.key} icon={k.icon} active={kind === k.key} onClick={() => { setKind(k.key); setV({}); }}>{k.label}</Chip>)}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={kind} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
          <Field label="Date"><Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} /></Field>
          {kind === 'weight' && <Field label="Morning weight (after toilet, before food)"><UnitInput autoFocus unit={u.label('mass')} value={v.weight || ''} onChange={set('weight')} /></Field>}
          {kind === 'checkin' && CHECKIN_KEYS.map((k) => (
            <Field key={k} label={`${METRICS[k].name}${k === 'stress' || k === 'soreness' ? ' (1 = none, 5 = high)' : ' (1 = low, 5 = great)'}`}><ScaleInput value={v[k]} onChange={set(k)} /></Field>
          ))}
          {kind === 'bp' && <div className="grid grid-cols-2 gap-3"><Field label="Systolic"><UnitInput autoFocus unit="mmHg" value={v.sys || ''} onChange={set('sys')} /></Field><Field label="Diastolic"><UnitInput unit="mmHg" value={v.dia || ''} onChange={set('dia')} /></Field></div>}
          {kind === 'glucose' && <div className="grid grid-cols-2 gap-3">
            <Field label="Reading"><UnitInput autoFocus unit={u.label('glucose')} value={v.glucose || ''} onChange={set('glucose')} /></Field>
            <Field label="Context"><Select value={v.context || 'fasting'} onChange={set('context')} options={[['fasting', 'Fasting'], ['1h post-meal', '1 h after meal'], ['2h post-meal', '2 h after meal'], ['random', 'Random'], ['bedtime', 'Bedtime']]} /></Field>
          </div>}
          {kind === 'symptom' && <>
            <Field label="Symptom"><Input autoFocus placeholder="Headache, bloating, joint pain…" value={v.name || ''} onChange={set('name')} /></Field>
            <Field label={`Severity: ${v.severity || 3}/10`}><input type="range" min="0" max="10" value={v.severity || 3} onChange={set('severity')} className="w-full" /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Duration"><Input placeholder="2 h" value={v.duration || ''} onChange={set('duration')} /></Field><Field label="Suspected trigger"><Input placeholder="Poor sleep, food…" value={v.triggers || ''} onChange={set('triggers')} /></Field></div>
          </>}
          {['water', 'alcohol', 'caffeine', 'sunlight', 'meditation', 'steps', 'cigarettes'].includes(kind) && (
            <>
              <Field label={`Add ${METRICS[kind].name.toLowerCase()} (added to the day’s total)`}><UnitInput autoFocus unit={METRICS[kind].unit} value={v.amount || ''} onChange={set('amount')} /></Field>
              <div className="flex flex-wrap gap-2">
                {({ water: [250, 500, 750], alcohol: [1, 2, 3], caffeine: [64, 95, 150], sunlight: [5, 10, 20], meditation: [5, 10, 20], steps: [1000, 2500, 5000], cigarettes: [1, 2, 5] })[kind].map((n) => (
                  <Button key={n} variant="soft" size="sm" onClick={() => setV({ amount: n })}>+{n} {METRICS[kind].unit}</Button>
                ))}
              </div>
              {kind === 'alcohol' && <p className="text-xs text-muted">1 unit = 10 g alcohol: ½ pint beer, a small (125 mL) glass of wine or a single (25 mL) shot.</p>}
            </>
          )}
        </motion.div>
      </AnimatePresence>
      <div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></div>
    </Modal>
  );
}
