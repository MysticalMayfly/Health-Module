import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Stethoscope, Pill, AlertCircle, CalendarDays, ShieldCheck, Syringe, Users, Contact, FileText, IdCard, CheckCircle2, Plus } from 'lucide-react';
import { PageHeader, Card, CardTitle, Stagger, Button, Tabs, Field, Input, Select, Textarea, Badge, StatusPill, Progress } from '../components/ui.jsx';
import { CalendarHeatmap } from '../components/charts.jsx';
import RecordManager from '../components/RecordManager.jsx';
import { useData } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { addDays, dateRange, daysBetween, fmtDate, mean, todayISO } from '../lib/format.js';

const SUGGESTED = (age, sex) => [
  ['Dental check-up & cleaning', 6], ['Eye exam', 24], ['Blood panel', 12], ['Blood pressure (clinic)', 12], ['Skin check (moles)', 12],
  ...(age >= 45 ? [['Colorectal cancer screening', 120]] : []),
  ...(sex === 'female' ? [['Cervical screening (Pap/HPV)', 36], ...(age >= 40 ? [['Mammogram', 24]] : [])] : []),
  ...(sex === 'female' && age >= 50 ? [['Bone density (DEXA)', 24]] : []),
  ...(sex !== 'female' && age >= 50 ? [['Prostate discussion (PSA)', 24]] : []),
  ...(age >= 40 ? [['ECG / cardiac risk review', 36]] : []),
];
const RISK = { diabetes: 'HbA1c & fasting insulin yearly; waist & post-meal glucose', heart: 'ApoB, Lp(a) once, BP; consider a coronary calcium score after 40', bp: 'Home BP twice a week; sodium & potassium intake', cancer: 'Age-appropriate cancer screening, possibly earlier: discuss with your doctor', dementia: 'Sleep, BP, hearing, exercise and social connection are the modifiable levers' };

