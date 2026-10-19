import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import Layout from './components/Layout.jsx';
import { useData } from './lib/store.jsx';
import Today from './pages/Today.jsx';
import Journey from './pages/Journey.jsx';
import Iceberg from './pages/Iceberg.jsx';
import Food from './pages/Food.jsx';
import Weight from './pages/Weight.jsx';
import Sleep from './pages/Sleep.jsx';
import Training from './pages/Training.jsx';
import Body from './pages/Body.jsx';
import Vitals from './pages/Vitals.jsx';
import CheckIn from './pages/CheckIn.jsx';
import Weekly from './pages/Weekly.jsx';
import Recovery from './pages/Recovery.jsx';
import Nutrition from './pages/Nutrition.jsx';
import Correlations from './pages/Correlations.jsx';
import Experiments from './pages/Experiments.jsx';
import Annual from './pages/Annual.jsx';
import Labs from './pages/Labs.jsx';
import Medical from './pages/Medical.jsx';
import DoctorSummary from './pages/DoctorSummary.jsx';
import Actions from './pages/Actions.jsx';
import Integrations from './pages/Integrations.jsx';
import Metrics from './pages/Metrics.jsx';
import Settings from './pages/Settings.jsx';
import Onboarding from './pages/Onboarding.jsx';

function Splash({ error }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} className="grad-bg flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-xl">
        <Activity size={28} />
      </motion.div>
      <div className="text-sm text-muted">{error ? `Can’t reach the API: ${error}` : 'Loading your health OS…'}</div>
    </div>
  );
}

export default function App() {
  const { model, settings, error } = useData();
  const loc = useLocation();
  if (!settings || !model) return <Splash error={error} />;
  const onboarded = settings.onboarding?.completed;
  if (!onboarded && loc.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  return (
    <Routes>
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/doctor-summary" element={<DoctorSummary />} />
      <Route element={<Layout />}>
        <Route index element={<Today />} />
        <Route path="journey" element={<Journey />} />
        <Route path="iceberg" element={<Iceberg />} />
        <Route path="food" element={<Food />} />
        <Route path="weight" element={<Weight />} />
        <Route path="sleep" element={<Sleep />} />
        <Route path="training" element={<Training />} />
        <Route path="body" element={<Body />} />
        <Route path="vitals" element={<Vitals />} />
        <Route path="checkin" element={<CheckIn />} />
        <Route path="weekly" element={<Weekly />} />
        <Route path="recovery" element={<Recovery />} />
        <Route path="nutrition" element={<Nutrition />} />
        <Route path="correlations" element={<Correlations />} />
        <Route path="experiments" element={<Experiments />} />
        <Route path="annual" element={<Annual />} />
        <Route path="labs" element={<Labs />} />
        <Route path="medical" element={<Medical />} />
        <Route path="actions" element={<Actions />} />
        <Route path="integrations" element={<Integrations />} />
        <Route path="metrics" element={<Metrics />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
