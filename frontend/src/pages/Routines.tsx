import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useStore, useT, useUnits, exName } from '../lib/store';
import { Empty, ExercisePicker, Icon, PageHeader, Skeleton } from '../components/ui';
import type { Routine, RoutineExercise } from '../lib/types';

const TYPES = ['strength', 'bodybuilding', 'emom', 'amrap', 'tabata', 'hiit', 'sprint', 'boxing', 'circuit', 'pyramid', 'ladder', 'freeform'];
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function Routines() {
  const t = useT();
  const nav = useNavigate();
  const [list, setList] = useState<Routine[] | null>(null);
  const load = () => api<Routine[]>('/routines').then(setList).catch(() => setList([]));
  useEffect(() => { load(); }, []);
  const dup = async (id: string) => { await api(`/routines/${id}/duplicate`, { method: 'POST' }); load(); };
  return (
    <div className="space-y-3">
      <PageHeader title={t('routines')} back right={<button className="chip" onClick={() => nav('/routines/new')}>+ {t('new_routine')}</button>} />
      {!list && <Skeleton />}
      {list?.length === 0 && <Empty>{t('no_data')}</Empty>}
      {list?.map((r) => (
        <div key={r.id} className="card">
          <button className="w-full text-left" onClick={() => nav(`/routines/${r.id}`)}>
            <div className="text-xl font-extrabold">{r.name}</div>
            <div className="text-[15px] capitalize text-muted">{r.type} · {r.blocks.map((b) => `${b.name} (${b.exercises.length})`).join(' → ')}</div>
          </button>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex gap-1">{DAYS.map((d, i) => <span key={i} className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${r.days.includes(i) ? 'bg-accent text-on-accent' : 'bg-elevated text-muted'}`}>{d}</span>)}</div>
            <button className="chip" onClick={() => dup(r.id)}>{t('duplicate')}</button>
          </div>
        </div>
      ))}
    </div>
  );
}

type Draft = Omit<Routine, 'id'> & { id?: string };
const blank: Draft = { name: '', type: 'strength', days: [], blocks: [{ name: 'Warmup', exercises: [] }, { name: 'Main', exercises: [] }, { name: 'Cooldown', exercises: [] }] };

