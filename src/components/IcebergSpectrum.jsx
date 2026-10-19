import { motion } from 'framer-motion';
import { useTheme } from '../lib/theme.jsx';
import { ZONES, zoneOf } from '../lib/journey.js';

/**
 * The 198 spectrum: two mirrored icebergs. The lower berg's tip is disease (1%) with 99 causes stacked above it;
 * the upper berg's tip is the pinnacle (1%) with 99 causes of health beneath it. The waterline (0) sits between them.
 * A marker rides the axis at the person's position (good − bad factors).
 */
export default function IcebergSpectrum({ position = 0, good = 0, bad = 0, unknown = 0, height = 420, compact = false }) {
  const { c, dark } = useTheme();
  const W = 340, H = height, mid = H / 2, top = 18, bot = H - 18;
  const y = (p) => mid - (p / 99) * (mid - top);
  const zone = zoneOf(position);
  const zc = { critical: c.status.critical, serious: c.status.serious, warning: c.status.warning, neutral: c.muted, good: c.status.good };
  const healthFill = dark ? ['#0f3b2c', '#199e70'] : ['#d6f3e8', '#1baf7a'];
  const diseaseFill = dark ? ['#4a1d1d', '#e66767'] : ['#fbe1e0', '#e34948'];
  const cx = W / 2;
  return (
    <div className="relative mx-auto w-full" style={{ maxWidth: W + 150 }}>
      <svg viewBox={`0 0 ${W + 150} ${H}`} className="w-full">
        <defs>
          <linearGradient id="hb" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor={healthFill[0]} /><stop offset="100%" stopColor={healthFill[1]} /></linearGradient>
          <linearGradient id="db" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={diseaseFill[0]} /><stop offset="100%" stopColor={diseaseFill[1]} /></linearGradient>
          <linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" /><stop offset="100%" stopColor="var(--accent)" stopOpacity="0" /></linearGradient>
          <clipPath id="axisclip"><rect x="0" y="0" width={W + 150} height={H} /></clipPath>
        </defs>
        {/* Upper iceberg: causes of health → pinnacle */}
        <motion.path initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 1.4, ease: 'easeOut' }}
          d={`M ${cx - 140} ${mid - 4} L ${cx - 110} ${mid - 60} L ${cx - 85} ${mid - 70} L ${cx - 60} ${mid - 120} L ${cx - 30} ${mid - 140} L ${cx - 6} ${top + 4} L ${cx + 8} ${top} L ${cx + 30} ${mid - 130} L ${cx + 70} ${mid - 110} L ${cx + 95} ${mid - 64} L ${cx + 140} ${mid - 4} Z`}
          fill="url(#hb)" stroke={healthFill[1]} strokeWidth="1.5" />
        {/* Lower iceberg: causes of disease → disease tip */}
        <motion.path initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 1.4, ease: 'easeOut', delay: 0.2 }}
          d={`M ${cx - 140} ${mid + 4} L ${cx - 100} ${mid + 66} L ${cx - 70} ${mid + 76} L ${cx - 46} ${mid + 128} L ${cx - 20} ${mid + 142} L ${cx - 4} ${bot} L ${cx + 10} ${bot - 4} L ${cx + 36} ${mid + 132} L ${cx + 64} ${mid + 104} L ${cx + 100} ${mid + 70} L ${cx + 140} ${mid + 4} Z`}
          fill="url(#db)" stroke={diseaseFill[1]} strokeWidth="1.5" />
        {/* Waterline with drifting waves */}
        <g clipPath="url(#axisclip)">
          <rect x="0" y={mid} width={W + 150} height={40} fill="url(#water)" />
          <g style={{ animation: 'waves 6s linear infinite' }}>
            <path d={Array.from({ length: 20 }, (_, i) => `${i === 0 ? 'M' : 'Q'} ${i * 40} ${mid + (i % 2 ? -5 : 5)} ${i * 40 + 20} ${mid}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth="1.5" opacity="0.6" />
          </g>
        </g>
        {/* Labels */}
        <text x={cx + 18} y={top + 10} fontSize="11" fontWeight="700" fill={c.fg}>1% PINNACLE</text>
        <text x={cx + 18} y={bot - 2} fontSize="11" fontWeight="700" fill={c.fg}>1% DISEASE</text>
        {!compact && <>
          <text x={cx} y={mid - 40} fontSize="10.5" textAnchor="middle" fill={dark ? '#c9f1e2' : '#0b4f39'} fontWeight="600">99 causes of health</text>
          <text x={cx} y={mid + 52} fontSize="10.5" textAnchor="middle" fill={dark ? '#ffd9d9' : '#7a1f1f'} fontWeight="600">99 causes of disease</text>
        </>}
        <text x="6" y={mid - 6} fontSize="10" fill={c.muted}>waterline 0</text>
        {/* Zone axis on the right */}
        {ZONES.map((z) => (
          <g key={z.key}>
            <rect x={W + 52} y={y(z.to)} width="8" height={Math.max(1, y(z.from) - y(z.to))} rx="3" fill={zc[z.status]} opacity="0.9" />
            {!compact && <text x={W + 66} y={(y(z.to) + y(z.from)) / 2 + 3} fontSize="9.5" fill={c.fg2}>{z.name}</text>}
          </g>
        ))}
        {/* Position marker */}
        <motion.g initial={{ y: 0 }} animate={{ y: y(position) - mid }} transition={{ type: 'spring', stiffness: 40, damping: 9, delay: 0.5 }}>
          <line x1={cx - 150} x2={W + 60} y1={mid} y2={mid} stroke={zc[zone.status]} strokeWidth="2" strokeDasharray="5 4" />
          <motion.circle cx={W + 56} cy={mid} r="9" fill={zc[zone.status]} stroke={c.card} strokeWidth="3"
            animate={{ scale: [1, 1.25, 1] }} transition={{ repeat: Infinity, duration: 2 }} style={{ transformOrigin: `${W + 56}px ${mid}px` }} />
          <rect x={cx - 150} y={mid - 13} width="62" height="26" rx="8" fill={c.card} stroke={zc[zone.status]} strokeWidth="2" />
          <text x={cx - 119} y={mid + 5} fontSize="14" fontWeight="800" textAnchor="middle" fill={c.fg}>{position > 0 ? '+' : ''}{position}</text>
        </motion.g>
      </svg>
      {!compact && (
        <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl bg-good/10 py-2"><div className="text-lg font-bold text-[#0a7d0a] dark:text-good tabular">{good}</div>health causes in place</div>
          <div className="rounded-xl bg-critical/10 py-2"><div className="text-lg font-bold text-critical tabular">{bad}</div>disease causes active</div>
          <div className="rounded-xl bg-raised py-2"><div className="text-lg font-bold tabular">{unknown}</div>unknown: measure them</div>
        </div>
      )}
    </div>
  );
}
