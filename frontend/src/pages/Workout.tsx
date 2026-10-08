import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { fmtTime, useStore, useT, useUnits, exName } from '../lib/store';
import { beep, celebrate, keepAwake, vibrate } from '../lib/feedback';
import { ExercisePicker, Icon, Sheet, Stepper } from '../components/ui';
import type { PR, Session, WSet } from '../lib/types';

export default function Workout() {
  const t = useT();
  const nav = useNavigate();
  const u = useUnits();
  const { active, setActive, exMap, settings } = useStore();
  const [now, setNow] = useState(Date.now());
  const [picker, setPicker] = useState(() => !!useStore.getState().active && useStore.getState().active!.exercises.length === 0);
  const [finish, setFinish] = useState(false);
  const [rpe, setRpe] = useState(7);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [prs, setPrs] = useState<PR[] | null>(null);
  const restBeeped = useRef(false);

  // inputs for the current set (display units)
  const cur = active?.exercises[active.current];
  const ex = cur ? exMap[cur.exerciseId] : undefined;
  const tracking = ex?.tracking || 'weight_reps';
  const lastLogged = cur?.sets[cur.sets.length - 1];
  const [w, setW] = useState(0);
  const [reps, setReps] = useState(5);
  const [dur, setDur] = useState(60);
  const [dist, setDist] = useState(100);
  const [setRpeVal, setSetRpe] = useState<number | null>(null);

  useEffect(() => {
    if (!cur) return;
    setW(Number(u.show(lastLogged?.weight ?? cur.target.weight ?? 20)) || 0);
    setReps(lastLogged?.reps ?? cur.target.reps ?? (tracking === 'reps' ? 10 : 5));
    setDur(lastLogged?.durationSec ?? cur.target.durationSec ?? 60);
    setDist(lastLogged?.distanceM ?? cur.target.distanceM ?? 100);
    setSetRpe(null);
  }, [active?.current, cur?.exerciseId]); // eslint-disable-line

  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 250); keepAwake(true); return () => { clearInterval(i); keepAwake(false); }; }, []);

  const restLeft = active?.restUntil ? Math.ceil((active.restUntil - now) / 1000) : 0;
  useEffect(() => {
    if (!active?.restUntil) { restBeeped.current = false; return; }
    if (restLeft <= 3 && restLeft > 0) beep(660, 90, 0.15);
    if (restLeft <= 0 && !restBeeped.current) { restBeeped.current = true; beep(1046, 400); vibrate([200, 100, 200]); setActive((a) => ({ ...a, restUntil: null })); }
  }, [restLeft]); // eslint-disable-line

  if (!active) {
    if (prs) return <PRScreen prs={prs} onDone={() => nav('/')} />;
    return <div className="flex min-h-full flex-col items-center justify-center gap-6 p-6"><p className="text-xl">{t('no_data')}</p><button className="btn-primary" onClick={() => nav('/train')}>{t('start_workout')}</button></div>;
  }

  const elapsed = Math.floor((now - active.startedAt) / 1000);
  const targetSets = cur?.target.sets || 0;
  const setNo = (cur?.sets.length || 0) + 1;

  const logSet = () => {
    if (!cur) return;
    const s: WSet = { exerciseId: cur.exerciseId, setNumber: setNo, rpe: setRpeVal ?? undefined };
    if (tracking === 'weight_reps') { s.weight = u.toKg(w); s.reps = reps; }
    if (tracking === 'reps') s.reps = reps;
    if (tracking === 'time') s.durationSec = dur;
    if (tracking === 'distance_time') { s.distanceM = dist; s.durationSec = dur; }
    const rest = cur.target.restSec ?? (tracking === 'weight_reps' ? 90 : 60);
    vibrate(30);
    setActive((a) => {
      const exercises = a.exercises.map((e, i) => (i === a.current ? { ...e, sets: [...e.sets, { ...s, restSec: rest }] } : e));
      const doneHere = exercises[a.current].sets.length >= (exercises[a.current].target.sets || Infinity);
      const nextIdx = doneHere && a.current < exercises.length - 1 ? a.current + 1 : a.current;
      return { ...a, exercises, current: nextIdx, restUntil: Date.now() + rest * 1000, restTotal: rest };
    });
  };
  const removeSet = (exIdx: number, setIdx: number) => setActive((a) => ({
    ...a, exercises: a.exercises.map((e, i) => (i === exIdx ? { ...e, sets: e.sets.filter((_, j) => j !== setIdx).map((x, j) => ({ ...x, setNumber: j + 1 })) } : e)),
  }));
  const addRest = (sec: number) => setActive((a) => ({ ...a, restUntil: Math.max(Date.now(), (a.restUntil || Date.now()) + sec * 1000) }));

  const save = async () => {
    setSaving(true); setErr('');
    const sets = active.exercises.flatMap((e) => e.sets);
    try {
      const res = await api<Session>('/workouts', { body: {
        routineId: active.routineId || null, name: active.name, type: active.type || null, date: new Date(active.startedAt).toISOString(),
        duration: Math.round(elapsed / 60), sessionRpe: rpe, notes: notes || null, warmupDone: !!active.warmupDone, sets,
      } });
      setFinish(false); setActive(null);
      if (res.newPRs?.length) { celebrate(); setPrs(res.newPRs); } else { vibrate([40, 30, 40]); setPrs([]); }
    } catch {
      setErr(t('offline'));
    } finally { setSaving(false); }
  };
  const discard = () => { if (confirm(t('confirm_discard'))) { setActive(null); nav('/'); } };

  const nextLabel = cur ? (() => {
    const nextSet = cur.sets.length < (cur.target.sets || Infinity) ? cur : active.exercises[active.current + 1];
    if (!nextSet) return '';
    const e = exMap[nextSet.exerciseId];
    const n = nextSet.sets.length + 1;
    const wt = nextSet === cur ? w : Number(u.show(nextSet.target.weight));
    return `${nextSet === cur ? '' : `${exName(e, settings.languageMode)} · `}${t('set')} ${n}${e?.tracking === 'weight_reps' && wt ? ` — ${wt}${u.wUnit} × ${nextSet === cur ? reps : nextSet.target.reps ?? ''}` : ''}`;
  })() : '';

  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-[max(12px,env(safe-area-inset-top))]">
      {/* top bar */}
      <div className="flex items-center gap-2">
        <button aria-label="Minimise" onClick={() => nav('/')} className="flex h-14 w-14 items-center justify-center rounded-xl">{Icon.back}</button>
        <div className="flex-1 text-center"><div className="truncate text-lg font-bold">{active.name}</div><div className="num text-xl text-muted">{fmtTime(elapsed)}</div></div>
        <button onClick={() => setFinish(true)} className="btn-primary !min-h-[48px] !px-4 !text-base">{t('done')}</button>
      </div>

      {/* exercise strip */}
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-2">
        {active.exercises.map((e, i) => {
          const done = e.target.sets ? e.sets.length >= e.target.sets : false;
          return (
            <button key={i} onClick={() => setActive((a) => ({ ...a, current: i }))}
              className={`chip shrink-0 ${i === active.current ? 'chip-on' : ''} ${done && i !== active.current ? '!border-success !text-success' : ''}`}>
              {done ? '✓ ' : ''}{exName(exMap[e.exerciseId], settings.languageMode)} <span className="ml-1 opacity-70">{e.sets.length}{e.target.sets ? `/${e.target.sets}` : ''}</span>
            </button>
          );
        })}
        <button onClick={() => setPicker(true)} className="chip shrink-0">+ {t('add_exercise')}</button>
      </div>

      {/* main glanceable area */}
      {active.restUntil && restLeft > 0 ? (
        <section className="flex flex-1 flex-col items-center justify-center py-6 text-center" aria-live="polite">
          <div className="text-2xl font-bold uppercase tracking-widest text-muted">{t('rest')}</div>
          <div className="num tick my-2 text-[112px] leading-none text-accent sm:text-[128px]">{fmtTime(restLeft)}</div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-elevated"><div className="h-full bg-accent transition-[width] duration-200" style={{ width: `${100 - (restLeft / (active.restTotal || 90)) * 100}%` }} /></div>
          {nextLabel && <div className="mt-6 text-2xl font-semibold">{t('next')}: {nextLabel}</div>}
          <div className="mt-6 flex gap-3">
            <button className="btn-secondary" onClick={() => addRest(-15)}>−15s</button>
            <button className="btn-secondary" onClick={() => addRest(30)}>+30s</button>
          </div>
          <div className="flex-1" />
          <button onClick={() => setActive((a) => ({ ...a, restUntil: null }))} className="btn-secondary btn-xl mt-6 w-full">{t('skip_rest')}</button>
        </section>
      ) : cur ? (
        <section className="flex flex-1 flex-col py-4">
          <h1 className="text-center text-[34px] font-extrabold leading-tight sm:text-[40px]">{exName(ex, settings.languageMode)}</h1>
          <div className="mt-1 text-center text-[28px] font-bold text-accent">{t('set')} {setNo}{targetSets ? ` / ${targetSets}` : ''}</div>
          <div className="mt-6 space-y-6">
            {tracking === 'weight_reps' && <Stepper big value={w} onChange={setW} step={u.step} unit={u.wUnit} label={t('weight')} />}
            {(tracking === 'weight_reps' || tracking === 'reps') && <Stepper value={reps} onChange={setReps} step={1} unit={t('reps')} label={t('reps')} />}
            {tracking === 'distance_time' && <Stepper big value={dist} onChange={setDist} step={50} unit="m" label="Distance" />}
            {(tracking === 'time' || tracking === 'distance_time') && <Stepper big={tracking === 'time'} value={dur} onChange={setDur} step={tracking === 'time' ? 15 : 1} unit={t('sec')} label={`${t('sec')} (${fmtTime(dur)})`} />}
            <div>
              <div className="label text-center">RPE</div>
              <div className="flex justify-center gap-2">
                {[6, 7, 8, 9, 10].map((r) => <button key={r} onClick={() => setSetRpe(setRpeVal === r ? null : r)} className={`chip h-12 w-12 justify-center !px-0 text-lg ${setRpeVal === r ? 'chip-on' : ''}`}>{r}</button>)}
              </div>
            </div>
          </div>
          <div className="flex-1" />
          <button onClick={logSet} className="btn-primary btn-xl mt-6 w-full">{Icon.check}{t('log_set')}</button>
        </section>
      ) : (
        <section className="flex flex-1 flex-col items-center justify-center gap-4 py-10">
          <p className="text-xl text-muted">{t('add_exercise')}</p>
          <button className="btn-primary btn-xl w-full" onClick={() => setPicker(true)}>{Icon.plus}{t('add_exercise')}</button>
        </section>
      )}

      {/* logged sets */}
      {cur && cur.sets.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface">
          {cur.sets.map((s, j) => (
            <li key={j} className="flex min-h-[56px] items-center px-4">
              <span className="w-16 font-bold text-muted">#{s.setNumber}</span>
              <span className="num flex-1 text-2xl">
                {s.weight ? `${u.show(s.weight)}${u.wUnit} × ` : ''}{s.reps ?? ''}{s.reps ? '' : ''}{s.distanceM ? `${s.distanceM}m ` : ''}{s.durationSec ? fmtTime(s.durationSec) : ''}
                {s.rpe ? <span className="ml-2 text-base text-muted">@{s.rpe}</span> : null}
              </span>
              <button aria-label="Delete set" onClick={() => removeSet(active.current, j)} className="flex h-12 w-12 items-center justify-center text-muted">{Icon.trash}</button>
            </li>
          ))}
        </ul>
      )}

      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={(e) => setActive((a) => ({ ...a, exercises: [...a.exercises, { exerciseId: e.id, sets: [], target: {} }], current: a.exercises.length, restUntil: null }))} />

      <Sheet open={finish} onClose={() => setFinish(false)} title={t('finish_title')}>
        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          <div><div className="num text-3xl">{fmtTime(elapsed)}</div><div className="text-muted">time</div></div>
          <div><div className="num text-3xl">{active.exercises.reduce((a, e) => a + e.sets.length, 0)}</div><div className="text-muted">sets</div></div>
          <div><div className="num text-3xl">{u.show(active.exercises.flatMap((e) => e.sets).reduce((a, s) => a + (s.weight || 0) * (s.reps || 0), 0))}</div><div className="text-muted">{u.wUnit} vol</div></div>
        </div>
        <label className="label">{t('session_rpe')}</label>
        <div className="mb-4 grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => <button key={r} onClick={() => setRpe(r)} className={`chip justify-center ${rpe === r ? 'chip-on' : ''}`}>{r}</button>)}
        </div>
        <label className="label" htmlFor="notes">{t('notes')}</label>
        <textarea id="notes" rows={3} className="input py-3" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <label className="mt-3 flex min-h-[48px] items-center gap-3 text-lg">
          <input type="checkbox" className="h-6 w-6 accent-[rgb(var(--accent))]" checked={!!active.warmupDone} onChange={(e) => setActive((a) => ({ ...a, warmupDone: e.target.checked }))} /> {t('warmup')} ✓
        </label>
        {err && <p role="alert" className="mt-3 rounded-xl bg-warning/15 p-3 font-semibold text-warning">{err}</p>}
        <button disabled={saving} onClick={save} className="btn-primary btn-xl mt-4 w-full">{t('finish')}</button>
        <button onClick={discard} className="btn-ghost mt-2 w-full text-danger">{t('discard')}</button>
      </Sheet>
    </div>
  );
}

