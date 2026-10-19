import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle2, AlertTriangle, AlertOctagon, Info, CircleDot, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useId } from 'react';

export const fadeUp = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 26 } },
};
export function Stagger({ children, className = '', delay = 0, gap = 0.06 }) {
  return (
    <motion.div className={className} initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: gap, delayChildren: delay } } }}>
      {children}
    </motion.div>
  );
}

export function PageHeader({ icon: Icon, title, subtitle, children, eyebrow }) {
  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-4">
        {Icon && (
          <motion.div initial={{ rotate: -20, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 14 }}
            className="grad-bg flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg shadow-[var(--glow)]">
            <Icon size={24} />
          </motion.div>
        )}
        <div>
          {eyebrow && <div className="text-xs font-semibold uppercase tracking-wider text-muted">{eyebrow}</div>}
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-fg2">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </motion.div>
  );
}

export function Card({ children, className = '', onClick, hover = true, as, to, ...rest }) {
  const cls = `rounded-2xl border border-line bg-card p-5 shadow-sm transition-shadow ${hover ? 'card-glow' : ''} ${onClick || to ? 'cursor-pointer' : ''} ${className}`;
  const inner = (
    <motion.div variants={fadeUp} whileHover={hover ? { y: -3 } : undefined} className={cls} onClick={onClick} {...rest}>
      {children}
    </motion.div>
  );
  return to ? <Link to={to} className="block">{inner}</Link> : inner;
}

export function CardTitle({ icon: Icon, title, sub, right, className = '' }) {
  return (
    <div className={`mb-4 flex items-start justify-between gap-3 ${className}`}>
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-raised text-accent"><Icon size={17} /></div>}
        <div className="min-w-0">
          <h3 className="truncate font-semibold leading-tight">{title}</h3>
          {sub && <p className="truncate text-xs text-muted">{sub}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

export function Button({ variant = 'primary', size = 'md', icon: Icon, children, className = '', ...rest }) {
  const v = {
    primary: 'grad-bg text-white shadow-md shadow-[var(--glow)] hover:brightness-110',
    soft: 'bg-raised text-fg hover:bg-line',
    ghost: 'text-fg2 hover:bg-raised hover:text-fg',
    outline: 'border border-line text-fg hover:bg-raised',
    danger: 'bg-critical/10 text-critical hover:bg-critical/20',
  }[variant];
  const s = { sm: 'h-8 px-3 text-xs gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-6 text-base gap-2' }[size];
  return (
    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }} className={`inline-flex items-center justify-center rounded-xl font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${v} ${s} ${className}`} {...rest}>
      {Icon && <Icon size={size === 'sm' ? 14 : 16} />}
      {children}
    </motion.button>
  );
}
export function IconBtn({ icon: Icon, label, className = '', size = 18, ...rest }) {
  return (
    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} aria-label={label} title={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-fg2 transition-colors hover:bg-raised hover:text-fg ${className}`} {...rest}>
      <Icon size={size} />
    </motion.button>
  );
}

const TONES = {
  good: 'bg-good/12 text-[#0a7d0a] dark:text-good', warning: 'bg-warning/15 text-[#8a5d00] dark:text-warning', serious: 'bg-serious/15 text-[#a8471f] dark:text-serious',
  critical: 'bg-critical/12 text-critical', info: 'bg-accent/12 text-accent', neutral: 'bg-raised text-fg2', accent: 'grad-bg text-white',
};
export function Badge({ tone = 'neutral', icon: Icon, children, className = '' }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}>{Icon && <Icon size={12} />}{children}</span>;
}
const STATUS_ICON = { good: CheckCircle2, optimal: CheckCircle2, warning: AlertTriangle, near: AlertTriangle, serious: AlertOctagon, critical: AlertOctagon, out: AlertOctagon, info: Info, neutral: CircleDot };
const STATUS_LABEL = { good: 'Good', optimal: 'Optimal', warning: 'Watch', near: 'Borderline', serious: 'Elevated', critical: 'Critical', out: 'Out of range', info: 'Info', neutral: 'Unknown' };
const STATUS_TONE = { optimal: 'good', near: 'warning', out: 'critical' };
export function StatusPill({ status, label }) {
  if (!status) return <Badge tone="neutral" icon={CircleDot}>{label || 'No data'}</Badge>;
  return <Badge tone={STATUS_TONE[status] || status} icon={STATUS_ICON[status]}>{label || STATUS_LABEL[status]}</Badge>;
}

export function Tabs({ tabs, value, onChange, className = '' }) {
  const id = useId();
  return (
    <div className={`inline-flex flex-wrap gap-1 rounded-xl bg-raised p-1 ${className}`}>
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)} className={`relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${value === t.key ? 'text-fg' : 'text-muted hover:text-fg'}`}>
          {value === t.key && <motion.span layoutId={`tab-${id}`} className="absolute inset-0 rounded-lg bg-card shadow-sm" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
          <span className="relative flex items-center gap-1.5">{t.icon && <t.icon size={14} />}{t.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide, footer }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ y: 60, scale: 0.94, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 40, scale: 0.96, opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className={`relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-card p-6 shadow-2xl sm:rounded-3xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}>
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">{title}</h2>
              <IconBtn icon={X} label="Close" onClick={onClose} />
            </div>
            {children}
            {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="mb-1 block text-xs font-medium text-fg2">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}
const inputCls = 'w-full rounded-xl border border-line bg-page px-3 py-2 text-sm text-fg outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25';
export const Input = ({ className = '', ...p }) => <input className={`${inputCls} ${className}`} {...p} />;
export const Textarea = ({ className = '', ...p }) => <textarea className={`${inputCls} min-h-20 ${className}`} {...p} />;
export function Select({ options, className = '', ...p }) {
  return <select className={`${inputCls} ${className}`} {...p}>{options.map((o) => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o}</option>))}</select>;
}
export function UnitInput({ unit, className = '', ...p }) {
  return (
    <div className={`relative ${className}`}>
      <input type="number" step="any" className={`${inputCls} pr-14`} {...p} />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted">{unit}</span>
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="inline-flex items-center gap-2 text-sm" aria-pressed={checked}>
      <span className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'grad-bg' : 'bg-line'}`}>
        <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 30 }} className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${checked ? 'right-0.5' : 'left-0.5'}`} />
      </span>
      {label}
    </button>
  );
}

