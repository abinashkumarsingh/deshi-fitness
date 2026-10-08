import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useStore, useT } from '../lib/store';
import { Icon, PageHeader, Sheet } from '../components/ui';
import type { Exercise, Tracking } from '../lib/types';

const TRACK: { value: Tracking; label: string }[] = [{ value: 'weight_reps', label: 'Weight × reps' }, { value: 'reps', label: 'Reps only' }, { value: 'time', label: 'Time' }, { value: 'distance_time', label: 'Distance + time' }];

export default function Exercises() {
  const t = useT();
  const { exercises, loadExercises } = useStore();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [edit, setEdit] = useState<Partial<Exercise> | null>(null);
  const cats = useMemo(() => ['all', 'custom', ...Array.from(new Set(exercises.map((e) => e.category)))], [exercises]);
  const list = exercises.filter((e) => (cat === 'all' || (cat === 'custom' ? e.isCustom : e.category === cat)) && (!q || `${e.name} ${e.muscleGroup}`.toLowerCase().includes(q.toLowerCase())));

  const save = async () => {
    if (!edit?.name) return;
    const body = { name: edit.name, category: edit.category || 'custom', muscleGroup: edit.muscleGroup || null, equipment: edit.equipment || null, type: edit.type || null, tracking: edit.tracking || 'weight_reps', videoUrl: edit.videoUrl || null };
    await api(edit.id ? `/exercises/${edit.id}` : '/exercises', { method: edit.id ? 'PUT' : 'POST', body });
    setEdit(null); loadExercises(true);
  };
  const del = async () => { if (edit?.id && confirm(`${t('delete')}?`)) { await api(`/exercises/${edit.id}`, { method: 'DELETE' }); setEdit(null); loadExercises(true); } };

  return (
    <div className="space-y-4">
      <PageHeader title={t('exercises')} back right={<button className="chip" onClick={() => setEdit({ tracking: 'weight_reps', category: 'custom' })}>+ {t('new_exercise')}</button>} />
      <input className="input" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">{cats.map((c) => <button key={c} onClick={() => setCat(c)} className={`chip shrink-0 capitalize ${cat === c ? 'chip-on' : ''}`}>{c === 'all' ? t('all') : c === 'custom' ? t('custom') : c}</button>)}</div>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {list.map((e) => (
          <li key={e.id}>
            <button disabled={!e.isCustom} onClick={() => setEdit(e)} className="flex min-h-[64px] w-full items-center justify-between px-4 py-2 text-left disabled:opacity-100">
              <span><span className="block text-lg font-bold">{e.name}</span>
                <span className="text-[15px] capitalize text-muted">{e.category} · {e.muscleGroup} · {e.equipment} · {e.type}</span></span>
              {e.isCustom && <span className="text-muted">{Icon.chevron}</span>}
            </button>
          </li>
        ))}
      </ul>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? t('edit') : t('new_exercise')}>
        {edit && <div className="space-y-3">
          {(['name', 'category', 'muscleGroup', 'equipment', 'type', 'videoUrl'] as const).map((k) => (
            <div key={k}><label className="label capitalize">{k.replace(/([A-Z])/g, ' $1')}</label><input className="input" value={(edit[k] as string) || ''} onChange={(ev) => setEdit({ ...edit, [k]: ev.target.value })} /></div>
          ))}
          <div><div className="label">Tracking</div><div className="flex flex-wrap gap-2">{TRACK.map((x) => <button key={x.value} onClick={() => setEdit({ ...edit, tracking: x.value })} className={`chip ${edit.tracking === x.value ? 'chip-on' : ''}`}>{x.label}</button>)}</div></div>
          <button className="btn-primary btn-xl w-full" onClick={save}>{t('save')}</button>
          {edit.id && <button className="btn-ghost w-full text-danger" onClick={del}>{t('delete')}</button>}
        </div>}
      </Sheet>
    </div>
  );
}
