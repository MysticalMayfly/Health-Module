// Chart kit on Recharts. Rules: one y-axis per chart, 2px lines, 4px rounded bar ends, hover tooltips,
// legend whenever ≥2 series, recessive grid; colors come from the validated categorical palette in fixed order.
import { ResponsiveContainer, ComposedChart, Line, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ScatterChart, Scatter, LineChart, BarChart, LabelList } from 'recharts';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { useTheme } from '../lib/theme.jsx';
import { fmt, fmtDate, addDays, todayISO } from '../lib/format.js';

export function ChartTooltip({ active, payload, label, unit = '', dec = 0, labelFmt, valueFmt }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p.value != null && p.dataKey !== '_band');
  if (!rows.length) return null;
  return (
    <div className="rounded-xl border border-line bg-card/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <div className="mb-1 font-semibold text-fg">{labelFmt ? labelFmt(label) : /^\d{4}-\d{2}-\d{2}$/.test(label) ? fmtDate(label, 'EEE d MMM yyyy') : label}</div>
      {rows.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-fg2"><span className="h-2 w-2 rounded-full" style={{ background: p.color || p.payload?.fill }} />{p.name}</span>
          <span className="tabular font-medium text-fg">{valueFmt ? valueFmt(p.value, p) : `${fmt(p.value, p.payload?._dec ?? dec)}${unit ? ` ${unit}` : ''}`}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg2">
      {items.map((i) => (
        <span key={i.name} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-sm" style={{ background: i.color, opacity: i.dashed ? 0.6 : 1, border: i.dashed ? `1px dashed ${i.color}` : 'none' }} />{i.name}
        </span>
      ))}
    </div>
  );
}

/**
 * Time-series chart. series: [{ key, name, type: 'line'|'area'|'bar', color, dashed, dot, stack, width }]
 * One y-axis only. refLines: [{ y, label, color }], refAreas: [{ y1, y2, color, label }]
 */
