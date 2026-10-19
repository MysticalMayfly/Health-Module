import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TestTube2, Plus, FileUp, Loader2, CalendarClock, TrendingUp, AlertTriangle, Settings2 } from 'lucide-react';
import { PageHeader, Card, CardTitle, Stagger, Button, Modal, Field, Input, UnitInput, StatusPill, Badge, Chip, Table, Empty } from '../components/ui.jsx';
import { TimeChart, Sparkline } from '../components/charts.jsx';
import { useData } from '../lib/store.jsx';
import { useTheme } from '../lib/theme.jsx';
import { api } from '../lib/api.js';
import { addDays, daysBetween, fmt, fmtDate, todayISO } from '../lib/format.js';
import { LAB_MARKERS, LAB_PANELS } from '@shared/labs.js';

/** Extract text from a PDF lab report in the browser (pdf.js), line by line. */
async function pdfLines(file) {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const lines = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const items = (await (await doc.getPage(p)).getTextContent()).items;
    const rows = new Map();
    for (const it of items) { const y = Math.round(it.transform[5]); rows.set(y, `${rows.get(y) || ''} ${it.str}`); }
    [...rows.entries()].sort((a, b) => b[0] - a[0]).forEach(([, t]) => lines.push(t.replace(/\s+/g, ' ').trim()));
  }
  return lines;
}
/** Match known markers by alias and pull the first number after the name; converts mmol/L when needed. */
export function parseLabText(lines) {
  const found = {};
  const toMg = { glucose: 18.016, chol: 38.67, tg: 88.57 };
  for (const raw of lines) {
    const line = raw.toLowerCase();
    for (const [key, mk] of Object.entries(LAB_MARKERS)) {
      if (found[key]) continue;
      for (const alias of mk.aliases || []) {
        const i = line.indexOf(alias);
        if (i === -1) continue;
        if (key === 'hdl' && /non[- ]?hdl/.test(line)) continue;
        if (key === 'fasting_glucose' && /post|pp|random/.test(line)) continue;
        const num = line.slice(i + alias.length).match(/(-?\d+(?:\.\d+)?)/);
        if (!num) continue;
        let v = parseFloat(num[1]);
        if (mk.dim && /mmol/.test(line)) v *= toMg[mk.dim];
        found[key] = { value: +v.toFixed(2), line: raw };
        break;
      }
    }
  }
  return found;
}

function RangeBar({ mk, value, sex, opt }) {
  const { c } = useTheme();
  const ref = sex === 'female' && mk.refF ? mk.refF : mk.ref;
  const lo = Math.min(ref[0], opt[0], value ?? ref[0]) * 0.8, hi = Math.max(ref[1], opt[1], value ?? ref[1]) * 1.15;
  const pct = (v) => ((v - lo) / (hi - lo)) * 100;
  return (
    <div className="relative mt-2 h-2.5 rounded-full bg-critical/20">
      <div className="absolute inset-y-0 rounded-full bg-warning/40" style={{ left: `${pct(ref[0])}%`, width: `${pct(ref[1]) - pct(ref[0])}%` }} />
      <div className="absolute inset-y-0 rounded-full bg-good/60" style={{ left: `${pct(opt[0])}%`, width: `${pct(opt[1]) - pct(opt[0])}%` }} />
      {value != null && <motion.div initial={{ left: '0%' }} animate={{ left: `calc(${Math.max(0, Math.min(100, pct(value)))}% - 6px)` }} transition={{ type: 'spring', stiffness: 60, damping: 12 }} className="absolute -top-1 h-4.5 w-3 rounded-full border-2 border-white shadow" style={{ background: c.fg, height: 18 }} />}
    </div>
  );
}

