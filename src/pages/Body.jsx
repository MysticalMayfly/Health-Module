import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ruler, Scale, Percent, Camera, Plus, Upload, Trash2, ArrowLeftRight, Info, PersonStanding } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader, Card, CardTitle, Stagger, Button, Modal, Field, Input, Select, UnitInput, Table, Empty, Segmented, IconBtn, Badge } from '../components/ui.jsx';
import { StatTile } from '../components/motion.jsx';
import { TimeChart } from '../components/charts.jsx';
import { useData } from '../lib/store.jsx';
import { useTheme } from '../lib/theme.jsx';
import { api } from '../lib/api.js';
import { fmt, fmtDate, fmtSigned, todayISO } from '../lib/format.js';
import { METRICS, MEASURE_KEYS } from '@shared/catalog.js';

const PROTOCOL = {
  waist: 'At the navel, relaxed, after exhaling. Tape level, snug but not compressing.',
  hips: 'Widest point of the buttocks, feet together.',
  neck: 'Just below the larynx, tape sloping slightly down to the front.',
  chest: 'Across the nipples, arms relaxed, after a normal exhale.',
  arm: 'Right arm, flexed, at the peak of the biceps.',
  thigh: 'Right leg, midway between hip crease and kneecap, standing.',
  bodyfat: 'Same method, same time of day, every time (morning, fasted).',
};

/** US Navy body-fat estimate (cm). */
function navyBF({ sex, height, waist, neck, hips }) {
  if (!height || !waist || !neck) return null;
  if (sex === 'female') { if (!hips) return null; return 495 / (1.29579 - 0.35004 * Math.log10(waist + hips - neck) + 0.221 * Math.log10(height)) - 450; }
  return 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(height)) - 450;
}

function CompareSlider({ a, b }) {
  const [x, setX] = useState(50);
  return (
    <div className="relative aspect-[3/4] w-full select-none overflow-hidden rounded-xl bg-raised">
      <img src={`/uploads/${b.file}`} alt="after" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - x}% 0 0)` }}><img src={`/uploads/${a.file}`} alt="before" className="h-full w-full object-cover" /></div>
      <div className="absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${x}%` }}><div className="absolute top-1/2 left-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-lg"><ArrowLeftRight size={14} /></div></div>
      <input type="range" min="0" max="100" value={x} onChange={(e) => setX(Number(e.target.value))} className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" aria-label="Compare" />
      <span className="absolute top-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-xs text-white">{fmtDate(a.date)}</span>
      <span className="absolute top-2 right-2 rounded-md bg-black/60 px-2 py-0.5 text-xs text-white">{fmtDate(b.date)}</span>
    </div>
  );
}

