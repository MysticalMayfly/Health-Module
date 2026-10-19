// Apple Health has no web API. Two supported routes into LifeOS:
//  1. export.xml   — Health app → profile → "Export All Health Data" → upload the XML (streamed with sax).
//  2. JSON webhook — e.g. the "Health Auto Export" iOS app's REST automation POSTing to /api/ingest/apple-health.
import fs from 'node:fs';
import sax from 'sax';
import { LB, GLUCOSE_MMOL, localDate, iso } from '../canonical.js';

const HK = {
  HKQuantityTypeIdentifierBodyMass: 'weight',
  HKQuantityTypeIdentifierBodyFatPercentage: 'bodyfat',
  HKQuantityTypeIdentifierWaistCircumference: 'waist',
  HKQuantityTypeIdentifierStepCount: 'steps',
  HKQuantityTypeIdentifierActiveEnergyBurned: 'active_kcal',
  HKQuantityTypeIdentifierRestingHeartRate: 'rhr',
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: 'hrv',
  HKQuantityTypeIdentifierVO2Max: 'vo2max',
  HKQuantityTypeIdentifierOxygenSaturation: 'spo2',
  HKQuantityTypeIdentifierRespiratoryRate: 'resp_rate',
  HKQuantityTypeIdentifierBloodGlucose: 'glucose',
  HKQuantityTypeIdentifierDietaryWater: 'water',
  HKQuantityTypeIdentifierDietaryCaffeine: 'caffeine',
  HKQuantityTypeIdentifierBodyTemperature: 'body_temp',
};

function convert(metric, value, unit = '') {
  const u = unit.toLowerCase();
  if (metric === 'weight' && u === 'lb') return value * LB;
  if (metric === 'waist' && u === 'in') return value * 2.54;
  if (metric === 'waist' && u === 'm') return value * 100;
  if ((metric === 'bodyfat' || metric === 'spo2') && value <= 1) return value * 100;
  if (metric === 'glucose' && u.includes('mmol')) return value * GLUCOSE_MMOL;
  if (metric === 'water' && u === 'l') return value * 1000;
  if (metric === 'water' && u.includes('oz')) return value * 29.5735;
  if (metric === 'active_kcal' && u === 'kj') return value / 4.184;
  if (metric === 'body_temp' && u.includes('f')) return (value - 32) * 5 / 9;
  return value;
}

const SLEEP_ASLEEP = /Asleep|AsleepUnspecified|AsleepCore|AsleepDeep|AsleepREM/;

/** Stream-parse export.xml into canonical samples / sleep / workouts. */
export function parseExportXml(filePath) {
  return new Promise((resolve, reject) => {
    const samples = [], workouts = [], bp = new Map(), nights = new Map();
    const parser = sax.createStream(true, { trim: true });
    parser.on('opentag', ({ name, attributes: a }) => {
      if (name === 'Record') {
        const metric = HK[a.type];
        const v = parseFloat(a.value);
        if (metric) samples.push({ metric, ts: a.startDate, value: convert(metric, v, a.unit) });
        else if (a.type === 'HKQuantityTypeIdentifierBloodPressureSystolic' || a.type === 'HKQuantityTypeIdentifierBloodPressureDiastolic') {
          const k = a.startDate; const p = bp.get(k) || {};
          p[a.type.endsWith('Systolic') ? 'sys' : 'dia'] = v; bp.set(k, p);
        } else if (a.type === 'HKCategoryTypeIdentifierSleepAnalysis') {
          addSleepSegment(nights, a.startDate, a.endDate, a.value);
        }
      } else if (name === 'Workout') {
        const mult = a.durationUnit === 'hr' ? 60 : a.durationUnit === 's' ? 1 / 60 : 1;
        workouts.push({
          date: localDate(a.startDate), kind: workoutKind(a.workoutActivityType),
          title: (a.workoutActivityType || 'Workout').replace('HKWorkoutActivityType', ''),
          duration: parseFloat(a.duration) * mult,
          distance: a.totalDistance ? parseFloat(a.totalDistance) * (a.totalDistanceUnit === 'mi' ? 1.60934 : 1) : null,
          kcal: a.totalEnergyBurned ? parseFloat(a.totalEnergyBurned) : null,
          ext_id: `ah-${iso(a.startDate)}`,
        });
      }
    });
    parser.on('error', reject);
    parser.on('end', () => {
      for (const [ts, p] of bp) if (p.sys && p.dia) samples.push({ metric: 'bp', ts, value: p.sys, value2: p.dia });
      resolve({ samples, sleep: finishNights(nights), workouts });
    });
    fs.createReadStream(filePath).pipe(parser);
  });
}

