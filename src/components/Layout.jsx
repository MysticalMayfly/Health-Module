import { AnimatePresence, motion } from 'framer-motion';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  Sun, Moon, Mountain, Layers, Utensils, Scale, BedDouble, Dumbbell, Ruler, HeartPulse, ClipboardCheck, CalendarCheck, BatteryCharging,
  Salad, Sparkles, FlaskConical, Trophy, TestTube2, Stethoscope, ListChecks, PlugZap, SlidersHorizontal, Settings, Plus, Menu, X,
  PanelLeftClose, PanelLeftOpen, Activity, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { useTheme } from '../lib/theme.jsx';
import { useData } from '../lib/store.jsx';
import { zoneOf } from '../lib/journey.js';
import { fmtDate, todayISO } from '../lib/format.js';
import QuickLog from './QuickLog.jsx';
import { DEFAULT_REMINDERS } from '../pages/Actions.jsx';
import { STATUS } from '../lib/theme.jsx';

export const NAV = [
  { group: 'Overview', items: [
    { to: '/', label: 'Today', icon: Sun, end: true },
    { to: '/journey', label: 'Journey 198', icon: Mountain },
    { to: '/iceberg', label: 'Iceberg & the 99', icon: Layers },
  ] },
  { group: 'Track', items: [
    { to: '/food', label: 'Food log', icon: Utensils },
    { to: '/weight', label: 'Weight & energy', icon: Scale },
    { to: '/sleep', label: 'Sleep', icon: BedDouble },
    { to: '/training', label: 'Training', icon: Dumbbell },
    { to: '/body', label: 'Body composition', icon: Ruler },
    { to: '/vitals', label: 'Vitals', icon: HeartPulse },
    { to: '/checkin', label: 'Check-in & symptoms', icon: ClipboardCheck },
  ] },
  { group: 'Insights', items: [
    { to: '/weekly', label: 'Weekly review', icon: CalendarCheck },
    { to: '/recovery', label: 'Recovery', icon: BatteryCharging },
    { to: '/nutrition', label: 'Nutrition quality', icon: Salad },
    { to: '/correlations', label: 'Correlations lab', icon: Sparkles },
    { to: '/experiments', label: 'Experiments', icon: FlaskConical },
    { to: '/annual', label: 'Annual report', icon: Trophy },
  ] },
  { group: 'Medical', items: [
    { to: '/labs', label: 'Labs & biomarkers', icon: TestTube2 },
    { to: '/medical', label: 'Medical & prevention', icon: Stethoscope },
  ] },
  { group: 'System', items: [
    { to: '/actions', label: 'Actions & protocols', icon: ListChecks },
    { to: '/integrations', label: 'Integrations', icon: PlugZap },
    { to: '/metrics', label: 'Custom metrics', icon: SlidersHorizontal },
    { to: '/settings', label: 'Settings', icon: Settings },
  ] },
];

