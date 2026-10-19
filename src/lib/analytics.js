// The analytics engine: turns raw rows into daily series, energy balance, baselines, drift alerts,
// readiness, training stats, action completion, the 99 factors and the 198 journey position.
import { METRICS, CHECKIN_KEYS } from '@shared/catalog.js';
import { LAB_MARKERS, homaIR } from '@shared/labs.js';
import { KCAL_PER_KG } from '@shared/units.js';
import { addDays, todayISO, dateRange, mean, sd, sum, clamp, slope, bedMinutes, wakeMinutes, clockToMinutes, weekStart, daysBetween } from './format.js';
import { FACTORS } from './factors.js';

export const ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very: 1.9 };
export const ACTIVITY_LABEL = { sedentary: 'Sedentary (desk, little exercise)', light: 'Light (1–3 sessions/wk)', moderate: 'Moderate (3–5 sessions/wk)', active: 'Active (6–7 sessions/wk)', very: 'Very active (physical job + training)' };

export function bmr({ weight, height, age, sex }) {
  if (!weight || !height || !age) return null;
  return 10 * weight + 6.25 * height - 5 * age + (sex === 'female' ? -161 : 5);
}
export const ageOf = (profile) => (profile.birthYear ? new Date().getFullYear() - profile.birthYear : profile.age || null);

const MUSCLE = [[/squat|lunge|leg press|split/i, 'Legs'], [/deadlift|hinge|rdl|hip thrust|good morning/i, 'Posterior chain'],
  [/bench|push-?up|chest|dip|fly/i, 'Chest'], [/overhead|shoulder|ohp|lateral|military/i, 'Shoulders'],
  [/row|pull|chin|lat/i, 'Back'], [/curl|tricep|bicep|extension/i, 'Arms'], [/plank|core|ab|crunch/i, 'Core']];
export const muscleOf = (ex) => (MUSCLE.find(([re]) => re.test(ex)) || [null, 'Other'])[1];
export const e1rm = (w, reps) => (w > 0 && reps > 0 ? w * (1 + reps / 30) : null);

