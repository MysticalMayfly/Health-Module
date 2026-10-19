import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { buildModel } from './analytics.js';
import { DEFAULT_UNITS, fromCanonical, toCanonical, unitLabel, dimDecimals } from '@shared/units.js';
import { addDays, todayISO, fmt } from './format.js';

const DataCtx = createContext(null);

export function DataProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [s, b] = await Promise.all([api.settings(), api.bundle(addDays(todayISO(), -800))]);
      setSettings(s); setBundle(b); setError(null);
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const saveSettings = useCallback(async (patch) => {
    await api.saveSettings(patch);
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const model = useMemo(() => (settings && bundle ? buildModel(bundle, settings) : null), [settings, bundle]);
  const units = { ...DEFAULT_UNITS, ...(settings?.units || {}) };

  const notify = useCallback((msg, kind = 'good') => { setToast({ msg, kind, id: Date.now() }); setTimeout(() => setToast(null), 2600); }, []);

  const value = {
    settings, bundle, model, error, refresh, saveSettings, units, toast, notify,
    // unit helpers bound to the user's settings
    u: {
      label: (dim, fb) => unitLabel(dim, fb, units),
      from: (v, dim) => fromCanonical(v, dim, units),
      to: (v, dim) => toCanonical(v, dim, units),
      dec: (dim, base) => dimDecimals(dim, base, units),
      show: (v, dim, dec = 0, withUnit = true, fb = '') => (v == null ? '—' : `${fmt(fromCanonical(v, dim, units), dimDecimals(dim, dec, units))}${withUnit ? ` ${unitLabel(dim, fb, units)}` : ''}`),
    },
  };
  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}

export const useData = () => useContext(DataCtx);
