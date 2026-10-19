import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ListChecks, Plus, Trash2, Pencil, BookOpen, Bell, Library, Zap, CheckSquare } from 'lucide-react';
import { PageHeader, Card, CardTitle, Stagger, Button, Modal, Field, Input, Select, Badge, Chip, Toggle, IconBtn, Tabs } from '../components/ui.jsx';
import { BarList, CalendarHeatmap } from '../components/charts.jsx';
import RecordManager from '../components/RecordManager.jsx';
import { useData } from '../lib/store.jsx';
import { useTheme } from '../lib/theme.jsx';
import { api } from '../lib/api.js';
import { addDays, dateRange, mean, todayISO } from '../lib/format.js';
import { ACTIONS, PHASES } from '@shared/actions.js';
import { DOMAINS } from '@shared/catalog.js';

const AUTO_RULES = [['', 'Manual tick'], ['log_food', 'Food logged'], ['weigh_in', 'Weight logged'], ['checkin', 'Check-in done'], ['water', 'Water ≥ goal'], ['meds', 'All meds taken'], ['sleep7', 'Slept 7 h+'], ['bedtime', 'In bed by target'],
  ['wake_consistent', 'Wake ±30 min'], ['protein', 'Protein ≥ 90% target'], ['steps', 'Steps ≥ goal'], ['cal_range', 'Calories ±10%'], ['alcohol_free', 'No alcohol logged'], ['sunlight', 'Sunlight ≥ 10 min'],
  ['train', 'Any workout'], ['fiber', 'Fibre ≥ 30 g'], ['plants5', '5+ plant servings'], ['zone2', '30 min zone 2'], ['meditate', 'Meditation ≥ 10 min'], ['no_upf', 'UPF < 10% kcal']];
export const DEFAULT_REMINDERS = [
  { id: 'weigh', label: 'Weigh in', time: '07:00', freq: 'daily', on: true }, { id: 'checkin', label: 'Daily check-in', time: '21:00', freq: 'daily', on: true },
  { id: 'meds', label: 'Meds & supplements', time: '09:00', freq: 'daily', on: true }, { id: 'review', label: 'Weekly review', time: '18:00', freq: 'sunday', on: true },
  { id: 'measure', label: 'Tape measurements', time: '07:15', freq: 'monthly', on: true }, { id: 'tests', label: 'Fitness test battery', time: '10:00', freq: 'quarterly', on: false },
];

