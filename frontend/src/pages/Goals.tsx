import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useT, useUnits } from '../lib/store';
import { Icon, PageHeader, Sheet } from '../components/ui';
import type { Goal } from '../lib/types';

export const GOAL_TYPES: { value: string; label: string; weeks?: number; event?: boolean }[] = [
  { value: 'fat_loss', label: 'Fat Loss', weeks: 12 }, { value: 'lean_bulk', label: 'Lean Bulk', weeks: 16 },
  { value: 'bodybuilding', label: 'Bodybuilding' }, { value: 'hypertrophy', label: 'Hypertrophy' }, { value: 'strength', label: 'Strength', weeks: 12 },
  { value: 'athletic', label: 'Athletic Performance' }, { value: 'boxing', label: 'Boxing', event: true }, { value: 'sprint', label: 'Sprint', event: true },
  { value: 'endurance', label: 'Endurance', event: true }, { value: 'general_health', label: 'General Health' }, { value: 'recomposition', label: 'Recomposition', weeks: 20 },
  { value: 'maintenance', label: 'Maintenance' }, { value: 'rehab', label: 'Rehab' }, { value: 'peaking', label: 'Peaking', weeks: 6, event: true },
];
const label = (v: string) => GOAL_TYPES.find((g) => g.value === v)?.label || v;

export default function Goals() {
  const t = useT();
  const u = useUnits();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [edit, setEdit] = useState<'primary' | 'secondary' | null>(null);
  const [type, setType] = useState('fat_loss');
  const [target, setTarget] = useState('');
  const [event, setEvent] = useState('');
  const [tw, setTw] = useState('');
  const load = () => api<Goal[]>('/goals').then(setGoals).catch(() => {});
  useEffect(() => { load(); }, []);

  const active = (p: 'primary' | 'secondary') => goals.find((g) => g.active && g.priority === p);
  const open = (p: 'primary' | 'secondary') => {
    const g = active(p);
    setType(g?.type || 'fat_loss'); setTarget(g?.targetDate?.slice(0, 10) || ''); setEvent(g?.eventDate?.slice(0, 10) || ''); setTw(g?.targetWeight ? u.show(g.targetWeight) : ''); setEdit(p);
  };
  const save = async () => {
    await api('/goals', { body: { type, priority: edit, targetDate: target || null, eventDate: event || null, targetWeight: tw ? u.toKg(Number(tw)) : null } });
    setEdit(null); load();
  };
  const end = async (g: Goal) => { await api(`/goals/${g.id}`, { method: 'PUT', body: { active: false } }); load(); };

  const card = (p: 'primary' | 'secondary') => {
    const g = active(p);
    const week = g ? Math.floor((Date.now() - new Date(g.startDate).getTime()) / (7 * 86400000)) + 1 : 0;
    const totalW = g?.targetDate ? Math.ceil((new Date(g.targetDate).getTime() - new Date(g.startDate).getTime()) / (7 * 86400000)) : null;
    const evDays = g?.eventDate ? Math.ceil((new Date(g.eventDate).getTime() - Date.now()) / 86400000) : null;
    return (
      <div className="card">
        <div className="text-[14px] font-semibold uppercase text-muted">{p === 'primary' ? t('primary_goal') : t('secondary_goal')}</div>
        {g ? <>
          <div className="display mt-1 text-[24px] grad-text">{label(g.type)}</div>
          <div className="text-lg font-semibold">Week {week}{totalW ? ` of ${totalW}` : ''}{evDays !== null ? ` · ${evDays} days to event` : ''}</div>
          {g.targetWeight && <div className="text-muted">{t('target_weight')}: {u.show(g.targetWeight)} {u.wUnit}</div>}
          {totalW && <div className="mt-3 h-3 overflow-hidden rounded-full bg-elevated"><div className="h-full bg-grad" style={{ width: `${Math.min(100, (week / totalW) * 100)}%` }} /></div>}
          <div className="mt-4 grid grid-cols-2 gap-2"><button className="btn-secondary" onClick={() => open(p)}>{t('edit')}</button><button className="btn-ghost text-muted" onClick={() => end(g)}>End</button></div>
        </> : <button className="btn-primary mt-3 w-full" onClick={() => open(p)}>{Icon.plus}{t('set_goal')}</button>}
      </div>
    );
  };
  const meta = GOAL_TYPES.find((g) => g.value === type);

  return (
    <div className="space-y-4">
      <PageHeader title={t('goals')} back />
      {card('primary')}
      {card('secondary')}
      <p className="text-[15px] text-muted">Primary goal drives suggestions. Secondary is considered when it doesn't conflict.</p>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit === 'primary' ? t('primary_goal') : t('secondary_goal')}>
        <div className="mb-4 flex flex-wrap gap-2">{GOAL_TYPES.map((g) => <button key={g.value} onClick={() => setType(g.value)} className={`chip ${type === g.value ? 'chip-on' : ''}`}>{g.label}</button>)}</div>
        <div className="space-y-3">
          <div><label className="label" htmlFor="td">{t('target_date')}{meta?.weeks ? ` (typ. ${meta.weeks} weeks)` : ''}</label><input id="td" type="date" className="input" value={target} onChange={(e) => setTarget(e.target.value)} /></div>
          {meta?.event && <div><label className="label" htmlFor="ed">{t('event_date')}</label><input id="ed" type="date" className="input" value={event} onChange={(e) => setEvent(e.target.value)} /></div>}
          <div><label className="label" htmlFor="tw">{t('target_weight')} ({u.wUnit})</label><input id="tw" inputMode="decimal" className="input" value={tw} onChange={(e) => setTw(e.target.value)} /></div>
          <button className="btn-primary btn-xl w-full" onClick={save}>{t('save')}</button>
        </div>
      </Sheet>
    </div>
  );
}
