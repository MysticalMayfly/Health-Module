import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Zap, Flame, Beef, Droplets, Footprints, BedDouble, Scale, Pill, Bell, Trophy, ChevronLeft, ChevronRight, Info, Sparkles, Mountain } from 'lucide-react';
import { Link } from 'react-router-dom';
import QuoteCarousel from '../components/QuoteCarousel.jsx';
import { Card, CardTitle, Stagger, StatusPill, Badge, MoreLink, Empty, Progress } from '../components/ui.jsx';
import { Ring, StatTile, AnimatedNumber, Burst } from '../components/motion.jsx';
import { TimeChart, Gauge, Sparkline } from '../components/charts.jsx';
import { useData } from '../lib/store.jsx';
import { useTheme } from '../lib/theme.jsx';
import { api } from '../lib/api.js';
import { addDays, todayISO, fmtDay, fmt, fmtHours, lastNDays } from '../lib/format.js';
import { zoneOf, PHASES } from '../lib/journey.js';
import { DOMAINS } from '@shared/catalog.js';

export default function Today() {
  const { model: m, refresh, u, notify } = useData();
  const { c } = useTheme();
  const [date, setDate] = useState(todayISO());
  const [burst, setBurst] = useState(false);
  const isToday = date === todayISO();
  const actions = m.actionsOn(date);
  const done = actions.filter((a) => m.actionDone(a, date)).length;
  const pct = actions.length ? done / actions.length : 0;
  const food = m.foodByDate[date] || {};
  const zone = zoneOf(m.current.position);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const readiness = m.readiness[date];
  const sleep = m.sleepByDate[date];
  const meds = m.activeMeds.filter((x) => !x.date || x.date <= date);

  const toggle = async (a) => {
    const was = m.actionDone(a, date);
    await api.add('action_logs', { date, action_id: a.id, done: !was });
    await refresh();
    if (!was && done + 1 === actions.length) { setBurst(true); notify('All daily actions complete. Another step up the iceberg 🎉'); setTimeout(() => setBurst(false), 1200); }
  };
  const toggleMed = async (r) => { await api.add('med_logs', { date, record_id: r.id, done: !m.medLog[`${date}|${r.id}`] }); await refresh(); };

  const last14 = lastNDays(14, date).map((d) => ({ date: d, intake: m.foodByDate[d]?.kcal ?? null, target: m.targets.kcal }));

  return (
    <div>
      {m.prefs.showQuotes !== false && <QuoteCarousel />}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-3xl font-bold tracking-tight">{greet}{m.profile.name ? `, ${m.profile.name.split(' ')[0]}` : ''} <motion.span className="inline-block" animate={{ rotate: [0, 18, -8, 18, 0] }} transition={{ delay: 0.6, duration: 1.2 }}>👋</motion.span></h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-fg2">
            You are in <StatusPill status={zone.status === 'neutral' ? 'info' : zone.status} label={zone.name} /> at <b className="tabular text-fg">{m.current.position > 0 ? '+' : ''}{m.current.position}</b> on the 198 journey.
          </p>
        </motion.div>
        <div className="flex items-center gap-1 rounded-xl border border-line bg-card p-1">
          <button className="rounded-lg p-1.5 hover:bg-raised" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day"><ChevronLeft size={16} /></button>
          <span className="min-w-28 text-center text-sm font-medium">{isToday ? 'Today' : fmtDay(date)}</span>
          <button className="rounded-lg p-1.5 hover:bg-raised disabled:opacity-30" disabled={isToday} onClick={() => setDate(addDays(date, 1))} aria-label="Next day"><ChevronRight size={16} /></button>
        </div>
      </div>

      <Stagger className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Daily actions */}
        <Card className="relative lg:col-span-2" hover={false}>
          <CardTitle icon={Zap} title="Daily action items" sub={`Your onboarding plan · Phase ${Math.max(1, ...actions.map((a) => a.phase || 1))}: ${PHASES[Math.max(1, ...actions.map((a) => a.phase || 1))].name}`} right={<MoreLink to="/actions">Manage</MoreLink>} />
          {!actions.length ? <Empty icon={Zap} title="No actions yet" text="Finish onboarding or add actions to start climbing." /> : (
            <div className="flex flex-col gap-5 md:flex-row">
              <div className="relative flex shrink-0 flex-col items-center justify-center">
                <Ring value={pct} size={150} stroke={13} id="today">
                  <AnimatedNumber value={pct * 100} className="text-3xl font-bold" suffix="%" />
                  <span className="text-xs text-muted">{done} / {actions.length} done</span>
                </Ring>
                <Burst show={burst} />
                <div className="mt-3 flex gap-3 text-center text-xs text-muted">
                  <div><div className="text-base font-bold text-fg tabular">{m.streaks.actions80}</div>day streak</div>
                  <div><div className="text-base font-bold text-fg tabular">{fmt(m.adherence(date, 7))}%</div>7-day avg</div>
                  <div><div className="text-base font-bold text-fg tabular">{m.goodDays}</div>good days</div>
                </div>
              </div>
              <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                {actions.map((a, i) => {
                  const ok = m.actionDone(a, date);
                  return (
                    <motion.button key={a.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.98 }}
                      onClick={() => toggle(a)} title={a.why}
                      className={`group flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${ok ? 'border-transparent bg-good/10' : 'border-line hover:bg-raised'}`}>
                      <motion.span animate={ok ? { scale: [1, 1.3, 1] } : {}} className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${ok ? 'border-good bg-good text-white' : 'border-line'}`}>
                        <AnimatePresence>{ok && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Check size={13} strokeWidth={3} /></motion.span>}</AnimatePresence>
                      </motion.span>
                      <span className="min-w-0">
                        <span className={`block text-sm font-medium ${ok ? 'text-fg2 line-through decoration-good/60' : ''}`}>{a.title}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                          {DOMAINS[a.domain]?.name}{a.auto && <Badge tone="info" className="!py-0 !text-[10px]">auto-checked</Badge>}
                        </span>
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        {/* Readiness + journey */}
        <Card hover={false}>
          <CardTitle icon={Sparkles} title="Readiness" sub="HRV, resting HR, sleep, soreness" right={<MoreLink to="/recovery">Details</MoreLink>} />
          <Gauge value={readiness} label={readiness == null ? 'No wearable data' : readiness >= 75 ? 'Push: go for a hard session' : readiness >= 50 ? 'Maintain: train as planned' : 'Recover: easy movement only'} />
          <Link to="/journey" className="mt-4 block rounded-xl bg-raised p-3 transition hover:bg-line">
            <div className="flex items-center justify-between text-xs text-muted"><span className="flex items-center gap-1"><Mountain size={13} /> Journey (26 weeks)</span><b className="text-fg">{m.current.good} good · {m.current.bad} bad</b></div>
            <div className="mt-1 h-12"><Sparkline data={m.positionHistory.map((p) => p.position)} color={c.series[2]} /></div>
          </Link>
        </Card>
      </Stagger>

      <Stagger className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6" delay={0.15}>
        {m.prefs.hideCalories
          ? <StatTile icon={Flame} label="Meals logged" value={(m.foodByDate[date]?.items) || 0} unit="items" sub="Calories hidden (Settings)" to="/food" />
          : <StatTile icon={Flame} label={m.targets.kcal >= (food.kcal || 0) ? 'Calories left' : 'Calories over'} value={Math.abs(m.targets.kcal - (food.kcal || 0))} unit="kcal" sub={`${fmt(food.kcal || 0)} of ${fmt(m.targets.kcal)} eaten`} to="/food" />}
        <StatTile icon={Beef} label="Protein" value={food.protein || 0} unit={`/ ${m.targets.protein} g`} sub={`${Math.round(((food.protein || 0) / m.targets.protein) * 100)}% of target`} to="/food" />
        <StatTile icon={Droplets} label="Water" value={(m.series('water')[date] || 0) / 1000} dec={1} unit={`/ ${(m.targets.water / 1000).toFixed(1)} L`} to="/food" />
        <StatTile icon={Footprints} label="Steps" value={m.series('steps')[date] || 0} sub={`Goal ${fmt(m.targets.steps)}`} spark={lastNDays(14, date).map((d) => m.series('steps')[d] ?? null)} sparkColor={c.series[2]} to="/training" />
        <StatTile icon={BedDouble} label="Sleep last night" value={sleep?.duration} dec={1} unit="h" sub={sleep ? `Quality ${sleep.quality ?? '—'}/5 · ${sleep.efficiency ?? '—'}% eff.` : 'Not logged'} to="/sleep" />
        <StatTile icon={Scale} label="Trend" value={u.from(m.trend[date], 'mass')} dec={1} unit={u.label('mass')} delta={m.weeklyRate != null ? u.from(m.weeklyRate, 'mass') : null} deltaDec={2} goodWhen={m.direction < 0 ? 'down' : m.direction > 0 ? 'up' : 'none'} sub="per week" to="/weight" />
      </Stagger>

      <Stagger className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3" delay={0.25}>
        <Card hover={false} className={`lg:col-span-2 ${m.prefs.hideCalories ? 'hidden' : ''}`}>
          <CardTitle icon={Flame} title="Energy balance: last 14 days" sub={`Target ${fmt(m.targets.kcal)} kcal · TDEE ${fmt(m.tdee)} (${m.tdeeSource})`} right={<MoreLink to="/weight">Weight & energy</MoreLink>} />
          <TimeChart data={last14} unit="kcal" height={210} series={[{ key: 'intake', name: 'Logged intake', type: 'bar', cells: (d) => (d.intake == null ? null : Math.abs(d.intake - m.targets.kcal) <= m.targets.kcal * 0.1 ? c.series[2] : d.intake > m.targets.kcal ? c.series[1] : c.series[0]) }, { key: 'target', name: 'Target', type: 'line', color: c.muted, dashed: true }]} />
          <p className="mt-1 text-xs text-muted">Bars: aqua = within ±10% of target · orange = over · blue = under.</p>
        </Card>
        <div className="space-y-4">
          <Card hover={false}>
            <CardTitle icon={Pill} title="Meds & supplements" sub={meds.length ? `${meds.filter((x) => m.medLog[`${date}|${x.id}`]).length}/${meds.length} taken` : 'None scheduled'} right={<MoreLink to="/medical">Manage</MoreLink>} />
            <div className="space-y-1.5">
              {meds.map((r) => {
                const ok = !!m.medLog[`${date}|${r.id}`];
                return (
                  <motion.button key={r.id} whileTap={{ scale: 0.97 }} onClick={() => toggleMed(r)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${ok ? 'bg-good/10' : 'bg-raised hover:bg-line'}`}>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${ok ? 'border-good bg-good text-white' : 'border-line'}`}>{ok && <Check size={12} strokeWidth={3} />}</span>
                    <span className="flex-1"><b className="font-medium">{r.data.name}</b> <span className="text-muted">{r.data.dose}</span></span>
                    <span className="text-xs text-muted">{r.data.time}</span>
                  </motion.button>
                );
              })}
              {!meds.length && <p className="text-sm text-muted">Add medications or supplements under Medical.</p>}
            </div>
          </Card>
          <Card hover={false}>
            <CardTitle icon={Bell} title="Early warnings" sub="Drift caught below the waterline" right={<MoreLink to="/iceberg">All</MoreLink>} />
            <div className="space-y-2">
              {m.alerts.slice(0, 3).map((a, i) => (
                <Link key={i} to={a.to} className="flex items-start gap-2 rounded-xl p-2 text-sm transition hover:bg-raised">
                  <StatusPill status={a.severity} />
                  <span className="min-w-0 flex-1 leading-snug">{a.title}</span>
                </Link>
              ))}
              {!m.alerts.length && <p className="flex items-center gap-2 text-sm text-muted"><Info size={14} /> No drift detected.</p>}
              {m.wins.slice(0, 2).map((w) => <div key={w} className="flex items-center gap-2 rounded-xl bg-good/10 p-2 text-sm"><Trophy size={14} className="text-good" />{w}</div>)}
            </div>
          </Card>
        </div>
      </Stagger>

      <Stagger className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3" delay={0.35}>
        {[
          { label: 'Protein', v: food.protein || 0, t: m.targets.protein, unit: 'g', color: c.series[0] },
          { label: 'Fibre', v: food.fiber || 0, t: m.targets.fiber, unit: 'g', color: c.series[2] },
          { label: 'Plant servings', v: food.plant_servings || 0, t: 5, unit: '', color: c.series[5] },
        ].map((x) => (
          <Card key={x.label} hover={false} className="!p-4">
            <div className="mb-2 flex justify-between text-sm"><span className="font-medium">{x.label}</span><span className="tabular text-fg2">{fmt(x.v, x.unit ? 0 : 1)} / {x.t} {x.unit}</span></div>
            <Progress value={x.v} max={x.t} color={x.color} />
          </Card>
        ))}
      </Stagger>
    </div>
  );
}