export default function Actions() {
  const { model: m, refresh, notify, saveSettings } = useData();
  const { c } = useTheme();
  const [tab, setTab] = useState('actions');
  const [edit, setEdit] = useState(null);
  const [lib, setLib] = useState(false);
  const [phase, setPhase] = useState(0);
  const all = m.actions;
  const [inactive, setInactive] = useState([]);
  useEffect(() => { api.list('actions').then((rows) => setInactive(rows.filter((a) => !a.active))); }, [m]);
  const days30 = dateRange(addDays(m.today, -29), m.today);
  const adh = all.map((a) => ({ name: a.title.length > 28 ? `${a.title.slice(0, 27)}…` : a.title, value: Math.round(mean(days30.filter((d) => !a.created || a.created <= d).map((d) => (m.actionDone(a, d) ? 100 : 0))) ?? 0) }));
  const reminders = m.settings.reminders || DEFAULT_REMINDERS;

  const save = async () => {
    const { id, ...row } = edit;
    if (id) await api.update('actions', id, row); else await api.add('actions', { ...row, layer: 1, created: todayISO(), sort: all.length + 1 });
    setEdit(null); await refresh(); notify('Action saved');
  };
  const addFromLib = async (x) => { await api.add('actions', { key: x.key, title: x.title, domain: x.domain, layer: 1, phase: x.phase, auto: x.auto, why: x.why, created: todayISO(), sort: all.length + 1 }); await refresh(); notify(`Added “${x.title}”`); };
  const remove = async (a) => { if (confirm(`Remove “${a.title}”? Its history is deleted too.`)) { await api.remove('actions', a.id); refresh(); } };
  const pause = async (a) => { await api.update('actions', a.id, { active: 0 }); refresh(); notify('Paused. It no longer counts toward your daily score.'); };
  const setRem = async (i, patch) => { const r = reminders.map((x, j) => (j === i ? { ...x, ...patch } : x)); await saveSettings({ reminders: r }); };

  return (
    <div>
      <PageHeader icon={ListChecks} title="Actions & protocols" subtitle="Your daily action items (from onboarding), reusable protocols and reminders." />
      <Tabs className="mb-5" value={tab} onChange={setTab} tabs={[{ key: 'actions', label: 'Daily actions', icon: Zap }, { key: 'protocols', label: 'Protocols', icon: BookOpen }, { key: 'reminders', label: 'Reminders', icon: Bell }]} />

      {tab === 'actions' && (
        <Stagger className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card hover={false} className="xl:col-span-2">
            <CardTitle icon={Zap} title={`${all.length} active daily actions`} sub="Start small: 5–7 actions. Unlock more on the Journey page when adherence holds ≥ 80%."
              right={<div className="flex gap-2"><Button size="sm" variant="soft" icon={Library} onClick={() => setLib(true)}>Library</Button><Button size="sm" icon={Plus} onClick={() => setEdit({ title: '', domain: 'nutrition', phase: 1, auto: '', why: '' })}>Custom</Button></div>} />
            <div className="space-y-2">
              <AnimatePresence>
                {all.map((a, i) => (
                  <motion.div key={a.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} transition={{ delay: i * 0.02 }} className="group flex items-center gap-3 rounded-xl border border-line p-3">
                    <CheckSquare size={18} className="shrink-0 text-accent" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{a.title}</div>
                      <div className="mt-0.5 flex flex-wrap gap-1.5 text-[11px]"><Badge>{DOMAINS[a.domain]?.name}</Badge><Badge tone="info">Phase {a.phase} · {PHASES[a.phase]?.name}</Badge>{a.auto && <Badge tone="good">auto: {AUTO_RULES.find((r) => r[0] === a.auto)?.[1]}</Badge>}</div>
                    </div>
                    <div className="flex gap-0.5 opacity-60 group-hover:opacity-100">
                      <Button size="sm" variant="ghost" onClick={() => pause(a)}>Pause</Button>
                      <IconBtn icon={Pencil} label="Edit" size={15} onClick={() => setEdit({ id: a.id, title: a.title, domain: a.domain, phase: a.phase, auto: a.auto || '', why: a.why || '' })} />
                      <IconBtn icon={Trash2} label="Delete" size={15} onClick={() => remove(a)} />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {inactive.length > 0 && <div className="pt-3 text-xs font-semibold uppercase tracking-wider text-muted">Paused</div>}
              {inactive.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-xl border border-dashed border-line p-3 opacity-70">
                  <div className="flex-1 text-sm">{a.title}</div>
                  <Button size="sm" variant="soft" onClick={async () => { await api.update('actions', a.id, { active: 1 }); refresh(); }}>Resume</Button>
                  <IconBtn icon={Trash2} label="Delete" size={15} onClick={() => remove(a)} />
                </div>
              ))}
            </div>
          </Card>
          <div className="space-y-4">
            <Card hover={false}><CardTitle title="30-day adherence per action" /><BarList data={adh} unit="%" refLine={80} cellColor={(d) => (d.value >= 80 ? c.status.good : d.value >= 50 ? c.series[0] : c.status.serious)} /></Card>
            <Card hover={false}><CardTitle title="Daily score calendar" /><CalendarHeatmap values={m.daily.action_score || {}} days={126} label="done" /></Card>
          </div>
        </Stagger>
      )}

      {tab === 'protocols' && (
        <RecordManager kind="protocol" title="Protocols library" icon={BookOpen} sub="Saved routines for recurring situations" sort="name"
          fields={[{ key: 'name', label: 'Name' }, { key: 'when', label: 'When to use' }, { key: 'steps', label: 'Steps (one per line)', type: 'list' }]}
          summary={(r) => (
            <div>
              <div className="font-semibold">{r.data.name}</div><div className="text-xs text-muted">{r.data.when}</div>
              <ol className="mt-2 grid gap-1 sm:grid-cols-2">{(r.data.steps || []).map((s, i) => <li key={i} className="flex items-start gap-2 text-sm"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-raised text-[10px] font-bold">{i + 1}</span>{s}</li>)}</ol>
            </div>)}
          empty="e.g. Sick-day protocol, travel protocol, a minimum viable health day for bad weeks." />
      )}

      {tab === 'reminders' && (
        <Card hover={false}>
          <CardTitle icon={Bell} title="Reminders" sub="Browser notifications while LifeOS is open. Push for mobile comes with the PWA."
            right={<Button size="sm" variant="soft" onClick={async () => { const r = await Notification.requestPermission(); notify(r === 'granted' ? 'Notifications enabled' : 'Notifications blocked by the browser', r === 'granted' ? 'good' : 'error'); }}>Enable notifications</Button>} />
          <div className="space-y-2">
            {reminders.map((r, i) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3">
                <Toggle checked={r.on} onChange={(v) => setRem(i, { on: v })} />
                <div className="min-w-40 flex-1 text-sm font-medium">{r.label}</div>
                <Select value={r.freq} onChange={(e) => setRem(i, { freq: e.target.value })} options={[['daily', 'Daily'], ['weekdays', 'Weekdays'], ['sunday', 'Sundays'], ['monthly', '1st of month'], ['quarterly', 'Quarterly']]} className="!w-36" />
                <Input type="time" value={r.time} onChange={(e) => setRem(i, { time: e.target.value })} className="!w-28" />
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit action' : 'Custom action'} footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save} disabled={!edit?.title}>Save</Button></>}>
        {edit && <div className="grid grid-cols-2 gap-3">
          <Field label="Action" className="col-span-2"><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="Stretch for 10 minutes" /></Field>
          <Field label="Domain"><Select value={edit.domain} onChange={(e) => setEdit({ ...edit, domain: e.target.value })} options={Object.entries(DOMAINS).map(([k, d]) => [k, d.name])} /></Field>
          <Field label="Phase"><Select value={edit.phase} onChange={(e) => setEdit({ ...edit, phase: Number(e.target.value) })} options={Object.entries(PHASES).map(([k, p]) => [k, `${k} · ${p.name}`])} /></Field>
          <Field label="Auto-check from data" className="col-span-2"><Select value={edit.auto} onChange={(e) => setEdit({ ...edit, auto: e.target.value })} options={AUTO_RULES} /></Field>
          <Field label="Why it matters" className="col-span-2"><Input value={edit.why} onChange={(e) => setEdit({ ...edit, why: e.target.value })} /></Field>
        </div>}
      </Modal>
      <Modal open={lib} onClose={() => setLib(false)} title="Action library" wide>
        <div className="mb-3 flex flex-wrap gap-2"><Chip active={!phase} onClick={() => setPhase(0)}>All phases</Chip>{Object.entries(PHASES).map(([k, p]) => <Chip key={k} active={phase === Number(k)} onClick={() => setPhase(Number(k))}>{k} · {p.name}</Chip>)}</div>
        <div className="grid gap-2 md:grid-cols-2">
          {ACTIONS.filter((x) => !phase || x.phase === phase).map((x) => { const has = all.some((a) => a.key === x.key); return (
            <div key={x.key} className="rounded-xl border border-line p-3">
              <div className="flex items-start justify-between gap-2"><div className="text-sm font-medium">{x.title}</div><Button size="sm" variant={has ? 'ghost' : 'soft'} disabled={has} onClick={() => addFromLib(x)}>{has ? 'Added' : 'Add'}</Button></div>
              <div className="mt-1 text-xs text-muted">{x.why}</div>
              <div className="mt-1.5 flex gap-1.5"><Badge>{DOMAINS[x.domain]?.name}</Badge><Badge tone="info">Phase {x.phase}</Badge>{x.auto && <Badge tone="good">auto</Badge>}</div>
            </div>); })}
        </div>
      </Modal>
    </div>
  );
}