export function buildModel(bundle, settings) {
  const today = todayISO();
  const profile = settings.profile || {};
  const prefs = settings.prefs || {};
  const answers = settings.onboarding?.answers || {};
  const age = ageOf(profile);
  const customDefs = Object.fromEntries((bundle.metricDefs || []).map((d) => [d.key, d]));
  const defOf = (k) => METRICS[k] || customDefs[k] || { agg: 'last', name: k };

  // ── Daily series per metric
  const daily = {};
  const readings = { bp: [], glucose: [] };
  const sums = {}; // metric|date|source -> total
  const avgs = {}; // metric|date -> [values]
  const lasts = {}; // metric|date -> [ts, value]
  for (const e of bundle.entries || []) {
    if (e.metric === 'bp') { readings.bp.push(e); continue; }
    if (e.metric === 'glucose') { readings.glucose.push(e); continue; }
    const agg = defOf(e.metric).agg;
    if (agg === 'sum') { const k = `${e.metric}|${e.date}|${e.source}`; sums[k] = (sums[k] || 0) + e.value; }
    else if (agg === 'avg') { const k = `${e.metric}|${e.date}`; (avgs[k] ||= []).push(e.value); }
    else { const k = `${e.metric}|${e.date}`; if (!lasts[k] || e.ts >= lasts[k][0]) lasts[k] = [e.ts, e.value]; }
  }
  const put = (m, d, v) => { (daily[m] ||= {})[d] = v; };
  for (const [k, v] of Object.entries(sums)) { const [m, d] = k.split('|'); put(m, d, Math.max(daily[m]?.[d] ?? -Infinity, v)); } // max across sources: no double counting
  for (const [k, v] of Object.entries(avgs)) { const [m, d] = k.split('|'); put(m, d, mean(v)); }
  for (const [k, [, v]] of Object.entries(lasts)) { const [m, d] = k.split('|'); put(m, d, v); }
  const bpDay = {};
  for (const r of readings.bp) (bpDay[r.date] ||= []).push(r);
  for (const [d, rs] of Object.entries(bpDay)) { put('bp_sys', d, mean(rs.map((r) => r.value))); put('bp_dia', d, mean(rs.map((r) => r.value2))); }
  for (const r of readings.glucose) {
    const ctx = r.meta?.context || 'random';
    put(/fast/i.test(ctx) ? 'glucose_fasting' : /post|after/i.test(ctx) ? 'glucose_post' : 'glucose_random', r.date, r.value);
  }

  const foodByDate = Object.fromEntries((bundle.foodDaily || []).map((f) => [f.date, { ...f, upf_pct: f.kcal ? (f.kcal_upf / f.kcal) * 100 : null }]));
  const sleepByDate = Object.fromEntries((bundle.sleep || []).map((s) => [s.date, s]));
  const workoutsByDate = {};
  for (const w of bundle.workouts || []) (workoutsByDate[w.date] ||= []).push(w);
  const labsByMarker = {};
  for (const l of bundle.labs || []) (labsByMarker[l.marker] ||= []).push(l);
  const records = {};
  for (const r of bundle.records || []) (records[r.kind] ||= []).push(r);
  const contextByDate = Object.fromEntries((records.context || []).map((r) => [r.date, r.data?.tags || []]));

  // derived daily series from food / sleep / workouts
  for (const [d, f] of Object.entries(foodByDate)) for (const k of ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'satfat', 'sodium', 'potassium', 'upf_pct', 'plant_servings']) put(`food_${k}`, d, f[k]);
  for (const [d, s] of Object.entries(sleepByDate)) {
    put('sleep_duration', d, s.duration); put('sleep_quality', d, s.quality); put('sleep_efficiency', d, s.efficiency);
    put('bed_min', d, bedMinutes(s.bed)); put('wake_min', d, wakeMinutes(s.wake));
    if (s.deep && s.duration) put('deep_pct', d, (s.deep / s.duration) * 100);
    if (s.rem && s.duration) put('rem_pct', d, (s.rem / s.duration) * 100);
  }
  for (const [d, ws] of Object.entries(workoutsByDate)) {
    put('training_load', d, sum(ws.map((w) => (w.duration || 0) * (w.rpe || 5))));
    put('training_min', d, sum(ws.map((w) => w.duration || 0)));
  }

  const series = (m) => daily[m] || {};
  const win = (m, end, days) => { const s = series(m); const out = []; for (let i = 0; i < days; i++) { const v = s[addDays(end, -i)]; if (v != null) out.push(v); } return out; };
  const avgWin = (m, end, days) => mean(win(m, end, days));
  const latest = (m, end = today) => { const s = series(m); let best = null; for (const d in s) if (d <= end && (!best || d > best)) best = d; return best ? { date: best, value: s[best] } : null; };

  // ── Weight trend (EMA, Hacker's-Diet style smoothing α = 0.1)
  const trend = {};
  const wDates = Object.keys(series('weight')).sort();
  if (wDates.length) {
    let t = series('weight')[wDates[0]];
    for (const d of dateRange(wDates[0], today)) {
      const w = series('weight')[d];
      if (w != null) t += 0.1 * (w - t);
      trend[d] = t;
    }
  }
  const trendNow = trend[today] ?? null;
  const weightNow = trendNow ?? profile.weight ?? null;
  const trendChange = (end, days) => (trend[end] != null && trend[addDays(end, -days)] != null ? trend[end] - trend[addDays(end, -days)] : null);
  const weeklyRate = trendChange(today, 14) != null ? trendChange(today, 14) / 2 : null;

  // ── Energy balance: formula TDEE, adaptive TDEE (intake − Δtrend × 7700 / days)
  const factor = ACTIVITY[profile.activity] || 1.375;
  const formulaAt = (w) => { const b = bmr({ weight: w, height: profile.height, age, sex: profile.sex }); return b ? b * factor : null; };
  const formulaTDEE = formulaAt(weightNow);
  const adaptiveAt = (end, days = 21) => {
    const kcal = win('food_kcal', end, days);
    const dw = trendChange(end, days);
    if (kcal.length < Math.max(10, days * 0.6) || dw == null) return null;
    const est = mean(kcal) - (dw * KCAL_PER_KG) / days;
    const f = formulaAt(trend[end] ?? weightNow);
    return f ? clamp(est, f * 0.7, f * 1.45) : est;
  };
  const tdeeSeries = [];
  for (const d of dateRange(addDays(today, -150), today)) {
    const a = adaptiveAt(d);
    if (a != null) tdeeSeries.push({ date: d, adaptive: a, formula: formulaAt(trend[d]), intake: series('food_kcal')[d] ?? null });
  }
  const adaptiveTDEE = adaptiveAt(today) ?? tdeeSeries.at(-1)?.adaptive ?? null;
  const tdee = prefs.tdeeOverride || adaptiveTDEE || formulaTDEE;
  const tdeeSource = prefs.tdeeOverride ? 'manual' : adaptiveTDEE ? 'adaptive' : 'formula';

  // ── Targets
  const goal = profile.goal || 'longevity';
  const rate = Number(profile.rate ?? (goal === 'fat_loss' ? 0.5 : goal === 'muscle' ? 0.25 : 0));
  const direction = goal === 'fat_loss' ? -1 : goal === 'muscle' ? 1 : 0;
  const bmi = weightNow && profile.height ? weightNow / (profile.height / 100) ** 2 : null;
  const floorKcal = profile.sex === 'female' ? 1200 : 1500;
  const calTarget = prefs.calorieTarget || (tdee ? Math.max(floorKcal, Math.round((tdee + (direction * rate * KCAL_PER_KG) / 7) / 10) * 10) : 2000);
  const refWeight = bmi && bmi > 30 && profile.height ? 25 * (profile.height / 100) ** 2 : weightNow || 70;
  const proteinTarget = Math.round((profile.proteinPerKg || 1.6) * refWeight);
  const fatTarget = Math.round((calTarget * 0.28) / 9);
  const carbTarget = Math.max(0, Math.round((calTarget - proteinTarget * 4 - fatTarget * 9) / 4));
  const targets = {
    kcal: calTarget, protein: proteinTarget, fat: fatTarget, carbs: carbTarget, fiber: Math.max(25, Math.round((calTarget / 1000) * 14)),
    water: profile.waterGoal || Math.round(((weightNow || 70) * 35) / 100) * 100, steps: profile.stepGoal || 8000, sleep: profile.sleepGoal || 7.5,
    bedtime: profile.bedtime || '23:00', wake: profile.wake || '07:00', floorKcal,
  };

  // ── Forecast to goal (TDEE falls ~as BMR slope × activity as weight drops)
  const forecast = (() => {
    if (!trendNow || !profile.targetWeight || !tdee || direction === 0) return null;
    const run = (deltaScale) => {
      const pts = []; let w = trendNow; let t = tdee;
      const offset = tdee - (formulaTDEE || tdee); // keep the adaptive correction as weight changes
      for (let i = 0; i <= 540; i += 1) {
        if (i % 7 === 0) pts.push({ i, w });
        if ((direction < 0 && w <= profile.targetWeight) || (direction > 0 && w >= profile.targetWeight)) return { pts, days: i };
        w += ((calTarget - t) * deltaScale) / KCAL_PER_KG;
        t = (formulaAt(w) || t) + offset; // TDEE falls as weight falls
      }
      return { pts, days: null };
    };
    const mid = run(1), fast = run(1.25), slow = run(0.75);
    const pace = weeklyRate != null && Math.sign(weeklyRate) === direction && Math.abs(weeklyRate) > 0.02 ? Math.abs((profile.targetWeight - trendNow) / weeklyRate) * 7 : null;
    return { mid, fast, slow, eta: mid.days != null ? addDays(today, mid.days) : null, paceEta: pace ? addDays(today, Math.round(pace)) : null };
  })();

  // ── Logging accuracy check (H-7): compare logged intake with what the scale implies
  const logging = (() => {
    const kcal = win('food_kcal', today, 21);
    const dw = trendChange(today, 21);
    if (kcal.length < 10 || dw == null || !formulaTDEE) return null;
    const implied = formulaTDEE + (dw * KCAL_PER_KG) / 21; // intake that would explain the trend
    const gap = implied - mean(kcal);
    return { logged: mean(kcal), implied, gap, daysLogged: kcal.length, flag: gap > 250 ? 'under' : gap < -250 ? 'over' : 'ok' };
  })();

  // ── Baselines & z-scores (baseline = days 8–37 back, recent = last 7)
  const baseline = (m, end = today) => {
    const base = []; for (let i = 7; i < 37; i++) { const v = series(m)[addDays(end, -i)]; if (v != null) base.push(v); }
    const recent = win(m, end, 7);
    const mu = mean(base), s = sd(base);
    return { mean: mu, sd: s, recent: mean(recent), z: mu != null && s ? (mean(recent) - mu) / s : null, delta: mu != null && recent.length ? mean(recent) - mu : null };
  };

  // ── Readiness (0–100)
  const readinessAt = (d) => {
    const h = series('hrv')[d], r = series('rhr')[d], sl = sleepByDate[d]?.duration;
    if (h == null && r == null && sl == null) return null;
    const hb = mean(win('hrv', addDays(d, -1), 30)), hs = sd(win('hrv', addDays(d, -1), 30));
    const rb = mean(win('rhr', addDays(d, -1), 30)), rs = sd(win('rhr', addDays(d, -1), 30));
    const hz = h != null && hs ? (h - hb) / hs : 0;
    const rz = r != null && rs ? (r - rb) / rs : 0;
    const sz = sl != null ? (sl - targets.sleep) / 0.75 : 0;
    const sore = series('soreness')[d] ?? 2, stress = series('stress')[d] ?? 3;
    const load = mean(win('training_load', addDays(d, -1), 2).concat([0])) || 0;
    return Math.round(clamp(65 + 13 * (0.4 * hz - 0.3 * rz + 0.3 * clamp(sz, -2, 1.5) - 0.12 * (sore - 2) - 0.08 * (stress - 3)) - load / 120, 5, 100));
  };
  const readiness = {};
  for (const d of dateRange(addDays(today, -120), today)) { const v = readinessAt(d); if (v != null) readiness[d] = v; }
  for (const [d, v] of Object.entries(readiness)) put('readiness', d, v);

  // ── Training stats
  const lifts = {}; // exercise -> [{date, e1rm, best}]
  const weeklySets = {}; // week -> group -> sets
  for (const w of bundle.workouts || []) {
    const wk = weekStart(w.date);
    for (const s of w.sets || []) {
      const g = muscleOf(s.exercise);
      ((weeklySets[wk] ||= {})[g] = (weeklySets[wk][g] || 0) + 1);
      const est = e1rm(s.weight, s.reps);
      if (est) {
        const arr = (lifts[s.exercise] ||= []);
        const last = arr.at(-1);
        if (last && last.date === w.date) last.e1rm = Math.max(last.e1rm, est); else arr.push({ date: w.date, e1rm: est });
      }
    }
  }
  const acwr = (() => {
    const acute = sum(win('training_load', today, 7)), chronic = sum(win('training_load', today, 28)) / 4;
    return chronic ? acute / chronic : null;
  })();

  // ── Action completion
  const activeMeds = (records.medication || []).filter((m) => m.active);
  const actionLog = {};
  for (const l of bundle.actionLogs || []) actionLog[`${l.date}|${l.action_id}`] = !!l.done;
  const medLog = {};
  for (const l of bundle.medLogs || []) medLog[`${l.date}|${l.record_id}`] = !!l.done;
  const AUTO = {
    log_food: (d) => (foodByDate[d]?.items > 0 ? true : null),
    weigh_in: (d) => (series('weight')[d] != null ? true : null),
    checkin: (d) => (CHECKIN_KEYS.some((k) => series(k)[d] != null) ? true : null),
    water: (d) => (series('water')[d] != null ? series('water')[d] >= targets.water : null),
    meds: (d) => { const ms = activeMeds.filter((m) => !m.date || m.date <= d); return ms.length ? ms.every((m) => medLog[`${d}|${m.id}`]) : null; },
    sleep7: (d) => (sleepByDate[d] ? sleepByDate[d].duration >= 7 : null),
    bedtime: (d) => { const s = sleepByDate[addDays(d, 1)]; return s ? bedMinutes(s.bed) <= clockToMinutes(targets.bedtime) + 15 : null; },
    wake_consistent: (d) => { const s = sleepByDate[d]; const t = targets.wake.split(':').map(Number); return s ? Math.abs(wakeMinutes(s.wake) - (t[0] * 60 + t[1])) <= 30 : null; },
    protein: (d) => (foodByDate[d] ? foodByDate[d].protein >= targets.protein * 0.9 : null),
    steps: (d) => (series('steps')[d] != null ? series('steps')[d] >= targets.steps : null),
    cal_range: (d) => (foodByDate[d] ? Math.abs(foodByDate[d].kcal - targets.kcal) <= targets.kcal * 0.1 : null),
    alcohol_free: (d) => (series('alcohol')[d] > 0 ? false : null),
    sunlight: (d) => (series('sunlight')[d] != null ? series('sunlight')[d] >= 10 : null),
    train: (d) => (workoutsByDate[d]?.length ? true : null),
    fiber: (d) => (foodByDate[d] ? foodByDate[d].fiber >= 30 : null),
    plants5: (d) => (foodByDate[d] ? foodByDate[d].plant_servings >= 5 : null),
    zone2: (d) => ((workoutsByDate[d] || []).some((w) => w.kind === 'cardio' && (w.zone || 2) <= 3 && w.duration >= 30) ? true : null),
    meditate: (d) => (series('meditation')[d] != null ? series('meditation')[d] >= 10 : null),
    no_upf: (d) => (foodByDate[d]?.kcal ? foodByDate[d].upf_pct < 10 : null),
  };
  const actions = (bundle.actions || []).filter((a) => a.active);
  const actionDone = (a, d) => {
    const k = `${d}|${a.id}`;
    if (k in actionLog) return actionLog[k];
    const f = a.auto && AUTO[a.auto];
    return f ? !!f(d) : false;
  };
  const actionsOn = (d) => actions.filter((a) => !a.created || a.created <= d);
  const dayScore = (d) => { const as = actionsOn(d); if (!as.length) return null; return as.filter((a) => actionDone(a, d)).length / as.length; };
  const scoreSeries = {};
  for (const d of dateRange(addDays(today, -365), today)) { const s = dayScore(d); if (s != null && (d >= (settings.onboarding?.date || '0'))) scoreSeries[d] = s * 100; }
  daily.action_score = scoreSeries;
  const adherence = (end, days) => mean(win('action_score', end, days));

  // ── Streaks (positive iceberg)
  const streak = (pred) => { let n = 0; for (let d = today; ; d = addDays(d, -1)) { const r = pred(d); if (r === null && d === today) continue; if (!r) break; n++; if (n > 2000) break; } return n; };
  const streaks = {
    actions80: streak((d) => (scoreSeries[d] == null ? (d === today ? null : false) : scoreSeries[d] >= 80)),
    sleep7: streak((d) => (sleepByDate[d] ? sleepByDate[d].duration >= 7 : d === today ? null : false)),
    logging: streak((d) => (foodByDate[d] ? true : d === today ? null : false)),
    steps: streak((d) => (series('steps')[d] != null ? series('steps')[d] >= targets.steps : d === today ? null : false)),
  };
  const goodDays = Object.values(scoreSeries).filter((v) => v >= 80).length;

  // ── Labs helpers
  const labLatest = (marker, end = today) => { const arr = (labsByMarker[marker] || []).filter((l) => l.date <= end); return arr.at(-1) || null; };
  const labStatus = (marker, value, sex = profile.sex) => {
    const m = LAB_MARKERS[marker]; if (!m || value == null) return null;
    const ref = sex === 'female' && m.refF ? m.refF : m.ref, opt = sex === 'female' && m.optF ? m.optF : (settings.labRanges?.[marker] || m.opt);
    if (value < ref[0] || value > ref[1]) return 'out';
    if (value < opt[0] || value > opt[1]) return 'near';
    return 'optimal';
  };
  const labDrift = (marker) => {
    const arr = labsByMarker[marker] || []; const m = LAB_MARKERS[marker];
    if (!m || arr.length < 3) return null;
    const [a, b, c] = arr.slice(-3).map((x) => x.value);
    const worse = m.good === 'down' ? a < b && b < c : m.good === 'up' ? a > b && b > c : false;
    return worse;
  };

  // ── Screening due dates
  const screenings = (records.screening || []).map((s) => {
    const due = s.data?.last ? addDays(s.data.last, Math.round((s.data.intervalMonths || 12) * 30.4)) : null;
    return { ...s, due, overdue: !due || due < today, soon: due && due >= today && due <= addDays(today, 30) };
  });

  // ── Factor context at any date (the 99 causes) and journey position
  const ctxAt = (end = today) => buildCtx({ end, today, profile, answers, age, targets, series, win, avgWin, latest, trend, trendChange, foodByDate, sleepByDate, workoutsByDate, records, labLatest, screenings, lifts, adherence, medLog, activeMeds, bundle, direction, weeklyRateAt: (e) => (trendChange(e, 14) != null ? trendChange(e, 14) / 2 : null) });
  const evaluate = (end = today) => {
    const c = ctxAt(end);
    const res = FACTORS.map((f) => { let v = null; try { v = f.eval(c); } catch { v = null; } return { ...f, value: v === undefined ? null : v, detail: f.show ? safe(() => f.show(c)) : null }; });
    const good = res.filter((r) => r.value === true).length, bad = res.filter((r) => r.value === false).length;
    const layerPct = {};
    for (const L of [1, 2, 3, 4]) {
      const g = res.filter((r) => r.layer === L && r.value === true).length, b = res.filter((r) => r.layer === L && r.value === false).length;
      layerPct[`L${L}`] = g + b ? Math.round((g / (g + b)) * 100) : null;
    }
    return { factors: res, good, bad, unknown: res.length - good - bad, position: good - bad, ctx: c, layerPct };
  };
  const current = evaluate(today);
  const positionHistory = [];
  for (let i = 26; i >= 0; i--) {
    const d = addDays(today, -i * 7);
    if (settings.onboarding?.date && d < settings.onboarding.date) continue;
    const e = i === 0 ? current : evaluate(d);
    positionHistory.push({ date: d, position: e.position, good: e.good, bad: e.bad, ...e.layerPct });
  }
  const layerScores = [1, 2, 3, 4].map((L) => {
    const fs = current.factors.filter((f) => f.layer === L);
    const g = fs.filter((f) => f.value === true).length, b = fs.filter((f) => f.value === false).length;
    return { layer: L, good: g, bad: b, unknown: fs.length - g - b, total: fs.length, score: g + b ? Math.round((g / (g + b)) * 100) : null };
  });
  const domainScores = Object.entries(groupBy(current.factors, (f) => f.domain)).map(([domain, fs]) => {
    const g = fs.filter((f) => f.value === true).length, b = fs.filter((f) => f.value === false).length;
    return { domain, good: g, bad: b, total: fs.length, score: g + b ? Math.round((g / (g + b)) * 100) : null };
  });

  // ── Drift alerts (negative iceberg) + wins
  const alerts = [];
  const add = (severity, layer, title, detail, to) => alerts.push({ severity, layer, title, detail, to });
  const b = (m) => baseline(m);
  const rhrB = b('rhr'); if (rhrB.delta != null && rhrB.delta >= 3) add(rhrB.delta >= 5 ? 'serious' : 'warning', 2, `Resting HR up ${rhrB.delta.toFixed(1)} bpm vs your 30-day baseline`, 'Possible illness, poor sleep, alcohol or overreaching. Consider a lighter day.', '/recovery');
  const hrvB = b('hrv'); if (hrvB.z != null && hrvB.z <= -1) add('warning', 2, `HRV ${Math.abs(hrvB.delta).toFixed(0)} ms below baseline`, 'Your nervous system is under load. Prioritise sleep and easy movement.', '/recovery');
  const sl7 = avgWin('sleep_duration', today, 7); if (sl7 != null && sl7 < 6.5) add(sl7 < 6 ? 'serious' : 'warning', 1, `Averaging ${sl7.toFixed(1)} h sleep this week`, 'Short sleep raises appetite, glucose and blood pressure.', '/sleep');
  const bedSd = sd(win('bed_min', today, 7)); if (bedSd != null && bedSd > 60) add('warning', 1, `Bedtime varies by ±${Math.round(bedSd)} min`, 'Irregular sleep timing disrupts your circadian rhythm.', '/sleep');
  const t42 = trendChange(today, 42); if (direction <= 0 && t42 != null && t42 > 1) add('warning', 3, `Weight trend up ${t42.toFixed(1)} kg in 6 weeks`, 'Check logging accuracy and activity before changing targets.', '/weight');
  if (direction < 0 && weeklyRate != null && weightNow && -weeklyRate > weightNow * 0.01) add('warning', 3, `Losing ${Math.abs(weeklyRate).toFixed(2)} kg/week (>1% body weight)`, 'Fast loss risks muscle. Raise calories slightly and keep protein high.', '/weight');
  const waistArr = Object.entries(series('waist')).sort(); if (waistArr.length >= 2) { const recentW = waistArr.at(-1), old = waistArr.filter(([d]) => d >= addDays(today, -95)).at(0); if (old && recentW[1] - old[1] >= 2) add('warning', 3, `Waist up ${(recentW[1] - old[1]).toFixed(1)} cm in ~3 months`, 'Gaining visceral fat is an early cardio-metabolic warning.', '/body'); }
  const bpS = mean(readings.bp.slice(-4).map((r) => r.value)), bpD = mean(readings.bp.slice(-4).map((r) => r.value2));
  if (bpS != null && (bpS >= 130 || bpD >= 85)) add(bpS >= 140 || bpD >= 90 ? 'critical' : 'serious', 3, `Blood pressure averaging ${Math.round(bpS)}/${Math.round(bpD)}`, 'Elevated. Recheck with correct technique; discuss with your doctor if it persists.', '/vitals');
  const gf = Object.entries(series('glucose_fasting')).sort().slice(-4).map(([, v]) => v);
  if (gf.length >= 3 && slope(gf.map((v, i) => [i, v])) > 1.5) add('warning', 3, 'Fasting glucose drifting upward', `Last readings: ${gf.map((v) => Math.round(v)).join(' → ')} mg/dL`, '/vitals');
  const stB = b('steps'); if (stB.mean && stB.recent != null && stB.recent < stB.mean * 0.75) add('warning', 1, `Steps down ${Math.round((1 - stB.recent / stB.mean) * 100)}% vs baseline`, 'Reduced everyday movement (NEAT) is the quietest form of drift.', '/training');
  const enB = b('energy'); if (enB.delta != null && enB.delta <= -0.7) add('warning', 2, 'Energy dipping vs your baseline', 'Check sleep, iron/B12/vitamin D status and training load.', '/checkin');
  for (const marker of Object.keys(labsByMarker)) {
    const l = labLatest(marker); const st = labStatus(marker, l?.value);
    if (st === 'out') add('serious', 3, `${LAB_MARKERS[marker]?.name || marker} out of reference range`, `Latest ${l.value} ${LAB_MARKERS[marker]?.unit || ''} (${l.date}). Consult your doctor.`, '/labs');
    else if (labDrift(marker)) add('warning', 3, `${LAB_MARKERS[marker]?.name} worsening across 3 tests`, 'Still in range, but the trend is moving the wrong way. This is the iceberg forming.', '/labs');
  }
  for (const s of screenings.filter((x) => x.overdue)) add('info', 4, `${s.data?.name} is ${s.due ? 'overdue' : 'not on record'}`, s.due ? `Was due ${s.due}` : 'Add the date of your last one.', '/medical');
  for (const m of activeMeds) if (m.data?.stock != null && m.data.stock <= 7) add('info', 1, `${m.data.name}: ${m.data.stock} doses left`, 'Time to refill.', '/medical');
  const adh7 = adherence(today, 7); if (adh7 != null && adh7 < 50 && actions.length) add('warning', 1, `Daily actions at ${Math.round(adh7)}% this week`, 'Shrink the list to your 3 easiest actions and rebuild momentum.', '/');
  if (logging?.flag === 'under') add('info', 1, `Logged intake ~${Math.round(logging.gap)} kcal/day below what your weight trend implies`, 'Likely unlogged oils, drinks or snacks, or your activity is lower than set.', '/weight');
  const SEV = { critical: 0, serious: 1, warning: 2, info: 3 };
  alerts.sort((x, y) => SEV[x.severity] - SEV[y.severity]);

  const wins = [];
  if (streaks.actions80 >= 3) wins.push(`${streaks.actions80}-day streak of ≥80% daily actions`);
  if (streaks.sleep7 >= 3) wins.push(`${streaks.sleep7} nights in a row of 7 h+ sleep`);
  if (hrvB.z != null && hrvB.z >= 1) wins.push(`HRV ${hrvB.delta.toFixed(0)} ms above baseline`);
  if (rhrB.delta != null && rhrB.delta <= -2) wins.push(`Resting HR ${Math.abs(rhrB.delta).toFixed(1)} bpm below baseline`);
  const posDelta = positionHistory.length > 4 ? current.position - positionHistory.at(-5).position : null;
  if (posDelta > 0) wins.push(`Journey +${posDelta} steps in the last month`);

  // ── Correlation helpers
  const pearson = (xm, ym, lag = 0, days = 120) => {
    const xs = [], ys = [];
    for (const d of dateRange(addDays(today, -days), today)) {
      const x = series(xm)[d], y = series(ym)[addDays(d, lag)];
      if (x != null && y != null) { xs.push(x); ys.push(y); }
    }
    if (xs.length < 8) return { r: null, n: xs.length, pts: [] };
    const mx = mean(xs), my = mean(ys);
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
    return { r: dx && dy ? num / Math.sqrt(dx * dy) : null, n: xs.length, pts: xs.map((x, i) => ({ x, y: ys[i] })) };
  };

  // ── Rule-based insights (H-79)
  const insights = [];
  const wkendProt = mean(Object.entries(foodByDate).filter(([d]) => d >= addDays(today, -56) && [0, 6].includes(new Date(d).getDay())).map(([, f]) => f.protein));
  const wkdayProt = mean(Object.entries(foodByDate).filter(([d]) => d >= addDays(today, -56) && ![0, 6].includes(new Date(d).getDay())).map(([, f]) => f.protein));
  if (wkendProt && wkdayProt && wkendProt < wkdayProt * 0.85) insights.push(`Protein drops ${Math.round((1 - wkendProt / wkdayProt) * 100)}% on weekends (${Math.round(wkendProt)} g vs ${Math.round(wkdayProt)} g).`);
  const alcHrv = pearson('alcohol', 'hrv', 1);
  if (alcHrv.r != null && alcHrv.r < -0.25) insights.push(`Drinking days are followed by lower HRV the next morning (r = ${alcHrv.r.toFixed(2)}).`);
  const bedQ = pearson('bed_min', 'sleep_quality', 0);
  if (bedQ.r != null && bedQ.r < -0.2) insights.push(`Later bedtimes go with worse sleep quality (r = ${bedQ.r.toFixed(2)}).`);
  const sleepEnergy = pearson('sleep_duration', 'energy', 0);
  if (sleepEnergy.r != null && sleepEnergy.r > 0.2) insights.push(`More sleep → more energy the same day (r = ${sleepEnergy.r.toFixed(2)}).`);
  const stepsSleep = pearson('steps', 'sleep_duration', 1);
  if (stepsSleep.r != null && stepsSleep.r > 0.15) insights.push(`Higher-step days are followed by longer sleep (r = ${stepsSleep.r.toFixed(2)}).`);
  if (weeklyRate != null && direction !== 0) insights.push(`Weight trend is moving ${fmtRate(weeklyRate)} kg/week; your plan is ${direction < 0 ? '−' : '+'}${rate} kg/week.`);

  return {
    today, profile, prefs, answers, settings, age, daily, series, win, avgWin, latest, readings, foodByDate, sleepByDate, workoutsByDate,
    labsByMarker, labLatest, labStatus, labDrift, records, contextByDate, screenings, activeMeds, medLog,
    trend, trendNow, weightNow, weeklyRate, trendChange, bmi, formulaTDEE, adaptiveTDEE, tdee, tdeeSource, tdeeSeries, targets, goal, direction, rate,
    forecast, logging, baseline, readiness, readinessAt, lifts, weeklySets, acwr, actions, actionDone, actionsOn, dayScore, adherence, streaks, goodDays,
    current, positionHistory, layerScores, domainScores, evaluate, alerts, wins, pearson, insights, homa: homaIR(labLatest('fasting_glucose')?.value, labLatest('fasting_insulin')?.value),
    defOf, customDefs,
  };
}

