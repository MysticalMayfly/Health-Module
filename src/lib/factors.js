// THE 99 — each factor is one "cause" beneath the iceberg. true = a cause of health in place (+1 step),
// false = a cause of disease active (−1 step), null = unknown (measure it!). Position = good − bad ∈ [−99, +99].
// Data always wins; onboarding answers are the fallback so day one already has a position.
import { fmt, fmtHours, minutesToClock } from './format.js';

const STEPS_ANS = { under5k: 4000, '5to8k': 6500, '8to12k': 10000, over12k: 13000 };
const or = (v, fb) => (v != null ? v : fb ?? null);
const cmp = (v, fn) => (v == null ? null : fn(v));
const male = (c) => c.profile.sex !== 'female';

const F = (id, domain, layer, label, evalFn, show) => ({ id, domain, layer, label, eval: evalFn, show });

export const FACTORS = [
  // ── SLEEP (12)
  F('sleep_avg', 'sleep', 1, 'Average sleep ≥ 7 h', (c) => cmp(or(c.sleepAvg, c.answers.sleepHours), (v) => v >= 7), (c) => fmtHours(or(c.sleepAvg, c.answers.sleepHours))),
  F('sleep_short', 'sleep', 1, 'No more than 1 night under 6 h per week', (c) => (c.sleepNights >= 5 ? c.shortNights <= 2 : cmp(c.answers.sleepHours, (v) => v >= 6)), (c) => `${c.shortNights ?? '—'} short nights / 14 d`),
  F('bed_regular', 'sleep', 1, 'Bedtime varies by less than 45 min', (c) => (c.bedSd != null ? c.bedSd < 45 : c.answers.sleepRegular ? c.answers.sleepRegular === 'yes' : null), (c) => (c.bedSd != null ? `±${Math.round(c.bedSd)} min` : null)),
  F('wake_regular', 'sleep', 1, 'Wake time varies by less than 45 min', (c) => cmp(c.wakeSd, (v) => v < 45), (c) => (c.wakeSd != null ? `±${Math.round(c.wakeSd)} min` : null)),
  F('bed_midnight', 'sleep', 1, 'Usually asleep before midnight', (c) => cmp(c.bedAvg, (v) => v < 360), (c) => minutesToClock(c.bedAvg)),
  F('screens_bed', 'sleep', 1, 'Under 15 min of screens in the last hour before bed', (c) => (c.screenBed != null ? c.screenBed < 15 : c.answers.screens ? c.answers.screens === 'no' : null), (c) => (c.screenBed != null ? `${Math.round(c.screenBed)} min` : null)),
  F('latency', 'sleep', 2, 'Falls asleep within 20 min', (c) => cmp(c.latency, (v) => v <= 20), (c) => (c.latency != null ? `${Math.round(c.latency)} min` : null)),
  F('efficiency', 'sleep', 2, 'Sleep efficiency ≥ 85%', (c) => cmp(c.efficiency, (v) => v >= 85), (c) => (c.efficiency != null ? `${Math.round(c.efficiency)}%` : null)),
  F('sleep_debt', 'sleep', 2, 'Sleep debt under 3 h (14 d)', (c) => cmp(c.sleepDebt, (v) => v < 3), (c) => (c.sleepDebt != null ? fmtHours(c.sleepDebt) : null)),
  F('deep', 'sleep', 2, 'Deep sleep ≥ 13% of the night', (c) => cmp(c.deepPct, (v) => v >= 13), (c) => (c.deepPct != null ? `${c.deepPct.toFixed(0)}%` : null)),
  F('rem', 'sleep', 2, 'REM sleep ≥ 18% of the night', (c) => cmp(c.remPct, (v) => v >= 18), (c) => (c.remPct != null ? `${c.remPct.toFixed(0)}%` : null)),
  F('rested', 'sleep', 2, 'Wakes feeling rested (quality ≥ 3.5/5)', (c) => cmp(c.quality, (v) => v >= 3.5), (c) => (c.quality != null ? `${c.quality.toFixed(1)}/5` : null)),

  // ── NUTRITION (17)
  F('logging', 'nutrition', 1, 'Food logged on ≥ 80% of days', (c) => (c.foodDays || c.answers.diet ? c.foodDays >= 11 : null), (c) => `${c.foodDays}/14 days`),
  F('protein', 'nutrition', 1, 'Protein ≥ 90% of target', (c) => (c.foodDays >= 4 ? c.f('protein') >= c.targets.protein * 0.9 : c.answers.protein ? c.answers.protein === 'most' : null), (c) => (c.foodDays ? `${fmt(c.f('protein'))} / ${c.targets.protein} g` : null)),
  F('fiber', 'nutrition', 1, 'Fibre ≥ 25 g / day', (c) => (c.foodDays >= 4 ? c.f('fiber') >= 25 : null), (c) => (c.foodDays ? `${fmt(c.f('fiber'))} g` : null)),
  F('upf', 'nutrition', 1, 'Ultra-processed food under 20% of calories', (c) => (c.foodDays >= 4 ? c.f('upf_pct') < 20 : c.answers.processed ? c.answers.processed !== 'often' : null), (c) => (c.foodDays ? `${fmt(c.f('upf_pct'))}%` : null)),
  F('sugar', 'nutrition', 1, 'Total sugar under 50 g / day', (c) => (c.foodDays >= 4 ? c.f('sugar') < 50 : c.answers.sugaryDrinks ? c.answers.sugaryDrinks === 'never' : null), (c) => (c.foodDays ? `${fmt(c.f('sugar'))} g` : null)),
  F('sodium', 'nutrition', 1, 'Sodium under 2,300 mg / day', (c) => (c.foodDays >= 4 ? c.f('sodium') < 2300 : null), (c) => (c.foodDays ? `${fmt(c.f('sodium'))} mg` : null)),
  F('satfat', 'nutrition', 1, 'Saturated fat under 10% of calories', (c) => (c.foodDays >= 4 ? (c.f('satfat') * 9) / c.f('kcal') < 0.1 : null), (c) => (c.foodDays ? `${fmt(((c.f('satfat') * 9) / c.f('kcal')) * 100)}%` : null)),
  F('plants', 'nutrition', 1, '5+ servings of fruit & vegetables', (c) => (c.foodDays >= 4 ? c.f('plant_servings') >= 5 : cmp(c.answers.veg, (v) => v >= 5)), (c) => (c.foodDays ? `${fmt(c.f('plant_servings'), 1)} servings` : null)),
  F('variety', 'nutrition', 1, '4+ different plant foods per day', (c) => (c.foodDays >= 4 ? c.f('plant_variety') >= 4 : null), (c) => (c.foodDays ? `${fmt(c.f('plant_variety'), 1)} / day` : null)),
  F('kcal_target', 'nutrition', 1, 'Calories within ±10% of target', (c) => (c.foodDays >= 4 ? Math.abs(c.f('kcal') - c.targets.kcal) <= c.targets.kcal * 0.1 : null), (c) => (c.foodDays ? `${fmt(c.f('kcal'))} / ${fmt(c.targets.kcal)} kcal` : null)),
  F('water', 'nutrition', 1, 'Water at goal', (c) => (c.water != null ? c.water >= c.targets.water * 0.9 : cmp(c.answers.water, (v) => v * 1000 >= c.targets.water * 0.9)), (c) => (c.water != null ? `${fmt(c.water)} mL` : null)),
  F('potassium', 'nutrition', 1, 'Potassium ≥ 3,000 mg', (c) => (c.foodDays >= 4 ? c.f('potassium') >= 3000 : null), (c) => (c.foodDays ? `${fmt(c.f('potassium'))} mg` : null)),
  F('calcium', 'nutrition', 1, 'Calcium ≥ 800 mg', (c) => (c.foodDays >= 4 ? c.f('calcium') >= 800 : null), (c) => (c.foodDays ? `${fmt(c.f('calcium'))} mg` : null)),
  F('iron', 'nutrition', 1, 'Iron at RDA', (c) => (c.foodDays >= 4 ? c.f('iron') >= (male(c) ? 8 : 18) : null), (c) => (c.foodDays ? `${fmt(c.f('iron'), 1)} mg` : null)),
  F('vitc', 'nutrition', 1, 'Vitamin C ≥ 75 mg', (c) => (c.foodDays >= 4 ? c.f('vitc') >= 75 : null), (c) => (c.foodDays ? `${fmt(c.f('vitc'))} mg` : null)),
  F('late_meal', 'nutrition', 1, 'Last meal ≥ 3 h before bed', (c) => (c.lastMealGap != null ? c.lastMealGap >= 180 : c.answers.lateEating ? c.answers.lateEating === 'no' : null), (c) => (c.lastMealGap != null ? `${fmt(c.lastMealGap / 60, 1)} h gap` : null)),
  F('sugary_drinks', 'nutrition', 1, 'No sugary drinks', (c) => (c.answers.sugaryDrinks ? c.answers.sugaryDrinks === 'never' : null)),

  // ── MOVEMENT (17)
  F('steps7k', 'movement', 1, 'Averaging ≥ 7,000 steps', (c) => cmp(or(c.steps, STEPS_ANS[c.answers.steps]), (v) => v >= 7000), (c) => fmt(or(c.steps, STEPS_ANS[c.answers.steps]))),
  F('steps10k', 'movement', 1, 'Averaging ≥ 10,000 steps', (c) => cmp(or(c.steps, STEPS_ANS[c.answers.steps]), (v) => v >= 10000), (c) => fmt(or(c.steps, STEPS_ANS[c.answers.steps]))),
  F('strength2', 'movement', 1, 'Strength training ≥ 2× / week', (c) => (c.strengthPerWk || c.answers.strength == null ? c.strengthPerWk >= 2 : c.answers.strength >= 2), (c) => `${fmt(c.strengthPerWk, 1)}/wk`),
  F('strength3', 'movement', 1, 'Strength training ≥ 3× / week', (c) => (c.strengthPerWk || c.answers.strength == null ? c.strengthPerWk >= 3 : c.answers.strength >= 3), (c) => `${fmt(c.strengthPerWk, 1)}/wk`),
  F('zone2', 'movement', 1, 'Zone-2 cardio ≥ 150 min / week', (c) => (c.z2PerWk || c.answers.exerciseDays == null ? c.z2PerWk >= 150 : c.answers.exerciseDays >= 5), (c) => `${fmt(c.z2PerWk)} min/wk`),
  F('vigorous', 'movement', 1, 'Vigorous session ≥ 1× / week', (c) => (c.vigorousPerWk || c.strengthPerWk ? c.vigorousPerWk >= 1 : null), (c) => `${fmt(c.vigorousPerWk, 1)}/wk`),
  F('mobility', 'movement', 1, 'Mobility / yoga ≥ 1× / week', (c) => (c.trainDaysPerWk ? c.mobilityPerWk >= 1 : null), (c) => `${fmt(c.mobilityPerWk, 1)}/wk`),
  F('overload', 'movement', 2, 'Strength progressing over 8 weeks', (c) => cmp(c.liftProgress, (v) => v > 0), (c) => (c.liftProgress != null ? `${c.liftProgress > 0 ? '+' : ''}${fmt(c.liftProgress, 1)} kg e1RM` : null)),
  F('vo2', 'movement', 3, 'VO₂max above average for age', (c) => cmp(c.test('vo2max'), (v) => v >= (male(c) ? 42 : 35) - Math.max(0, (c.age || 30) - 30) * 0.3), (c) => fmt(c.test('vo2max'), 1)),
  F('grip', 'movement', 3, 'Grip strength healthy for sex', (c) => cmp(c.test('grip'), (v) => v >= (male(c) ? 40 : 25)), (c) => (c.test('grip') ? `${fmt(c.test('grip'), 1)} kg` : null)),
  F('pushups', 'movement', 3, `Push-ups ≥ 20 (men) / 10 (women)`, (c) => cmp(c.test('pushups'), (v) => v >= (male(c) ? 20 : 10)), (c) => fmt(c.test('pushups'))),
  F('plank', 'movement', 3, 'Plank ≥ 60 s', (c) => cmp(c.test('plank'), (v) => v >= 60), (c) => (c.test('plank') ? `${fmt(c.test('plank'))} s` : null)),
  F('sit_rise', 'movement', 3, 'Sit-to-rise score ≥ 8/10', (c) => cmp(c.test('sit_rise'), (v) => v >= 8), (c) => fmt(c.test('sit_rise'), 1)),
  F('balance', 'movement', 3, 'Single-leg balance ≥ 10 s (eyes closed)', (c) => cmp(c.test('balance'), (v) => v >= 10), (c) => (c.test('balance') ? `${fmt(c.test('balance'))} s` : null)),
  F('run5k', 'movement', 3, '5 km in under 30 min', (c) => cmp(c.test('run_5k'), (v) => v < 30), (c) => (c.test('run_5k') ? `${fmt(c.test('run_5k'), 1)} min` : null)),
  F('hrr', 'movement', 3, 'Heart-rate recovery ≥ 20 bpm in 1 min', (c) => cmp(c.test('hr_recovery'), (v) => v >= 20), (c) => fmt(c.test('hr_recovery'))),
  F('hang', 'movement', 3, 'Dead hang ≥ 30 s', (c) => cmp(c.test('dead_hang'), (v) => v >= 30), (c) => (c.test('dead_hang') ? `${fmt(c.test('dead_hang'))} s` : null)),

  // ── RECOVERY & STRESS (10)
  F('rhr70', 'recovery', 2, 'Resting HR under 70 bpm', (c) => cmp(c.rhr, (v) => v < 70), (c) => (c.rhr ? `${fmt(c.rhr)} bpm` : null)),
  F('rhr60', 'recovery', 2, 'Resting HR under 60 bpm', (c) => cmp(c.rhr, (v) => v < 60), (c) => (c.rhr ? `${fmt(c.rhr)} bpm` : null)),
  F('hrv_base', 'recovery', 2, 'HRV at or above your 60-day baseline', (c) => (c.hrv7 != null && c.hrv60 != null ? c.hrv7 >= c.hrv60 * 0.97 : null), (c) => (c.hrv7 ? `${fmt(c.hrv7)} vs ${fmt(c.hrv60)} ms` : null)),
  F('rhr_drift', 'recovery', 2, 'Resting HR not drifting upward', (c) => (c.rhr7 != null && c.rhr30 != null ? c.rhr7 - c.rhr30 < 3 : null), (c) => (c.rhr7 ? `${(c.rhr7 - c.rhr30).toFixed(1)} bpm vs baseline` : null)),
  F('stress', 'recovery', 2, 'Perceived stress ≤ 3 / 5', (c) => cmp(or(c.ci('stress'), c.answers.stress), (v) => v <= 3), (c) => fmt(or(c.ci('stress'), c.answers.stress), 1)),
  F('energy', 'recovery', 2, 'Energy ≥ 3.5 / 5', (c) => cmp(c.ci('energy'), (v) => v >= 3.5), (c) => fmt(c.ci('energy'), 1)),
  F('meditate', 'recovery', 1, 'Meditation / breathwork ≥ 3 days / week', (c) => (c.meditateDays || c.ciDays ? c.meditateDays >= 3 : null), (c) => `${fmt(c.meditateDays, 1)} d/wk`),
  F('sunlight', 'recovery', 1, 'Morning sunlight ≥ 4 days / week', (c) => (c.sunDays ? c.sunDays >= 4 : c.answers.sunlight ? c.answers.sunlight === 'daily' : null), (c) => `${fmt(c.sunDays, 1)} d/wk`),
  F('readiness', 'recovery', 2, 'Average readiness ≥ 60', (c) => cmp(c.readinessAvg, (v) => v >= 60), (c) => fmt(c.readinessAvg)),
  F('rest_day', 'recovery', 1, 'At least 1 rest day / week', (c) => (c.trainDaysPerWk ? c.restDays7 >= 1 : null), (c) => `${c.restDays7} rest days`),

  // ── BODY COMPOSITION (8)
  F('whtr55', 'body', 3, 'Waist-to-height under 0.55', (c) => (c.waist && c.profile.height ? c.waist.value / c.profile.height < 0.55 : null), (c) => (c.waist && c.profile.height ? (c.waist.value / c.profile.height).toFixed(2) : null)),
  F('whtr50', 'body', 3, 'Waist-to-height under 0.50', (c) => (c.waist && c.profile.height ? c.waist.value / c.profile.height < 0.5 : null), (c) => (c.waist && c.profile.height ? (c.waist.value / c.profile.height).toFixed(2) : null)),
  F('bodyfat', 'body', 3, 'Body fat in healthy range', (c) => (c.bodyfat ? (male(c) ? c.bodyfat.value >= 8 && c.bodyfat.value <= 20 : c.bodyfat.value >= 18 && c.bodyfat.value <= 30) : null), (c) => (c.bodyfat ? `${fmt(c.bodyfat.value, 1)}%` : null)),
  F('bmi', 'body', 3, 'BMI 18.5–25 (low weight in scoring)', (c) => { const w = c.weightTrend ?? c.profile.weight; return w && c.profile.height ? (w / (c.profile.height / 100) ** 2 >= 18.5 && w / (c.profile.height / 100) ** 2 < 25) : null; }, (c) => { const w = c.weightTrend ?? c.profile.weight; return w && c.profile.height ? fmt(w / (c.profile.height / 100) ** 2, 1) : null; }),
  F('toward_goal', 'body', 3, 'Weight trend moving toward goal', (c) => { if (c.weeklyRate == null || !c.profile.targetWeight) return null; const gap = c.profile.targetWeight - c.weightTrend; return Math.abs(gap) < 1 ? Math.abs(c.weeklyRate) < 0.2 : Math.sign(c.weeklyRate) === Math.sign(gap); }, (c) => (c.weeklyRate != null ? `${c.weeklyRate > 0 ? '+' : ''}${c.weeklyRate.toFixed(2)} kg/wk` : null)),
  F('safe_rate', 'body', 2, 'Weight change under 1% per week (muscle-safe)', (c) => (c.weeklyRate != null && c.weightTrend ? Math.abs(c.weeklyRate) <= c.weightTrend * 0.01 : null)),
  F('weigh_ins', 'body', 1, 'Weighing in ≥ 4× / week', (c) => (c.weighIns || c.weightTrend ? c.weighIns >= 4 : null), (c) => `${fmt(c.weighIns, 1)}/wk`),
  F('measured', 'body', 1, 'Body measurements in the last 35 days', (c) => (c.lastMeasure ? c.since(c.lastMeasure) <= 35 : c.weightTrend ? false : null), (c) => (c.lastMeasure ? `${c.since(c.lastMeasure)} d ago` : 'never')),

  // ── CARDIO-METABOLIC (15)
  F('bp130', 'metabolic', 3, 'Blood pressure under 130/85', (c) => (c.bp ? c.bp.s < 130 && c.bp.d < 85 : null), (c) => (c.bp ? `${Math.round(c.bp.s)}/${Math.round(c.bp.d)}` : null)),
  F('bp120', 'metabolic', 3, 'Blood pressure under 120/80', (c) => (c.bp ? c.bp.s < 120 && c.bp.d < 80 : null), (c) => (c.bp ? `${Math.round(c.bp.s)}/${Math.round(c.bp.d)}` : null)),
  F('fg100', 'metabolic', 3, 'Fasting glucose under 100 mg/dL', (c) => cmp(or(c.gFast, c.lab('fasting_glucose')), (v) => v < 100), (c) => fmt(or(c.gFast, c.lab('fasting_glucose')))),
  F('fg90', 'metabolic', 3, 'Fasting glucose under 90 mg/dL', (c) => cmp(or(c.gFast, c.lab('fasting_glucose')), (v) => v < 90), (c) => fmt(or(c.gFast, c.lab('fasting_glucose')))),
  F('post_meal', 'metabolic', 3, 'Post-meal glucose under 140 mg/dL', (c) => cmp(c.gPost, (v) => v < 140), (c) => fmt(c.gPost)),
  F('a1c57', 'metabolic', 3, 'HbA1c under 5.7%', (c) => cmp(c.lab('hba1c'), (v) => v < 5.7), (c) => fmt(c.lab('hba1c'), 1)),
  F('a1c54', 'metabolic', 3, 'HbA1c under 5.4%', (c) => cmp(c.lab('hba1c'), (v) => v < 5.4), (c) => fmt(c.lab('hba1c'), 1)),
  F('insulin', 'metabolic', 3, 'Insulin sensitive (HOMA-IR under 2)', (c) => (c.lab('fasting_insulin') && c.lab('fasting_glucose') ? (c.lab('fasting_insulin') * c.lab('fasting_glucose')) / 405 < 2 : null), (c) => (c.lab('fasting_insulin') ? fmt((c.lab('fasting_insulin') * c.lab('fasting_glucose')) / 405, 2) : null)),
  F('tg', 'metabolic', 3, 'Triglycerides under 150 mg/dL', (c) => cmp(c.lab('triglycerides'), (v) => v < 150), (c) => fmt(c.lab('triglycerides'))),
  F('tg_hdl', 'metabolic', 3, 'TG / HDL ratio under 2', (c) => (c.lab('triglycerides') && c.lab('hdl') ? c.lab('triglycerides') / c.lab('hdl') < 2 : null), (c) => (c.lab('hdl') ? fmt(c.lab('triglycerides') / c.lab('hdl'), 1) : null)),
  F('hdl', 'metabolic', 3, 'HDL ≥ 40 (men) / 50 (women)', (c) => cmp(c.lab('hdl'), (v) => v >= (male(c) ? 40 : 50)), (c) => fmt(c.lab('hdl'))),
  F('apob', 'metabolic', 3, 'ApoB under 100 mg/dL (or LDL under 130)', (c) => (c.lab('apob') != null ? c.lab('apob') < 100 : cmp(c.lab('ldl'), (v) => v < 130)), (c) => fmt(c.lab('apob') ?? c.lab('ldl'))),
  F('crp', 'metabolic', 3, 'hs-CRP under 1 mg/L (low inflammation)', (c) => cmp(c.lab('hscrp'), (v) => v < 1), (c) => fmt(c.lab('hscrp'), 1)),
  F('alt', 'metabolic', 3, 'ALT under 30 U/L (liver fat signal)', (c) => cmp(c.lab('alt'), (v) => v < 30), (c) => fmt(c.lab('alt'))),
  F('spo2', 'metabolic', 2, 'Blood oxygen ≥ 95%', (c) => cmp(c.spo2, (v) => v >= 95), (c) => (c.spo2 ? `${fmt(c.spo2)}%` : null)),

  // ── MIND (6)
  F('mood', 'mind', 2, 'Mood ≥ 3.5 / 5', (c) => cmp(c.ci('mood'), (v) => v >= 3.5), (c) => fmt(c.ci('mood'), 1)),
  F('focus', 'mind', 2, 'Focus ≥ 3.5 / 5', (c) => cmp(c.ci('focus'), (v) => v >= 3.5), (c) => fmt(c.ci('focus'), 1)),
  F('gad7', 'mind', 3, 'GAD-7 under 5 (minimal anxiety)', (c) => cmp(c.gad7, (v) => v < 5), (c) => fmt(c.gad7)),
  F('phq9', 'mind', 3, 'PHQ-9 under 5 (minimal low mood)', (c) => cmp(c.phq9, (v) => v < 5), (c) => fmt(c.phq9)),
  F('checkins', 'mind', 1, 'Daily check-in ≥ 5 days / week', (c) => (c.ciDays || c.foodDays ? c.ciDays >= 10 : null), (c) => `${c.ciDays}/14 days`),
  F('actions', 'mind', 1, 'Daily actions ≥ 70% complete', (c) => cmp(c.adh14, (v) => v >= 70), (c) => (c.adh14 != null ? `${Math.round(c.adh14)}%` : null)),

  // ── SUBSTANCES (4)
  F('alcohol_units', 'substances', 1, 'Alcohol ≤ 7 units / week', (c) => (c.alcoholLogged ? c.alcoholWk <= 7 : cmp(c.answers.alcohol, (v) => v <= 7)), (c) => `${fmt(c.alcoholLogged ? c.alcoholWk : c.answers.alcohol, 1)} /wk`),
  F('alcohol_free', 'substances', 1, '≥ 5 alcohol-free days / week', (c) => (c.alcoholLogged ? c.alcoholDays <= 2 : cmp(c.answers.alcohol, (v) => v <= 3)), (c) => (c.alcoholLogged ? `${fmt(7 - c.alcoholDays, 1)} free d/wk` : null)),
  F('smoke', 'substances', 1, 'Smoke-free', (c) => (c.cigs.length ? c.cigs.every((v) => v === 0) : c.answers.smoking ? c.answers.smoking === 'no' : null)),
  F('caffeine', 'substances', 1, 'Caffeine ≤ 300 mg / day', (c) => cmp(or(c.caffeine, c.answers.caffeine != null ? c.answers.caffeine * 95 : null), (v) => v <= 300), (c) => `${fmt(or(c.caffeine, c.answers.caffeine * 95))} mg`),

  // ── PREVENTION & MEDICAL (6)
  F('bloods', 'medical', 1, 'Blood panel in the last 12 months', (c) => (c.lastLabDate ? c.since(c.lastLabDate) <= 365 : c.answers.lastBloods ? c.answers.lastBloods === 'under1y' : null), (c) => (c.lastLabDate ? `${c.since(c.lastLabDate)} d ago` : null)),
  F('screenings', 'medical', 1, 'No overdue screenings', (c) => (c.screeningsTracked ? c.overdueScreenings === 0 : c.answers.lastCheckup ? c.answers.lastCheckup === 'under1y' : null), (c) => (c.screeningsTracked ? `${c.overdueScreenings} overdue` : null)),
  F('vitd', 'medical', 3, 'Vitamin D ≥ 30 ng/mL', (c) => cmp(c.lab('vitd'), (v) => v >= 30), (c) => fmt(c.lab('vitd'))),
  F('b12', 'medical', 3, 'Vitamin B12 ≥ 300 pg/mL', (c) => cmp(c.lab('b12'), (v) => v >= 300), (c) => fmt(c.lab('b12'))),
  F('adherence', 'medical', 1, 'Medication / supplement adherence ≥ 90%', (c) => cmp(c.medAdh, (v) => v >= 0.9), (c) => (c.medAdh != null ? `${Math.round(c.medAdh * 100)}%` : null)),
  F('vaccines', 'medical', 1, 'Vaccinations up to date', (c) => (c.vaccinesTracked ? c.vaccinesOverdue === 0 : null), (c) => (c.vaccinesTracked ? `${c.vaccinesOverdue} overdue` : null)),

  // ── OUTCOMES — the visible tip (L4)
  F('no_disease', 'medical', 4, 'No active diagnosed condition', (c) => (c.activeConditions.length ? false : c.answers.conditions ? c.answers.conditions.filter((x) => x !== 'none').length === 0 : (c.records.condition ? true : null)), (c) => (c.activeConditions.length ? c.activeConditions.map((x) => x.data?.name).join(', ') : null)),
  F('symptom_free', 'medical', 4, 'Symptom-free on ≥ 90% of days (90 d)', (c) => (c.records.symptom || c.ciDays ? new Set(c.symptoms90.map((s) => s.date)).size <= 9 : null), (c) => `${new Set(c.symptoms90.map((s) => s.date)).size} symptom days`),
  F('rarely_sick', 'medical', 4, 'Under 3 sick days in 90 days', (c) => (c.records.illness || c.ciDays ? c.illnessDays90 < 3 : null), (c) => `${c.illnessDays90} days`),
  F('injury_free', 'movement', 4, 'No active injury or pain', (c) => (c.injuries.length ? false : c.answers.pain ? c.answers.pain === 'no' : c.records.injury ? true : null), (c) => (c.injuries.length ? c.injuries.map((i) => i.data?.part).join(', ') : null)),
];

if (FACTORS.length !== 99) console.warn(`FACTORS has ${FACTORS.length} entries (expected 99)`);
export const FACTOR_BY_ID = Object.fromEntries(FACTORS.map((f) => [f.id, f]));
