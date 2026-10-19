// Every scalar metric stored in `entries`. Values are stored in the canonical unit; `dim` drives display conversion.
// layer: 1 inputs · 2 signals · 3 markers · 4 outcomes (the iceberg)
// agg: how a day collapses (sum | avg | last); good: which direction is better (up | down | range)
export const DOMAINS = {
  sleep: { name: 'Sleep', color: 1 },
  nutrition: { name: 'Nutrition', color: 2 },
  movement: { name: 'Movement', color: 3 },
  recovery: { name: 'Recovery & stress', color: 4 },
  body: { name: 'Body composition', color: 5 },
  metabolic: { name: 'Cardio-metabolic', color: 6 },
  mind: { name: 'Mind', color: 7 },
  medical: { name: 'Prevention & medical', color: 8 },
  substances: { name: 'Substances', color: 2 },
};

export const LAYERS = {
  1: { name: 'Inputs', short: 'L1', desc: 'What you do daily — fully in your control' },
  2: { name: 'Signals', short: 'L2', desc: 'How your body responds — early warnings' },
  3: { name: 'Markers', short: 'L3', desc: 'Measurable physiology — where drift hides' },
  4: { name: 'Outcomes', short: 'L4', desc: 'The visible tip — disease or peak health' },
};

const m = (name, unit, layer, domain, agg, good, extra = {}) => ({ name, unit, layer, domain, agg, good, dec: 0, ...extra });

export const METRICS = {
  // Body
  weight: m('Weight', 'kg', 3, 'body', 'last', 'range', { dim: 'mass', dec: 1 }),
  bodyfat: m('Body fat', '%', 3, 'body', 'last', 'down', { dec: 1 }),
  waist: m('Waist', 'cm', 3, 'body', 'last', 'down', { dim: 'length', dec: 1 }),
  hips: m('Hips', 'cm', 3, 'body', 'last', 'range', { dim: 'length', dec: 1 }),
  neck: m('Neck', 'cm', 3, 'body', 'last', 'range', { dim: 'length', dec: 1 }),
  chest: m('Chest', 'cm', 3, 'body', 'last', 'range', { dim: 'length', dec: 1 }),
  arm: m('Arm (flexed)', 'cm', 3, 'body', 'last', 'up', { dim: 'length', dec: 1 }),
  thigh: m('Thigh', 'cm', 3, 'body', 'last', 'range', { dim: 'length', dec: 1 }),
  lean_mass: m('Lean mass', 'kg', 3, 'body', 'last', 'up', { dim: 'mass', dec: 1 }),
  // Movement
  steps: m('Steps', 'steps', 1, 'movement', 'sum', 'up', { target: 8000 }),
  active_kcal: m('Active energy', 'kcal', 1, 'movement', 'sum', 'up'),
  sitting: m('Sitting time', 'h', 1, 'movement', 'sum', 'down', { dec: 1 }),
  // Nutrition extras (food itself lives in food_logs)
  water: m('Water', 'mL', 1, 'nutrition', 'sum', 'up', { target: 2500 }),
  caffeine: m('Caffeine', 'mg', 1, 'substances', 'sum', 'down', { target: 300 }),
  alcohol: m('Alcohol', 'units', 1, 'substances', 'sum', 'down', { dec: 1 }),
  cigarettes: m('Cigarettes', 'count', 1, 'substances', 'sum', 'down'),
  // Recovery / lifestyle inputs
  sunlight: m('Morning sunlight', 'min', 1, 'recovery', 'sum', 'up', { target: 10 }),
  meditation: m('Meditation / breathwork', 'min', 1, 'recovery', 'sum', 'up', { target: 10 }),
  outdoor: m('Time outdoors', 'min', 1, 'recovery', 'sum', 'up', { target: 30 }),
  screen_bed: m('Screens in last hour before bed', 'min', 1, 'sleep', 'sum', 'down'),
  work_hours: m('Work hours', 'h', 1, 'recovery', 'sum', 'range', { dec: 1 }),
  social: m('Meaningful social time', 'min', 1, 'mind', 'sum', 'up'),
  // Signals (wearables + vitals)
  rhr: m('Resting heart rate', 'bpm', 2, 'recovery', 'avg', 'down'),
  hrv: m('HRV', 'ms', 2, 'recovery', 'avg', 'up'),
  spo2: m('SpO₂', '%', 2, 'metabolic', 'avg', 'up'),
  resp_rate: m('Respiratory rate', '/min', 2, 'recovery', 'avg', 'range', { dec: 1 }),
  body_temp: m('Body temperature', '°C', 2, 'recovery', 'avg', 'range', { dec: 1 }),
  bp: m('Blood pressure', 'mmHg', 3, 'metabolic', 'last', 'down'),
  glucose: m('Glucose', 'mg/dL', 3, 'metabolic', 'last', 'down', { dim: 'glucose' }),
  vo2max: m('VO₂max', 'mL/kg/min', 3, 'movement', 'last', 'up', { dec: 1 }),
  // Daily check-in (1–5)
  energy: m('Energy', '/5', 2, 'recovery', 'avg', 'up', { scale: true }),
  mood: m('Mood', '/5', 2, 'mind', 'avg', 'up', { scale: true }),
  stress: m('Stress', '/5', 2, 'recovery', 'avg', 'down', { scale: true }),
  soreness: m('Soreness', '/5', 2, 'movement', 'avg', 'down', { scale: true }),
  focus: m('Focus', '/5', 2, 'mind', 'avg', 'up', { scale: true }),
  hunger: m('Hunger', '/5', 2, 'nutrition', 'avg', 'range', { scale: true }),
  digestion: m('Digestion', '/5', 2, 'nutrition', 'avg', 'up', { scale: true }),
  libido: m('Libido', '/5', 2, 'recovery', 'avg', 'up', { scale: true }),
  bristol: m('Stool (Bristol type)', 'type', 2, 'nutrition', 'last', 'range'),
  // Fitness test battery
  grip: m('Grip strength', 'kg', 3, 'movement', 'last', 'up', { dim: 'mass', dec: 1 }),
  pushups: m('Push-ups (max)', 'reps', 3, 'movement', 'last', 'up'),
  pullups: m('Pull-ups (max)', 'reps', 3, 'movement', 'last', 'up'),
  dead_hang: m('Dead hang', 's', 3, 'movement', 'last', 'up'),
  plank: m('Plank', 's', 3, 'movement', 'last', 'up'),
  sit_rise: m('Sit-to-rise score', '/10', 3, 'movement', 'last', 'up', { dec: 1 }),
  balance: m('Single-leg balance (eyes closed)', 's', 3, 'movement', 'last', 'up'),
  run_5k: m('5 km run time', 'min', 3, 'movement', 'last', 'down', { dec: 1 }),
  hr_recovery: m('HR recovery (1 min)', 'bpm', 3, 'movement', 'last', 'up'),
  // Mind questionnaires
  gad7: m('GAD-7 (anxiety)', '/21', 3, 'mind', 'last', 'down'),
  phq9: m('PHQ-9 (mood)', '/27', 3, 'mind', 'last', 'down'),
  // Cycle
  period: m('Period flow', '/3', 2, 'body', 'last', 'range'),
};