export function RoutineEditor() {
  const t = useT();
  const u = useUnits();
  const nav = useNavigate();
  const { id } = useParams();
  const { exMap, settings } = useStore();
  const [r, setR] = useState<Draft | null>(id === 'new' ? blank : null);
  const [pickFor, setPickFor] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (id && id !== 'new') api<Routine>(`/routines/${id}`).then(setR).catch(() => nav('/routines')); }, [id, nav]);
  if (!r) return <Skeleton h={300} />;

  const upd = (bi: number, ei: number, p: Partial<RoutineExercise>) => setR({ ...r, blocks: r.blocks.map((b, i) => (i !== bi ? b : { ...b, exercises: b.exercises.map((e, j) => (j === ei ? { ...e, ...p } : e)) })) });
  const rm = (bi: number, ei: number) => setR({ ...r, blocks: r.blocks.map((b, i) => (i !== bi ? b : { ...b, exercises: b.exercises.filter((_, j) => j !== ei) })) });
  const move = (bi: number, ei: number, d: number) => setR({ ...r, blocks: r.blocks.map((b, i) => {
    if (i !== bi) return b; const ex = [...b.exercises]; const j = ei + d; if (j < 0 || j >= ex.length) return b; [ex[ei], ex[j]] = [ex[j], ex[ei]]; return { ...b, exercises: ex };
  }) });
  const save = async () => {
    if (!r.name.trim()) return alert(t('routine_name'));
    setSaving(true);
    const body = { name: r.name, type: r.type, focus: r.focus, notes: r.notes, days: r.days, blocks: r.blocks.map((b) => ({ name: b.name, exercises: b.exercises.map(({ id: _id, ...e }) => e) })) };
    try { await api(id === 'new' ? '/routines' : `/routines/${id}`, { method: id === 'new' ? 'POST' : 'PUT', body }); nav(-1); } finally { setSaving(false); }
  };
  const del = async () => { if (confirm(`${t('delete')}?`)) { await api(`/routines/${id}`, { method: 'DELETE' }); nav('/routines'); } };
  const numIn = (v: number | null | undefined, on: (n: number | null) => void, lbl: string, unit?: string) => (
    <label className="block"><span className="block text-[13px] font-semibold text-muted">{lbl}{unit ? ` (${unit})` : ''}</span>
      <input inputMode="decimal" className="input !min-h-[48px] !px-2 text-center" value={v ?? ''} onChange={(e) => on(e.target.value === '' ? null : Number(e.target.value))} /></label>
  );

  return (
    <div className="space-y-5">
      <PageHeader title={id === 'new' ? t('new_routine') : t('edit')} back right={id !== 'new' ? <button aria-label={t('delete')} className="flex h-12 w-12 items-center justify-center text-danger" onClick={del}>{Icon.trash}</button> : undefined} />
      <div className="card space-y-4">
        <div><label className="label" htmlFor="rn">{t('routine_name')}</label><input id="rn" className="input" value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} placeholder="Push Day" /></div>
        <div><div className="label">Type</div><div className="flex flex-wrap gap-2">{TYPES.map((x) => <button key={x} onClick={() => setR({ ...r, type: x })} className={`chip capitalize ${r.type === x ? 'chip-on' : ''}`}>{x}</button>)}</div></div>
        <div><div className="label">{t('schedule')}</div><div className="flex gap-2">{DAYS.map((d, i) => (
          <button key={i} aria-pressed={r.days.includes(i)} aria-label={['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]} onClick={() => setR({ ...r, days: r.days.includes(i) ? r.days.filter((x) => x !== i) : [...r.days, i] })}
            className={`flex h-12 flex-1 items-center justify-center rounded-xl font-bold ${r.days.includes(i) ? 'bg-accent text-on-accent' : 'bg-elevated text-muted'}`}>{d}</button>
        ))}</div></div>
      </div>

      {r.blocks.map((b, bi) => (
        <section key={bi} className="space-y-2">
          <div className="flex items-center gap-2">
            <input aria-label="Block name" className="input !min-h-[44px] flex-1 !text-xl font-bold" value={b.name} onChange={(e) => setR({ ...r, blocks: r.blocks.map((x, i) => (i === bi ? { ...x, name: e.target.value } : x)) })} />
            <button aria-label="Remove block" className="flex h-12 w-12 items-center justify-center text-muted" onClick={() => setR({ ...r, blocks: r.blocks.filter((_, i) => i !== bi) })}>{Icon.trash}</button>
          </div>
          {b.exercises.map((e, ei) => {
            const ex = exMap[e.exerciseId];
            const tr = ex?.tracking || 'weight_reps';
            return (
              <div key={ei} className="card !p-4">
                <div className="mb-2 flex items-center gap-1">
                  <span className="flex-1 text-lg font-bold">{exName(ex, settings.languageMode)}</span>
                  <button aria-label="Move up" className="h-10 w-10 text-muted" onClick={() => move(bi, ei, -1)}>↑</button>
                  <button aria-label="Move down" className="h-10 w-10 text-muted" onClick={() => move(bi, ei, 1)}>↓</button>
                  <button aria-label="Remove" className="flex h-10 w-10 items-center justify-center text-muted" onClick={() => rm(bi, ei)}>{Icon.close}</button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {numIn(e.sets, (n) => upd(bi, ei, { sets: n }), 'Sets')}
                  {(tr === 'weight_reps' || tr === 'reps') && numIn(e.reps, (n) => upd(bi, ei, { reps: n }), t('reps'))}
                  {tr === 'weight_reps' && numIn(e.weight != null ? Number(u.show(e.weight)) : null, (n) => upd(bi, ei, { weight: n == null ? null : u.toKg(n) }), t('weight'), u.wUnit)}
                  {tr === 'distance_time' && numIn(e.distanceM, (n) => upd(bi, ei, { distanceM: n }), 'Dist', 'm')}
                  {(tr === 'time' || tr === 'distance_time') && numIn(e.durationSec, (n) => upd(bi, ei, { durationSec: n }), 'Time', 's')}
                  {numIn(e.restSec, (n) => upd(bi, ei, { restSec: n }), t('rest'), 's')}
                </div>
              </div>
            );
          })}
          <button className="btn-secondary w-full" onClick={() => setPickFor(bi)}>{Icon.plus}{t('add_exercise')}</button>
        </section>
      ))}
      <button className="btn-ghost w-full text-muted" onClick={() => setR({ ...r, blocks: [...r.blocks, { name: 'Block', exercises: [] }] })}>+ {t('add_block')}</button>
      <button disabled={saving} className="btn-primary btn-xl w-full" onClick={save}>{t('save')}</button>
      <ExercisePicker open={pickFor !== null} onClose={() => setPickFor(null)} onPick={(e) => pickFor !== null && setR({ ...r, blocks: r.blocks.map((b, i) => (i === pickFor ? { ...b, exercises: [...b.exercises, { exerciseId: e.id, sets: b.name.toLowerCase().includes('warm') || b.name.toLowerCase().includes('cool') ? 1 : 3, reps: e.tracking === 'weight_reps' ? 8 : e.tracking === 'reps' ? 10 : null, restSec: 90, durationSec: e.tracking === 'time' ? 60 : null }] } : b)) })} />
    </div>
  );
}
