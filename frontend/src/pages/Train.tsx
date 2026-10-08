import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { ActiveExercise, ActiveWorkout, useStore, useT } from '../lib/store';
import { ListLink, PageHeader, Skeleton } from '../components/ui';
import type { Routine, Session, WSet } from '../lib/types';
import { unlockAudio } from '../lib/feedback';

async function lastFor(exerciseId: string) {
  try { return await api<{ sets: WSet[] } | null>(`/workouts/exercise/${exerciseId}/last`); } catch { return null; }
}

export async function workoutFromRoutine(r: Routine): Promise<ActiveWorkout> {
  const flat = r.blocks.flatMap((b) => b.exercises);
  const exercises: ActiveExercise[] = await Promise.all(flat.map(async (e) => {
    const last = e.weight ? null : await lastFor(e.exerciseId);
    const lastTop = last?.sets.filter((s) => !s.isWarmup).reduce<WSet | null>((a, s) => (!a || (s.weight ?? 0) > (a.weight ?? 0) ? s : a), null);
    return { exerciseId: e.exerciseId, sets: [], target: { sets: e.sets, reps: e.reps ?? lastTop?.reps, weight: e.weight ?? lastTop?.weight, restSec: e.restSec, durationSec: e.durationSec, distanceM: e.distanceM } };
  }));
  return { startedAt: Date.now(), routineId: r.id, name: r.name, type: r.type, exercises, current: 0 };
}

export function workoutFromSession(s: Session): ActiveWorkout {
  const order: string[] = [];
  for (const x of s.sets) if (!order.includes(x.exerciseId)) order.push(x.exerciseId);
  return {
    startedAt: Date.now(), routineId: s.routineId, name: s.name || 'Workout', type: s.type || undefined, current: 0,
    exercises: order.map((id) => {
      const sets = s.sets.filter((x) => x.exerciseId === id && !x.isWarmup);
      const top = sets.reduce<WSet | null>((a, x) => (!a || (x.weight ?? 0) > (a.weight ?? 0) ? x : a), null);
      return { exerciseId: id, sets: [], target: { sets: sets.length, reps: top?.reps, weight: top?.weight, durationSec: top?.durationSec, distanceM: top?.distanceM, restSec: top?.restSec } };
    }),
  };
}

export default function Train() {
  const t = useT();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { start?: string } };
  const { active, setActive } = useStore();
  const [routines, setRoutines] = useState<Routine[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api<Routine[]>('/routines').then(setRoutines).catch(() => setRoutines([])); }, []);

  const begin = async (w: Promise<ActiveWorkout> | ActiveWorkout) => {
    if (active && !confirm(t('confirm_discard'))) return;
    unlockAudio(); setBusy(true);
    try { setActive(await w); nav('/workout'); } finally { setBusy(false); }
  };
  useEffect(() => {
    const id = loc.state?.start;
    if (id && routines) { const r = routines.find((x) => x.id === id); if (r) begin(workoutFromRoutine(r)); }
  }, [routines]); // eslint-disable-line

  const copyLast = async () => {
    const s = await api<Session | null>('/workouts/last');
    if (s) begin(workoutFromSession(s));
  };
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6">
      <PageHeader title={t('nav_train')} />
      {active && <button onClick={() => nav('/workout')} className="btn-primary btn-xl w-full">● {active.name} — {t('resume')}</button>}
      <div className="grid grid-cols-2 gap-3">
        <button disabled={busy} className="btn-secondary" onClick={() => begin({ startedAt: Date.now(), name: 'Workout', exercises: [], current: 0 })}>{t('empty_session')}</button>
        <button disabled={busy} className="btn-secondary" onClick={copyLast}>Copy last</button>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="h2">{t('pick_routine')}</h2>
          <button className="chip" onClick={() => nav('/routines/new')}>+ {t('new_routine')}</button>
        </div>
        {!routines && <Skeleton h={80} />}
        {routines?.length === 0 && <div className="card text-lg text-muted">{t('no_data')}</div>}
        <div className="space-y-3">
          {routines?.map((r) => (
            <div key={r.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-2xl font-extrabold">{r.name}</div>
                  <div className="text-[16px] capitalize text-muted">{r.type} · {r.blocks.reduce((a, b) => a + b.exercises.length, 0)} exercises{r.days.length ? ` · ${r.days.map((d) => days[d]).join(', ')}` : ''}</div>
                </div>
                <button className="chip shrink-0" onClick={() => nav(`/routines/${r.id}`)}>{t('edit')}</button>
              </div>
              <button disabled={busy} onClick={() => begin(workoutFromRoutine(r))} className="btn-primary mt-4 w-full">{t('start')}</button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <ListLink to="/warmups" title={t('warmups')} sub={t('ramp_up')} />
        <ListLink to="/exercises" title={t('exercises')} />
        <ListLink to="/routines" title={t('routines')} />
      </section>
    </div>
  );
}
