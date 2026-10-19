// Android Health Connect is on-device only, so a companion app / exporter reads records and POSTs them here:
//   POST /api/ingest/health-connect  { "records": [ { "type": "Steps", "count": 812, "startTime": "...", "endTime": "..." }, ... ] }
// Record fields mirror the Health Connect record classes (Steps, Weight, RestingHeartRate, SleepSession...).
import { localDate } from '../canonical.js';

const STAGE = { 1: 'awake', 2: 'sleeping', 3: 'out', 4: 'light', 5: 'deep', 6: 'rem' };

export function normalizeHC(body) {
  const samples = [], sleep = [], workouts = [];
  for (const r of body?.records || []) {
    const t = r.time || r.startTime;
    switch (r.type) {
      case 'Steps': samples.push({ metric: 'steps', ts: t, value: r.count }); break;
      case 'Weight': samples.push({ metric: 'weight', ts: t, value: r.weight?.inKilograms ?? r.weight }); break;
      case 'BodyFat': samples.push({ metric: 'bodyfat', ts: t, value: r.percentage?.value ?? r.percentage }); break;
      case 'RestingHeartRate': samples.push({ metric: 'rhr', ts: t, value: r.beatsPerMinute }); break;
      case 'HeartRateVariabilityRmssd': samples.push({ metric: 'hrv', ts: t, value: r.heartRateVariabilityMillis }); break;
      case 'ActiveCaloriesBurned': samples.push({ metric: 'active_kcal', ts: t, value: r.energy?.inKilocalories ?? r.energy }); break;
      case 'Hydration': samples.push({ metric: 'water', ts: t, value: r.volume?.inMilliliters ?? r.volume }); break;
      case 'OxygenSaturation': samples.push({ metric: 'spo2', ts: t, value: r.percentage?.value ?? r.percentage }); break;
      case 'RespiratoryRate': samples.push({ metric: 'resp_rate', ts: t, value: r.rate }); break;
      case 'Vo2Max': samples.push({ metric: 'vo2max', ts: t, value: r.vo2MillilitersPerMinuteKilogram }); break;
      case 'BloodGlucose': samples.push({ metric: 'glucose', ts: t, value: r.level?.inMilligramsPerDeciliter ?? r.level }); break;
      case 'BloodPressure': samples.push({ metric: 'bp', ts: t,
        value: r.systolic?.inMillimetersOfMercury ?? r.systolic, value2: r.diastolic?.inMillimetersOfMercury ?? r.diastolic }); break;
      case 'BodyTemperature': samples.push({ metric: 'body_temp', ts: t, value: r.temperature?.inCelsius ?? r.temperature }); break;
      case 'SleepSession': {
        const bed = new Date(r.startTime), wake = new Date(r.endTime);
        let asleep = 0, deep = 0, rem = 0;
        for (const s of r.stages || []) {
          const h = (new Date(s.endTime) - new Date(s.startTime)) / 3.6e6;
          const st = STAGE[s.stage] || 'sleeping';
          if (['sleeping', 'light', 'deep', 'rem'].includes(st)) asleep += h;
          if (st === 'deep') deep += h;
          if (st === 'rem') rem += h;
        }
        const span = (wake - bed) / 3.6e6;
        if (!r.stages?.length) asleep = span;
        sleep.push({ date: localDate(wake), bed: bed.toISOString(), wake: wake.toISOString(), duration: +asleep.toFixed(2),
          deep: deep ? +deep.toFixed(2) : null, rem: rem ? +rem.toFixed(2) : null, efficiency: Math.round((asleep / span) * 100) });
        break;
      }
      case 'ExerciseSession': {
        const st = new Date(r.startTime), en = new Date(r.endTime);
        const title = r.title || String(r.exerciseType || 'Workout');
        workouts.push({ date: localDate(st), kind: /STRENGTH|WEIGHT|CALISTHENICS/i.test(String(r.exerciseType)) ? 'strength'
          : /YOGA|PILATES|STRETCH/i.test(String(r.exerciseType)) ? 'mobility' : 'cardio',
          title, duration: (en - st) / 6e4, distance: r.distanceKm ?? null, kcal: r.kcal ?? null, ext_id: `hc-${r.id || st.toISOString()}` });
        break;
      }
      default: break;
    }
  }
  return { samples, sleep, workouts };
}

export default { id: 'health-connect', name: 'Health Connect (Android)', normalize: (p) => normalizeHC(p) };