export default function Medical() {
  const { model: m, saveSettings, refresh, notify } = useData();
  const [tab, setTab] = useState('profile');
  const mp = m.settings.medicalProfile || {};
  const [p, setP] = useState(mp);
  const tracked = new Set(m.screenings.map((s) => s.data?.name));
  const suggestions = SUGGESTED(m.age || 35, m.profile.sex).filter(([n]) => !tracked.has(n));
  const fam = m.records.family || [];
  const famRisks = [...new Set(fam.map((f) => (/diab/i.test(f.data?.condition) ? 'diabetes' : /heart|stroke|cardi/i.test(f.data?.condition) ? 'heart' : /pressure|hypert/i.test(f.data?.condition) ? 'bp' : /cancer/i.test(f.data?.condition) ? 'cancer' : /dement|alzh/i.test(f.data?.condition) ? 'dementia' : null)).filter(Boolean))];
  const medAdh = (r) => { const days = dateRange(addDays(m.today, -29), m.today).filter((d) => !r.date || d >= r.date); return days.length ? Math.round(mean(days.map((d) => (m.medLog[`${d}|${r.id}`] ? 1 : 0))) * 100) : null; };
  const adhHeat = Object.fromEntries(dateRange(addDays(m.today, -181), m.today).map((d) => { const ms = m.activeMeds.filter((r) => !r.date || r.date <= d); return [d, ms.length ? mean(ms.map((r) => (m.medLog[`${d}|${r.id}`] ? 100 : 0))) : null]; }).filter(([, v]) => v != null));
  const markDone = async (s) => { await api.update('records', s.id, { data: { ...s.data, last: todayISO() } }); await refresh(); notify(`${s.data.name} marked done today`); };

  return (
    <div>
      <PageHeader icon={Stethoscope} title="Medical & prevention" subtitle="Records, medications, screenings and family history: the prevention layer of the iceberg.">
        <Link to="/doctor-summary"><Button variant="soft" icon={FileText}>Doctor summary (PDF)</Button></Link>
      </PageHeader>
      <Tabs className="mb-5" value={tab} onChange={setTab} tabs={[
        { key: 'profile', label: 'Profile', icon: IdCard }, { key: 'meds', label: 'Medications', icon: Pill }, { key: 'conditions', label: 'Conditions & allergies', icon: AlertCircle },
        { key: 'appointments', label: 'Appointments', icon: CalendarDays }, { key: 'prevention', label: 'Screenings & vaccines', icon: ShieldCheck }, { key: 'family', label: 'Family history', icon: Users }, { key: 'providers', label: 'Providers', icon: Contact }]} />

      {tab === 'profile' && (
        <Stagger className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card hover={false} className="lg:col-span-2">
            <CardTitle icon={IdCard} title="Medical profile & emergency info" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Field label="Blood group"><Select value={p.bloodGroup || ''} onChange={(e) => setP({ ...p, bloodGroup: e.target.value })} options={['', 'A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−']} /></Field>
              <Field label="Organ donor"><Select value={p.donor || ''} onChange={(e) => setP({ ...p, donor: e.target.value })} options={['', 'Yes', 'No']} /></Field>
              <Field label="Insurance / policy no."><Input value={p.insurance || ''} onChange={(e) => setP({ ...p, insurance: e.target.value })} /></Field>
              <Field label="Emergency contact"><Input value={p.emergencyName || ''} onChange={(e) => setP({ ...p, emergencyName: e.target.value })} /></Field>
              <Field label="Emergency phone"><Input value={p.emergencyPhone || ''} onChange={(e) => setP({ ...p, emergencyPhone: e.target.value })} /></Field>
              <Field label="Relationship"><Input value={p.emergencyRel || ''} onChange={(e) => setP({ ...p, emergencyRel: e.target.value })} /></Field>
              <Field label="Notes for first responders" className="col-span-2 md:col-span-3"><Textarea value={p.notes || ''} onChange={(e) => setP({ ...p, notes: e.target.value })} /></Field>
            </div>
            <div className="mt-3 flex justify-end"><Button onClick={async () => { await saveSettings({ medicalProfile: p }); notify('Medical profile saved'); }}>Save</Button></div>
          </Card>
          <Card hover={false}>
            <CardTitle icon={ShieldCheck} title="At a glance" />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-fg2">Active conditions</span><b>{(m.records.condition || []).filter((x) => x.active).length}</b></div>
              <div className="flex justify-between"><span className="text-fg2">Medications & supplements</span><b>{m.activeMeds.length}</b></div>
              <div className="flex justify-between"><span className="text-fg2">Allergies</span><b>{(m.records.allergy || []).length}</b></div>
              <div className="flex justify-between"><span className="text-fg2">Overdue screenings</span><b className="text-critical">{m.screenings.filter((s) => s.overdue).length}</b></div>
              <div className="flex justify-between"><span className="text-fg2">Upcoming appointments</span><b>{(m.records.appointment || []).filter((a) => a.date >= m.today).length}</b></div>
            </div>
          </Card>
        </Stagger>
      )}

      {tab === 'meds' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <RecordManager kind="medication" title="Medications & supplements" icon={Pill} activeField="Currently taking"
            fields={[{ key: 'name', label: 'Name' }, { key: 'kind', label: 'Type', type: 'select', options: [['medication', 'Medication'], ['supplement', 'Supplement']], half: true }, { key: 'dose', label: 'Dose', half: true },
              { key: 'schedule', label: 'Schedule', type: 'select', options: ['daily', 'twice daily', 'weekly', 'as needed'], half: true }, { key: 'time', label: 'Time', placeholder: '08:00', half: true },
              { key: 'purpose', label: 'Purpose', half: true }, { key: 'stock', label: 'Doses in stock', type: 'number', half: true }, { key: '_date', label: 'Started', type: 'date', half: true }, { key: 'prescriber', label: 'Prescriber', half: true }]}
            defaults={{ kind: 'supplement', schedule: 'daily' }}
            summary={(r) => { const a = medAdh(r); return (
              <div>
                <div className="flex flex-wrap items-center gap-2"><b className="font-medium">{r.data.name}</b><span className="text-muted">{r.data.dose}</span><Badge tone={r.data.kind === 'medication' ? 'info' : 'neutral'}>{r.data.kind}</Badge>{r.data.stock != null && r.data.stock <= 7 && <Badge tone="warning">{r.data.stock} left</Badge>}</div>
                <div className="text-xs text-muted">{r.data.schedule} · {r.data.time} · {r.data.purpose}</div>
                {a != null && r.active ? <div className="mt-1.5 flex items-center gap-2 text-xs"><Progress value={a} className="flex-1" height={6} /><span className="tabular">{a}% (30 d)</span></div> : null}
              </div>); }} />
          <Card hover={false}>
            <CardTitle icon={CheckCircle2} title="Adherence calendar" sub="% of scheduled meds & supplements taken" />
            <CalendarHeatmap values={adhHeat} label="adherence" />
            <p className="mt-3 text-xs text-muted">Tick doses on the Today page. Stock counts help you remember to refill.</p>
          </Card>
        </div>
      )}

      {tab === 'conditions' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <RecordManager kind="condition" title="Conditions" icon={AlertCircle} activeField="Active (counts as a visible 1% tip)"
            fields={[{ key: 'name', label: 'Condition' }, { key: 'status', label: 'Status', type: 'select', options: ['active', 'monitoring', 'resolved'], half: true }, { key: '_date', label: 'Diagnosed', type: 'date', half: true }, { key: 'notes', label: 'Notes', type: 'textarea' }]}
            defaults={{ status: 'active' }}
            summary={(r) => <div><div className="flex items-center gap-2"><b className="font-medium">{r.data.name}</b><StatusPill status={r.data.status === 'resolved' ? 'good' : r.data.status === 'monitoring' ? 'warning' : 'serious'} label={r.data.status} /></div><div className="text-xs text-muted">{r.date ? `since ${fmtDate(r.date, 'MMM yyyy')}` : ''} {r.data.notes}</div></div>} />
          <RecordManager kind="allergy" title="Allergies" icon={AlertCircle}
            fields={[{ key: 'name', label: 'Allergen' }, { key: 'reaction', label: 'Reaction', half: true }, { key: 'severity', label: 'Severity', type: 'select', options: ['mild', 'moderate', 'severe', 'anaphylaxis'], half: true }]}
            defaults={{ severity: 'mild' }}
            summary={(r) => <div className="flex items-center gap-2"><b className="font-medium">{r.data.name}</b><Badge tone={/severe|anaph/.test(r.data.severity) ? 'critical' : 'warning'}>{r.data.severity}</Badge><span className="text-xs text-muted">{r.data.reaction}</span></div>} />
        </div>
      )}

      {tab === 'appointments' && (
        <RecordManager kind="appointment" title="Appointments" icon={CalendarDays} sub="Prepare questions before; capture notes and follow-ups after"
          fields={[{ key: 'title', label: 'Title' }, { key: '_date', label: 'Date', type: 'date', half: true }, { key: 'provider', label: 'Provider', half: true }, { key: 'kind', label: 'Type', type: 'select', options: ['GP', 'Specialist', 'Dental', 'Eye', 'Lab', 'Therapy', 'Other'], half: true },
            { key: 'status', label: 'Status', type: 'select', options: ['upcoming', 'done', 'cancelled'], half: true }, { key: 'questions', label: 'Questions to ask', type: 'textarea' }, { key: 'notes', label: 'Visit notes', type: 'textarea' }, { key: 'followUp', label: 'Follow-up' }]}
          defaults={{ status: 'upcoming', kind: 'GP' }}
          summary={(r) => <div><div className="flex flex-wrap items-center gap-2"><b className="font-medium">{r.data.title}</b><Badge tone={r.data.status === 'upcoming' ? 'info' : 'neutral'}>{r.data.status}</Badge><span className="text-xs text-muted">{fmtDate(r.date, 'EEE d MMM yyyy')} · {r.data.provider}</span></div>
            {r.data.questions && <div className="mt-1 text-xs">❓ {r.data.questions}</div>}{r.data.notes && <div className="mt-1 text-xs text-fg2">📝 {r.data.notes}</div>}{r.data.followUp && <div className="mt-1 text-xs text-accent">↪ {r.data.followUp}</div>}</div>} />
      )}

      {tab === 'prevention' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="space-y-4">
            <RecordManager kind="screening" title="Preventive screenings" icon={ShieldCheck} sort="name"
              fields={[{ key: 'name', label: 'Screening' }, { key: 'last', label: 'Last done', type: 'date', half: true }, { key: 'intervalMonths', label: 'Every (months)', type: 'number', half: true }, { key: 'notes', label: 'Notes' }]}
              defaults={{ intervalMonths: 12 }}
              summary={(r) => { const s = m.screenings.find((x) => x.id === r.id); return (
                <div className="flex flex-wrap items-center gap-2"><b className="font-medium">{r.data.name}</b>
                  <StatusPill status={s.overdue ? 'critical' : s.soon ? 'warning' : 'good'} label={!s.due ? 'never recorded' : s.overdue ? `overdue ${-daysBetween(m.today, s.due)} d` : `due ${fmtDate(s.due, 'd MMM yyyy')}`} />
                  <span className="text-xs text-muted">every {r.data.intervalMonths} mo</span>
                  <button className="ml-auto text-xs text-accent hover:underline" onClick={(e) => { e.stopPropagation(); markDone(r); }}>mark done today</button></div>); }} />
            {suggestions.length > 0 && (
              <Card hover={false}>
                <CardTitle icon={Plus} title="Suggested for your age & sex" sub="General guidance. Confirm the schedule with your doctor." />
                <div className="flex flex-wrap gap-2">{suggestions.map(([n, mo]) => <Button key={n} size="sm" variant="soft" icon={Plus} onClick={async () => { await api.add('records', { kind: 'screening', data: { name: n, intervalMonths: mo, last: null } }); refresh(); }}>{n}</Button>)}</div>
              </Card>
            )}
          </div>
          <RecordManager kind="vaccination" title="Vaccinations" icon={Syringe}
            fields={[{ key: 'name', label: 'Vaccine' }, { key: '_date', label: 'Date given', type: 'date', half: true }, { key: 'dose', label: 'Dose', half: true }, { key: 'nextDue', label: 'Next due', type: 'date', half: true }]}
            summary={(r) => <div className="flex flex-wrap items-center gap-2"><b className="font-medium">{r.data.name}</b><span className="text-xs text-muted">{fmtDate(r.date, 'MMM yyyy')} · {r.data.dose}</span>{r.data.nextDue && <StatusPill status={r.data.nextDue < m.today ? 'critical' : 'good'} label={`${r.data.nextDue < m.today ? 'overdue' : 'next'} ${fmtDate(r.data.nextDue, 'MMM yyyy')}`} />}</div>} />
        </div>
      )}

      {tab === 'family' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <RecordManager kind="family" title="Family history" icon={Users}
            fields={[{ key: 'relative', label: 'Relative', half: true }, { key: 'condition', label: 'Condition', half: true }, { key: 'ageOnset', label: 'Age at onset', type: 'number', half: true }, { key: 'notes', label: 'Notes', half: true }]}
            summary={(r) => <div className="flex flex-wrap items-center gap-2"><b className="font-medium">{r.data.relative}</b><span>{r.data.condition}</span>{r.data.ageOnset && <Badge tone={r.data.ageOnset < 60 ? 'warning' : 'neutral'}>onset {r.data.ageOnset}</Badge>}</div>} />
          <Card hover={false}>
            <CardTitle icon={ShieldCheck} title="Your risk map" sub="Family history → what to watch more closely" />
            {famRisks.length ? <div className="space-y-2">{famRisks.map((k) => <div key={k} className="rounded-xl bg-raised p-3 text-sm"><b className="capitalize">{k === 'bp' ? 'High blood pressure' : k}</b><div className="text-xs text-fg2">{RISK[k]}</div></div>)}</div> : <p className="text-sm text-muted">Add relatives’ conditions to see screening priorities.</p>}
            <p className="mt-3 text-xs text-muted">Genes load the gun; the 99 lifestyle causes pull the trigger. A family history makes the inputs layer even more important.</p>
          </Card>
        </div>
      )}

      {tab === 'providers' && (
        <RecordManager kind="provider" title="Providers" icon={Contact} sort="name"
          fields={[{ key: 'name', label: 'Name', half: true }, { key: 'specialty', label: 'Specialty', half: true }, { key: 'phone', label: 'Phone', half: true }, { key: 'address', label: 'Address / clinic', half: true }, { key: 'notes', label: 'Notes', type: 'textarea' }]}
          summary={(r) => <div className="flex flex-wrap items-center gap-2"><b className="font-medium">{r.data.name}</b><Badge>{r.data.specialty}</Badge><span className="text-xs text-muted">{r.data.phone} {r.data.address}</span></div>} />
      )}
    </div>
  );
}