function Sidebar({ collapsed, onNavigate }) {
  const { model } = useData();
  const pos = model?.current.position ?? 0;
  const zone = zoneOf(pos);
  return (
    <div className="flex h-full flex-col">
      <Link to="/" onClick={onNavigate} className="mb-4 flex items-center gap-2.5 px-3 pt-1">
        <motion.div whileHover={{ rotate: 12, scale: 1.08 }} className="grad-bg flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-lg shadow-[var(--glow)]">
          <Activity size={20} />
        </motion.div>
        {!collapsed && <div className="leading-tight"><div className="font-bold tracking-tight">LifeOS</div><div className="text-[11px] text-muted">Health module</div></div>}
      </Link>
      <nav className="-mx-1 flex-1 space-y-4 overflow-y-auto px-1 pb-4">
        {NAV.map((g) => (
          <div key={g.group}>
            {!collapsed && <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted">{g.group}</div>}
            <div className="space-y-0.5">
              {g.items.map((it) => (
                <NavLink key={it.to} to={it.to} end={it.end} onClick={onNavigate} title={collapsed ? it.label : undefined}
                  className={({ isActive }) => `group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'text-fg' : 'text-fg2 hover:text-fg'} ${collapsed ? 'justify-center' : ''}`}>
                  {({ isActive }) => (
                    <>
                      {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-xl bg-card shadow-sm ring-1 ring-line" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
                      {isActive && <motion.span layoutId="nav-bar" className="grad-bg absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-full" />}
                      <motion.span className="relative" whileHover={{ scale: 1.15, rotate: -6 }}><it.icon size={18} className={isActive ? 'text-accent' : ''} /></motion.span>
                      {!collapsed && <span className="relative truncate">{it.label}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      {model && (
        <Link to="/journey" onClick={onNavigate} className="mt-auto block rounded-2xl border border-line bg-card p-3 transition hover:shadow-md">
          {collapsed ? (
            <div className="text-center text-sm font-bold tabular" style={{ color: STATUS[zone.status] || 'var(--accent)' }}>{pos > 0 ? '+' : ''}{pos}</div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs"><span className="text-muted">Journey position</span><span className="font-semibold">{zone.name}</span></div>
              <div className="relative mt-2 h-2 rounded-full" style={{ background: 'linear-gradient(90deg,#d03b3b,#ec835a,#fab219,#898781,#1baf7a,#0ca30c)' }}>
                <motion.div className="absolute -top-1 h-4 w-4 rounded-full border-2 border-white bg-fg shadow" initial={{ left: '50%' }} animate={{ left: `calc(${((pos + 99) / 198) * 100}% - 8px)` }} transition={{ type: 'spring', stiffness: 60, damping: 12 }} />
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-muted"><span>−99</span><span className="font-semibold text-fg tabular">{pos > 0 ? '+' : ''}{pos}</span><span>+99</span></div>
            </>
          )}
        </Link>
      )}
    </div>
  );
}

/** Fires browser notifications for reminders while the app is open (H-78). */
function useReminders(reminders) {
  useEffect(() => {
    if (!reminders?.length || typeof Notification === 'undefined') return;
    const tick = () => {
      if (Notification.permission !== 'granted') return;
      const now = new Date();
      const hhmm = now.toTimeString().slice(0, 5), day = todayISO();
      for (const r of reminders) {
        if (!r.on || r.time !== hhmm) continue;
        const dow = now.getDay(), dom = now.getDate();
        const due = r.freq === 'daily' || (r.freq === 'weekdays' && dow > 0 && dow < 6) || (r.freq === 'sunday' && dow === 0) || (r.freq === 'monthly' && dom === 1) || (r.freq === 'quarterly' && dom === 1 && now.getMonth() % 3 === 0);
        const key = `lifeos-rem-${r.id}-${day}`;
        let fired = false; try { fired = !!localStorage.getItem(key); } catch { /* storage unavailable */ }
        if (due && !fired) { new Notification('LifeOS Health', { body: r.label }); try { localStorage.setItem(key, '1'); } catch { /* ignore */ } }
      }
    };
    const t = setInterval(tick, 20000);
    return () => clearInterval(t);
  }, [reminders]);
}

export default function Layout() {
  const { mode, setMode, dark } = useTheme();
  const { toast, settings } = useData();
  useReminders(settings?.reminders || DEFAULT_REMINDERS);
  const loc = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [quick, setQuick] = useState(false);

  return (
    <div className="relative flex min-h-full">
      {/* Floating background orbs */}
      <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <div className="absolute -top-32 -left-24 h-[28rem] w-[28rem] rounded-full opacity-[0.10] blur-3xl dark:opacity-[0.14]" style={{ background: 'var(--accent)', animation: 'floaty 18s ease-in-out infinite' }} />
        <div className="absolute top-1/3 -right-32 h-[30rem] w-[30rem] rounded-full opacity-[0.09] blur-3xl dark:opacity-[0.12]" style={{ background: 'var(--accent2)', animation: 'floaty 22s ease-in-out infinite reverse' }} />
      </div>

      <motion.aside animate={{ width: collapsed ? 76 : 256 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="sticky top-0 z-20 hidden h-screen shrink-0 border-r border-line bg-page/80 p-3 backdrop-blur-xl lg:block">
        <Sidebar collapsed={collapsed} />
      </motion.aside>

      <AnimatePresence>
        {mobile && (
          <motion.div className="fixed inset-0 z-40 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobile(false)} />
            <motion.div className="absolute inset-y-0 left-0 w-72 border-r border-line bg-page p-3" initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}>
              <button className="absolute top-3 right-3 rounded-lg p-2 hover:bg-raised" onClick={() => setMobile(false)} aria-label="Close menu"><X size={18} /></button>
              <Sidebar onNavigate={() => setMobile(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-line bg-page/70 px-4 backdrop-blur-xl">
          <button className="rounded-lg p-2 hover:bg-raised lg:hidden" onClick={() => setMobile(true)} aria-label="Open menu"><Menu size={18} /></button>
          <button className="hidden rounded-lg p-2 text-fg2 hover:bg-raised lg:block" onClick={() => setCollapsed((c) => !c)} aria-label="Collapse sidebar">
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <div className="text-sm text-fg2">{fmtDate(todayISO(), 'EEEE, d MMMM yyyy')}</div>
          <div className="ml-auto flex items-center gap-1.5">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setQuick(true)}
              className="grad-bg flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-white shadow-md shadow-[var(--glow)]">
              <motion.span animate={{ rotate: quick ? 45 : 0 }}><Plus size={16} /></motion.span><span className="hidden sm:inline">Quick log</span>
            </motion.button>
            <motion.button whileTap={{ scale: 0.85, rotate: 90 }} onClick={() => setMode(dark ? 'light' : 'dark')} title={`Theme: ${mode}`} aria-label="Toggle dark mode"
              className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl text-fg2 hover:bg-raised hover:text-fg">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={dark ? 'moon' : 'sun'} initial={{ y: 20, opacity: 0, rotate: -90 }} animate={{ y: 0, opacity: 1, rotate: 0 }} exit={{ y: -20, opacity: 0, rotate: 90 }} transition={{ duration: 0.25 }}>
                  {dark ? <Moon size={18} /> : <Sun size={18} />}
                </motion.span>
              </AnimatePresence>
            </motion.button>
            <NavLink to="/settings" className="flex h-9 w-9 items-center justify-center rounded-xl text-fg2 hover:bg-raised hover:text-fg" aria-label="Settings"><Settings size={18} /></NavLink>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-8">
          <AnimatePresence mode="wait">
            <motion.div key={loc.pathname} initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <QuickLog open={quick} onClose={() => setQuick(false)} />

      <AnimatePresence>
        {toast && (
          <motion.div key={toast.id} initial={{ y: 40, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0 }}
            className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-line bg-card px-4 py-3 text-sm shadow-2xl">
            {toast.kind === 'error' ? <AlertTriangle size={18} className="text-critical" /> : <CheckCircle2 size={18} className="text-good" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
