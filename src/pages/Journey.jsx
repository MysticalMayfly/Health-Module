import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mountain, Target, Lock, Unlock, ArrowRight, Microscope, TrendingUp, CheckCircle2, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader, Card, CardTitle, Stagger, Button, Modal, Badge, StatusPill, Progress } from '../components/ui.jsx';
import IcebergSpectrum from '../components/IcebergSpectrum.jsx';
import { TimeChart, RadarView, BarList } from '../components/charts.jsx';
import { AnimatedNumber } from '../components/motion.jsx';
import { useData } from '../lib/store.jsx';
import { useTheme } from '../lib/theme.jsx';
import { api } from '../lib/api.js';
import { ZONES, zoneOf, PHASES, suggestedPhase, nextPhaseActions } from '../lib/journey.js';
import { DOMAINS, LAYERS } from '@shared/catalog.js';
import { fmt, todayISO } from '../lib/format.js';

const MEASURE_HINT = { sleep: 'Log sleep or connect a wearable', nutrition: 'Log food for 4+ days', movement: 'Run the fitness test battery (Training)', recovery: 'Connect a wearable for HRV/RHR', body: 'Take tape measurements', metabolic: 'Log BP, glucose, or add a blood panel', mind: 'Do the daily check-in & monthly questionnaires', medical: 'Add screenings, vaccinations & labs', substances: 'Log alcohol / caffeine' };

