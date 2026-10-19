// Generates ~180 days of realistic, internally consistent demo data: a person who starts in "silent drift"
// (prediabetic markers, short sleep, sedentary) and climbs the 198 journey. Deterministic (seeded PRNG).
import { db, insert, setSetting, tx } from '../db.js';
import { ACTION_BY_KEY } from '../../shared/actions.js';

const DAYS = 180;

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const MEALS = {
  breakfast: {
    early: [[['Masala chai (milk + sugar)', 1], ['Aloo paratha', 2]], [['White bread', 3], ['Butter', 2], ['Masala chai (milk + sugar)', 1]],
      [['Poha', 1.2], ['Masala chai (milk + sugar)', 1]], [['Cornflakes', 1.5], ['Milk (whole)', 1]], [['Puri', 4], ['Aloo sabzi', 1]]],
    late: [[['Oats (dry)', 1], ['Milk (toned / 1.5%)', 1], ['Banana', 1], ['Almonds', 2]], [['Masala omelette', 1], ['Whole wheat bread', 2]],
      [['Moong dal chilla', 2], ['Curd / Dahi', 1]], [['Idli', 4], ['Sambar', 1]], [['Greek yogurt (plain, nonfat)', 1], ['Blueberries', 1], ['Chia seeds', 1]],
      [['Besan chilla', 2], ['Mint chutney', 1], ['Black coffee', 1]]],
  },
  lunch: {
    early: [[['White rice (cooked)', 2], ['Dal tadka (toor)', 1], ['Aloo sabzi', 1], ['Pickle (achar)', 1]], [['Chicken biryani', 1.2], ['Raita', 1]],
      [['Roti / Chapati (plain)', 3], ['Paneer butter masala', 1]], [['Hakka noodles (veg)', 1.2]], [['Pizza (cheese)', 3]]],
    late: [[['Roti / Chapati (plain)', 2], ['Dal tadka (toor)', 1], ['Mixed veg curry', 1], ['Green salad (mixed)', 1], ['Curd / Dahi', 1]],
      [['Brown rice (cooked)', 1], ['Rajma curry', 1], ['Green salad (mixed)', 1]], [['Chicken breast (cooked)', 1.5], ['Quinoa (cooked)', 1], ['Broccoli', 1]],
      [['Roti / Chapati (plain)', 2], ['Chicken curry', 1], ['Cucumber', 1]], [['Jowar roti', 2], ['Chole', 1], ['Green salad (mixed)', 1]]],
  },
  snack: {
    early: [[['Samosa', 1], ['Masala chai (milk + sugar)', 1]], [['Potato chips', 1]], [['Digestive biscuits', 1], ['Masala chai (milk + sugar)', 1]],
      [['Cola / soft drink', 1], ['Namkeen / bhujia', 1]], [['Gulab jamun', 2]]],
    late: [[['Apple', 1], ['Peanut butter', 1]], [['Roasted chana', 1]], [['Whey protein powder', 1], ['Banana', 1]], [['Makhana (roasted)', 1]],
      [['Guava', 1], ['Almonds', 2]], [['Sprouts salad (moong)', 1]], [['Buttermilk (chaas)', 1], ['Roasted chana', 1]]],
  },
  dinner: {
    early: [[['Roti / Chapati (plain)', 3], ['Butter chicken', 1]], [['Naan', 2], ['Dal makhani', 1]], [['White rice (cooked)', 2], ['Chole', 1]],
      [['Burger (chicken)', 1], ['French fries', 1], ['Cola / soft drink', 1]], [['Instant noodles (prepared)', 1]], [['Pav bhaji', 1]]],
    late: [[['Roti / Chapati (plain)', 2], ['Palak paneer', 1], ['Green salad (mixed)', 1]], [['Khichdi', 1], ['Curd / Dahi', 1]],
      [['Fish curry', 1.2], ['Brown rice (cooked)', 1], ['Mixed veg curry', 1]], [['Tandoori chicken', 1], ['Green salad (mixed)', 1], ['Roti / Chapati (plain)', 1]],
      [['Soya chunk curry', 1], ['Roti / Chapati (plain)', 2], ['Bhindi masala', 1]], [['Egg curry', 1], ['Roti / Chapati (plain)', 2], ['Cucumber', 1]]],
  },
};
const MEAL_SPLIT = { breakfast: 0.25, lunch: 0.33, snack: 0.12, dinner: 0.3 };
const NUTR = ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'satfat', 'sodium', 'potassium', 'calcium', 'iron', 'vitc'];

