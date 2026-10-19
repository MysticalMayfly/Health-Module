// Daily action library. Onboarding picks from this list based on the assessment;
// the journey unlocks later phases as adherence holds (Repair → Stabilize → Build → Optimize).
// auto: a rule the app can verify from logged data (otherwise the item is ticked by hand).
export const PHASES = {
  1: { name: 'Repair', desc: 'Stop feeding the 99 causes of disease. Start measuring.' },
  2: { name: 'Stabilize', desc: 'Lock in sleep, protein, movement and energy balance.' },
  3: { name: 'Build', desc: 'Add training, fibre, plants and stress skills, the 99 causes of health.' },
  4: { name: 'Optimize', desc: 'Fine-tune toward the 1% pinnacle: performance and longevity.' },
};

const a = (key, title, domain, phase, why, auto = null, triggers = []) => ({ key, title, domain, phase, why, auto, triggers, layer: 1 });

export const ACTIONS = [
  // Phase 1 — Repair
  a('log_food', 'Log everything you eat', 'nutrition', 1, 'You cannot change what you do not see. Logging alone tends to improve eating.', 'log_food', ['always']),
  a('weigh_in', 'Weigh in after waking', 'body', 1, 'Daily weigh-ins feed the trend line, which separates fat change from water noise.', 'weigh_in', ['goal_weight']),
  a('checkin', '30-second daily check-in', 'mind', 1, 'Energy, mood and stress are early signals that move before markers do.', 'checkin', ['always']),
  a('bedtime', 'In bed by your target bedtime', 'sleep', 1, 'A regular sleep time sets your circadian rhythm, which affects most other signals.', 'bedtime', ['sleep_irregular', 'sleep_short']),
  a('water', 'Drink your water target', 'nutrition', 1, 'Mild dehydration reduces energy and focus and is often mistaken for hunger.', 'water', ['low_water']),
  a('walk_meals', '10-minute walk after your biggest meal', 'movement', 1, 'A short walk after eating can blunt the rise in blood glucose.', null, ['sedentary', 'glucose']),
  a('no_sugary_drinks', 'No sugary drinks or packaged juice', 'nutrition', 1, 'Liquid sugar brings calories without fullness and is a common driver of insulin resistance.', null, ['sugary_drinks']),
  a('meds', 'Take medications & supplements', 'medical', 1, 'Taking medication consistently is part of treating any condition.', 'meds', ['has_meds']),
  a('smoke_free', 'Smoke-free day', 'substances', 1, 'Each smoke-free day reduces load on blood vessels, lungs and the immune system.', null, ['smoker']),
  a('screens_off', 'Screens off 30 min before bed', 'sleep', 1, 'Light and stimulation late in the evening delay melatonin and sleep onset.', null, ['screens']),
  // Phase 2 — Stabilize
  a('sleep7', 'Sleep 7+ hours', 'sleep', 2, 'Short sleep raises appetite, glucose and blood pressure, and slows recovery.', 'sleep7', ['sleep_short']),
  a('protein', 'Hit your protein target', 'nutrition', 2, 'Protein protects muscle while you lose fat and is the most filling macronutrient.', 'protein', ['low_protein', 'goal_weight']),
  a('steps', 'Reach your step goal', 'movement', 2, 'Everyday movement (NEAT) is the biggest adjustable part of daily energy use.', 'steps', ['sedentary']),
  a('cal_range', 'Stay within ±10% of calorie target', 'nutrition', 2, 'Consistent energy balance moves the weight trend in a predictable way.', 'cal_range', ['goal_weight']),
  a('caffeine_cutoff', 'No caffeine after 12 pm', 'sleep', 2, 'Caffeine’s half-life is about 5–6 h, so afternoon coffee reduces deep sleep.', null, ['caffeine']),
  a('alcohol_free', 'Alcohol-free day', 'substances', 2, 'Alcohol suppresses HRV and REM sleep and adds calories without nutrients.', 'alcohol_free', ['alcohol']),
  a('sunlight', '10 min morning sunlight', 'recovery', 2, 'Morning light helps set your body clock and improves sleep the following night.', 'sunlight', ['always']),
  a('veg2', 'Vegetables at 2 meals', 'nutrition', 2, 'Vegetables add fibre, potassium and micronutrients for very few calories.', null, ['low_veg']),
  a('dinner_early', 'Last meal 3 h before bed', 'sleep', 2, 'Eating late raises night-time heart rate and lowers HRV.', null, ['late_eating']),
  // Phase 3 — Build
  a('train', 'Train, or take a planned recovery day', 'movement', 3, 'Strength and cardio fitness are among the strongest predictors of longevity.', 'train', ['no_strength']),
  a('fiber', 'Eat 30 g fibre', 'nutrition', 3, 'Fibre feeds gut bacteria and improves lipids, glucose and fullness.', 'fiber', ['low_veg']),
  a('plants5', '5+ servings of fruit & vegetables', 'nutrition', 3, 'A greater variety of plants supports a healthier gut microbiome.', 'plants5', ['low_veg']),
  a('zone2', '30 min zone-2 cardio', 'movement', 3, 'Zone 2 builds mitochondria and aerobic capacity, which strengthens metabolic health.', 'zone2', ['no_cardio']),
  a('meditate', '10 min meditation or breathwork', 'recovery', 3, 'Regular calming practice lowers stress responses and improves HRV.', 'meditate', ['stress']),
  a('mobility', '10 min mobility', 'movement', 3, 'Keeping your range of motion protects joints and helps prevent injury.', null, ['pain']),
  a('no_upf', 'Ultra-processed food under 10% of calories', 'nutrition', 3, 'Ultra-processed diets lead to eating about 500 kcal/day more without noticing.', 'no_upf', ['processed']),
  a('connect', 'One meaningful social connection', 'mind', 3, 'Loneliness carries a mortality risk comparable to smoking.', null, ['always']),
  a('outdoors', '30 min outdoors', 'recovery', 3, 'Time in nature lowers cortisol and improves mood.', null, ['always']),
  // Phase 4 — Optimize
  a('hiit', 'High-intensity intervals (2×/week)', 'movement', 4, 'VO₂max is one of the strongest single predictors of all-cause mortality.', null, ['always']),
  a('wake_consistent', 'Wake within 30 min of your usual time', 'sleep', 4, 'A consistent wake time anchors your daily rhythm.', 'wake_consistent', ['always']),
  a('readiness', 'Train according to your readiness score', 'recovery', 4, 'Matching training load to recovery is how you get stronger without burning out.', null, ['always']),
  a('move_breaks', 'Movement break every 60 min of sitting', 'movement', 4, 'Long sitting raises cardiometabolic risk even if you exercise.', null, ['desk']),
  a('gratitude', 'Write 3 gratitudes', 'mind', 4, 'A simple practice that has been shown to raise wellbeing.', null, ['always']),
];

export const ACTION_BY_KEY = Object.fromEntries(ACTIONS.map((x) => [x.key, x]));