export default function Journey() {
  const { model: m, refresh, notify } = useData();
  const { c } = useTheme();
  const [unlock, setUnlock] = useState(null);
  const [picked, setPicked] = useState([]);
  const cur = m.current;
  const zone = zoneOf(cur.position);
  const adh = m.adherence(todayISO(), 14) ?? 0;
  const phaseNow = Math.max(1, ...m.actions.map((a) => a.phase || 1));
  const sug = suggestedPhase(cur.position, adh);
  const bad = cur.factors.filter((f) => f.value === false).sort((a, b) => a.layer - b.layer);
  const unknownByDomain = Object.entries(cur.factors.filter((f) => f.value == null).reduce((o, f) => ((o[f.domain] = (o[f.domain] || 0) + 1), o), {})).sort((a, b) => b[1] - a[1]);
  const start = m.settings.onboarding?.startPosition;

  const openUnlock = (p) => { const opts = nextPhaseActions(p, m.actions.map((a) => a.key), m.answers, m.profile); setUnlock({ phase: p, opts }); setPicked(opts.slice(0, 3).map((o) => o.key)); };
  const doUnlock = async () => {
    const rows = unlock.opts.filter((o) => picked.includes(o.key)).map((o, i) => ({ key: o.key, title: o.title, domain: o.domain, layer: 1, phase: o.phase, auto: o.auto, why: o.why, sort: 100 + i, created: todayISO() }));
    if (rows.length) await api.add('actions', rows);
    setUnlock(null); await refresh(); notify(`Phase ${unlock.phase} unlocked: ${rows.length} new daily actions`);
  };

  const zoneAreas = ZONES.map((z) => ({ y1: z.from, y2: z.to, color: { critical: c.status.critical, serious: c.status.serious, warning: c.status.warning, neutral: c.muted, good: c.status.good }[z.status] }));

  return (
    <div>
      <PageHeader icon={Mountain} title="The 198 journey" subtitle="From the 1% disease tip, through 99 causes of disease and 99 causes of health, to the 1% pinnacle." />
      <Stagger className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-2" hover={false}>
          <CardTitle icon={Target} title="Where you stand" sub="Position = health causes in place − disease causes active" />
          <IcebergSpectrum position={cur.position} good={cur.good} bad={cur.bad} unknown={cur.unknown} />
        </Card>
        <div className="space-y-4 xl:col-span-3">
          <Card hover={false}>
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted">Current zone</div>
                <div className="mt-1 flex items-center gap-2 text-2xl font-bold">{zone.name} <StatusPill status={zone.status === 'neutral' ? 'info' : zone.status} label={`${zone.from} to ${zone.to > 0 ? '+' : ''}${zone.to}`} /></div>
                <p className="mt-1 max-w-md text-sm text-fg2">{zone.desc}</p>
              </div>
              <div className="ml-auto grid grid-cols-3 gap-4 text-center">
                <div><AnimatedNumber value={cur.position} className="text-3xl font-bold grad-text" prefix={cur.position > 0 ? '+' : ''} /><div className="text-xs text-muted">position</div></div>
                <div><AnimatedNumber value={start != null ? cur.position - start : null} className="text-3xl font-bold" prefix={start != null && cur.position - start > 0 ? '+' : ''} /><div className="text-xs text-muted">since start</div></div>
                <div><AnimatedNumber value={99 - cur.position} className="text-3xl font-bold" /><div className="text-xs text-muted">to pinnacle</div></div>
              </div>
            </div>
          </Card>
          <Card hover={false}>
            <CardTitle icon={TrendingUp} title="Position over time" sub="Weekly snapshots of the 99 factors · zone bands shaded" />
            <TimeChart data={m.positionHistory} height={230} yDomain={[-99, 99]} refAreas={zoneAreas} refLines={[{ y: 0, label: 'waterline' }]} series={[{ key: 'position', name: 'Position', type: 'line', dot: true, width: 3 }]} />
          </Card>
        </div>
      </Stagger>

      <Stagger className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-4" delay={0.1}>
        {[1, 2, 3, 4].map((p) => {
          const active = p <= phaseNow, isNext = p === phaseNow + 1;
          return (
            <Card key={p} hover={false} className={`relative overflow-hidden ${p === phaseNow ? 'ring-2 ring-accent' : ''}`}>
              {p === phaseNow && <motion.div className="grad-bg absolute inset-x-0 top-0 h-1" layoutId="phase-bar" />}
              <div className="flex items-center justify-between">
                <Badge tone={active ? 'accent' : 'neutral'} icon={active ? Unlock : Lock}>Phase {p}</Badge>
                {p === sug && <Badge tone="info">suggested</Badge>}
              </div>
              <div className="mt-3 text-lg font-bold">{PHASES[p].name}</div>
              <p className="mt-1 text-sm text-fg2">{PHASES[p].desc}</p>
              <div className="mt-3 text-xs text-muted">{m.actions.filter((a) => a.phase === p).length} actions active</div>
              {isNext && (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-muted"><span>14-day adherence</span><span>{fmt(adh)}% / 80%</span></div>
                  <Progress value={adh} max={80} />
                  <Button size="sm" className="mt-3 w-full" variant={adh >= 80 ? 'primary' : 'soft'} icon={Unlock} onClick={() => openUnlock(p)}>{adh >= 80 ? 'Unlock phase' : 'Unlock early'}</Button>
                </div>
              )}
            </Card>
          );
        })}
      </Stagger>

      <Stagger className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3" delay={0.2}>
        <Card hover={false} className="lg:col-span-2">
          <CardTitle icon={XCircle} title="Biggest levers: disease causes active" sub="Inputs (L1) first, because they are fully in your control" right={<Link to="/iceberg" className="text-xs text-accent hover:underline">All 99 →</Link>} />
          <div className="grid gap-2 sm:grid-cols-2">
            {bad.slice(0, 12).map((f, i) => (
              <motion.div key={f.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="flex items-start gap-2 rounded-xl border border-line p-2.5 text-sm">
                <XCircle size={16} className="mt-0.5 shrink-0 text-critical" />
                <div className="min-w-0"><div className="font-medium leading-snug">{f.label}</div><div className="text-xs text-muted">{LAYERS[f.layer].short} · {DOMAINS[f.domain]?.name}{f.detail ? ` · now ${f.detail}` : ''}</div></div>
              </motion.div>
            ))}
            {!bad.length && <p className="text-sm text-muted">No active disease causes detected. 🎉</p>}
          </div>
        </Card>
        <Card hover={false}>
          <CardTitle icon={Microscope} title="Measure to reveal" sub={`${cur.unknown} factors unknown. Your true position may differ.`} />
          <div className="space-y-2">
            {!unknownByDomain.length && <p className="rounded-xl bg-good/10 p-3 text-sm">Every one of the 99 factors is measured. Your position reflects your data, not guesses. 🎯</p>}
            {unknownByDomain.map(([d, n]) => (
              <div key={d} className="rounded-xl bg-raised p-2.5 text-sm">
                <div className="flex justify-between font-medium"><span>{DOMAINS[d]?.name}</span><span className="tabular">{n}</span></div>
                <div className="text-xs text-muted">{MEASURE_HINT[d]}</div>
              </div>
            ))}
          </div>
        </Card>
      </Stagger>

      <Stagger className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2" delay={0.3}>
        <Card hover={false}>
          <CardTitle icon={CheckCircle2} title="Domain balance" sub="% of evaluated factors in place, by domain" />
          <RadarView data={m.domainScores.filter((d) => d.score != null).map((d) => ({ name: DOMAINS[d.domain]?.name, score: d.score }))} />
        </Card>
        <Card hover={false}>
          <CardTitle icon={CheckCircle2} title="Causes by domain" sub="Health causes in place (green) vs disease causes active (red)" />
          <BarList data={m.domainScores.map((d) => ({ name: DOMAINS[d.domain]?.name, value: d.good - d.bad }))} unit=" net" cellColor={(d) => (d.value >= 0 ? c.status.good : c.status.critical)} refLine={0} />
        </Card>
      </Stagger>

      <Modal open={!!unlock} onClose={() => setUnlock(null)} title={unlock ? `Unlock Phase ${unlock.phase}: ${PHASES[unlock.phase].name}` : ''}
        footer={<><Button variant="ghost" onClick={() => setUnlock(null)}>Cancel</Button><Button icon={ArrowRight} onClick={doUnlock}>Add {picked.length} actions</Button></>}>
        <p className="mb-3 text-sm text-fg2">Pick 2–3 actions. Adding too many at once is the most common reason habits fail.</p>
        <div className="space-y-2">
          {unlock?.opts.map((o) => (
            <button key={o.key} onClick={() => setPicked((p) => (p.includes(o.key) ? p.filter((k) => k !== o.key) : [...p, o.key]))}
              className={`w-full rounded-xl border p-3 text-left transition ${picked.includes(o.key) ? 'border-accent bg-accent/10' : 'border-line hover:bg-raised'}`}>
              <div className="flex items-center justify-between text-sm font-medium">{o.title}<Badge>{DOMAINS[o.domain]?.name}</Badge></div>
              <div className="mt-0.5 text-xs text-muted">{o.why}</div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
