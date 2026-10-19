import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, CheckCircle2, XCircle, HelpCircle, Bell, Trophy, Waves } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader, Card, CardTitle, Stagger, Chip, StatusPill, Badge, Segmented } from '../components/ui.jsx';
import { TimeChart } from '../components/charts.jsx';
import { AnimatedNumber } from '../components/motion.jsx';
import { useData } from '../lib/store.jsx';
import { useTheme } from '../lib/theme.jsx';
import { DOMAINS, LAYERS } from '@shared/catalog.js';

export default function Iceberg() {
  const { model: m } = useData();
  const { c } = useTheme();
  const [domain, setDomain] = useState('all');
  const [status, setStatus] = useState('all');
  const [layer, setLayer] = useState('all');
  const list = useMemo(() => m.current.factors.filter((f) => (domain === 'all' || f.domain === domain) && (layer === 'all' || f.layer === Number(layer))
    && (status === 'all' || (status === 'good' ? f.value === true : status === 'bad' ? f.value === false : f.value == null))), [m, domain, status, layer]);
  const widths = { 4: 56, 3: 72, 2: 86, 1: 100 };

  return (
    <div>
      <PageHeader icon={Layers} title="Iceberg & the 99" subtitle="Every outcome is the visible 1%. Here is everything underneath, layer by layer." />
      <Stagger className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card hover={false} className="xl:col-span-2">
          <CardTitle icon={Waves} title="The four layers" sub="Inputs drive signals, signals become markers, and markers become outcomes" />
          <div className="relative flex flex-col items-center gap-2 py-2">
            {[4, 3, 2, 1].map((L, i) => {
              const s = m.layerScores.find((x) => x.layer === L);
              const col = s.score == null ? c.muted : s.score >= 70 ? c.status.good : s.score >= 45 ? c.status.warning : c.status.critical;
              return (
                <div key={L} className="w-full">
                  {L === 3 && <div className="relative my-2 h-0.5 w-full overflow-hidden"><div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(90deg,var(--accent) 0 10px,transparent 10px 18px)', animation: 'waves 3s linear infinite', width: '200%' }} /><span className="absolute -top-2 right-0 bg-card px-1 text-[10px] text-accent">waterline</span></div>}
                  <motion.div initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} transition={{ delay: 0.15 * i, type: 'spring', stiffness: 90, damping: 16 }}
                    className="mx-auto overflow-hidden rounded-xl border border-line" style={{ width: `${widths[L]}%` }}>
                    <div className="relative p-3" style={{ background: `linear-gradient(90deg, ${col}22, transparent)` }}>
                      <div className="flex items-center justify-between gap-2">
                        <div><div className="text-sm font-semibold">{LAYERS[L].short} · {LAYERS[L].name}</div><div className="text-[11px] text-muted">{LAYERS[L].desc}</div></div>
                        <div className="text-right"><div className="text-xl font-bold tabular" style={{ color: col }}>{s.score == null ? '—' : `${s.score}%`}</div><div className="text-[10px] text-muted">{s.good}✓ {s.bad}✗ {s.unknown}?</div></div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted">Layer score = share of measured factors in that layer that are causes of health. Outcomes sit above the waterline; the 99% below is where the work happens.</p>
        </Card>
        <Card hover={false} className="xl:col-span-3">
          <CardTitle icon={Layers} title="Lag: inputs lead, markers follow" sub="Layer scores over 26 weeks. Watch L3 follow L1 weeks later." />
          <TimeChart data={m.positionHistory} height={300} unit="%" yDomain={[0, 100]} series={[
            { key: 'L1', name: 'L1 Inputs', type: 'line', color: c.series[0], width: 2.5 }, { key: 'L2', name: 'L2 Signals', type: 'line', color: c.series[2] },
            { key: 'L3', name: 'L3 Markers', type: 'line', color: c.series[6] }, { key: 'L4', name: 'L4 Outcomes', type: 'line', color: c.series[1], dashed: true },
          ]} />
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-good/10 p-3"><AnimatedNumber value={m.current.good} className="text-2xl font-bold text-[#0a7d0a] dark:text-good" /><div className="text-xs text-muted">causes of health</div></div>
            <div className="rounded-xl bg-critical/10 p-3"><AnimatedNumber value={m.current.bad} className="text-2xl font-bold text-critical" /><div className="text-xs text-muted">causes of disease</div></div>
            <div className="rounded-xl bg-raised p-3"><AnimatedNumber value={m.current.unknown} className="text-2xl font-bold" /><div className="text-xs text-muted">unknown</div></div>
          </div>
        </Card>
      </Stagger>

      <Stagger className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2" delay={0.1}>
        <Card hover={false}>
          <CardTitle icon={Bell} title="Drift alerts: the negative iceberg" sub="Moving the wrong way, often before any threshold is crossed" />
          <div className="space-y-2">
            {m.alerts.map((a, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                <Link to={a.to} className="flex items-start gap-3 rounded-xl border border-line p-3 transition hover:bg-raised">
                  <StatusPill status={a.severity} />
                  <div className="min-w-0 flex-1"><div className="text-sm font-medium">{a.title}</div><div className="text-xs text-muted">{a.detail}</div></div>
                  <Badge>{LAYERS[a.layer]?.short}</Badge>
                </Link>
              </motion.div>
            ))}
            {!m.alerts.length && <p className="text-sm text-muted">Nothing drifting. Keep stacking good days.</p>}
          </div>
        </Card>
        <Card hover={false}>
          <CardTitle icon={Trophy} title="Compounding: the positive iceberg" sub="Good days banked. The visible result comes after many of these." />
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[['Good days (≥80%)', m.goodDays], ['Action streak', m.streaks.actions80], ['7 h+ sleep streak', m.streaks.sleep7], ['Logging streak', m.streaks.logging]].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-raised p-3 text-center"><AnimatedNumber value={v} className="text-2xl font-bold grad-text" /><div className="text-[11px] text-muted">{l}</div></div>
            ))}
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            {[7, 30, 50, 100, 200, 365].map((n) => (
              <motion.span key={n} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.05 * n ** 0.5 }} className={`rounded-full px-3 py-1 text-xs font-semibold ${m.goodDays >= n ? 'grad-bg text-white shadow' : 'bg-raised text-muted'}`}>{n} days {m.goodDays >= n ? '✓' : ''}</motion.span>
            ))}
          </div>
          <div className="space-y-1.5">{m.wins.map((w) => <div key={w} className="flex items-center gap-2 rounded-xl bg-good/10 p-2 text-sm"><Trophy size={14} className="text-good" />{w}</div>)}</div>
        </Card>
      </Stagger>

      <Card hover={false} className="mt-4">
        <CardTitle icon={Layers} title="All 99 factors" sub={`${list.length} shown`} right={<Segmented size="sm" value={status} onChange={setStatus} options={[['all', 'All'], ['good', '✓ Health'], ['bad', '✗ Disease'], ['unknown', '? Unknown']]} />} />
        <div className="mb-3 flex flex-wrap gap-2">
          <Chip active={domain === 'all'} onClick={() => setDomain('all')}>All domains</Chip>
          {Object.entries(DOMAINS).map(([k, d]) => <Chip key={k} active={domain === k} onClick={() => setDomain(k)}>{d.name}</Chip>)}
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          <Chip active={layer === 'all'} onClick={() => setLayer('all')}>All layers</Chip>
          {[1, 2, 3, 4].map((L) => <Chip key={L} active={layer === String(L)} onClick={() => setLayer(String(L))}>{LAYERS[L].short} {LAYERS[L].name}</Chip>)}
        </div>
        <motion.div layout className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence>
            {list.map((f) => (
              <motion.div key={f.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                className={`flex items-start gap-2.5 rounded-xl border p-3 text-sm ${f.value === true ? 'border-good/30 bg-good/5' : f.value === false ? 'border-critical/30 bg-critical/5' : 'border-line'}`}>
                {f.value === true ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-good" /> : f.value === false ? <XCircle size={17} className="mt-0.5 shrink-0 text-critical" /> : <HelpCircle size={17} className="mt-0.5 shrink-0 text-muted" />}
                <div className="min-w-0 flex-1">
                  <div className="font-medium leading-snug">{f.label}</div>
                  <div className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] text-muted"><span>{LAYERS[f.layer].short}</span>·<span>{DOMAINS[f.domain]?.name}</span>{f.detail && <><span>·</span><span className="font-medium text-fg2">{f.detail}</span></>}</div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </Card>
    </div>
  );
}
