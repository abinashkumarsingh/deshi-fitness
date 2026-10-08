import { ReactNode, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useStore, useT, exName } from '../lib/store';
import type { Exercise } from '../lib/types';

/* ---------- Icons (inline, stroke-based) ---------- */
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.25, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
export const Icon = {
  home: <svg viewBox="0 0 24 24" width="26" height="26" {...P}><path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" /></svg>,
  dumbbell: <svg viewBox="0 0 24 24" width="26" height="26" {...P}><path d="M6 7v10M18 7v10M3 9v6M21 9v6M6 12h12" /></svg>,
  timer: <svg viewBox="0 0 24 24" width="26" height="26" {...P}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M9 2h6" /></svg>,
  chart: <svg viewBox="0 0 24 24" width="26" height="26" {...P}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>,
  more: <svg viewBox="0 0 24 24" width="26" height="26" {...P}><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>,
  back: <svg viewBox="0 0 24 24" width="26" height="26" {...P}><path d="M15 18l-6-6 6-6" /></svg>,
  close: <svg viewBox="0 0 24 24" width="26" height="26" {...P}><path d="M6 6l12 12M18 6L6 18" /></svg>,
  plus: <svg viewBox="0 0 24 24" width="26" height="26" {...P}><path d="M12 5v14M5 12h14" /></svg>,
  minus: <svg viewBox="0 0 24 24" width="26" height="26" {...P}><path d="M5 12h14" /></svg>,
  check: <svg viewBox="0 0 24 24" width="26" height="26" {...P}><path d="M5 13l4 4L19 7" /></svg>,
  trash: <svg viewBox="0 0 24 24" width="22" height="22" {...P}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>,
  fire: <svg viewBox="0 0 24 24" width="22" height="22" {...P}><path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-4 5-4 7-1-1-2-2-2-4-2 2-3 5-3 9 0 4 3 7 7 7z" /></svg>,
  sparkle: <svg viewBox="0 0 24 24" width="22" height="22" {...P}><path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" /></svg>,
  chevron: <svg viewBox="0 0 24 24" width="22" height="22" {...P}><path d="M9 6l6 6-6 6" /></svg>,
};