const iso = (d) => d.toISOString().slice(0, 10);

export function loadDemo() {
  const r = rng(42);
  const n = (mu, sd) => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const dateOf = (i) => { const d = new Date(today); d.setDate(d.getDate() - (DAYS - 1 - i)); return d; };
  const foods = Object.fromEntries(db.prepare('SELECT * FROM foods').all().map((f) => [f.name, f]));

  tx(() => {
    for (const t of ['entries', 'food_logs', 'workouts', 'sleep', 'labs', 'records', 'actions', 'action_logs', 'med_logs', 'meals', 'photos', 'ingest_runs']) db.exec(`DELETE FROM ${t}`);
    const start = iso(dateOf(0));
    setSetting('profile', { name: 'Alex (demo)', sex: 'male', birthYear: today.getFullYear() - 36, height: 176, activity: 'moderate',
      goal: 'fat_loss', targetWeight: 76, rate: 0.5, bedtime: '22:45', wake: '06:30', stepGoal: 9000, waterGoal: 2500, proteinPerKg: 1.8 });
    setSetting('onboarding', { completed: true, date: start, startPosition: -38, demo: true,
      answers: { sleepHours: 6, sleepRegular: 'no', diet: 'fair', protein: 'low', veg: 1, processed: 'often', sugaryDrinks: 'daily',
        steps: 'under5k', exerciseDays: 1, strength: 0, stress: 4, alcohol: 8, smoking: 'no', screens: 'yes', sunlight: 'rarely',
        conditions: ['prediabetes'], meds: 'supplements', lastCheckup: 'over2y', lastBloods: 'over2y', family: ['diabetes', 'heart', 'bp'] } });

    // Actions, phased in as the journey progresses
    const phases = [[0, ['log_food', 'weigh_in', 'checkin', 'bedtime', 'water', 'no_sugary_drinks', 'meds']],
      [30, ['sleep7', 'protein', 'steps', 'cal_range', 'caffeine_cutoff', 'alcohol_free', 'sunlight']],
      [75, ['train', 'fiber', 'plants5', 'zone2', 'meditate', 'no_upf']], [140, ['wake_consistent', 'hiit']]];
    const actionIds = {};
    let sort = 0;
    for (const [day, keys] of phases) for (const k of keys) {
      const A = ACTION_BY_KEY[k];
      actionIds[k] = insert('actions', { key: k, title: A.title, domain: A.domain, layer: 1, phase: A.phase, auto: A.auto, why: A.why, sort: sort++, created: iso(dateOf(day)) });
    }

    // Records
    const rec = (kind, date, data, active = 1) => insert('records', { kind, date, data, active });
    rec('condition', iso(dateOf(4)), { name: 'Prediabetes', status: 'monitoring', notes: 'HbA1c 5.9% at baseline' });
    rec('condition', iso(dateOf(4)), { name: 'Vitamin D deficiency', status: 'resolved', notes: '14 ng/mL at baseline' }, 0);
    rec('allergy', start, { name: 'Dust mite', reaction: 'Sneezing, congestion', severity: 'mild' });
    const vitd = rec('medication', iso(dateOf(6)), { name: 'Vitamin D3', dose: '2000 IU', schedule: 'daily', kind: 'supplement', time: '09:00', purpose: 'Deficiency', stock: 40 });
    const omega = rec('medication', iso(dateOf(40)), { name: 'Omega-3 (fish oil)', dose: '1 g EPA+DHA', schedule: 'daily', kind: 'supplement', time: '13:00', purpose: 'Triglycerides', stock: 12 });
    const creat = rec('medication', iso(dateOf(80)), { name: 'Creatine monohydrate', dose: '5 g', schedule: 'daily', kind: 'supplement', time: '18:00', purpose: 'Strength', stock: 55 });
    rec('family', start, { relative: 'Father', condition: 'Type 2 diabetes', ageOnset: 48 });
    rec('family', start, { relative: 'Mother', condition: 'Hypertension', ageOnset: 52 });
    rec('family', start, { relative: 'Paternal grandfather', condition: 'Heart attack', ageOnset: 62 });
    rec('vaccination', '2021-03-10', { name: 'Tetanus (Td)', dose: 'Booster', nextDue: '2031-03-10' });
    rec('vaccination', iso(dateOf(20)), { name: 'Influenza', dose: 'Annual', nextDue: iso(dateOf(20 + 365)) });
    rec('vaccination', '2015-06-01', { name: 'Hepatitis B', dose: '3-dose series complete' });
    rec('screening', null, { name: 'Dental check-up & cleaning', last: iso(dateOf(-60)), intervalMonths: 6 });
    rec('screening', null, { name: 'Eye exam', last: iso(dateOf(-400)), intervalMonths: 24 });
    rec('screening', null, { name: 'Blood panel', last: iso(dateOf(175)), intervalMonths: 3 });
    rec('screening', null, { name: 'Skin check (moles)', last: null, intervalMonths: 12 });
    rec('screening', null, { name: 'Blood pressure (clinic)', last: iso(dateOf(150)), intervalMonths: 12 });
    rec('provider', null, { name: 'Dr. Mehta', specialty: 'General physician', phone: '+91 98xxx xxxxx' });
    rec('appointment', iso(dateOf(5)), { title: 'Baseline check-up', provider: 'Dr. Mehta', kind: 'GP', status: 'done', notes: 'HbA1c 5.9, TG high, Vit D low. Lifestyle first, recheck in 3 months.', followUp: 'Recheck bloods in 12 weeks' });
    rec('appointment', iso(dateOf(92)), { title: '3-month review', provider: 'Dr. Mehta', kind: 'GP', status: 'done', notes: 'Clear improvement. Continue.' });
    rec('appointment', iso(dateOf(DAYS + 12)), { title: 'Dental cleaning', provider: 'Smile Dental', kind: 'Dental', status: 'upcoming', questions: 'Gum sensitivity on lower left' });
    rec('injury', iso(dateOf(108)), { part: 'Lower back', cause: 'Deadlift with rounded back', severity: 'mild', rehab: 'McGill big 3, walks, deload 2 weeks', status: 'recovered' }, 0);
    rec('illness', iso(dateOf(95)), { name: 'Common cold', start: iso(dateOf(95)), end: iso(dateOf(99)), daysLost: 2 }, 0);
    rec('illness', iso(dateOf(22)), { name: 'Viral fever', start: iso(dateOf(22)), end: iso(dateOf(26)), daysLost: 3 }, 0);
    rec('experiment', iso(dateOf(120)), { title: 'No caffeine after 12 pm', hypothesis: 'Deep sleep and HRV improve', intervention: 'Last coffee before noon', start: iso(dateOf(120)), end: iso(dateOf(141)), metrics: ['hrv', 'sleep_duration', 'energy'], status: 'complete', result: 'Sleep +22 min, HRV +4 ms vs prior 3 weeks. Keeping it.' });
    rec('experiment', iso(dateOf(160)), { title: 'Dinner by 8 pm', hypothesis: 'Lower night RHR, better energy', intervention: 'Kitchen closes at 8 pm', start: iso(dateOf(160)), end: iso(dateOf(188)), metrics: ['rhr', 'hrv', 'energy'], status: 'running' });
    rec('phase', iso(dateOf(14)), { kind: 'cut', start: iso(dateOf(14)), end: iso(dateOf(110)), targetRate: 0.5, notes: 'First cut' });
    rec('phase', iso(dateOf(110)), { kind: 'diet_break', start: iso(dateOf(110)), end: iso(dateOf(124)), targetRate: 0, notes: 'Maintenance break' });
    rec('phase', iso(dateOf(124)), { kind: 'cut', start: iso(dateOf(124)), end: null, targetRate: 0.4, notes: 'Second cut to 76 kg' });
    rec('protocol', null, { name: 'Sick-day protocol', when: 'Fever, cold or RHR +5 bpm for 2+ days', steps: ['Skip intense training; walk only', 'Sleep 8–9 h', 'Fluids 3 L + electrolytes', 'Protein target still applies', 'Log symptoms daily'] });
    rec('protocol', null, { name: 'Travel protocol', when: 'Any trip of 2+ days', steps: ['Pack resistance band', 'Walk 10k steps; take stairs', 'Protein at every meal', 'Get morning light at the destination', 'Keep wake time ±1 h'] });
    rec('protocol', null, { name: 'Minimum viable health day', when: 'Overwhelmed / low-energy days', steps: ['Sleep window protected', '5k steps', 'Protein at 2 meals', 'Water target', 'No alcohol'] });
    rec('protocol', null, { name: 'Morning routine', when: 'Every morning', steps: ['Wake 6:30, weigh in', 'Water + sunlight 10 min', 'Check-in (30 s)', 'High-protein breakfast'] });
    for (let i = 0; i < DAYS; i += 1) {
      const tags = [];
      if (i >= 22 && i <= 26) tags.push('sick');
      if (i >= 95 && i <= 99) tags.push('sick');
      if (i >= 60 && i <= 64) tags.push('travel');
      if (i >= 130 && i <= 132) tags.push('festival');
      if (tags.length) rec('context', iso(dateOf(i)), { tags });
    }
    // Symptoms: frequent early, fading
    for (let i = 0; i < DAYS; i++) {
      const p = i / DAYS;
      if (r() < 0.12 * (1 - p)) rec('symptom', iso(dateOf(i)), { name: r() < 0.6 ? 'Headache' : 'Bloating', severity: Math.round(3 + r() * 4 - p * 2), duration: '2-4 h', triggers: r() < 0.5 ? 'Poor sleep' : 'Heavy dinner' });
      if (r() < 0.08 * (1 - p)) rec('symptom', iso(dateOf(i)), { name: 'Afternoon energy crash', severity: Math.round(4 + r() * 3), duration: '1-2 h', triggers: 'High-carb lunch' });
    }

    // Daily simulation
    let trueW = 86.2;
    const meds = [[vitd, 6], [omega, 40], [creat, 80]];
    const lifts = { Squat: 50, 'Bench press': 45, Deadlift: 70, 'Overhead press': 30, 'Barbell row': 40, 'Pull-up': 0 };
    const ent = (metric, date, value, extra = {}) => insert('entries', { metric, date, ts: extra.ts || date, value, source: extra.source || 'manual', value2: extra.value2, text: extra.text, meta: extra.meta });

    for (let i = 0; i < DAYS; i++) {
      const p = i / (DAYS - 1);
      const d = dateOf(i), date = iso(d), dow = d.getDay(), weekend = dow === 0 || dow === 6;
      const sick = (i >= 22 && i <= 26) || (i >= 95 && i <= 99);
      const cutting = (i >= 14 && i < 110) || i >= 124;
      // Energy balance (true intake vs true expenditure)
      const steps = Math.max(1500, Math.round(n(4300 + p * 5200 + (weekend ? -800 : 0), 1500) * (sick ? 0.4 : 1)));
      const tdee = 10 * trueW + 6.25 * 176 - 5 * 36 + 5 + steps * 0.045 + 450;
      const deficit = cutting ? 350 + p * 250 : (i < 14 ? -150 : 0);
      const intake = Math.max(1200, n(tdee - deficit + (weekend ? 250 * (1 - p) : 0), 220));
      trueW += (intake - tdee) / 7700;
      const water = (weekend ? 0.4 : 0) + (r() < 0.1 ? 0.6 : 0) + n(0, 0.35);
      if (r() < 0.86) ent('weight', date, +(trueW + water).toFixed(1), { ts: `${date}T06:45:00` });

      // Food log: logged ≈ 93% of true intake (realistic under-reporting)
      if (r() < 0.93 && !(sick && r() < 0.5)) {
        const logged = intake * 0.93;
        for (const [meal, frac] of Object.entries(MEAL_SPLIT)) {
          const pool = r() < 0.2 + p * 0.75 ? MEALS[meal].late : MEALS[meal].early;
          const items = pool[Math.floor(r() * pool.length)];
          const base = items.reduce((s, [nm, q]) => s + (foods[nm].kcal * foods[nm].serving_g * q) / 100, 0);
          const scale = (logged * frac) / base;
          for (const [nm, q] of items) {
            const f = foods[nm];
            const grams = Math.round(f.serving_g * q * scale);
            const row = { date, meal, food_id: f.id, name: f.name, grams, nova: f.nova, time: { breakfast: '08:30', lunch: '13:30', snack: '17:00', dinner: p > 0.6 ? '19:45' : '21:45' }[meal], created: date };
            for (const k of NUTR) row[k] = +((f[k] || 0) * grams / 100).toFixed(2);
            insert('food_logs', row);
          }
        }
      }
      ent('steps', date, steps, { source: 'health-connect' });
      ent('active_kcal', date, Math.round(steps * 0.04 + n(120, 40)), { source: 'health-connect' });
      ent('water', date, Math.round(n(1500 + p * 1200, 300)));
      ent('caffeine', date, Math.max(0, Math.round(n(330 - p * 150, 60))));
      if (r() < 0.45 - p * 0.3 || (weekend && r() < 0.6 - p * 0.4)) ent('alcohol', date, +(1 + r() * 4 * (1 - p * 0.7)).toFixed(1));
      if (r() < 0.2 + p * 0.7) ent('sunlight', date, Math.round(n(12, 4)));
      if (i > 60 && r() < 0.3 + p * 0.5) ent('meditation', date, Math.round(n(11, 3)));
      ent('screen_bed', date, Math.max(0, Math.round(n(55 - p * 40, 12))));

      // Sleep
      const dur = Math.min(9.2, Math.max(4.2, n(6.0 + p * 1.35 + (weekend ? 0.4 : 0) - (sick ? -0.8 : 0), 0.55)));
      const bedH = 24.6 - p * 1.6 + n(0, 0.6 - p * 0.35);
      const bed = new Date(d); bed.setDate(bed.getDate() - 1); bed.setHours(0, 0, 0, 0); bed.setMinutes(Math.round(bedH * 60));
      const lat = Math.max(4, Math.round(n(28 - p * 15, 6)));
      const wake = new Date(bed.getTime() + (dur * 60 + lat + 20) * 60000);
      insert('sleep', { date, bed: bed.toISOString(), wake: wake.toISOString(), duration: +dur.toFixed(2), quality: Math.min(5, Math.max(1, Math.round(n(2.6 + p * 1.8, 0.7)))),
        efficiency: Math.round(Math.min(97, n(82 + p * 9, 3))), latency: lat, awakenings: Math.max(0, Math.round(n(3 - p * 1.5, 1))),
        deep: +(dur * n(0.13 + p * 0.04, 0.02)).toFixed(2), rem: +(dur * n(0.19 + p * 0.03, 0.02)).toFixed(2), source: 'health-connect',
        hygiene: { dark: r() < 0.5 + p * 0.45, cool: r() < 0.6 + p * 0.3, noScreens: r() < 0.25 + p * 0.6, windDown: r() < 0.2 + p * 0.6 } });
      ent('rhr', date, Math.round(n(73 - p * 11 + (sick ? 7 : 0), 1.8)), { source: 'health-connect' });
      ent('hrv', date, Math.round(n(31 + p * 22 - (sick ? 14 : 0), 4)), { source: 'health-connect' });
      ent('spo2', date, Math.round(n(96.5, 0.8)), { source: 'health-connect' });
      ent('resp_rate', date, +n(15.5 - p * 1.2 + (sick ? 2 : 0), 0.4).toFixed(1), { source: 'health-connect' });

      // Check-in
      if (r() < 0.9) {
        const ci = { energy: 2.4 + p * 1.7 - (sick ? 1.3 : 0), mood: 2.8 + p * 1.3, stress: 3.9 - p * 1.6, soreness: 2 + (i > 75 ? 0.6 : 0), focus: 2.6 + p * 1.4, hunger: 3 - p * 0.3, digestion: 2.7 + p * 1.5 };
        for (const [k, v] of Object.entries(ci)) ent(k, date, Math.min(5, Math.max(1, Math.round(n(v, 0.6)))));
      }
      if (i % 3 === 0) ent('bristol', date, Math.round(Math.min(7, Math.max(1, n(3 + p, 0.8)))));

      // Vitals
      if (dow === 1 || dow === 4) {
        ent('bp', date, Math.round(n(136 - p * 16, 3.5)), { ts: `${date}T07:10:00`, value2: Math.round(n(87 - p * 10, 2.5)) });
      }
      if (dow === 0) ent('glucose', date, Math.round(n(106 - p * 14, 3)), { ts: `${date}T07:00:00`, meta: { context: 'fasting' } });
      if (dow === 3 && r() < 0.7) ent('glucose', date, Math.round(n(168 - p * 38, 10)), { ts: `${date}T14:30:00`, meta: { context: '1h post-meal' } });

      // Measurements (every 4 weeks)
      if (i % 28 === 2) {
        const mm = { waist: 98.5 - p * 9.5, hips: 104 - p * 4, neck: 40 - p * 1.5, chest: 102 - p * 2, arm: 33 + p * 1.2, thigh: 58 - p * 1.8, bodyfat: 27.5 - p * 6.5 };
        for (const [k, v] of Object.entries(mm)) ent(k, date, +n(v, 0.25).toFixed(1), { ts: `${date}T07:00:00` });
        ent('vo2max', date, +(36 + p * 6.5 + n(0, 0.4)).toFixed(1), { source: 'health-connect' });
        ent('gad7', date, Math.max(0, Math.round(9 - p * 6 + n(0, 1))));
        ent('phq9', date, Math.max(0, Math.round(8 - p * 5.5 + n(0, 1))));
      }
      // Fitness tests (quarterly-ish)
      if ([3, 60, 120, 176].includes(i)) {
        const t = { grip: 38 + p * 6, pushups: 12 + p * 17, pullups: 1 + p * 7, dead_hang: 20 + p * 38, plank: 45 + p * 80, sit_rise: 6 + p * 3, balance: 12 + p * 25, run_5k: 35 - p * 8, hr_recovery: 17 + p * 11 };
        for (const [k, v] of Object.entries(t)) ent(k, date, +v.toFixed(1));
      }

      // Training
      if (!sick) {
        const plan = i < 40 ? { 2: 'walk' } : i < 75 ? { 1: 'A', 3: 'cardio', 5: 'B' } : i < 140 ? { 1: 'A', 2: 'z2', 3: 'B', 5: 'A', 6: 'z2' } : { 1: 'A', 2: 'z2', 3: 'B', 4: 'hiit', 5: 'A', 6: 'z2', 0: 'mob' };
        const sess = plan[dow];
        if (sess && r() < 0.88 && !(i >= 108 && i <= 118 && (sess === 'A' || sess === 'B'))) {
          if (sess === 'A' || sess === 'B') {
            const ex = sess === 'A' ? ['Squat', 'Bench press', 'Barbell row'] : ['Deadlift', 'Overhead press', 'Pull-up'];
            const sets = [];
            for (const e of ex) {
              lifts[e] += e === 'Pull-up' ? 0 : (e === 'Deadlift' || e === 'Squat' ? 0.9 : 0.45) * (r() < 0.8 ? 1 : 0);
              const reps = e === 'Pull-up' ? Math.max(1, Math.round(1 + p * 7)) : 5 + Math.round(r() * 3);
              for (let s = 0; s < 3; s++) sets.push({ exercise: e, weight: e === 'Pull-up' ? 0 : Math.round(lifts[e] * 2) / 2, reps, rpe: Math.round(n(7.5, 0.8)) });
            }
            insert('workouts', { date, kind: 'strength', title: `Strength ${sess}`, duration: Math.round(n(55, 6)), rpe: Math.round(n(7.5, 0.7)), sets });
          } else if (sess === 'z2' || sess === 'cardio' || sess === 'walk') {
            const dur = sess === 'walk' ? 30 : Math.round(n(40, 6));
            insert('workouts', { date, kind: 'cardio', title: sess === 'walk' ? 'Brisk walk' : r() < 0.5 ? 'Zone 2 cycle' : 'Zone 2 jog', duration: dur, zone: 2, rpe: 4,
              distance: +(dur * (sess === 'walk' ? 0.1 : 0.14)).toFixed(1), kcal: Math.round(dur * 8) });
          } else if (sess === 'hiit') {
            insert('workouts', { date, kind: 'cardio', title: '4×4 intervals', duration: 32, zone: 5, rpe: 9, kcal: 330 });
          } else if (sess === 'mob') {
            insert('workouts', { date, kind: 'mobility', title: 'Mobility flow', duration: 20, rpe: 2 });
          }
        }
      }
      // Manual action logs
      for (const [k, id] of Object.entries(actionIds)) {
        const A = ACTION_BY_KEY[k];
        if (A.auto && !['meds', 'alcohol_free', 'bedtime', 'wake_consistent'].includes(A.auto)) continue;
        const created = db.prepare('SELECT created FROM actions WHERE id = ?').get(id).created;
        if (created > date) continue;
        if (r() < 0.5 + p * 0.42) db.prepare('INSERT OR REPLACE INTO action_logs (date, action_id, done) VALUES (?,?,1)').run(date, id);
      }
      for (const [id, startDay] of meds) if (i >= startDay && r() < 0.88) db.prepare('INSERT OR REPLACE INTO med_logs (date, record_id, done) VALUES (?,?,1)').run(date, id);
    }

    // Labs: baseline, 3-month, 6-month
    const panels = [[4, 0], [90, 0.5], [175, 1]];
    const L = {
      fasting_glucose: [106, 94], hba1c: [5.9, 5.4], fasting_insulin: [14.5, 6.8], uric_acid: [7.3, 5.9], total_chol: [228, 182], ldl: [148, 112],
      hdl: [40, 49], triglycerides: [196, 104], apob: [116, 87], lpa: [38, 38], hscrp: [3.4, 0.9], homocysteine: [13, 9.5], vitd: [14, 44], b12: [230, 430],
      ferritin: [180, 140], folate: [6, 12], tsh: [2.3, 2.0], ft4: [1.2, 1.25], alt: [52, 24], ast: [38, 22], ggt: [55, 26], creatinine: [0.98, 0.95],
      egfr: [98, 101], hemoglobin: [14.6, 15.1], wbc: [8.1, 5.9], platelets: [260, 245], testosterone: [410, 560],
    };
    for (const [day, p] of panels) {
      const date = iso(dateOf(day));
      for (const [k, [a, b]] of Object.entries(L)) {
        if (k === 'lpa' && day !== 4) continue;
        const v = a + (b - a) * p * (0.9 + r() * 0.2);
        insert('labs', { date, marker: k, value: +v.toFixed(k === 'hba1c' || k === 'hscrp' || k === 'tsh' ? 2 : 1), lab: 'City Diagnostics' });
      }
    }
    // Saved meals
    insert('meals', { name: 'High-protein oats', kind: 'meal', items: [{ name: 'Oats (dry)', grams: 50 }, { name: 'Milk (toned / 1.5%)', grams: 250 }, { name: 'Whey protein powder', grams: 30 }, { name: 'Banana', grams: 118 }] });
    insert('meals', { name: 'Standard dal-roti thali', kind: 'meal', items: [{ name: 'Roti / Chapati (plain)', grams: 70 }, { name: 'Dal tadka (toor)', grams: 150 }, { name: 'Mixed veg curry', grams: 150 }, { name: 'Curd / Dahi', grams: 150 }, { name: 'Green salad (mixed)', grams: 100 }] });
    for (const m of db.prepare('SELECT * FROM meals').all()) {
      const items = JSON.parse(m.items).map((it) => ({ ...it, food_id: foods[it.name]?.id }));
      db.prepare('UPDATE meals SET items = ? WHERE id = ?').run(JSON.stringify(items), m.id);
    }
    insert('ingest_runs', { source: 'health-connect', started: new Date(Date.now() - 3600e3).toISOString(), finished: new Date(Date.now() - 3590e3).toISOString(), status: 'ok', counts: { entries: 1260, sleep: 180, workouts: 0, skipped: 0, rejected: 0 } });
  });
  return { days: DAYS };
}
