import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Card, CardTitle, Button, Modal, Field, Input, Select, Textarea, IconBtn, Empty, Toggle } from './ui.jsx';
import { useData } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { todayISO } from '../lib/format.js';

/**
 * Generic CRUD for `records` of one kind.
 * fields: [{ key, label, type: text|number|date|select|textarea|list|tags, options, placeholder, half }]
 * The record's own `date` column is edited via a field with key '_date'.
 */
export default function RecordManager({ kind, title, icon, fields, summary, sub, empty, defaults = {}, sort = 'date-desc', filter, activeField, compact, className = '' }) {
  const { model, refresh, notify } = useData();
  const [edit, setEdit] = useState(null);
  let rows = (model?.records[kind] || []).slice();
  if (filter) rows = rows.filter(filter);
  rows.sort((a, b) => (sort === 'date-desc' ? String(b.date || '').localeCompare(String(a.date || '')) : String(a.data?.name || '').localeCompare(String(b.data?.name || ''))));

  const open = (r) => setEdit(r ? { id: r.id, _date: r.date || '', active: r.active, ...r.data } : { _date: todayISO(), active: 1, ...defaults });
  const save = async () => {
    const { id, _date, active, ...data } = edit;
    for (const f of fields) {
      if (f.type === 'number' && data[f.key] !== '' && data[f.key] != null) data[f.key] = Number(data[f.key]);
      if (f.type === 'list' && typeof data[f.key] === 'string') data[f.key] = data[f.key].split('\n').map((s) => s.trim()).filter(Boolean);
      if (f.type === 'tags' && typeof data[f.key] === 'string') data[f.key] = data[f.key].split(',').map((s) => s.trim()).filter(Boolean);
    }
    const row = { kind, date: fields.some((f) => f.key === '_date') ? _date || null : null, data, active: active ? 1 : 0 };
    if (id) await api.update('records', id, row); else await api.add('records', row);
    setEdit(null); await refresh(); notify(`${title} saved`);
  };
  const del = async (id) => { await api.remove('records', id); setEdit(null); await refresh(); notify('Deleted'); };
  const val = (k) => {
    const v = edit?.[k];
    const f = fields.find((x) => x.key === k);
    if (f?.type === 'list' && Array.isArray(v)) return v.join('\n');
    if (f?.type === 'tags' && Array.isArray(v)) return v.join(', ');
    return v ?? '';
  };

  return (
    <Card className={className} hover={false}>
      <CardTitle icon={icon} title={title} sub={sub} right={<Button size="sm" icon={Plus} onClick={() => open(null)}>Add</Button>} />
      {!rows.length ? <Empty icon={icon} title={`No ${title.toLowerCase()} yet`} text={empty} /> : (
        <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
          <AnimatePresence initial={false}>
            {rows.map((r, i) => (
              <motion.div key={r.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}
                className={`group flex items-start gap-3 rounded-xl border border-line px-3 py-2.5 transition hover:bg-raised/60 ${r.active === 0 ? 'opacity-60' : ''}`}>
                <div className="min-w-0 flex-1 text-sm">{summary(r)}</div>
                <div className="flex shrink-0 gap-0.5 opacity-60 transition group-hover:opacity-100">
                  <IconBtn icon={Pencil} label="Edit" size={15} onClick={() => open(r)} />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={`${edit?.id ? 'Edit' : 'Add'} ${title.toLowerCase().replace(/s$/, '')}`}
        footer={<>{edit?.id && <Button variant="danger" icon={Trash2} onClick={() => del(edit.id)} className="mr-auto">Delete</Button>}<Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save}>Save</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          {fields.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint} className={f.half ? '' : 'col-span-2'}>
              {f.type === 'select' ? <Select value={val(f.key)} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })} options={f.options} />
                : f.type === 'textarea' || f.type === 'list' ? <Textarea placeholder={f.placeholder || (f.type === 'list' ? 'One per line' : '')} value={val(f.key)} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })} />
                  : <Input type={f.type === '_date' || f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'} step="any" placeholder={f.placeholder} value={val(f.key)} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })} />}
            </Field>
          ))}
          {activeField && <div className="col-span-2"><Toggle checked={!!edit?.active} onChange={(v) => setEdit({ ...edit, active: v ? 1 : 0 })} label={activeField} /></div>}
        </div>
      </Modal>
    </Card>
  );
}
