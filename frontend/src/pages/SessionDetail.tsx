import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { fmtTime, useStore, useT, useUnits } from '../lib/store';
import { Icon, PageHeader, Skeleton } from '../components/ui';
import { workoutFromSession } from './Train';
import type { Session, WSet } from '../lib/types';

export default function SessionDetail() {
  const t = useT();
  const u = useUnits();
  const nav = useNavigate();
  const { id } = useParams();
  const { exMap, setActive, active } = useStore();
  const [s, setS] = useState<Session | null>(null);
  const [editing, setEditing] = useState(false);
  const [sets, setSets] = useState<WSet[]>([]);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  useEffect(() => { api<Session>(`/workouts/${id}`).then((x) => { setS(x); setSets(x.sets); setName(x.name || ''); setNotes(x.notes || ''); }).catch(() => nav(-1)); }, [id, nav]);
  if (!s) return <Skeleton h={300} />;

  const groups: [string, WSet[]][] = [];
  for (const x of (editing ? sets : s.sets)) { const g = groups.find((y) => y[0] === x.exerciseId); g ? g[1].push(x) : groups.push([x.exerciseId, [x]]); }

  const save = async () => {
    const res = await api<Session>(`/workouts/${id}`, { method: 'PUT', body: { name, notes, sets: sets.map(({ id: _i, ...x }) => { const { sessionId: _s, ...rest } = x as WSet & { sessionId?: string }; return rest; }) } });
    setS(res); setEditing(false);
  };
  const del = async () => { if (confirm(`${t('delete')}?`)) { await api(`/workouts/${id}`, { method: 'DELETE' }); nav(-1); } };
  const repeat = () => { if (active && !confirm(t('confirm_discard'))) return; setActive(workoutFromSession(s)); nav('/workout'); };
  const upd = (idx: number, p: Partial<WSet>) => setSets(sets.map((x, i) => (i === idx ? { ...x, ...p } : x)));

  return (
    <div className="space-y-4">
      <PageHeader title={s.name || 'Workout'} back right={<button aria-label={t('delete')} className="flex h-12 w-12 items-center justify-center text-danger" onClick={del}>{Icon.trash}</button>} />
      <p className="text-lg text-muted">{new Date(s.date).toLocaleString()}{s.duration ? ` · ${s.duration} min` : ''}{s.sessionRpe ? ` · RPE ${s.sessionRpe}` : ''}</p>
      {editing && <div className="space-y-3"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /><textarea className="input py-3" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('notes')} /></div>}
      {!editing && s.notes && <p className="card">{s.notes}</p>}
      {groups.map(([exId, list]) => (
        <div key={exId} className="card">
          <div className="mb-2 text-xl font-bold">{exMap[exId]?.name || 'Exercise'}</div>
          <ul className="space-y-1">
            {list.map((x) => {
              const idx = sets.indexOf(x);
              return (
                <li key={idx} className="flex items-center gap-2">
                  <span className="w-10 font-bold text-muted">#{x.setNumber}</span>
                  {editing ? <>
                    {x.weight != null && <input aria-label="weight" inputMode="decimal" className="input !min-h-[44px] w-24 text-center" value={u.show(x.weight)} onChange={(e) => upd(idx, { weight: u.toKg(Number(e.target.value) || 0) })} />}
                    {x.reps != null && <input aria-label="reps" inputMode="numeric" className="input !min-h-[44px] w-20 text-center" value={x.reps} onChange={(e) => upd(idx, { reps: Number(e.target.value) || 0 })} />}
                    {x.durationSec != null && <input aria-label="seconds" inputMode="numeric" className="input !min-h-[44px] w-24 text-center" value={x.durationSec} onChange={(e) => upd(idx, { durationSec: Number(e.target.value) || 0 })} />}
                    <button aria-label="Delete set" className="ml-auto flex h-11 w-11 items-center justify-center text-muted" onClick={() => setSets(sets.filter((_, i) => i !== idx))}>{Icon.close}</button>
                  </> : (
                    <span className="num text-2xl">{x.weight ? `${u.show(x.weight)}${u.wUnit} × ` : ''}{x.reps ?? ''}{x.distanceM ? `${x.distanceM}m ` : ''}{x.durationSec ? fmtTime(x.durationSec) : ''}{x.rpe ? <span className="ml-2 text-base text-muted">@{x.rpe}</span> : null}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {editing ? (
        <div className="grid grid-cols-2 gap-3"><button className="btn-secondary" onClick={() => { setEditing(false); setSets(s.sets); }}>{t('cancel')}</button><button className="btn-primary" onClick={save}>{t('save')}</button></div>
      ) : (
        <div className="grid grid-cols-2 gap-3"><button className="btn-secondary" onClick={() => setEditing(true)}>{t('edit')}</button><button className="btn-primary" onClick={repeat}>{t('copy_last')}</button></div>
      )}
    </div>
  );
}