export function Segmented({ options, value, onChange, size = 'md' }) {
  const id = useId();
  return (
    <div className="inline-flex rounded-xl bg-raised p-1">
      {options.map(([k, label]) => (
        <button key={k} type="button" onClick={() => onChange(k)} className={`relative rounded-lg font-medium transition-colors ${size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'} ${value === k ? 'text-fg' : 'text-muted hover:text-fg'}`}>
          {value === k && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-lg bg-card shadow-sm" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
          <span className="relative">{label}</span>
        </button>
      ))}
    </div>
  );
}

export function Chip({ active, onClick, children, icon: Icon }) {
  return (
    <motion.button type="button" whileTap={{ scale: 0.94 }} onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${active ? 'border-transparent grad-bg text-white shadow-md' : 'border-line text-fg2 hover:border-accent hover:text-fg'}`}>
      {Icon && <Icon size={14} />}{children}
    </motion.button>
  );
}

export function Empty({ icon: Icon = Info, title, text, action }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 3 }} className="flex h-14 w-14 items-center justify-center rounded-2xl bg-raised text-muted"><Icon size={26} /></motion.div>
      <div className="font-medium">{title}</div>
      {text && <p className="max-w-sm text-sm text-muted">{text}</p>}
      {action}
    </motion.div>
  );
}

export function Progress({ value, max = 100, color, className = '', height = 8 }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div className={`overflow-hidden rounded-full bg-raised ${className}`} style={{ height }}>
      <motion.div className={color ? '' : 'grad-bg'} style={{ background: color, height: '100%', borderRadius: 999 }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 80, damping: 18 }} />
    </div>
  );
}

export function MoreLink({ to, children = 'Open' }) {
  return <Link to={to} className="inline-flex items-center gap-0.5 text-xs font-medium text-accent hover:underline">{children}<ChevronRight size={14} /></Link>;
}

export function Skeleton({ className = '' }) { return <div className={`shimmer rounded-xl ${className}`} />; }

export function Table({ columns, rows, empty = 'No rows yet' }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-line text-left text-xs text-muted">{columns.map((c) => <th key={c.key} className={`px-2 py-2 font-medium ${c.right ? 'text-right' : ''}`}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <motion.tr key={r.id ?? i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.02, 0.4) }} className="border-b border-line/60 last:border-0 hover:bg-raised/50">
              {columns.map((c) => <td key={c.key} className={`px-2 py-2 ${c.right ? 'text-right tabular' : ''}`}>{c.render ? c.render(r) : r[c.key]}</td>)}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
