import { useState } from 'react';
import { motion } from 'framer-motion';
import { SlidersHorizontal, Plus, Trash2, BookOpen } from 'lucide-react';
import { PageHeader, Card, CardTitle, Stagger, Button, Modal, Field, Input, Select, Badge, Table, Empty, IconBtn } from '../components/ui.jsx';
import { TimeChart } from '../components/charts.jsx';
import { ScaleInput } from '../components/QuickLog.jsx';
import { useData } from '../lib/store.jsx';
import { useTheme } from '../lib/theme.jsx';
import { api } from '../lib/api.js';
import { addDays, dateRange, todayISO, fmt } from '../lib/format.js';
import { METRICS, DOMAINS, LAYERS } from '@shared/catalog.js';

export default function Metrics() {
  const { model: m, refresh, notify } = useData();
  const { c } = useTheme();
  const [edit, setEdit] = useState(null);
  const [vals, setVals] = useState({});
  const [date, setDate] = useState(todayISO());
  const defs = Object.values(m.customDefs);

  const save = async () => {
    const key = edit.key || `custom_${edit.name.toLowerCase().replace(/\W+/g, '_').replace(/^_|_$/g, '')}`;
    await api.add('metric_defs', { ...edit, key, target: edit.target === '' ? null : Number(edit.target), layer: Number(edit.layer) });
    setEdit(null); await refresh(); notify('Metric saved');
  };
  const logVal = async (d) => {
    const v = vals[d.key]; if (v === undefined || v === '') return;
    await api.add('entries', { metric: d.key, date, value: d.type === 'boolean' ? (v ? 1 : 0) : Number(v), text: d.type === 'text' ? v : undefined });
    setVals({ ...vals, [d.key]: '' }); await refresh(); notify(`${d.name} logged`);
  };

  return (
    <div>
      <PageHeader icon={SlidersHorizontal} title="Custom metrics" subtitle="Track anything: define the type, unit, iceberg layer and target. It joins correlations and drift detection automatically.">
        <Button icon={Plus} onClick={() => setEdit({ name: '', type: 'number', unit: '', layer: 1, domain: 'recovery', target: '', direction: 'up', agg: 'last' })}>New metric</Button>
      </PageHeader>
      {!defs.length && <Card hover={false}><Empty icon={SlidersHorizontal} title="No custom metrics" text="Examples: cold-shower minutes, reading pages, pain score, migraine yes/no, screen time, work hours, cups of green tea." /></Card>}
      <Stagger className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {defs.map((d) => {
          const data = dateRange(addDays(m.today, -59), m.today).map((x) => ({ date: x, v: m.series(d.key)[x] ?? null }));
          return (
            <Card key={d.key} hover={false}>
              <CardTitle icon={SlidersHorizontal} title={d.name} sub={`${d.type}${d.unit ? ` · ${d.unit}` : ''} · ${LAYERS[d.layer]?.short} ${LAYERS[d.layer]?.name} · ${DOMAINS[d.domain]?.name}${d.target != null ? ` · target ${d.target}` : ''}`}
                right={<div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setEdit(d)}>Edit</Button><IconBtn icon={Trash2} label="Delete" size={15} onClick={async () => { if (confirm(`Delete ${d.name}? Logged values stay in the database.`)) { await api.remove('metric_defs', d.key); refresh(); } }} /></div>} />
              <div className="mb-3 flex flex-wrap items-end gap-2">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="!w-40" />
                {d.type === 'scale' ? <div className="min-w-48 flex-1"><ScaleInput value={vals[d.key]} onChange={(v) => setVals({ ...vals, [d.key]: v })} /></div>
                  : d.type === 'boolean' ? <Select value={vals[d.key] ?? ''} onChange={(e) => setVals({ ...vals, [d.key]: e.target.value === '1' })} options={[['', '—'], ['1', 'Yes'], ['0', 'No']]} className="!w-28" />
                    : <Input type={d.type === 'text' ? 'text' : 'number'} step="any" placeholder={d.unit} value={vals[d.key] ?? ''} onChange={(e) => setVals({ ...vals, [d.key]: e.target.value })} className="!w-40" />}
                <Button size="sm" onClick={() => logVal(d)}>Log</Button>
              </div>
              <TimeChart data={data} unit={d.unit} height={170} refLines={d.target != null ? [{ y: d.target, label: 'target' }] : []} series={[{ key: 'v', name: d.name, type: d.type === 'boolean' ? 'bar' : 'area', color: c.series[Object.keys(m.customDefs).indexOf(d.key) % 8] }]} />
            </Card>
          );
        })}
      </Stagger>
      <Card hover={false} className="mt-4">
        <CardTitle icon={BookOpen} title="Built-in metric catalog" sub={`${Object.keys(METRICS).length} metrics · stored in canonical units`} />
        <Table rows={Object.entries(METRICS).map(([k, d]) => ({ id: k, k, ...d }))} columns={[
          { key: 'name', label: 'Metric' }, { key: 'k', label: 'Key', render: (r) => <code className="text-xs">{r.k}</code> }, { key: 'unit', label: 'Unit' },
          { key: 'layer', label: 'Layer', render: (r) => <Badge>{LAYERS[r.layer].short} {LAYERS[r.layer].name}</Badge> }, { key: 'domain', label: 'Domain', render: (r) => DOMAINS[r.domain]?.name },
          { key: 'agg', label: 'Daily aggregation' }, { key: 'n', label: 'Days logged', right: true, render: (r) => fmt(Object.keys(m.series(r.k)).length) },
        ]} />
      </Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.key ? 'Edit metric' : 'New metric'} footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button disabled={!edit?.name} onClick={save}>Save</Button></>}>
        {edit && <div className="grid grid-cols-2 gap-3">
          <Field label="Name" className="col-span-2"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Cold shower" /></Field>
          <Field label="Type"><Select value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value })} options={[['number', 'Number'], ['scale', '1–5 scale'], ['boolean', 'Yes / no'], ['text', 'Text note']]} /></Field>
          <Field label="Unit"><Input value={edit.unit || ''} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} placeholder="min" /></Field>
          <Field label="Iceberg layer"><Select value={edit.layer} onChange={(e) => setEdit({ ...edit, layer: e.target.value })} options={Object.entries(LAYERS).map(([k, l]) => [k, `${l.short} ${l.name}`])} /></Field>
          <Field label="Domain"><Select value={edit.domain} onChange={(e) => setEdit({ ...edit, domain: e.target.value })} options={Object.entries(DOMAINS).map(([k, d]) => [k, d.name])} /></Field>
          <Field label="Daily target"><Input type="number" value={edit.target ?? ''} onChange={(e) => setEdit({ ...edit, target: e.target.value })} /></Field>
          <Field label="Better when"><Select value={edit.direction} onChange={(e) => setEdit({ ...edit, direction: e.target.value })} options={[['up', 'Higher'], ['down', 'Lower'], ['range', 'In range']]} /></Field>
          <Field label="Multiple logs per day" className="col-span-2"><Select value={edit.agg} onChange={(e) => setEdit({ ...edit, agg: e.target.value })} options={[['last', 'Keep latest'], ['sum', 'Add up'], ['avg', 'Average']]} /></Field>
        </div>}
      </Modal>
    </div>
  );
}
