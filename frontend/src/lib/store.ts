import { create } from 'zustand';
import { api, authStore, AuthState } from './api';
import type { Exercise, Settings, WSet } from './types';
import en from '../locales/en.json';
import desi from '../locales/desi.json';

const safeGet = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const safeSet = (k: string, v: unknown) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

export interface ActiveExercise {
  exerciseId: string;
  target: { sets?: number | null; reps?: number | null; weight?: number | null; restSec?: number | null; durationSec?: number | null; distanceM?: number | null };
  sets: WSet[];
}
export interface ActiveWorkout {
  startedAt: number;
  routineId?: string | null;
  name: string;
  type?: string;
  exercises: ActiveExercise[];
  current: number;
  restUntil?: number | null;
  restTotal?: number;
  warmupDone?: boolean;
  readiness?: Record<string, number>;
}

const defaultSettings: Settings = { languageMode: 'desi', tone: 'bhai', theme: 'dark', units: 'metric', aiEnabled: true };

interface State {
  auth: AuthState | null;
  settings: Settings;
  exercises: Exercise[];
  exMap: Record<string, Exercise>;
  active: ActiveWorkout | null;
  setAuth: (a: AuthState | null) => void;
  loadSettings: () => Promise<void>;
  updateSettings: (p: Partial<Settings>) => Promise<void>;
  loadExercises: (force?: boolean) => Promise<void>;
  setActive: (a: ActiveWorkout | null | ((p: ActiveWorkout) => ActiveWorkout)) => void;
}

export const useStore = create<State>((set, get) => ({
  auth: authStore.get(),
  settings: safeGet('deshi.settings', defaultSettings),
  exercises: safeGet<Exercise[]>('deshi.exercises', []),
  exMap: Object.fromEntries(safeGet<Exercise[]>('deshi.exercises', []).map((e) => [e.id, e])),
  active: safeGet<ActiveWorkout | null>('deshi.active', null),
  setAuth: (a) => { authStore.set(a); set({ auth: a }); if (!a) { safeSet('deshi.active', null); set({ active: null }); } },
  loadSettings: async () => {
    const s = await api<Settings>('/settings');
    safeSet('deshi.settings', s); set({ settings: s });
  },
  updateSettings: async (p) => {
    const next = { ...get().settings, ...p };
    set({ settings: next }); safeSet('deshi.settings', next);
    await api('/settings', { method: 'PUT', body: p });
  },
  loadExercises: async (force) => {
    if (!force && get().exercises.length) { api<Exercise[]>('/exercises').then((ex) => { safeSet('deshi.exercises', ex); set({ exercises: ex, exMap: Object.fromEntries(ex.map((e) => [e.id, e])) }); }).catch(() => {}); return; }
    const ex = await api<Exercise[]>('/exercises');
    safeSet('deshi.exercises', ex);
    set({ exercises: ex, exMap: Object.fromEntries(ex.map((e) => [e.id, e])) });
  },
  setActive: (a) => {
    const cur = get().active;
    const next = typeof a === 'function' ? (cur ? a(cur) : null) : a;
    safeSet('deshi.active', next); set({ active: next });
  },
}));

const dicts: Record<string, Record<string, string>> = { en, desi, hi: desi };
export function useT() {
  const lang = useStore((s) => s.settings.languageMode);
  return (key: keyof typeof en | string, vars?: Record<string, string | number>) => {
    let s = dicts[lang]?.[key] ?? (en as Record<string, string>)[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    return s;
  };
}

/* ---------- units ---------- */
export const KG_TO_LB = 2.20462;
export function useUnits() {
  const units = useStore((s) => s.settings.units);
  const imp = units === 'imperial';
  return {
    imp,
    wUnit: imp ? 'lb' : 'kg',
    show: (kg?: number | null) => (kg === null || kg === undefined ? '' : String(Math.round((imp ? kg * KG_TO_LB : kg) * 10) / 10)),
    toKg: (v: number) => (imp ? Math.round((v / KG_TO_LB) * 100) / 100 : v),
    step: imp ? 5 : 2.5,
  };
}

export const fmtTime = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
};
export const today = () => new Date().toISOString().slice(0, 10);
export const exName = (e?: Exercise, lang?: string) => (e ? (lang === 'desi' && e.nameDesi && e.nameDesi !== e.name ? `${e.name}` : e.name) : 'Exercise');
