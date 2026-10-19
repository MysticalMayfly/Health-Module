import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useState } from 'react';
import { Quote, ChevronLeft, ChevronRight } from 'lucide-react';
import { QUOTES } from '../lib/quotes.js';
import { useInterval } from './motion.jsx';

// Rotates every 10 s; a progress bar shows time until the next quote. Pauses on hover.
export default function QuoteCarousel({ interval = 10000 }) {
  const [i, setI] = useState(() => Math.floor(Math.random() * QUOTES.length));
  const [dir, setDir] = useState(1);
  const [paused, setPaused] = useState(false);
  const next = useCallback(() => { if (!paused) { setDir(1); setI((x) => (x + 1) % QUOTES.length); } }, [paused]);
  useInterval(next, interval);
  const go = (d) => { setDir(d); setI((x) => (x + d + QUOTES.length) % QUOTES.length); };
  const q = QUOTES[i];
  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl border border-line bg-card shadow-sm" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="grad-bg absolute inset-0 opacity-[0.07]" />
      <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full opacity-20 blur-2xl grad-bg" style={{ animation: 'floaty 9s ease-in-out infinite' }} />
      <div className="relative flex min-h-[92px] items-center gap-3 px-4 py-4 md:px-6">
        <motion.div animate={{ rotate: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 4 }} className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-raised text-accent sm:flex">
          <Quote size={18} />
        </motion.div>
        <div className="relative min-w-0 flex-1">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div key={i} custom={dir} initial={{ opacity: 0, x: 40 * dir, filter: 'blur(4px)' }} animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, x: -40 * dir, filter: 'blur(4px)' }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
              <p className="text-base font-medium leading-snug md:text-lg">“{q.text}”</p>
              <p className="mt-1 text-xs text-muted">— {q.by}</p>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="flex shrink-0 gap-1">
          <button onClick={() => go(-1)} className="rounded-lg p-1.5 text-muted hover:bg-raised hover:text-fg" aria-label="Previous quote"><ChevronLeft size={16} /></button>
          <button onClick={() => go(1)} className="rounded-lg p-1.5 text-muted hover:bg-raised hover:text-fg" aria-label="Next quote"><ChevronRight size={16} /></button>
        </div>
      </div>
      <div className="h-0.5 w-full bg-raised">
        <motion.div key={`${i}-${paused}`} className="grad-bg h-full" initial={{ width: '0%' }} animate={{ width: paused ? undefined : '100%' }} transition={{ duration: interval / 1000, ease: 'linear' }} />
      </div>
    </div>
  );
}