const fmtRate = (v) => `${v > 0 ? '+' : ''}${v.toFixed(2)}`;
const safe = (f) => { try { return f(); } catch { return null; } };
export const groupBy = (arr, f) => arr.reduce((o, x) => ((o[f(x)] ||= []).push(x), o), {});

function buildCtx(o) {
  const { end, series, win, avgWin, latest, records, workoutsByDate, foodByDate, sleepByDate } = o;
  const days = (n) => dateRange(addDays(end, -(n - 1)), end);
  const wk = (n) => n / 7;
  const workouts = days(28).flatMap((d) => workoutsByDate[d] || []);
  const foodDays = days(14).map((d) => foodByDate[d]).filter(Boolean);
  const sleepDays = days(14).map((d) => sleepByDate[d]).filter(Boolean);
  const activeConditions = (records.condition || []).filter((c) => c.active && c.data?.status !== 'resolved' && (!c.date || c.date <= end));
  const symptoms90 = (records.symptom || []).filter((s) => s.date > addDays(end, -90) && s.date <= end);
  const illness90 = (records.illness || []).filter((s) => s.date > addDays(end, -90) && s.date <= end);
  const injuries = (records.injury || []).filter((s) => s.active && s.data?.status !== 'recovered' && (!s.date || s.date <= end));
  const lastLabDate = Object.values(o.bundle.labs || []).filter((l) => l.date <= end).map((l) => l.date).sort().at(-1);
  const medDays = days(30);
  const medsDue = o.activeMeds.filter((m) => !m.date || m.date <= end);
  const medAdh = medsDue.length ? mean(medDays.map((d) => mean(medsDue.filter((m) => !m.date || m.date <= d).map((m) => (o.medLog[`${d}|${m.id}`] ? 1 : 0))))) : null;
  const lift8 = Object.values(o.lifts).map((arr) => {
    const recent = arr.filter((x) => x.date <= end && x.date > addDays(end, -28));
    const old = arr.filter((x) => x.date <= addDays(end, -42) && x.date > addDays(end, -84));
    return recent.length && old.length ? Math.max(...recent.map((x) => x.e1rm)) - Math.max(...old.map((x) => x.e1rm)) : null;
  }).filter((v) => v != null);
  const bpR = o.bundle.entries.filter((e) => e.metric === 'bp' && e.date <= end).slice(-6);
  return {
    ...o, days,
    sleepAvg: mean(sleepDays.map((s) => s.duration)), sleepNights: sleepDays.length,
    shortNights: sleepDays.filter((s) => s.duration < 6).length,
    bedSd: sd(win('bed_min', end, 14)), wakeSd: sd(win('wake_min', end, 14)), bedAvg: avgWin('bed_min', end, 14),
    latency: mean(sleepDays.map((s) => s.latency)), efficiency: mean(sleepDays.map((s) => s.efficiency)), quality: mean(sleepDays.map((s) => s.quality)),
    deepPct: avgWin('deep_pct', end, 14), remPct: avgWin('rem_pct', end, 14),
    sleepDebt: sleepDays.length >= 5 ? Math.max(0, (o.targets.sleep * sleepDays.length) - sleepDays.reduce((s, x) => s + x.duration, 0)) : null,
    screenBed: avgWin('screen_bed', end, 14),
    foodDays: foodDays.length,
    f: (k) => mean(foodDays.map((x) => x[k])),
    kcalCv: foodDays.length >= 5 ? sd(foodDays.map((x) => x.kcal)) / mean(foodDays.map((x) => x.kcal)) : null,
    lastMealGap: (() => { const bed = o.targets.bedtime.split(':').map(Number); const lm = foodDays.map((x) => x.last_meal).filter(Boolean).map((t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; }); return lm.length ? (bed[0] * 60 + bed[1] + (bed[0] < 12 ? 1440 : 0)) - mean(lm) : null; })(),
    steps: avgWin('steps', end, 14), water: avgWin('water', end, 14),
    strengthPerWk: workouts.filter((w) => w.kind === 'strength').length / 4,
    z2PerWk: sum(workouts.filter((w) => w.kind === 'cardio' && (w.zone || 2) <= 3).map((w) => w.duration)) / 4,
    vigorousPerWk: workouts.filter((w) => (w.zone || 0) >= 4 || (w.rpe || 0) >= 8).length / 4,
    mobilityPerWk: workouts.filter((w) => w.kind === 'mobility').length / 4,
    trainDaysPerWk: new Set(workouts.map((w) => w.date)).size / 4,
    restDays7: 7 - new Set(days(7).filter((d) => workoutsByDate[d]?.length)).size,
    liftProgress: lift8.length ? mean(lift8) : null,
    test: (k) => latest(k, end)?.value ?? null,
    rhr: avgWin('rhr', end, 14), hrv7: avgWin('hrv', end, 7), hrv60: avgWin('hrv', end, 60),
    rhr7: avgWin('rhr', end, 7), rhr30: avgWin('rhr', addDays(end, -7), 30), resp7: avgWin('resp_rate', end, 7), resp30: avgWin('resp_rate', addDays(end, -7), 30),
    ci: (k) => avgWin(k, end, 14), ciDays: days(14).filter((d) => ['energy', 'mood', 'stress'].some((k) => series(k)[d] != null)).length,
    meditateDays: win('meditation', end, 14).filter((v) => v >= 5).length / 2,
    sunDays: win('sunlight', end, 14).filter((v) => v >= 5).length / 2,
    readinessAvg: avgWin('readiness', end, 14),
    weightTrend: o.trend[end] ?? null, weighIns: win('weight', end, 14).length / 2,
    waist: latest('waist', end), bodyfat: latest('bodyfat', end), lastMeasure: latest('waist', end)?.date,
    weeklyRate: o.weeklyRateAt(end),
    bp: bpR.length ? { s: mean(bpR.map((r) => r.value)), d: mean(bpR.map((r) => r.value2)) } : null,
    gFast: avgWin('glucose_fasting', end, 60), gPost: avgWin('glucose_post', end, 60),
    spo2: avgWin('spo2', end, 14),
    lab: (k) => o.labLatest(k, end)?.value ?? null, lastLabDate,
    alcoholWk: sum(win('alcohol', end, 14)) / 2, alcoholDays: win('alcohol', end, 14).filter((v) => v > 0).length / 2,
    alcoholLogged: Object.keys(series('alcohol')).length > 0, caffeine: avgWin('caffeine', end, 14), cigs: win('cigarettes', end, 14),
    gad7: latest('gad7', end)?.value ?? null, phq9: latest('phq9', end)?.value ?? null, social: win('social', end, 14).length / 2,
    activeConditions, symptoms90, illnessDays90: sum(illness90.map((i) => i.data?.daysLost || 1)), injuries, medAdh,
    overdueScreenings: o.screenings.filter((s) => s.overdue).length, screeningsTracked: o.screenings.length,
    familyCount: (records.family || []).length,
    vaccinesOverdue: (records.vaccination || []).filter((v) => v.data?.nextDue && v.data.nextDue < end).length, vaccinesTracked: (records.vaccination || []).length,
    adh14: o.adherence(end, 14),
    wtWk: wk(1),
    since: (d) => (d ? daysBetween(d, end) : null),
  };
}
