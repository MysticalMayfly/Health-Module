// The 198 journey: 1% disease tip · 99 causes of disease · 99 causes of health · 1% pinnacle.
import { ACTIONS, PHASES } from '@shared/actions.js';

export const ZONES = [
  { key: 'disease', name: 'Disease tip', from: -99, to: -67, status: 'critical', desc: 'Symptoms and diagnoses are visible. Repair is urgent and medical guidance comes first.' },
  { key: 'precip', name: 'Precipitating', from: -66, to: -34, status: 'serious', desc: 'Many causes of disease are active. The iceberg is building under the surface.' },
  { key: 'drift', name: 'Silent drift', from: -33, to: -1, status: 'warning', desc: 'You feel “fine”, but markers are drifting. This is the cheapest stage to turn around.' },
  { key: 'baseline', name: 'Baseline', from: 0, to: 33, status: 'neutral', desc: 'Neutral ground. The foundations are forming.' },
  { key: 'fitness', name: 'Fitness', from: 34, to: 66, status: 'good', desc: 'The causes of health outnumber the causes of disease. Resilience is compounding.' },
  { key: 'peak', name: 'Pinnacle', from: 67, to: 99, status: 'good', desc: 'Most of the 99 are in place. Performance, vitality and longevity become visible.' },
];
export const zoneOf = (p) => ZONES.find((z) => p >= z.from && p <= z.to) || (p < 0 ? ZONES[0] : ZONES.at(-1));
export { PHASES };

/** Suggest the current phase from position + adherence. */
export function suggestedPhase(position, adherence14) {
  if (position < -33) return 1;
  if (position < 0) return adherence14 >= 80 ? 2 : 1;
  if (position < 34) return adherence14 >= 80 ? 3 : 2;
  return adherence14 >= 80 ? 4 : 3;
}

// Onboarding answers → flags that trigger actions
export function flagsFrom(a, profile) {
  const f = new Set(['always']);
  if (a.sleepHours < 7) f.add('sleep_short');
  if (a.sleepRegular === 'no') f.add('sleep_irregular');
  if (a.screens === 'yes') f.add('screens');
  if ((a.water ?? 2) < 2) f.add('low_water');
  if (['under5k', '5to8k'].includes(a.steps)) f.add('sedentary');
  if (a.sugaryDrinks && a.sugaryDrinks !== 'never') f.add('sugary_drinks');
  if (a.meds && a.meds !== 'none') f.add('has_meds');
  if (a.smoking && a.smoking !== 'no') f.add('smoker');
  if (a.protein && a.protein !== 'most') f.add('low_protein');
  if (['fat_loss', 'muscle'].includes(profile.goal)) f.add('goal_weight');
  if ((a.caffeine ?? 0) >= 3) f.add('caffeine');
  if ((a.alcohol ?? 0) > 3) f.add('alcohol');
  if ((a.veg ?? 3) < 4) f.add('low_veg');
  if (a.lateEating === 'yes') f.add('late_eating');
  if (!a.strength) f.add('no_strength');
  if ((a.exerciseDays ?? 0) < 3) f.add('no_cardio');
  if ((a.stress ?? 3) >= 4) f.add('stress');
  if (a.pain === 'yes') f.add('pain');
  if (a.processed === 'often') f.add('processed');
  if (a.desk === 'yes') f.add('desk');
  if ((a.conditions || []).some((c) => ['prediabetes', 't2d'].includes(c))) f.add('glucose');
  return f;
}

/** Pick a starting set of 5–7 daily actions: phase 1 essentials first, filling from phase 2 by need. */
export function recommendActions(answers, profile) {
  const flags = flagsFrom(answers, profile);
  const score = (x) => x.triggers.filter((t) => flags.has(t)).length + (x.triggers.includes('always') ? 0.5 : 0);
  const p1 = ACTIONS.filter((x) => x.phase === 1 && x.triggers.some((t) => flags.has(t))).sort((x, y) => score(y) - score(x));
  const p2 = ACTIONS.filter((x) => x.phase === 2 && x.triggers.some((t) => flags.has(t) && t !== 'always')).sort((x, y) => score(y) - score(x));
  const picked = [...p1.slice(0, 6)];
  for (const x of p2) { if (picked.length >= 7) break; if (picked.length < 5 || score(x) >= 1) picked.push(x); }
  return picked.map((x) => x.key);
}

/** Actions to offer when unlocking the next phase. */
export function nextPhaseActions(phase, existingKeys, answers, profile) {
  const flags = flagsFrom(answers || {}, profile || {});
  return ACTIONS.filter((x) => x.phase === phase && !existingKeys.includes(x.key))
    .sort((x, y) => y.triggers.filter((t) => flags.has(t)).length - x.triggers.filter((t) => flags.has(t)).length);
}

export const CONDITIONS = [
  ['none', 'None'], ['prediabetes', 'Prediabetes'], ['t2d', 'Type 2 diabetes'], ['hypertension', 'High blood pressure'], ['cholesterol', 'High cholesterol'],
  ['fatty_liver', 'Fatty liver'], ['thyroid', 'Thyroid disorder'], ['pcos', 'PCOS'], ['obesity', 'Obesity'], ['heart', 'Heart disease'],
  ['asthma', 'Asthma'], ['mental', 'Anxiety / depression'], ['gut', 'IBS / gut issues'], ['other', 'Other'],
];
export const FAMILY = [['diabetes', 'Diabetes'], ['heart', 'Heart disease / stroke'], ['bp', 'High blood pressure'], ['cancer', 'Cancer'], ['dementia', 'Dementia'], ['none', 'None known']];
export const GOALS = [
  ['fat_loss', 'Lose fat', 'Drop body fat while keeping muscle'],
  ['muscle', 'Build muscle', 'Gain lean mass with minimal fat'],
  ['longevity', 'Longevity & healthspan', 'Fix the 99 causes; stay disease-free'],
  ['condition', 'Reverse a condition', 'Prediabetes, BP, cholesterol, fatty liver…'],
  ['performance', 'Energy & performance', 'Feel and perform at your peak'],
];