export default function Body() {
  const { model: m, bundle, refresh, notify, u } = useData();
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ date: todayISO(), method: 'tape' });
  const [photoOpen, setPhotoOpen] = useState(false);
  const [pose, setPose] = useState('front');
  const [cmp, setCmp] = useState([]);
  const h = m.profile.height;
  const latest = (k) => m.latest(k);
  const waist = latest('waist'), bf = latest('bodyfat');
  const whtr = waist && h ? waist.value / h : null;
  const lean = bf && m.trendNow ? m.trendNow * (1 - bf.value / 100) : null;
  const seriesFor = (keys) => {
    const dates = [...new Set(keys.flatMap((k) => Object.keys(m.series(k))))].sort();
    return dates.map((d) => Object.fromEntries([['date', d], ...keys.map((k) => [k, m.series(k)[d] != null ? +(METRICS[k].dim ? u.from(m.series(k)[d], METRICS[k].dim) : m.series(k)[d]).toFixed(1) : null])]));
  };
  const whtrData = Object.entries(m.series('waist')).sort().map(([d, w]) => ({ date: d, whtr: h ? +(w / h).toFixed(3) : null }));
  const navy = navyBF({ sex: m.profile.sex, height: h, waist: u.to(Number(v.waist), 'length'), neck: u.to(Number(v.neck), 'length'), hips: u.to(Number(v.hips), 'length') });
  const deltas = MEASURE_KEYS.map((k) => { const arr = Object.entries(m.series(k)).sort(); return { id: k, k, name: METRICS[k].name, first: arr[0], last: arr.at(-1) }; }).filter((r) => r.last);
  const photos = (bundle.photos || []).filter((p) => p.pose === pose).sort((a, b) => a.date.localeCompare(b.date));

  const save = async () => {
    const rows = MEASURE_KEYS.filter((k) => v[k] !== undefined && v[k] !== '').map((k) => ({ metric: k, date: v.date, ts: `${v.date}T07:00:00`, value: METRICS[k].dim ? u.to(Number(v[k]), 'length') : Number(v[k]), meta: k === 'bodyfat' ? { method: v.method } : undefined }));
    await api.add('entries', rows); setOpen(false); await refresh(); notify(`${rows.length} measurements saved`);
  };
  const upload = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api.uploadPhoto(fd); setPhotoOpen(false); await refresh(); notify('Photo added');
  };

  return (
    <div>
      <PageHeader icon={Ruler} title="Body composition" subtitle="Tape measurements, body fat and progress photos. The waist shows visceral fat that the scale misses.">
        <Button variant="soft" icon={Camera} onClick={() => setPhotoOpen(true)}>Add photo</Button>
        <Button icon={Plus} onClick={() => setOpen(true)}>Measurement session</Button>
      </PageHeader>
      <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatTile icon={Scale} label="Trend weight" value={u.from(m.trendNow, 'mass')} dec={1} unit={u.label('mass')} />
        <StatTile icon={Ruler} label="Waist" value={u.from(waist?.value, 'length')} dec={1} unit={u.label('length')} sub={waist ? fmtDate(waist.date) : 'not measured'} />
        <StatTile icon={PersonStanding} label="Waist-to-height" value={whtr} dec={2} sub={whtr == null ? 'needs waist + height' : whtr < 0.5 ? 'Healthy (< 0.50)' : whtr < 0.6 ? 'Increased risk' : 'High risk'} tone={whtr != null && whtr < 0.5 ? 'grad' : undefined} />
        <StatTile icon={Percent} label="Body fat" value={bf?.value} dec={1} unit="%" sub={bf?.date ? fmtDate(bf.date) : '—'} />
        <StatTile icon={Scale} label="Lean mass (est.)" value={u.from(lean, 'mass')} dec={1} unit={u.label('mass')} />
        <StatTile icon={Info} label="BMI" value={m.bmi} dec={1} sub="shown, but weighted low in scoring" />
      </Stagger>
      <Stagger className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3" delay={0.1}>
        <Card hover={false} className="xl:col-span-2">
          <CardTitle icon={Ruler} title="Circumferences" sub={`Monthly tape measurements (${u.label('length')})`} />
          <TimeChart data={seriesFor(['waist', 'hips', 'chest', 'thigh', 'arm'])} unit={u.label('length')} dec={1} height={280} series={[
            { key: 'waist', name: 'Waist', type: 'line', dot: true, width: 3 }, { key: 'hips', name: 'Hips', type: 'line', dot: true }, { key: 'chest', name: 'Chest', type: 'line', dot: true },
            { key: 'thigh', name: 'Thigh', type: 'line', dot: true }, { key: 'arm', name: 'Arm', type: 'line', dot: true }]} />
        </Card>
        <Card hover={false}>
          <CardTitle icon={PersonStanding} title="Waist-to-height ratio" sub="Below 0.5 is the target. Keep your waist under half your height." />
          <TimeChart data={whtrData} dec={2} height={280} yDomain={[0.4, 0.7]} refAreas={[{ y1: 0.4, y2: 0.5, color: c.status.good, label: 'healthy' }]} refLines={[{ y: 0.5 }]} series={[{ key: 'whtr', name: 'WHtR', type: 'area', color: c.series[2] }]} />
        </Card>
        <Card hover={false}>
          <CardTitle icon={Percent} title="Body fat %" />
          <TimeChart data={seriesFor(['bodyfat'])} unit="%" dec={1} height={220} series={[{ key: 'bodyfat', name: 'Body fat', type: 'area', color: c.series[1] }]} />
        </Card>
        <Card hover={false} className="xl:col-span-2">
          <CardTitle icon={ArrowLeftRight} title="Change since first measurement" />
          <Table rows={deltas} columns={[
            { key: 'name', label: 'Site' },
            { key: 'first', label: 'First', right: true, render: (r) => `${fmt(METRICS[r.k].dim ? u.from(r.first[1], 'length') : r.first[1], 1)} · ${fmtDate(r.first[0])}` },
            { key: 'last', label: 'Latest', right: true, render: (r) => `${fmt(METRICS[r.k].dim ? u.from(r.last[1], 'length') : r.last[1], 1)} · ${fmtDate(r.last[0])}` },
            { key: 'd', label: 'Change', right: true, render: (r) => { const d = r.last[1] - r.first[1]; const good = METRICS[r.k].good === 'up' ? d > 0 : METRICS[r.k].good === 'down' ? d < 0 : null; return <span className={good === true ? 'font-semibold text-[#0a7d0a] dark:text-good' : good === false ? 'font-semibold text-critical' : ''}>{fmtSigned(METRICS[r.k].dim ? u.from(d, 'length') : d, 1)}</span>; } },
          ]} />
        </Card>
      </Stagger>

      <Card hover={false} className="mt-4">
        <CardTitle icon={Camera} title="Progress photos" sub="Same pose, light and time of day. Tap two photos to compare." right={<Segmented size="sm" value={pose} onChange={(p) => { setPose(p); setCmp([]); }} options={[['front', 'Front'], ['side', 'Side'], ['back', 'Back']]} />} />
        {photos.length ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:col-span-2">
              {photos.map((p) => (
                <motion.button key={p.id} whileHover={{ scale: 1.04 }} onClick={() => setCmp((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id].slice(-2)))}
                  className={`group relative aspect-[3/4] overflow-hidden rounded-xl ring-2 ${cmp.includes(p.id) ? 'ring-accent' : 'ring-transparent'}`}>
                  <img src={`/uploads/${p.file}`} alt={p.date} className="h-full w-full object-cover" />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 text-left text-[11px] text-white">{fmtDate(p.date)}</span>
                  <span onClick={async (e) => { e.stopPropagation(); await api.remove('photos', p.id); refresh(); }} className="absolute top-1 right-1 hidden rounded-md bg-black/60 p-1 text-white group-hover:block"><Trash2 size={12} /></span>
                </motion.button>
              ))}
            </div>
            <div>{cmp.length === 2 ? <CompareSlider a={photos.find((p) => p.id === cmp[0])} b={photos.find((p) => p.id === cmp[1])} /> : <Empty icon={ArrowLeftRight} title="Pick two photos" text="Drag the slider to see before and after." />}</div>
          </div>
        ) : <Empty icon={Camera} title={`No ${pose} photos yet`} text="Monthly photos often show progress that the scale and tape miss." action={<Button size="sm" icon={Upload} onClick={() => setPhotoOpen(true)}>Upload</Button>} />}
        <p className="mt-3 text-xs text-muted">DEXA / InBody results? Import them as CSV under <Link className="text-accent" to="/integrations">Integrations</Link> (body fat, lean mass).</p>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Measurement session" wide footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></>}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Date"><Input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></Field>
          <Field label="Body-fat method"><Select value={v.method} onChange={(e) => setV({ ...v, method: e.target.value })} options={[['tape', 'Tape (US Navy formula)'], ['scale', 'Smart scale (BIA)'], ['calipers', 'Skinfold calipers'], ['dexa', 'DEXA'], ['inbody', 'InBody']]} /></Field>
          {MEASURE_KEYS.map((k, i) => (
            <motion.div key={k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="rounded-xl border border-line p-3">
              <Field label={METRICS[k].name} hint={PROTOCOL[k]}><UnitInput unit={METRICS[k].dim ? u.label('length') : '%'} value={v[k] ?? ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></Field>
            </motion.div>
          ))}
        </div>
        <AnimatePresence>{navy && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 flex items-center justify-between rounded-xl bg-accent/10 p-3 text-sm">US Navy estimate from your tape: <b>{navy.toFixed(1)}%</b><Button size="sm" variant="soft" onClick={() => setV({ ...v, bodyfat: navy.toFixed(1), method: 'tape' })}>Use it</Button></motion.div>}</AnimatePresence>
      </Modal>
      <Modal open={photoOpen} onClose={() => setPhotoOpen(false)} title="Add progress photo">
        <form onSubmit={upload} className="space-y-3">
          <Field label="Photo"><input name="file" type="file" accept="image/*" required className="block w-full text-sm" /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Date"><Input name="date" type="date" defaultValue={todayISO()} /></Field><Field label="Pose"><Select name="pose" defaultValue={pose} options={[['front', 'Front'], ['side', 'Side'], ['back', 'Back']]} /></Field></div>
          <Field label="Notes"><Input name="notes" /></Field>
          <div className="flex justify-end"><Button type="submit" icon={Upload}>Upload</Button></div>
        </form>
      </Modal>
    </div>
  );
}
