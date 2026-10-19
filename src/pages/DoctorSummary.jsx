import { Link } from 'react-router-dom';
import { Printer, ArrowLeft } from 'lucide-react';
import { useData } from '../lib/store.jsx';
import { Button } from '../components/ui.jsx';
import { TimeChart } from '../components/charts.jsx';
import { LAB_MARKERS } from '@shared/labs.js';
import { addDays, dateRange, fmt, fmtDate, mean } from '../lib/format.js';
import { bpClass } from './Vitals.jsx';

/** One-page printable snapshot for a doctor visit (H-48). Use the browser's “Save as PDF”. */
export default function DoctorSummary() {
  const { model: m, u } = useData();
  const p = m.profile, mp = m.settings.medicalProfile || {};
  const bp = m.readings.bp.slice(-10);
  const bpAvg = bp.length ? [Math.round(mean(bp.map((r) => r.value))), Math.round(mean(bp.map((r) => r.value2)))] : null;
  const weight = dateRange(addDays(m.today, -179), m.today).filter((_, i) => i % 3 === 0).map((d) => ({ date: d, w: m.trend[d] != null ? +u.from(m.trend[d], 'mass').toFixed(1) : null }));
  const labs = Object.keys(m.labsByMarker).map((k) => ({ k, mk: LAB_MARKERS[k], arr: m.labsByMarker[k] })).filter((x) => x.mk);
  const Section = ({ title, children }) => <section className="mb-5 break-inside-avoid"><h2 className="mb-2 border-b border-line pb-1 text-sm font-bold uppercase tracking-wider text-fg2">{title}</h2>{children}</section>;
  return (
    <div className="mx-auto max-w-4xl bg-card p-8 text-sm print:max-w-none print:p-0">
      <div className="no-print mb-6 flex justify-between"><Link to="/medical"><Button variant="ghost" icon={ArrowLeft}>Back</Button></Link><Button icon={Printer} onClick={() => window.print()}>Print / save as PDF</Button></div>
      <header className="mb-6 flex items-end justify-between border-b-2 border-fg pb-3">
        <div><h1 className="text-2xl font-bold">{p.name || 'Patient'}: health summary</h1><div className="text-fg2">{p.sex} · {m.age} y · {p.height} cm · blood group {mp.bloodGroup || '—'}</div></div>
        <div className="text-right text-xs text-muted">Generated {fmtDate(m.today, 'd MMM yyyy')}<br />LifeOS Health</div>
      </header>
      <div className="grid grid-cols-2 gap-6">
        <Section title="Active conditions">{(m.records.condition || []).filter((c) => c.active).map((c) => <div key={c.id}>• <b>{c.data.name}</b> ({c.data.status}) {c.data.notes}</div>)}{!(m.records.condition || []).some((c) => c.active) && <div className="text-muted">None recorded</div>}</Section>
        <Section title="Allergies">{(m.records.allergy || []).map((a) => <div key={a.id}>• <b>{a.data.name}</b>: {a.data.reaction} ({a.data.severity})</div>)}{!(m.records.allergy || []).length && <div className="text-muted">None recorded</div>}</Section>
        <Section title="Medications & supplements">{m.activeMeds.map((r) => <div key={r.id}>• <b>{r.data.name}</b> {r.data.dose}, {r.data.schedule} ({r.data.purpose})</div>)}</Section>
        <Section title="Vitals (recent averages)">
          <div>Blood pressure: <b>{bpAvg ? `${bpAvg[0]}/${bpAvg[1]} mmHg` : '—'}</b> {bpAvg && `(${bpClass(...bpAvg)[0]}, ${bp.length} home readings)`}</div>
          <div>Resting HR: <b>{fmt(m.avgWin('rhr', m.today, 14))} bpm</b> · HRV <b>{fmt(m.avgWin('hrv', m.today, 14))} ms</b></div>
          <div>Fasting glucose (home, 60 d): <b>{u.show(m.avgWin('glucose_fasting', m.today, 60), 'glucose')}</b></div>
          <div>Weight (trend): <b>{u.show(m.trendNow, 'mass', 1)}</b> · BMI {fmt(m.bmi, 1)} · waist {u.show(m.latest('waist')?.value, 'length', 1)}</div>
          <div>Sleep (14 d avg): <b>{fmt(m.avgWin('sleep_duration', m.today, 14), 1)} h</b> · steps <b>{fmt(m.avgWin('steps', m.today, 14))}</b></div>
        </Section>
      </div>
      <Section title="Weight trend (6 months)"><TimeChart data={weight} unit={u.label('mass')} dec={1} height={150} series={[{ key: 'w', name: 'Trend weight', type: 'line' }]} /></Section>
      <Section title="Laboratory results">
        <table className="w-full text-xs">
          <thead><tr className="border-b border-line text-left text-muted"><th className="py-1">Marker</th><th>Latest</th><th>Date</th><th>Previous</th><th>Reference</th><th>Flag</th></tr></thead>
          <tbody>{labs.map(({ k, mk, arr }) => { const l = arr.at(-1), pr = arr.at(-2); const st = m.labStatus(k, l.value); const f = (v) => fmt(mk.dim ? u.from(v, mk.dim) : v, u.dec(mk.dim, mk.dec || 0)); return (
            <tr key={k} className="border-b border-line/50"><td className="py-1 font-medium">{mk.name}</td><td><b>{f(l.value)}</b> {u.label(mk.dim, mk.unit)}</td><td>{fmtDate(l.date, 'd MMM yy')}</td><td>{pr ? f(pr.value) : '—'}</td><td>{f(mk.ref[0])}–{f(mk.ref[1])}</td><td>{st === 'out' ? '⚠ OUT' : st === 'near' ? 'borderline' : ''}{m.labDrift(k) ? ' ↗ drifting' : ''}</td></tr>); })}</tbody>
        </table>
      </Section>
      <div className="grid grid-cols-2 gap-6">
        <Section title="Family history">{(m.records.family || []).map((f) => <div key={f.id}>• {f.data.relative}: {f.data.condition}{f.data.ageOnset ? ` (onset ${f.data.ageOnset})` : ''}</div>)}</Section>
        <Section title="Flags from tracking">{m.alerts.filter((a) => a.severity !== 'info').slice(0, 6).map((a, i) => <div key={i}>• {a.title}</div>)}</Section>
      </div>
      <Section title="Questions for this visit">{(m.records.appointment || []).filter((a) => a.date >= m.today && a.data.questions).map((a) => <div key={a.id}>• {a.data.questions}</div>)}<div className="mt-6 h-16 border border-dashed border-line" /></Section>
      <p className="mt-6 text-[10px] text-muted">Self-tracked data from LifeOS Health. Home readings and wearable estimates are not clinical measurements.</p>
    </div>
  );
}