function PRScreen({ prs, onDone }: { prs: PR[]; onDone: () => void }) {
  const t = useT();
  const { exMap } = useStore();
  const u = useUnits();
  const label: Record<string, string> = { est_1rm: 'Est. 1RM', max_weight: 'Max weight', best_volume: 'Best volume', max_reps: 'Max reps', longest_duration: 'Longest' };
  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="text-[64px]">{prs.length ? '🔥' : '💪'}</div>
      <h1 className="text-[32px] font-extrabold leading-tight">{prs.length ? t('new_pr') : t('workout_complete')}</h1>
      <ul className="w-full space-y-3">
        {prs.map((p) => (
          <li key={p.id} className="card text-left">
            <div className="text-lg font-bold">{exMap[p.exerciseId]?.name}</div>
            <div className="text-muted">{label[p.type] || p.type.replace(/_/g, ' ')}</div>
            <div className="num text-[40px] text-accent">{p.unit === 'kg' ? `${u.show(p.value)} ${u.wUnit}` : p.unit === 'sec' ? fmtTime(p.value) : `${p.value} ${p.unit || ''}`}</div>
            {p.previous != null && <div className="text-muted">prev {p.unit === 'kg' ? `${u.show(p.previous)} ${u.wUnit}` : p.unit === 'sec' ? fmtTime(p.previous) : p.previous}</div>}
          </li>
        ))}
      </ul>
      <button onClick={onDone} className="btn-primary btn-xl w-full">{t('done')}</button>
    </div>
  );
}
