import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Settings as Cog, User, Ruler, Palette, Target, Database, Download, UploadCloud, RotateCcw, Sparkles, Shield, Globe, Sun, Moon, Monitor } from 'lucide-react';
import { PageHeader, Card, CardTitle, Stagger, Button, Field, Input, Select, Segmented, Toggle, UnitInput, Modal } from '../components/ui.jsx';
import { useData } from '../lib/store.jsx';
import { useTheme } from '../lib/theme.jsx';
import { api } from '../lib/api.js';
import { ACTIVITY_LABEL } from '../lib/analytics.js';
import { GOALS } from '../lib/journey.js';
import { fmt } from '../lib/format.js';

export default function Settings() {
  const { model: m, settings, saveSettings, refresh, notify, u, units } = useData();
  const { mode, setMode, reduceMotion, setReduceMotion } = useTheme();
  const nav = useNavigate();
  const [p, setP] = useState({ ...settings.profile, height: settings.profile?.height ? +u.from(settings.profile.height, 'length').toFixed(1) : '' });
  const [prefs, setPrefs] = useState(settings.prefs || {});
  const [confirmReset, setConfirmReset] = useState(false);
  const [foodStats, setFoodStats] = useState(null);
  const setU = async (patch) => { await saveSettings({ units: { ...units, ...patch } }); };

  const saveProfile = async () => { await saveSettings({ profile: { ...settings.profile, ...p, height: u.to(Number(p.height), 'length'), birthYear: Number(p.birthYear) } }); notify('Profile saved'); };
  const savePrefs = async () => { await saveSettings({ prefs }); notify('Preferences saved'); };
  const exportAll = () => { window.location.href = '/api/export'; };
  const importAll = (file) => { const fr = new FileReader(); fr.onload = async () => { try { await api.importAll(JSON.parse(fr.result)); await refresh(); notify('Data restored'); } catch (e) { notify(e.message, 'error'); } }; fr.readAsText(file); };

  return (
    <div>
      <PageHeader icon={Cog} title="Settings" subtitle="Profile, units, theme, targets and your data." />
      <Stagger className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card hover={false}>
          <CardTitle icon={Palette} title="Appearance" />
          <div className="space-y-4">
            <Field label="Theme"><div className="flex gap-2">
              {[['light', 'Light', Sun], ['dark', 'Dark', Moon], ['system', 'System', Monitor]].map(([k, l, I]) => (
                <motion.button key={k} whileTap={{ scale: 0.95 }} onClick={() => setMode(k)} className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl border p-3 text-sm transition ${mode === k ? 'border-accent bg-accent/10' : 'border-line hover:bg-raised'}`}><I size={20} />{l}</motion.button>
              ))}
            </div></Field>
            <Toggle checked={reduceMotion} onChange={setReduceMotion} label="Reduce motion (turns off most animations)" />
            <Toggle checked={prefs.showQuotes !== false} onChange={(v) => { setPrefs({ ...prefs, showQuotes: v }); saveSettings({ prefs: { ...prefs, showQuotes: v } }); }} label="Show the quote carousel on Today" />
          </div>
        </Card>
        <Card hover={false}>
          <CardTitle icon={Ruler} title="Units" sub="Data is stored in kg · cm · mg/dL and converted for display" />
          <div className="space-y-3">
            {[['Body weight', 'mass', [['kg', 'kg'], ['lb', 'lb']]], ['Length', 'length', [['cm', 'cm'], ['in', 'in']]], ['Glucose', 'glucose', [['mg/dL', 'mg/dL'], ['mmol/L', 'mmol/L']]], ['Cholesterol & triglycerides', 'lipids', [['mg/dL', 'mg/dL'], ['mmol/L', 'mmol/L']]]].map(([l, k, opts]) => (
              <div key={k} className="flex items-center justify-between gap-3"><span className="text-sm">{l}</span><Segmented size="sm" value={units[k]} onChange={(v) => setU({ [k]: v })} options={opts} /></div>
            ))}
          </div>
        </Card>
        <Card hover={false}>
          <CardTitle icon={User} title="Profile" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name"><Input value={p.name || ''} onChange={(e) => setP({ ...p, name: e.target.value })} /></Field>
            <Field label="Sex (for formulas)"><Select value={p.sex || 'male'} onChange={(e) => setP({ ...p, sex: e.target.value })} options={[['male', 'Male'], ['female', 'Female']]} /></Field>
            <Field label="Birth year"><Input type="number" value={p.birthYear || ''} onChange={(e) => setP({ ...p, birthYear: e.target.value })} /></Field>
            <Field label="Height"><UnitInput unit={u.label('length')} value={p.height} onChange={(e) => setP({ ...p, height: e.target.value })} /></Field>
            <Field label="Activity level" className="col-span-2"><Select value={p.activity || 'light'} onChange={(e) => setP({ ...p, activity: e.target.value })} options={Object.entries(ACTIVITY_LABEL)} /></Field>
            <Field label="Primary goal" className="col-span-2"><Select value={p.goal || 'longevity'} onChange={(e) => setP({ ...p, goal: e.target.value })} options={GOALS.map(([k, l]) => [k, l])} /></Field>
          </div>
          <div className="mt-3 flex justify-end"><Button onClick={saveProfile}>Save profile</Button></div>
        </Card>
        <Card hover={false}>
          <CardTitle icon={Target} title="Targets" sub={`Current: ${fmt(m.targets.kcal)} kcal · ${m.targets.protein} g protein · TDEE ${fmt(m.tdee)} (${m.tdeeSource})`} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Protein (g per kg)"><Input type="number" step="0.1" value={p.proteinPerKg ?? 1.6} onChange={(e) => setP({ ...p, proteinPerKg: Number(e.target.value) })} /></Field>
            <Field label="Step goal"><Input type="number" value={p.stepGoal ?? 8000} onChange={(e) => setP({ ...p, stepGoal: Number(e.target.value) })} /></Field>
            <Field label="Water goal"><UnitInput unit="mL" value={p.waterGoal ?? ''} placeholder={String(m.targets.water)} onChange={(e) => setP({ ...p, waterGoal: e.target.value ? Number(e.target.value) : undefined })} /></Field>
            <Field label="Sleep need"><UnitInput unit="h" value={p.sleepGoal ?? 7.5} onChange={(e) => setP({ ...p, sleepGoal: Number(e.target.value) })} /></Field>
            <Field label="Target bedtime"><Input type="time" value={p.bedtime || '23:00'} onChange={(e) => setP({ ...p, bedtime: e.target.value })} /></Field>
            <Field label="Target wake time"><Input type="time" value={p.wake || '07:00'} onChange={(e) => setP({ ...p, wake: e.target.value })} /></Field>
            <Field label="Manual calorie target" hint="Leave blank for automatic"><UnitInput unit="kcal" value={prefs.calorieTarget ?? ''} onChange={(e) => setPrefs({ ...prefs, calorieTarget: e.target.value ? Number(e.target.value) : undefined })} /></Field>
            <Field label="Manual TDEE override" hint="Leave blank to use adaptive"><UnitInput unit="kcal" value={prefs.tdeeOverride ?? ''} onChange={(e) => setPrefs({ ...prefs, tdeeOverride: e.target.value ? Number(e.target.value) : undefined })} /></Field>
          </div>
          <div className="mt-3 flex justify-end gap-2"><Button variant="soft" onClick={savePrefs}>Save overrides</Button><Button onClick={saveProfile}>Save targets</Button></div>
        </Card>
        <Card hover={false}>
          <CardTitle icon={Globe} title="Regional & data sources" />
          <div className="space-y-3">
            <Field label="Time zone"><Input value={prefs.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone} onChange={(e) => setPrefs({ ...prefs, timezone: e.target.value })} /></Field>
            <Toggle checked={prefs.asianCutoffs ?? true} onChange={(v) => setPrefs({ ...prefs, asianCutoffs: v })} label="Use South-Asian waist cut-offs (90 cm men / 80 cm women)" />
            <Field label="USDA FoodData Central API key" hint="Free from api.data.gov. DEMO_KEY works with low rate limits."><Input value={prefs.usdaKey || ''} placeholder="DEMO_KEY" onChange={(e) => setPrefs({ ...prefs, usdaKey: e.target.value })} /></Field>
            <Field label="Blood panel every (months)"><Input type="number" value={prefs.labIntervalMonths ?? 6} onChange={(e) => setPrefs({ ...prefs, labIntervalMonths: Number(e.target.value) })} /></Field>
            <div className="flex items-center justify-between"><Button size="sm" variant="ghost" onClick={async () => setFoodStats(await api.foodStats())}>Food database stats</Button><Button onClick={savePrefs}>Save</Button></div>
            {foodStats && <div className="flex flex-wrap gap-2 text-xs">{foodStats.map((s) => <span key={s.source} className="rounded-full bg-raised px-2 py-1">{s.source}: <b>{s.n}</b></span>)}</div>}
          </div>
        </Card>
        <Card hover={false}>
          <CardTitle icon={Shield} title="Safety" />
          <div className="space-y-3 text-sm">
            <Toggle checked={!!prefs.hideCalories} onChange={(v) => { setPrefs({ ...prefs, hideCalories: v }); saveSettings({ prefs: { ...prefs, hideCalories: v } }); }} label="Hide calorie numbers (focus on food quality and habits)" />
            <p className="text-xs text-muted">Calorie targets never go below {m.targets.floorKcal} kcal. Losing more than 1% of body weight per week triggers a warning. Lab and vital ranges are informational and not medical advice: anything flagged critical should be discussed with a clinician. If tracking ever feels stressful or obsessive, pause it.</p>
          </div>
        </Card>
        <Card hover={false} className="xl:col-span-2">
          <CardTitle icon={Database} title="Your data" sub="Everything lives in a local SQLite database you own" />
          <div className="flex flex-wrap gap-2">
            <Button variant="soft" icon={Download} onClick={exportAll}>Export everything (JSON)</Button>
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-raised px-4 text-sm font-medium hover:bg-line"><UploadCloud size={16} />Restore from export<input type="file" accept=".json" className="hidden" onChange={(e) => e.target.files[0] && importAll(e.target.files[0])} /></label>
            <Button variant="soft" icon={Sparkles} onClick={async () => { await api.demo(); await refresh(); notify('Demo data loaded (180 days)'); }}>Load demo data</Button>
            <Button variant="soft" icon={RotateCcw} onClick={async () => { await saveSettings({ onboarding: { ...settings.onboarding, completed: false } }); nav('/onboarding'); }}>Redo onboarding</Button>
            <Button variant="danger" onClick={() => setConfirmReset(true)}>Delete all data</Button>
          </div>
        </Card>
      </Stagger>
      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Delete all health data?" footer={<><Button variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button><Button variant="danger" onClick={async () => { await api.reset(false); setConfirmReset(false); await refresh(); nav('/onboarding'); }}>Delete everything</Button></>}>
        <p className="text-sm">This permanently removes every log, record, lab, photo reference and setting (the starter food database stays). Export first if you might want it back.</p>
      </Modal>
    </div>
  );
}