export function TimeChart({ data, series, height = 240, unit = '', dec = 0, yDomain, refLines = [], refAreas = [], xKey = 'date', legend = true, xFmt, yFmt, valueFmt, barSize, syncId }) {
  const { c } = useTheme();
  const col = (s, i) => s.color || c.series[i % 8];
  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} syncId={syncId}>
            <defs>
              {series.filter((s) => s.type === 'area').map((s, i) => (
                <linearGradient key={s.key} id={`area-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={col(s, series.indexOf(s))} stopOpacity={0.35} /><stop offset="100%" stopColor={col(s, series.indexOf(s))} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="0" />
            <XAxis dataKey={xKey} tickFormatter={xFmt || ((d) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? fmtDate(d) : d))} minTickGap={24} tickLine={false} axisLine={false} />
            <YAxis domain={yDomain || ['auto', 'auto']} tickLine={false} axisLine={false} width={48} tickFormatter={yFmt || ((v) => fmt(v, dec > 1 ? 1 : dec))} />
            <Tooltip content={<ChartTooltip unit={unit} dec={dec} valueFmt={valueFmt} />} cursor={{ stroke: c.axis, strokeWidth: 1 }} />
            {refAreas.map((r, i) => <ReferenceArea key={i} y1={r.y1} y2={r.y2} fill={r.color || c.status.good} fillOpacity={0.08} stroke="none" label={r.label ? { value: r.label, position: 'insideTopLeft', fontSize: 10, fill: c.muted } : undefined} />)}
            {refLines.map((r, i) => <ReferenceLine key={i} y={r.y} x={r.x} stroke={r.color || c.muted} strokeDasharray="4 4" label={r.label ? { value: r.label, position: 'insideTopRight', fontSize: 10, fill: c.muted } : undefined} />)}
            {series.map((s, i) => {
              const color = col(s, i);
              if (s.type === 'bar') return <Bar key={s.key} dataKey={s.key} name={s.name} fill={color} stackId={s.stack} radius={s.stack ? [0, 0, 0, 0] : [4, 4, 0, 0]} maxBarSize={barSize || 28} animationDuration={900} isAnimationActive>{s.cells && data.map((d, j) => <Cell key={j} fill={s.cells(d) || color} />)}</Bar>;
              if (s.type === 'area') return <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={color} strokeWidth={2} fill={`url(#area-${s.key})`} stackId={s.stack} connectNulls dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: c.card }} animationDuration={1100} />;
              return <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={color} strokeWidth={s.width ?? 2} strokeDasharray={s.dashed ? '5 4' : undefined}
                dot={s.dot ? { r: 3, fill: color, stroke: c.card, strokeWidth: 1.5 } : false} activeDot={{ r: 5, strokeWidth: 2, stroke: c.card }} connectNulls animationDuration={1200} />;
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {legend && series.length > 1 && <Legend items={series.map((s, i) => ({ name: s.name, color: col(s, i), dashed: s.dashed }))} />}
    </div>
  );
}

/** Horizontal or vertical categorical bars. */
export function BarList({ data, height, unit = '', dec = 0, color, horizontal = true, nameKey = 'name', valueKey = 'value', refLine, cellColor, labels = true }) {
  const { c } = useTheme();
  const h = height || (horizontal ? Math.max(120, data.length * 34) : 220);
  return (
    <div style={{ height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 4, right: labels ? 44 : 8, bottom: 0, left: horizontal ? 8 : -12 }}>
          <CartesianGrid horizontal={!horizontal} vertical={horizontal} />
          {horizontal ? <><XAxis type="number" hide /><YAxis type="category" dataKey={nameKey} width={120} tickLine={false} axisLine={false} /></>
            : <><XAxis dataKey={nameKey} tickLine={false} axisLine={false} interval={0} /><YAxis tickLine={false} axisLine={false} width={44} /></>}
          <Tooltip content={<ChartTooltip unit={unit} dec={dec} />} />
          {refLine != null && <ReferenceLine {...(horizontal ? { x: refLine } : { y: refLine })} stroke={c.muted} strokeDasharray="4 4" />}
          <Bar dataKey={valueKey} name={unit || 'Value'} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={22} animationDuration={900} fill={color || c.series[0]}>
            {data.map((d, i) => <Cell key={i} fill={cellColor ? cellColor(d, i) : color || c.series[0]} />)}
            {labels && <LabelList dataKey={valueKey} position={horizontal ? 'right' : 'top'} formatter={(v) => fmt(v, dec)} style={{ fill: c.fg2, fontSize: 11 }} />}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Donut({ data, size = 180, inner = 0.68, center, unit = '', dec = 0 }) {
  const { c } = useTheme();
  const [hover, setHover] = useState(null);
  const total = data.reduce((s, d) => s + (d.value || 0), 0);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={(size / 2) * inner} outerRadius={size / 2 - 4} paddingAngle={2} stroke={c.card} strokeWidth={2}
              animationDuration={1000} onMouseEnter={(_, i) => setHover(i)} onMouseLeave={() => setHover(null)}>
              {data.map((d, i) => <Cell key={i} fill={d.color || c.series[i % 8]} opacity={hover == null || hover === i ? 1 : 0.45} />)}
            </Pie>
            <Tooltip content={<ChartTooltip unit={unit} dec={dec} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>
      </div>
      <div className="space-y-1.5 text-sm">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-2" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color || c.series[i % 8] }} />
            <span className="text-fg2">{d.name}</span>
            <span className="tabular ml-auto pl-3 font-medium">{fmt(d.value, dec)}{unit}</span>
            <span className="tabular w-10 text-right text-xs text-muted">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RadarView({ data, height = 280, keys = [{ key: 'score', name: 'Score' }], max = 100 }) {
  const { c } = useTheme();
  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="72%">
            <PolarGrid />
            <PolarAngleAxis dataKey="name" tick={{ fill: c.fg2, fontSize: 11 }} />
            <PolarRadiusAxis domain={[0, max]} tick={false} axisLine={false} />
            {keys.map((k, i) => <Radar key={k.key} dataKey={k.key} name={k.name} stroke={k.color || c.series[i]} fill={k.color || c.series[i]} fillOpacity={0.22} strokeWidth={2} animationDuration={1100} dot={{ r: 3 }} />)}
            <Tooltip content={<ChartTooltip dec={0} />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      {keys.length > 1 && <Legend items={keys.map((k, i) => ({ name: k.name, color: k.color || c.series[i] }))} />}
    </div>
  );
}

export function Sparkline({ data, color, height = '100%' }) {
  const { c } = useTheme();
  const d = data.map((v, i) => ({ i, v }));
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={d} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Line type="monotone" dataKey="v" stroke={color || c.series[0]} strokeWidth={2} dot={false} connectNulls animationDuration={1200} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ScatterPlot({ pts, xName, yName, height = 280 }) {
  const { c } = useTheme();
  const n = pts.length;
  let line = null;
  if (n > 2) {
    const mx = pts.reduce((s, p) => s + p.x, 0) / n, my = pts.reduce((s, p) => s + p.y, 0) / n;
    const b = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / (pts.reduce((s, p) => s + (p.x - mx) ** 2, 0) || 1);
    const xs = pts.map((p) => p.x); const x0 = Math.min(...xs), x1 = Math.max(...xs);
    line = [{ x: x0, y: my + b * (x0 - mx) }, { x: x1, y: my + b * (x1 - mx) }];
  }
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 12, bottom: 18, left: -6 }}>
          <CartesianGrid />
          <XAxis type="number" dataKey="x" name={xName} domain={['auto', 'auto']} tickLine={false} label={{ value: xName, position: 'insideBottom', offset: -10, fill: c.muted, fontSize: 11 }} />
          <YAxis type="number" dataKey="y" name={yName} domain={['auto', 'auto']} tickLine={false} width={48} />
          <Tooltip content={({ active, payload }) => active && payload?.length ? (
            <div className="rounded-xl border border-line bg-card px-3 py-2 text-xs shadow-xl"><div>{xName}: <b>{fmt(payload[0].payload.x, 1)}</b></div><div>{yName}: <b>{fmt(payload[0].payload.y, 1)}</b></div></div>) : null} />
          <Scatter data={pts} fill={c.series[0]} fillOpacity={0.7} stroke={c.card} strokeWidth={1.5} animationDuration={900} />
          {line && <Scatter data={line} line={{ stroke: c.series[1], strokeWidth: 2 }} shape={() => null} legendType="none" isAnimationActive={false} />}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

/** GitHub-style calendar heatmap (sequential single hue). values: { date: 0..100 } */
export function CalendarHeatmap({ values, days = 182, end = todayISO(), label = 'Score', unit = '%' }) {
  const { c, dark } = useTheme();
  const steps = dark ? ['#184f95', '#256abf', '#3987e5', '#6da7ec', '#9ec5f4'] : ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#1c5cab'];
  const start = addDays(end, -(days - 1));
  const startDow = (new Date(start).getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    const idx = i + startDow;
    cells.push({ d, col: Math.floor(idx / 7), row: idx % 7, v: values[d] });
  }
  const cols = Math.max(...cells.map((x) => x.col)) + 1;
  const sz = 13, gap = 3;
  const [tip, setTip] = useState(null);
  const color = (v) => (v == null ? c.raised : steps[Math.min(4, Math.floor((v / 100) * 5))]);
  return (
    <div className="relative overflow-x-auto">
      <svg width={cols * (sz + gap) + 24} height={7 * (sz + gap) + 18}>
        {['M', '', 'W', '', 'F', '', ''].map((t, i) => <text key={i} x={0} y={i * (sz + gap) + sz - 2} fontSize={9} fill={c.muted}>{t}</text>)}
        {cells.map((x, i) => (
          <motion.rect key={x.d} x={x.col * (sz + gap) + 16} y={x.row * (sz + gap)} width={sz} height={sz} rx={3} fill={color(x.v)}
            initial={{ opacity: 0, scale: 0.3 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(1.2, i * 0.005) }}
            onMouseEnter={() => setTip(x)} onMouseLeave={() => setTip(null)} style={{ transformOrigin: 'center', transformBox: 'fill-box' }} />
        ))}
        {cells.filter((x) => x.row === 0 && x.d.endsWith('-01') || (x.row === 0 && Number(x.d.slice(8)) <= 7)).map((x) => (
          <text key={`m${x.d}`} x={x.col * (sz + gap) + 16} y={7 * (sz + gap) + 12} fontSize={9} fill={c.muted}>{fmtDate(x.d, 'MMM')}</text>
        ))}
      </svg>
      <div className="mt-1 flex items-center gap-1 text-[10px] text-muted">Less{steps.map((s) => <span key={s} className="h-2.5 w-2.5 rounded-sm" style={{ background: s }} />)}More
        {tip && <span className="ml-auto text-xs text-fg2">{fmtDate(tip.d, 'EEE d MMM')}: <b className="text-fg">{tip.v == null ? 'no data' : `${fmt(tip.v)}${unit}`}</b> {label}</span>}
      </div>
    </div>
  );
}

/** Semicircle gauge 0–100 with animated needle sweep. */
export function Gauge({ value, label, size = 200, zones }) {
  const { c } = useTheme();
  const r = size / 2 - 14, cx = size / 2, cy = size / 2;
  const arc = (a0, a1) => { const p = (a) => [cx + r * Math.cos(Math.PI * (1 - a)), cy - r * Math.sin(Math.PI * (1 - a))]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`; };
  const z = zones || [[0, 0.5, c.status.serious], [0.5, 0.75, c.status.warning], [0.75, 1, c.status.good]];
  const v = Math.max(0, Math.min(100, value ?? 0)) / 100;
  return (
    <div className="relative mx-auto" style={{ width: size, height: size / 2 + 58 }}>
      <svg width={size} height={size / 2 + 10}>
        {z.map(([a, b, col], i) => <path key={i} d={arc(a + 0.005, b - 0.005)} stroke={col} strokeWidth={12} fill="none" strokeLinecap="round" opacity={0.85} />)}
        <motion.g initial={{ rotate: -90 }} animate={{ rotate: -90 + v * 180 }} transition={{ type: 'spring', stiffness: 50, damping: 11 }} style={{ originX: `${cx}px`, originY: `${cy}px` }}>
          <line x1={cx} y1={cy} x2={cx} y2={cy - r + 18} stroke={c.fg} strokeWidth={3} strokeLinecap="round" />
        </motion.g>
        <circle cx={cx} cy={cy} r={7} fill={c.fg} />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <div className="text-2xl font-bold tabular">{value == null ? '—' : Math.round(value)}</div>
        {label && <div className="text-xs text-muted">{label}</div>}
      </div>
    </div>
  );
}
