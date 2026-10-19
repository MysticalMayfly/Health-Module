// Canonical storage: kg · cm · mg/dL. Display follows settings.units.
export const DEFAULT_UNITS = { mass: 'kg', length: 'cm', glucose: 'mg/dL', lipids: 'mg/dL' };

const LB = 0.45359237;
const IN = 2.54;
const GLU = 18.016; // mg/dL per mmol/L glucose
const CHOL = 38.67; // cholesterol (total, LDL, HDL, non-HDL)
const TG = 88.57; // triglycerides

// dim → { unitFor(units), to(display→canonical), from(canonical→display) }
const DIMS = {
  mass: { unit: (u) => u.mass, from: (v, u) => (u.mass === 'lb' ? v / LB : v), to: (v, u) => (u.mass === 'lb' ? v * LB : v) },
  length: { unit: (u) => u.length, from: (v, u) => (u.length === 'in' ? v / IN : v), to: (v, u) => (u.length === 'in' ? v * IN : v) },
  glucose: { unit: (u) => u.glucose, from: (v, u) => (u.glucose === 'mmol/L' ? v / GLU : v), to: (v, u) => (u.glucose === 'mmol/L' ? v * GLU : v) },
  chol: { unit: (u) => u.lipids, from: (v, u) => (u.lipids === 'mmol/L' ? v / CHOL : v), to: (v, u) => (u.lipids === 'mmol/L' ? v * CHOL : v) },
  tg: { unit: (u) => u.lipids, from: (v, u) => (u.lipids === 'mmol/L' ? v / TG : v), to: (v, u) => (u.lipids === 'mmol/L' ? v * TG : v) },
};

export function unitLabel(dim, fallback, units = DEFAULT_UNITS) {
  return dim && DIMS[dim] ? DIMS[dim].unit(units) : fallback;
}
export function fromCanonical(v, dim, units = DEFAULT_UNITS) {
  if (v == null || !dim || !DIMS[dim]) return v;
  return DIMS[dim].from(v, units);
}
export function toCanonical(v, dim, units = DEFAULT_UNITS) {
  if (v == null || v === '' || !dim || !DIMS[dim]) return v === '' ? null : v;
  return DIMS[dim].to(Number(v), units);
}
/** Extra decimals needed when a dim is shown in mmol/L. */
export function dimDecimals(dim, base, units = DEFAULT_UNITS) {
  if ((dim === 'glucose' && units.glucose === 'mmol/L') || ((dim === 'chol' || dim === 'tg') && units.lipids === 'mmol/L')) return Math.max(base, 2);
  return base;
}
export const KCAL_PER_KG = 7700;