function addSleepSegment(nights, start, end, value) {
  const s = new Date(iso(start)), e = new Date(iso(end));
  const date = localDate(e); // a night belongs to the morning you wake up
  const n = nights.get(date) || { date, bed: s, wake: e, asleep: 0, deep: 0, rem: 0, inBed: 0, awake: 0 };
  const h = (e - s) / 3.6e6;
  if (s < n.bed) n.bed = s;
  if (e > n.wake) n.wake = e;
  if (/InBed/.test(value)) n.inBed += h;
  else if (/Awake/.test(value)) n.awake += h;
  else if (SLEEP_ASLEEP.test(value)) {
    n.asleep += h;
    if (/Deep/.test(value)) n.deep += h;
    if (/REM/.test(value)) n.rem += h;
  }
  nights.set(date, n);
}

function finishNights(nights) {
  return [...nights.values()].filter((n) => n.asleep > 0.5).map((n) => {
    const span = (n.wake - n.bed) / 3.6e6;
    return {
      date: n.date, bed: n.bed.toISOString(), wake: n.wake.toISOString(), duration: +n.asleep.toFixed(2),
      deep: n.deep ? +n.deep.toFixed(2) : null, rem: n.rem ? +n.rem.toFixed(2) : null,
      efficiency: span > 0 ? Math.min(100, Math.round((n.asleep / span) * 100)) : null,
    };
  });
}

function workoutKind(t = '') {
  if (/Strength|Weight|Functional|CrossTraining|CoreTraining/.test(t)) return 'strength';
  if (/Yoga|Pilates|Flexibility|MindAndBody|Cooldown/.test(t)) return 'mobility';
  if (/Soccer|Basketball|Tennis|Badminton|Cricket|Squash|Volleyball|Golf/.test(t)) return 'sport';
  return 'cardio';
}

// ── Health Auto Export JSON
const HAE = {
  step_count: 'steps', weight_body_mass: 'weight', body_mass: 'weight', resting_heart_rate: 'rhr',
  heart_rate_variability: 'hrv', active_energy: 'active_kcal', blood_glucose: 'glucose',
  body_fat_percentage: 'bodyfat', vo2_max: 'vo2max', dietary_water: 'water', blood_oxygen_saturation: 'spo2',
  respiratory_rate: 'resp_rate', dietary_caffeine: 'caffeine', waist_circumference: 'waist',
};

export function parseAutoExportJson(body) {
  const data = body?.data || body;
  const samples = [], sleep = [], workouts = [];
  for (const m of data.metrics || []) {
    if (m.name === 'sleep_analysis') {
      for (const d of m.data || []) {
        const asleep = d.asleep ?? d.totalSleep ?? ((d.core || 0) + (d.deep || 0) + (d.rem || 0));
        const bed = d.sleepStart || d.inBedStart, wake = d.sleepEnd || d.inBedEnd;
        if (!asleep || !wake) continue;
        const span = bed && wake ? (new Date(iso(wake)) - new Date(iso(bed))) / 3.6e6 : null;
        sleep.push({ date: localDate(wake), bed: iso(bed), wake: iso(wake), duration: +asleep.toFixed(2),
          deep: d.deep ?? null, rem: d.rem ?? null, efficiency: span ? Math.round((asleep / span) * 100) : null });
      }
      continue;
    }
    if (m.name === 'blood_pressure') {
      for (const d of m.data || []) samples.push({ metric: 'bp', ts: d.date, value: d.systolic, value2: d.diastolic });
      continue;
    }
    const metric = HAE[m.name];
    if (!metric) continue;
    for (const d of m.data || []) samples.push({ metric, ts: d.date, value: convert(metric, Number(d.qty ?? d.Avg ?? d.avg), m.units) });
  }
  for (const w of data.workouts || []) {
    const start = w.start || w.startDate;
    const dur = typeof w.duration === 'number' ? w.duration / 60 : null; // seconds → minutes
    workouts.push({ date: localDate(start), kind: workoutKind(w.name), title: w.name || 'Workout', duration: dur,
      distance: w.distance?.qty ?? null, kcal: w.activeEnergyBurned?.qty ?? w.activeEnergy?.qty ?? null, ext_id: `hae-${iso(start)}` });
  }
  return { samples, sleep, workouts };
}

export default {
  id: 'apple-health',
  name: 'Apple Health',
  async normalize(payload) {
    if (payload?.filePath) return parseExportXml(payload.filePath);
    return parseAutoExportJson(payload);
  },
};
