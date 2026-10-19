import { animate, motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fmt } from '../lib/format.js';
import { fadeUp } from './ui.jsx';
import { Sparkline } from './charts.jsx';

export function AnimatedNumber({ value, dec = 0, className = '', prefix = '', suffix = '' }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => `${prefix}${fmt(v, dec)}${suffix}`);
  useEffect(() => {
    if (value == null || Number.isNaN(value)) return;
    const c = animate(mv, value, { duration: 1.1, ease: [0.16, 1, 0.3, 1] });
    return c.stop;
  }, [value, mv]);
  if (value == null || Number.isNaN(value)) return <span className={className}>—</span>;
  return <motion.span className={`tabular ${className}`}>{text}</motion.span>;
}

/** Animated progress ring. value 0–1. */
export function Ring({ value = 0, size = 120, stroke = 10, color, track, children, gradient = true, id = 'ring' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {gradient && (
          <defs>
            <linearGradient id={`g-${id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--accent)" /><stop offset="100%" stopColor="var(--accent2)" />
            </linearGradient>
          </defs>
        )}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track || 'var(--raised)'} strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color || `url(#g-${id})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - v) }} transition={{ type: 'spring', stiffness: 40, damping: 14 }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/** Small burst of particles — fired when the day's actions hit 100%. */
export function Burst({ show }) {
  const parts = Array.from({ length: 18 });
  return (
    <AnimatePresence>
      {show && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {parts.map((_, i) => {
            const a = (i / parts.length) * Math.PI * 2;
            return (
              <motion.span key={i} className="absolute h-2 w-2 rounded-full" style={{ background: i % 2 ? 'var(--accent)' : 'var(--accent2)' }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }} animate={{ x: Math.cos(a) * 90, y: Math.sin(a) * 90, opacity: 0, scale: 0.4 }} exit={{ opacity: 0 }}
                transition={{ duration: 1, ease: 'easeOut' }} />
            );
          })}
        </div>
      )}
    </AnimatePresence>
  );
}

/** KPI tile with animated value, delta and optional sparkline. */
export function StatTile({ icon: Icon, label, value, dec = 0, unit, delta, deltaDec = 1, goodWhen = 'up', spark, sparkColor, to, sub, tone }) {
  const dir = delta == null || Math.abs(delta) < 1e-9 ? 0 : delta > 0 ? 1 : -1;
  const good = dir === 0 ? null : (goodWhen === 'up' ? dir > 0 : goodWhen === 'down' ? dir < 0 : null);
  const DIcon = dir > 0 ? ArrowUpRight : dir < 0 ? ArrowDownRight : Minus;
  const body = (
    <motion.div variants={fadeUp} whileHover={{ y: -4 }} className="card-glow relative h-full overflow-hidden rounded-2xl border border-line bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-fg2">
          {Icon && <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-raised text-accent"><Icon size={15} /></span>}
          <span className="truncate">{label}</span>
        </div>
        {delta != null && (
          <span className={`inline-flex shrink-0 items-center text-xs font-semibold ${good === true ? 'text-[#0a7d0a] dark:text-good' : good === false ? 'text-critical' : 'text-muted'}`}>
            <DIcon size={14} />{fmt(Math.abs(delta), deltaDec)}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <AnimatedNumber value={value} dec={dec} className={`text-2xl font-bold tracking-tight ${tone === 'grad' ? 'grad-text' : ''}`} />
        {unit && <span className="text-sm text-muted">{unit}</span>}
      </div>
      {sub && <div className="mt-0.5 truncate text-xs text-muted">{sub}</div>}
      {spark && spark.length > 1 && <div className="mt-2 -mb-1 h-9"><Sparkline data={spark} color={sparkColor} /></div>}
    </motion.div>
  );
  return to ? <Link to={to} className="block h-full">{body}</Link> : body;
}

/** Typewriter-free rotating text with crossfade. */
export function useInterval(cb, ms) {
  useEffect(() => { const t = setInterval(cb, ms); return () => clearInterval(t); }, [cb, ms]);
}

export function Pulse({ color = 'var(--accent2)' }) {
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      <motion.span className="absolute inline-flex h-full w-full rounded-full" style={{ background: color }} animate={{ scale: [1, 2.2], opacity: [0.6, 0] }} transition={{ repeat: Infinity, duration: 1.6 }} />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: color }} />
    </span>
  );
}

export function useMounted(delay = 0) {
  const [m, setM] = useState(false);
  useEffect(() => { const t = setTimeout(() => setM(true), delay); return () => clearTimeout(t); }, [delay]);
  return m;
}
