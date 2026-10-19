import { createContext, useContext, useEffect, useState } from 'react';

// Reference categorical palette (validated light/dark steps) + status colors.
const SERIES = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
};
const SEQ = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];
export const STATUS = { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b', neutral: '#898781', info: '#2a78d6' };

const ThemeCtx = createContext(null);
const read = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => read('lifeos-theme', 'system'));
  const [reduceMotion, setReduceMotion] = useState(() => read('lifeos-reduce-motion', 'false') === 'true');
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const h = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  const dark = mode === 'dark' || (mode === 'system' && systemDark);
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); write('lifeos-theme', mode); }, [dark, mode]);
  useEffect(() => { document.documentElement.classList.toggle('reduce-motion', reduceMotion); write('lifeos-reduce-motion', String(reduceMotion)); }, [reduceMotion]);

  const c = {
    series: SERIES[dark ? 'dark' : 'light'], seq: SEQ, status: STATUS,
    fg: dark ? '#f0efec' : '#0b0b0b', fg2: dark ? '#c3c2b7' : '#52514e', muted: '#898781',
    grid: dark ? '#2c2c2a' : '#e1e0d9', axis: dark ? '#383835' : '#c3c2b7', card: dark ? '#1a1a19' : '#fcfcfb', raised: dark ? '#242422' : '#f0efec',
    neutral: dark ? '#383835' : '#e1e0d9',
  };
  return <ThemeCtx.Provider value={{ mode, setMode, dark, toggle: () => setMode(dark ? 'light' : 'dark'), reduceMotion, setReduceMotion, c }}>{children}</ThemeCtx.Provider>;
}
export const useTheme = () => useContext(ThemeCtx);