export const CHECKIN_KEYS = ['energy', 'mood', 'stress', 'soreness', 'focus', 'hunger', 'digestion'];
export const MEASURE_KEYS = ['waist', 'hips', 'neck', 'chest', 'arm', 'thigh', 'bodyfat'];
export const TEST_KEYS = ['grip', 'pushups', 'pullups', 'dead_hang', 'plank', 'sit_rise', 'balance', 'run_5k', 'hr_recovery', 'vo2max'];

// Food nutrient fields (per log row) with display info and default daily targets (adult)
export const NUTRIENTS = {
  kcal: { name: 'Calories', unit: 'kcal', dec: 0 },
  protein: { name: 'Protein', unit: 'g', dec: 0 },
  carbs: { name: 'Carbs', unit: 'g', dec: 0 },
  fat: { name: 'Fat', unit: 'g', dec: 0 },
  fiber: { name: 'Fibre', unit: 'g', dec: 0, target: 30 },
  sugar: { name: 'Sugar', unit: 'g', dec: 0, limit: 50 },
  satfat: { name: 'Saturated fat', unit: 'g', dec: 0, limit: 20 },
  sodium: { name: 'Sodium', unit: 'mg', dec: 0, limit: 2300 },
  potassium: { name: 'Potassium', unit: 'mg', dec: 0, target: 3400 },
  calcium: { name: 'Calcium', unit: 'mg', dec: 0, target: 1000 },
  iron: { name: 'Iron', unit: 'mg', dec: 1, target: 17 },
  vitc: { name: 'Vitamin C', unit: 'mg', dec: 0, target: 90 },
};
