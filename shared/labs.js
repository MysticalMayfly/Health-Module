// Biomarker catalog. Values stored in `unit`; `dim` enables mg/dL ↔ mmol/L display.
// ref = typical lab reference range; opt = a stricter "optimal" range you can edit per marker in Settings.
// Ranges are informational defaults, not medical advice.
const mk = (name, panel, unit, ref, opt, good = 'range', extra = {}) => ({ name, panel, unit, ref, opt, good, ...extra });

export const LAB_MARKERS = {
  fasting_glucose: mk('Fasting glucose', 'Metabolic', 'mg/dL', [70, 99], [72, 90], 'down', { dim: 'glucose', aliases: ['glucose fasting', 'fbs', 'fasting blood sugar', 'glucose, fasting'] }),
  hba1c: mk('HbA1c', 'Metabolic', '%', [4, 5.6], [4.5, 5.3], 'down', { dec: 1, aliases: ['hba1c', 'glycated hemoglobin', 'glycosylated haemoglobin', 'a1c'] }),
  fasting_insulin: mk('Fasting insulin', 'Metabolic', 'µIU/mL', [2.6, 24.9], [2, 8], 'down', { dec: 1, aliases: ['insulin fasting', 'insulin'] }),
  uric_acid: mk('Uric acid', 'Metabolic', 'mg/dL', [3.5, 7.2], [3.5, 6], 'down', { dec: 1, aliases: ['uric acid', 'urate'] }),
  total_chol: mk('Total cholesterol', 'Lipids', 'mg/dL', [0, 200], [120, 180], 'down', { dim: 'chol', aliases: ['total cholesterol', 'cholesterol total', 'cholesterol, total'] }),
  ldl: mk('LDL cholesterol', 'Lipids', 'mg/dL', [0, 129], [0, 100], 'down', { dim: 'chol', aliases: ['ldl', 'ldl cholesterol', 'ldl-c', 'ldl cholesterol direct'] }),
  hdl: mk('HDL cholesterol', 'Lipids', 'mg/dL', [40, 200], [50, 100], 'up', { dim: 'chol', aliases: ['hdl', 'hdl cholesterol', 'hdl-c'] }),
  triglycerides: mk('Triglycerides', 'Lipids', 'mg/dL', [0, 150], [0, 100], 'down', { dim: 'tg', aliases: ['triglycerides', 'triglyceride', 'tg'] }),
  apob: mk('ApoB', 'Lipids', 'mg/dL', [0, 100], [0, 80], 'down', { aliases: ['apolipoprotein b', 'apo b', 'apob'] }),
  lpa: mk('Lp(a)', 'Lipids', 'nmol/L', [0, 75], [0, 75], 'down', { aliases: ['lipoprotein a', 'lp(a)', 'lpa'] }),
  hscrp: mk('hs-CRP', 'Inflammation', 'mg/L', [0, 3], [0, 1], 'down', { dec: 1, aliases: ['hs-crp', 'hscrp', 'c-reactive protein', 'crp'] }),
  homocysteine: mk('Homocysteine', 'Inflammation', 'µmol/L', [5, 15], [5, 10], 'down', { dec: 1, aliases: ['homocysteine'] }),
  vitd: mk('Vitamin D (25-OH)', 'Vitamins', 'ng/mL', [30, 100], [40, 60], 'range', { aliases: ['vitamin d', '25-oh vitamin d', '25 hydroxy vitamin d', 'vitamin d total'] }),
  b12: mk('Vitamin B12', 'Vitamins', 'pg/mL', [200, 900], [400, 900], 'up', { aliases: ['vitamin b12', 'b12', 'cobalamin'] }),
  folate: mk('Folate', 'Vitamins', 'ng/mL', [3, 20], [10, 20], 'up', { dec: 1, aliases: ['folate', 'folic acid'] }),
  ferritin: mk('Ferritin', 'Vitamins', 'ng/mL', [30, 400], [50, 200], 'range', { aliases: ['ferritin'] }),
  magnesium: mk('Magnesium', 'Vitamins', 'mg/dL', [1.7, 2.2], [2, 2.2], 'range', { dec: 2, aliases: ['magnesium'] }),
  tsh: mk('TSH', 'Thyroid', 'mIU/L', [0.4, 4.5], [0.5, 2.5], 'range', { dec: 2, aliases: ['tsh', 'thyroid stimulating hormone'] }),
  ft4: mk('Free T4', 'Thyroid', 'ng/dL', [0.8, 1.8], [1, 1.5], 'range', { dec: 2, aliases: ['free t4', 'ft4'] }),
  alt: mk('ALT (SGPT)', 'Liver', 'U/L', [7, 56], [7, 30], 'down', { aliases: ['alt', 'sgpt', 'alanine aminotransferase'] }),
  ast: mk('AST (SGOT)', 'Liver', 'U/L', [10, 40], [10, 30], 'down', { aliases: ['ast', 'sgot', 'aspartate aminotransferase'] }),
  ggt: mk('GGT', 'Liver', 'U/L', [8, 61], [8, 30], 'down', { aliases: ['ggt', 'gamma gt'] }),
  creatinine: mk('Creatinine', 'Kidney', 'mg/dL', [0.7, 1.3], [0.7, 1.1], 'range', { dec: 2, aliases: ['creatinine', 'serum creatinine'] }),
  egfr: mk('eGFR', 'Kidney', 'mL/min/1.73m²', [90, 200], [90, 200], 'up', { aliases: ['egfr'] }),
  bun: mk('BUN / urea nitrogen', 'Kidney', 'mg/dL', [7, 20], [8, 16], 'range', { aliases: ['bun', 'blood urea nitrogen'] }),
  hemoglobin: mk('Hemoglobin', 'Blood count', 'g/dL', [13.5, 17.5], [14, 16], 'range', { dec: 1, refF: [12, 15.5], optF: [12.5, 14.5], aliases: ['hemoglobin', 'haemoglobin', 'hb'] }),
  wbc: mk('White blood cells', 'Blood count', '10³/µL', [4.5, 11], [4, 7], 'range', { dec: 1, aliases: ['wbc', 'total leucocyte count', 'tlc'] }),
  platelets: mk('Platelets', 'Blood count', '10³/µL', [150, 450], [175, 350], 'range', { aliases: ['platelets', 'platelet count'] }),
  testosterone: mk('Testosterone (total)', 'Hormones', 'ng/dL', [300, 1000], [500, 900], 'up', { aliases: ['testosterone', 'total testosterone'] }),
  psa: mk('PSA', 'Hormones', 'ng/mL', [0, 4], [0, 2.5], 'down', { dec: 2, aliases: ['psa', 'prostate specific antigen'] }),
};

export const LAB_PANELS = [...new Set(Object.values(LAB_MARKERS).map((x) => x.panel))];

/** Derived marker: HOMA-IR = glucose (mg/dL) × insulin (µIU/mL) / 405 */
export const homaIR = (glucose, insulin) => (glucose && insulin ? (glucose * insulin) / 405 : null);