/* ---------- Layout ---------- */
export function Layout() {
  const t = useT();
  const active = useStore((s) => s.active);
  const nav = useNavigate();
  const tabs = [
    { to: '/', label: t('nav_home'), icon: Icon.home, end: true },
    { to: '/train', label: t('nav_train'), icon: Icon.dumbbell },
    { to: '/timer', label: t('nav_timer'), icon: Icon.timer },
    { to: '/progress', label: t('nav_progress'), icon: Icon.chart },
    { to: '/more', label: t('nav_more'), icon: Icon.more },
  ];
  return (
    <div className="min-h-full">
      <main className="mx-auto max-w-xl px-4 pt-[max(16px,env(safe-area-inset-top))] pb-safe sm:px-6">
        <Outlet />
      </main>
      {active && (
        <button onClick={() => nav('/workout')} className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-20 mx-auto flex max-w-xl items-center justify-between rounded-2xl bg-accent px-5 py-3 text-on-accent font-bold shadow-lg">
          <span>● {active.name}</span><span>{t('resume')} →</span>
        </button>
      )}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-xl grid-cols-5">
          {tabs.map((tb) => (
            <NavLink key={tb.to} to={tb.to} end={tb.end}
              className={({ isActive }) => `flex min-h-[68px] flex-col items-center justify-center gap-1 text-[13px] font-semibold ${isActive ? 'text-accent' : 'text-muted'}`}>
              <span aria-hidden>{tb.icon}</span>{tb.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function PageHeader({ title, back, right }: { title: string; back?: boolean; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="mb-5 flex min-h-[56px] items-center gap-2">
      {back && <button aria-label="Back" onClick={() => nav(-1)} className="-ml-2 flex h-12 w-12 items-center justify-center rounded-xl text-fg">{Icon.back}</button>}
      <h1 className="h1 flex-1 truncate">{title}</h1>
      {right}
    </header>
  );
}

/* ---------- Bottom sheet ---------- */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        <div className="mb-4 flex items-center">
          <h2 className="h2 flex-1">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="flex h-12 w-12 items-center justify-center rounded-xl">{Icon.close}</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Big stepper (glanceable number input) ---------- */
export function Stepper({ value, onChange, step = 1, min = 0, label, unit, big }: { value: number; onChange: (v: number) => void; step?: number; min?: number; label?: string; unit?: string; big?: boolean }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const set = (v: number) => onChange(Math.max(min, Math.round(v * 100) / 100));
  return (
    <div>
      {label && <div className="label text-center">{label}</div>}
      <div className="flex items-center gap-2">
        <button aria-label={`Decrease ${label || ''}`} onClick={() => set(value - step)} className="btn-secondary h-16 w-16 shrink-0 !px-0">{Icon.minus}</button>
        <div className="flex min-w-0 flex-1 items-baseline justify-center gap-1">
          <input inputMode="decimal" aria-label={label} value={text}
            onChange={(e) => { setText(e.target.value); const n = parseFloat(e.target.value); if (!isNaN(n)) onChange(n); }}
            onBlur={() => setText(String(value))}
            className={`num w-full min-w-0 bg-transparent text-center outline-none ${big ? "text-[64px]" : "text-[44px]"}`} />
          {unit && <span className="text-xl font-semibold text-muted">{unit}</span>}
        </div>
        <button aria-label={`Increase ${label || ''}`} onClick={() => set(value + step)} className="btn-secondary h-16 w-16 shrink-0 !px-0">{Icon.plus}</button>
      </div>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)} className={`chip ${value === o.value ? 'chip-on' : ''}`}>{o.label}</button>
      ))}
    </div>
  );
}

export function Stat({ label, value, unit, accent }: { label: string; value: ReactNode; unit?: string; accent?: boolean }) {
  return (
    <div className="card !p-4">
      <div className="text-[14px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={`num mt-1 text-[40px] leading-none ${accent ? 'text-accent' : ''}`}>{value}{unit && <span className="ml-1 text-lg font-semibold text-muted">{unit}</span>}</div>
    </div>
  );
}

export const Skeleton = ({ h = 80 }: { h?: number }) => <div className="skeleton w-full" style={{ height: h }} />;
export const Empty = ({ children }: { children: ReactNode }) => <div className="card text-center text-lg text-muted">{children}</div>;

/* ---------- Exercise picker ---------- */
export function ExercisePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (e: Exercise) => void }) {
  const t = useT();
  const { exercises, settings } = useStore();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const cats = useMemo(() => ['all', ...Array.from(new Set(exercises.map((e) => e.category)))], [exercises]);
  const list = exercises.filter((e) => (cat === 'all' || e.category === cat) && (!q || `${e.name} ${e.nameDesi || ''} ${e.muscleGroup}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <Sheet open={open} onClose={onClose} title={t('add_exercise')}>
      <input autoFocus className="input mb-3" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
        {cats.map((c) => <button key={c} onClick={() => setCat(c)} className={`chip shrink-0 capitalize ${cat === c ? 'chip-on' : ''}`}>{c === 'all' ? t('all') : c}</button>)}
      </div>
      <ul className="divide-y divide-line">
        {list.map((e) => (
          <li key={e.id}>
            <button onClick={() => { onPick(e); onClose(); setQ(''); }} className="flex min-h-[60px] w-full items-center justify-between py-2 text-left">
              <span><span className="block text-lg font-semibold">{exName(e, settings.languageMode)}</span><span className="text-[15px] capitalize text-muted">{e.muscleGroup} · {e.equipment}</span></span>
              <span className="text-accent">{Icon.plus}</span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

export function ListLink({ to, title, sub, onClick }: { to?: string; title: string; sub?: string; onClick?: () => void }) {
  const nav = useNavigate();
  return (
    <button onClick={() => (onClick ? onClick() : to && nav(to))} className="card flex w-full items-center justify-between !py-4 text-left">
      <span><span className="block text-lg font-bold">{title}</span>{sub && <span className="text-[15px] text-muted">{sub}</span>}</span>
      <span className="text-muted">{Icon.chevron}</span>
    </button>
  );
}