export default function Labs() {
  const { model: m, refresh, notify, u, saveSettings } = useData();
  const { c } = useTheme();
  const [panel, setPanel] = useState('all');
  const [sel, setSel] = useState(null);
  const [add, setAdd] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [rangeEdit, setRangeEdit] = useState(null);
  const sex = m.profile.sex;
  const optOf = (k) => (sex === 'female' && LAB_MARKERS[k].optF) || m.settings.labRanges?.[k] || LAB_MARKERS[k].opt;
  const markers = Object.entries(LAB_MARKERS).filter(([, mk]) => panel === 'all' || mk.panel === panel);
  const lastDate = Object.values(m.labsByMarker).flat().map((l) => l.date).sort().at(-1);
  const interval = m.settings.prefs?.labIntervalMonths || 6;
  const nextDue = lastDate ? addDays(lastDate, Math.round(interval * 30.4)) : null;
  const counts = useMemo(() => { const o = { optimal: 0, near: 0, out: 0 }; for (const k of Object.keys(m.labsByMarker)) { const s = m.labStatus(k, m.labLatest(k)?.value); if (s) o[s]++; } return o; }, [m]);
  const drifting = Object.keys(m.labsByMarker).filter((k) => m.labDrift(k));

  const saveAdd = async () => {
    const rows = Object.entries(add.values).filter(([, v]) => v !== '' && v != null).map(([marker, v]) => ({ date: add.date, marker, value: LAB_MARKERS[marker].dim ? +u.to(Number(v), LAB_MARKERS[marker].dim).toFixed(3) : Number(v), lab: add.lab }));
    if (rows.length) await api.add('labs', rows);
    setAdd(null); setPdf(null); await refresh(); notify(`${rows.length} results saved`);
  };
  const onPdf = async (file) => {
    setPdf({ loading: true });
    try {
      const lines = await pdfLines(file);
      const found = parseLabText(lines);
      const dateMatch = lines.join(' ').match(/(\d{4}-\d{2}-\d{2})|(\d{2}[/-]\d{2}[/-]\d{4})/);
      let date = todayISO();
      if (dateMatch?.[1]) date = dateMatch[1]; else if (dateMatch?.[2]) { const [d, mo, y] = dateMatch[2].split(/[/-]/); date = `${y}-${mo}-${d}`; }
      setPdf({ found, lines: lines.length });
      setAdd({ date, lab: file.name.replace(/\.pdf$/i, ''), values: Object.fromEntries(Object.entries(found).map(([k, v]) => [k, LAB_MARKERS[k].dim ? +u.from(v.value, LAB_MARKERS[k].dim).toFixed(2) : v.value])) });
    } catch (e) { setPdf({ error: e.message }); }
  };

  const detail = sel && (m.labsByMarker[sel] || []).map((l) => ({ date: l.date, v: +(LAB_MARKERS[sel].dim ? u.from(l.value, LAB_MARKERS[sel].dim) : l.value).toFixed(2) }));
  const dimConv = (k, v) => (LAB_MARKERS[k].dim ? +u.from(v, LAB_MARKERS[k].dim).toFixed(2) : v);

  return (
    <div>
      <PageHeader icon={TestTube2} title="Labs & biomarkers" subtitle="Every marker with its reference range and your optimal range. Drift is flagged while values are still technically normal.">
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-raised px-4 text-sm font-medium hover:bg-line"><FileUp size={16} />Import PDF<input type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files[0] && onPdf(e.target.files[0])} /></label>
        <Button icon={Plus} onClick={() => setAdd({ date: todayISO(), lab: '', values: {} })}>Add results</Button>
      </PageHeader>
      <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card hover={false} className="!p-4"><div className="text-xs text-fg2">Optimal</div><div className="mt-1 text-3xl font-bold text-[#0a7d0a] dark:text-good tabular">{counts.optimal}</div></Card>
        <Card hover={false} className="!p-4"><div className="text-xs text-fg2">In range, not optimal</div><div className="mt-1 text-3xl font-bold text-[#8a5d00] dark:text-warning tabular">{counts.near}</div></Card>
        <Card hover={false} className="!p-4"><div className="text-xs text-fg2">Out of range</div><div className="mt-1 text-3xl font-bold text-critical tabular">{counts.out}</div></Card>
        <Card hover={false} className="!p-4"><div className="flex items-center gap-1.5 text-xs text-fg2"><CalendarClock size={13} />Next panel due</div><div className="mt-1 text-xl font-bold">{nextDue ? fmtDate(nextDue, 'd MMM yyyy') : 'Add your first panel'}</div><div className="text-xs text-muted">{nextDue ? (daysBetween(m.today, nextDue) < 0 ? `${-daysBetween(m.today, nextDue)} days overdue` : `in ${daysBetween(m.today, nextDue)} days`) : ''} · every {interval} months</div></Card>
      </Stagger>
      {(drifting.length > 0 || m.homa != null) && (
        <Stagger className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2" delay={0.05}>
          {drifting.length > 0 && <Card hover={false} className="!p-4"><div className="flex items-center gap-2 text-sm font-semibold"><TrendingUp size={16} className="text-warning" />Drifting the wrong way across 3+ tests</div><div className="mt-2 flex flex-wrap gap-2">{drifting.map((k) => <Badge key={k} tone="warning">{LAB_MARKERS[k].name}</Badge>)}</div></Card>}
          {m.homa != null && <Card hover={false} className="!p-4"><div className="text-sm font-semibold">HOMA-IR (insulin resistance)</div><div className="mt-1 flex items-center gap-3"><span className="text-2xl font-bold tabular">{m.homa.toFixed(2)}</span><StatusPill status={m.homa < 1.5 ? 'good' : m.homa < 2.5 ? 'warning' : 'serious'} label={m.homa < 1.5 ? 'Insulin sensitive' : m.homa < 2.5 ? 'Early resistance' : 'Insulin resistant'} /></div><div className="text-xs text-muted">glucose × insulin / 405</div></Card>}
        </Stagger>
      )}
      <div className="my-4 flex flex-wrap gap-2"><Chip active={panel === 'all'} onClick={() => setPanel('all')}>All panels</Chip>{LAB_PANELS.map((p) => <Chip key={p} active={panel === p} onClick={() => setPanel(p)}>{p}</Chip>)}</div>
      <Stagger className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" gap={0.03}>
        {markers.map(([k, mk]) => {
          const arr = m.labsByMarker[k] || [];
          const l = arr.at(-1);
          const st = m.labStatus(k, l?.value);
          const opt = optOf(k);
          return (
            <Card key={k} onClick={() => arr.length && setSel(k)} className="!p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><div className="truncate font-semibold">{mk.name}</div><div className="text-[11px] text-muted">{mk.panel}{l ? ` · ${fmtDate(l.date, 'd MMM yy')}` : ''}</div></div>
                <StatusPill status={st} label={!l ? 'No result' : undefined} />
              </div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div><span className="text-2xl font-bold tabular">{l ? fmt(dimConv(k, l.value), u.dec(mk.dim, mk.dec || 0)) : '—'}</span> <span className="text-xs text-muted">{u.label(mk.dim, mk.unit)}</span>{m.labDrift(k) && <AlertTriangle size={14} className="ml-1 inline text-warning" />}</div>
                {arr.length > 1 && <div className="h-8 w-24"><Sparkline data={arr.map((x) => x.value)} color={st === 'optimal' ? c.status.good : st === 'out' ? c.status.critical : c.series[0]} /></div>}
              </div>
              <RangeBar mk={mk} value={l?.value} sex={sex} opt={opt} />
              <div className="mt-1.5 flex justify-between text-[10px] text-muted"><span>ref {fmt(dimConv(k, (sex === 'female' && mk.refF ? mk.refF : mk.ref)[0]), u.dec(mk.dim, mk.dec || 0))}–{fmt(dimConv(k, (sex === 'female' && mk.refF ? mk.refF : mk.ref)[1]), u.dec(mk.dim, mk.dec || 0))}</span>
                <button className="inline-flex items-center gap-0.5 hover:text-accent" onClick={(e) => { e.stopPropagation(); setRangeEdit({ k, lo: opt[0], hi: opt[1] }); }}><Settings2 size={10} />optimal {fmt(dimConv(k, opt[0]), u.dec(mk.dim, mk.dec || 0))}–{fmt(dimConv(k, opt[1]), u.dec(mk.dim, mk.dec || 0))}</button></div>
            </Card>
          );
        })}
      </Stagger>

      <Modal open={!!sel} onClose={() => setSel(null)} title={sel ? LAB_MARKERS[sel].name : ''} wide>
        {sel && <>
          <TimeChart data={detail} unit={u.label(LAB_MARKERS[sel].dim, LAB_MARKERS[sel].unit)} dec={u.dec(LAB_MARKERS[sel].dim, LAB_MARKERS[sel].dec || 0)} height={280}
            refAreas={[{ y1: dimConv(sel, optOf(sel)[0]), y2: dimConv(sel, optOf(sel)[1]), color: c.status.good, label: 'optimal' }]}
            refLines={[{ y: dimConv(sel, LAB_MARKERS[sel].ref[0]), label: 'ref low' }, { y: dimConv(sel, LAB_MARKERS[sel].ref[1]), label: 'ref high' }]}
            series={[{ key: 'v', name: LAB_MARKERS[sel].name, type: 'line', dot: true, width: 3 }]} />
          <Table rows={(m.labsByMarker[sel] || []).slice().reverse()} columns={[{ key: 'date', label: 'Date', render: (r) => fmtDate(r.date, 'd MMM yyyy') }, { key: 'value', label: 'Value', right: true, render: (r) => fmt(dimConv(sel, r.value), u.dec(LAB_MARKERS[sel].dim, LAB_MARKERS[sel].dec || 0)) }, { key: 'lab', label: 'Lab' }, { key: 'x', label: '', render: (r) => <button className="text-xs text-critical hover:underline" onClick={async () => { await api.remove('labs', r.id); refresh(); }}>delete</button> }]} />
        </>}
      </Modal>

      <Modal open={!!add} onClose={() => { setAdd(null); setPdf(null); }} title={pdf?.found ? `Review extracted results (${Object.keys(pdf.found).length} found)` : 'Add lab results'} wide footer={<><Button variant="ghost" onClick={() => { setAdd(null); setPdf(null); }}>Cancel</Button><Button onClick={saveAdd}>Save results</Button></>}>
        {add && <>
          {pdf?.found && <p className="mb-3 rounded-xl bg-accent/10 p-3 text-xs">Values were read from the PDF and converted to your units. <b>Check each one</b> before saving: PDF layouts vary.</p>}
          <div className="mb-4 grid grid-cols-2 gap-3"><Field label="Date"><Input type="date" value={add.date} onChange={(e) => setAdd({ ...add, date: e.target.value })} /></Field><Field label="Lab"><Input value={add.lab} onChange={(e) => setAdd({ ...add, lab: e.target.value })} /></Field></div>
          {LAB_PANELS.map((p) => (
            <div key={p} className="mb-3"><div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">{p}</div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">{Object.entries(LAB_MARKERS).filter(([, mk]) => mk.panel === p).map(([k, mk]) => (
                <Field key={k} label={mk.name}><UnitInput unit={u.label(mk.dim, mk.unit)} value={add.values[k] ?? ''} onChange={(e) => setAdd({ ...add, values: { ...add.values, [k]: e.target.value } })} className={pdf?.found?.[k] ? 'rounded-xl ring-2 ring-accent/40' : ''} /></Field>
              ))}</div></div>
          ))}
        </>}
      </Modal>
      <AnimatePresence>{pdf?.loading && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"><div className="flex items-center gap-2 rounded-2xl bg-card p-5 shadow-xl"><Loader2 className="animate-spin" />Reading PDF…</div></motion.div>}</AnimatePresence>
      {pdf?.error && <Modal open onClose={() => setPdf(null)} title="Couldn’t read that PDF"><p className="text-sm">{pdf.error}. Scanned (image) PDFs need OCR. Enter the values manually instead.</p></Modal>}
      <Modal open={!!rangeEdit} onClose={() => setRangeEdit(null)} title={rangeEdit ? `Optimal range · ${LAB_MARKERS[rangeEdit.k].name}` : ''} footer={<><Button variant="ghost" onClick={async () => { const r = { ...(m.settings.labRanges || {}) }; delete r[rangeEdit.k]; await saveSettings({ labRanges: r }); setRangeEdit(null); }}>Reset to default</Button><Button onClick={async () => { await saveSettings({ labRanges: { ...(m.settings.labRanges || {}), [rangeEdit.k]: [Number(rangeEdit.lo), Number(rangeEdit.hi)] } }); setRangeEdit(null); notify('Range saved'); }}>Save</Button></>}>
        {rangeEdit && <div className="grid grid-cols-2 gap-3"><Field label={`Low (${LAB_MARKERS[rangeEdit.k].unit})`}><Input type="number" step="any" value={rangeEdit.lo} onChange={(e) => setRangeEdit({ ...rangeEdit, lo: e.target.value })} /></Field><Field label={`High (${LAB_MARKERS[rangeEdit.k].unit})`}><Input type="number" step="any" value={rangeEdit.hi} onChange={(e) => setRangeEdit({ ...rangeEdit, hi: e.target.value })} /></Field><p className="col-span-2 text-xs text-muted">Stored in canonical units. Agree any personal targets with your doctor.</p></div>}
      </Modal>
    </div>
  );
}
