import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useStore, useT } from '../lib/store';
import { Icon, PageHeader, Sheet } from '../components/ui';
import type { Exercise, Tracking } from '../lib/types';

const TRACK: { value: Tracking; label: string }[] = [{ value: 'weight_reps', label: 'Weight × reps' }, { value: 'reps', label: 'Reps only' }, { value: 'time', label: 'Time' }, { value: 'distance_time', label: 'Distance + time' }];
const IMG = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
const PAGE = 60;

type Detail = Exercise & { instructions?: string[] | null; images?: string[] | null; secondaryMuscles?: string[] | null };

export default function Exercises() {
  const t = useT();
  const { exercises, loadExercises } = useStore();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [muscle, setMuscle] = useState('all');
  const [equip, setEquip] = useState('all');
  const [limit, setLimit] = useState(PAGE);
  const [edit, setEdit] = useState<Partial<Exercise> | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [img, setImg] = useState(0);

  const cats = useMemo(() => ['all', 'custom', ...Array.from(new Set(exercises.map((e) => e.category))).sort()], [exercises]);
  const muscles = useMemo(() => Array.from(new Set(exercises.map((e) => e.muscleGroup).filter(Boolean) as string[])).sort(), [exercises]);
  const equips = useMemo(() => Array.from(new Set(exercises.map((e) => e.equipment).filter(Boolean) as string[])).sort(), [exercises]);
  const list = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return exercises.filter((e) =>
      (cat === 'all' || (cat === 'custom' ? e.isCustom : e.category === cat)) &&
      (muscle === 'all' || e.muscleGroup === muscle) &&
      (equip === 'all' || e.equipment === equip) &&
      words.every((w) => `${e.name} ${e.muscleGroup} ${e.equipment}`.toLowerCase().includes(w)));
  }, [exercises, q, cat, muscle, equip]);
  useEffect(() => setLimit(PAGE), [q, cat, muscle, equip]);

  const open = async (e: Exercise) => {
    if (e.isCustom) return setEdit(e);
    setImg(0); setDetail(e);
    try { setDetail(await api<Detail>(`/exercises/${e.id}`)); } catch { /* keep summary */ }
  };
  const save = async () => {
    if (!edit?.name) return;
    const body = { name: edit.name, category: edit.category || 'custom', muscleGroup: edit.muscleGroup || null, equipment: edit.equipment || null, type: edit.type || null, tracking: edit.tracking || 'weight_reps', videoUrl: edit.videoUrl || null };
    await api(edit.id ? `/exercises/${edit.id}` : '/exercises', { method: edit.id ? 'PUT' : 'POST', body });
    setEdit(null); loadExercises(true);
  };
  const del = async () => { if (edit?.id && confirm(`${t('delete')}?`)) { await api(`/exercises/${edit.id}`, { method: 'DELETE' }); setEdit(null); loadExercises(true); } };

  // Cycle the two demo frames (start/end position) like a mini animation
  useEffect(() => {
    if (!detail?.images || detail.images.length < 2) return;
    const id = setInterval(() => setImg((i) => (i + 1) % detail.images!.length), 1200);
    return () => clearInterval(id);
  }, [detail?.images]);

  const sel = (value: string, set: (v: string) => void, opts: string[], label: string) => (
    <label className="min-w-0 flex-1">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => set(e.target.value)} className="input !min-h-[48px] capitalize">
        <option value="all">All {label.toLowerCase()}</option>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );

  return (
    <div className="space-y-4">
      <PageHeader title={t('exercises')} back right={<button className="chip shrink-0" onClick={() => setEdit({ tracking: 'weight_reps', category: 'custom' })}>+ New</button>} />
      <input className="input" placeholder={`${t('search')} ${exercises.length} exercises`} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex gap-2">
        {sel(muscle, setMuscle, muscles, 'Muscles')}
        {sel(equip, setEquip, equips, 'Equipment')}
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">{cats.map((c) => <button key={c} onClick={() => setCat(c)} className={`chip shrink-0 capitalize ${cat === c ? 'chip-on' : ''}`}>{c === 'all' ? t('all') : c === 'custom' ? t('custom') : c}</button>)}</div>
      <p className="text-[15px] font-semibold text-muted">{list.length} result{list.length === 1 ? '' : 's'}</p>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {list.slice(0, limit).map((e) => (
          <li key={e.id}>
            <button onClick={() => open(e)} className="flex min-h-[64px] w-full items-center gap-3 px-4 py-2 text-left">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[17px] font-bold">{e.name}</span>
                <span className="block truncate text-[14px] capitalize text-muted">{[e.muscleGroup, e.equipment, e.difficulty].filter(Boolean).join(' · ')}</span>
              </span>
              {e.isCustom && <span className="shrink-0 rounded-full bg-elevated px-2 py-0.5 text-[12px] font-bold text-muted">Custom</span>}
              <span className="shrink-0 text-muted">{Icon.chevron}</span>
            </button>
          </li>
        ))}
      </ul>
      {list.length > limit && <button className="btn-secondary w-full" onClick={() => setLimit((l) => l + PAGE)}>Show more ({list.length - limit} left)</button>}

      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail?.name}>
        {detail && <div className="space-y-4">
          {detail.images && detail.images.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-line bg-white">
              <img src={IMG + detail.images[img]} alt={`${detail.name} demonstration`} className="aspect-[4/3] w-full object-contain" loading="lazy" />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {[detail.muscleGroup, ...(detail.secondaryMuscles || [])].filter(Boolean).map((m, i) => (
              <span key={m! + i} className={`rounded-full px-3 py-1 text-[14px] font-semibold capitalize ${i === 0 ? 'chip-on' : 'bg-elevated text-fg'}`}>{m}</span>
            ))}
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center">
            {[['Equipment', detail.equipment], ['Level', detail.difficulty], ['Type', detail.type]].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-elevated px-1.5 py-2"><dt className="text-[11px] font-bold uppercase tracking-wider text-muted">{k}</dt><dd className="text-[13px] font-bold capitalize leading-tight [word-break:normal]">{v || '—'}</dd></div>
            ))}
          </dl>
          {detail.instructions && detail.instructions.length > 0 && (
            <ol className="space-y-3">
              {detail.instructions.map((s, i) => (
                <li key={i} className="flex gap-3 text-[16px] leading-relaxed">
                  <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-elevated text-[13px]">{i + 1}</span><span>{s}</span>
                </li>
              ))}
            </ol>
          )}
          {detail.images && <p className="text-[13px] text-muted">Images & instructions: Free Exercise DB (public domain).</p>}
        </div>}
      </Sheet>

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
