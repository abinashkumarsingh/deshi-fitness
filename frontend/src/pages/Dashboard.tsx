import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useStore, useT, useUnits, today } from '../lib/store';
import { Icon, Sheet, Skeleton, Stat, Stepper } from '../components/ui';
import type { Routine, Session, Suggestion } from '../lib/types';

interface Ctx { sessions7: number; streakDays: number; sleepAvg7: number | null; weightAvg7: number | null; goalType: string | null; daysToEvent: number | null }

export default function Dashboard() {
  const t = useT();
  const nav = useNavigate();
  const u = useUnits();
  const { settings, auth } = useStore();
  const [sug, setSug] = useState<{ context: Ctx; suggestions: Suggestion[] } | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [recent, setRecent] = useState<Session[]>([]);
  const [macros, setMacros] = useState<{ date: string; calories: number; protein: number; waterMl: number }[]>([]);
  interface PlanItem { exerciseId: string | null; name: string; sets: number; reps: number | null; weight: number | null; durationSec: number | null; reason: string }
  const [ai, setAi] = useState<{ busy: boolean; text?: string; err?: string; plan?: PlanItem[]; focus?: string | null }>({ busy: false });
  const { setActive, active } = useStore();
  const [sheet, setSheet] = useState<'weight' | 'sleep' | null>(null);
  const [weight, setWeight] = useState(70);
  const [sleepH, setSleepH] = useState(7);
  const [toast, setToast] = useState('');

  const load = () => {
    api<{ context: Ctx; suggestions: Suggestion[] }>('/suggestions/today').then(setSug).catch(() => {});
    api<Routine[]>('/routines').then(setRoutines).catch(() => {});
    api<Session[]>('/workouts?limit=3').then(setRecent).catch(() => {});
    api<typeof macros>('/metrics/macros?days=7').then(setMacros).catch(() => {});
  };
  useEffect(load, []);
  useEffect(() => { if (sug?.context.weightAvg7) setWeight(Number(u.show(sug.context.weightAvg7))); }, [sug?.context.weightAvg7]); // eslint-disable-line

  const h = new Date().getHours();
  const greet = h < 12 ? t('greeting_morning') : h < 17 ? t('greeting_afternoon') : t('greeting_evening');
  const dow = new Date().getDay();
  const todays = routines.filter((r) => r.days.includes(dow));
  const todayMacros = macros.find((m) => m.date === today());
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2000); };

  const dismiss = async (s: Suggestion) => {
    setSug((p) => p && { ...p, suggestions: p.suggestions.filter((x) => x.id !== s.id) });
    await api(`/suggestions/${s.id}/dismiss`, { method: 'POST' }).catch(() => {});
  };
  const askAi = async () => {
    setAi({ busy: true });
    try {
      const r = await api<{ ok: boolean; text?: string; reason?: string; plan?: PlanItem[]; focus?: string | null }>('/ai/suggest', { body: {} });
      setAi(r.ok ? { busy: false, text: r.text, plan: r.plan, focus: r.focus } : { busy: false, err: r.reason === 'no_key' || r.reason === 'disabled' ? t('ai_unavailable') : `AI: ${r.reason}` });
    } catch { setAi({ busy: false, err: 'AI request failed' }); }
  };
  const startPlan = () => {
    if (!ai.plan?.length) return;
    if (active && !confirm(t('confirm_discard'))) return;
    setActive({
      startedAt: Date.now(), name: ai.focus || 'AI workout', current: 0,
      exercises: ai.plan.filter((p) => p.exerciseId).map((p) => ({ exerciseId: p.exerciseId!, sets: [], target: { sets: p.sets, reps: p.reps, weight: p.weight, durationSec: p.durationSec } })),
    });
    nav('/workout');
  };
  const addWater = async () => { await api('/nutrition', { body: { meal: 'Water', waterMl: 250 } }); flash('💧 +250ml'); load(); };
  const saveWeight = async () => { await api('/body', { body: { weight: u.toKg(weight) } }); setSheet(null); flash('✓'); load(); };
  const saveSleep = async () => { await api('/sleep', { body: { hours: sleepH } }); setSheet(null); flash('✓'); load(); };

  const prColor = { high: 'border-l-danger', medium: 'border-l-warning', low: 'border-l-success' };
  const c = sug?.context;

  return (
    <div className="space-y-6">
      <header className="pt-2">
        <p className="text-lg font-semibold text-muted">{greet}{auth?.user.name ? `, ${auth.user.name.split(' ')[0]}` : ''}</p>
        <h1 className="display text-[34px] leading-tight">{new Date().toLocaleDateString(settings.languageMode === 'en' ? 'en-IN' : 'en-IN', { weekday: 'long' })}</h1>
        {c?.goalType && <p className="text-lg font-semibold capitalize text-accent">{c.goalType.replace(/_/g, ' ')}{c.daysToEvent !== null && c.daysToEvent > 0 ? ` · ${c.daysToEvent}d to go` : ''}</p>}
      </header>

      <div className="grid grid-cols-2 gap-3">
        {c ? <>
          <Stat label={t('this_week')} value={c.sessions7} unit={t('sessions')} />
          <Stat label={t('streak')} value={c.streakDays} accent={c.streakDays > 0} />
          <Stat label={t('sleep')} value={c.sleepAvg7 !== null ? c.sleepAvg7.toFixed(1) : '–'} unit="h" />
          <Stat label={t('weight')} value={c.weightAvg7 ? u.show(c.weightAvg7) : '–'} unit={c.weightAvg7 ? u.wUnit : undefined} />
        </> : [0, 1, 2, 3].map((i) => <Skeleton key={i} h={108} />)}
      </div>

      <section className="space-y-3">
        {todays.map((r) => (
          <div key={r.id} className="bg-grad rounded-3xl p-5 text-[#0C1210]">
            <div className="text-[13px] font-bold uppercase tracking-widest">{t('today')} · {r.type}</div>
            <div className="display mt-1 text-[24px] leading-tight">{r.name}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-white/45 px-3 py-2"><div className="text-[12px] font-bold uppercase tracking-wider">Exercises</div><div className="num text-[22px]">{r.blocks.reduce((a, b) => a + b.exercises.length, 0)}</div></div>
              <div className="rounded-2xl bg-white/45 px-3 py-2"><div className="text-[12px] font-bold uppercase tracking-wider">Blocks</div><div className="num text-[22px]">{r.blocks.length}</div></div>
            </div>
            <button onClick={() => nav('/train', { state: { start: r.id } })} className="btn mt-3 w-full bg-[#0C1210] text-white">{t('start')} →</button>
          </div>
        ))}
        <button onClick={() => nav('/train')} className="btn-primary btn-xl w-full">{Icon.dumbbell}{t('start_workout')}</button>
      </section>

      <section>
        <h2 className="h2 mb-3">{t('quick_log')}</h2>
        <div className="grid grid-cols-2 gap-3">
          <button className="btn-secondary" onClick={() => setSheet('weight')}>⚖️ {t('log_weight')}</button>
          <button className="btn-secondary" onClick={() => setSheet('sleep')}>😴 {t('log_sleep')}</button>
          <button className="btn-secondary" onClick={() => nav('/food')}>🍛 {t('log_food')}</button>
          <button className="btn-secondary whitespace-nowrap" onClick={addWater}>💧 +250ml</button>
        </div>
        {todayMacros && (
          <p className="mt-3 text-[16px] font-semibold text-muted">
            {t('today')}: <span className="text-fg">{todayMacros.calories}</span> kcal · <span className="text-fg">{Math.round(todayMacros.protein)}g</span> {t('protein')} · <span className="text-fg">{(todayMacros.waterMl / 1000).toFixed(1)}L</span> {t('water')}
          </p>
        )}
      </section>

      <section>
        <h2 className="h2 mb-3">{t('suggestions')}</h2>
        <div className="space-y-3">
          {!sug && <Skeleton h={72} />}
          {sug && !sug.suggestions.length && <div className="card text-lg text-muted">{t('no_suggestions')}</div>}
          {sug?.suggestions.map((s) => (
            <div key={s.id} className={`card flex items-start gap-3 border-l-[6px] ${prColor[s.priority]}`}>
              <p className="flex-1 text-[18px] font-semibold leading-snug">{s.message}</p>
              <button aria-label="Dismiss" onClick={() => dismiss(s)} className="-mr-2 -mt-2 flex h-12 w-12 shrink-0 items-center justify-center text-muted">{Icon.close}</button>
            </div>
          ))}
          {settings.aiEnabled && (
            <div className="card">
              {ai.plan && ai.plan.length > 0 ? (
                <div>
                  <div className="text-[14px] font-semibold uppercase tracking-wide text-muted">{t('ai_title')}</div>
                  {ai.focus && <div className="mt-1 text-2xl font-extrabold">{ai.focus}</div>}
                  <ol className="mt-3 space-y-3">
                    {ai.plan.map((p, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="num mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-elevated text-base">{i + 1}</span>
                        <span>
                          <span className="block text-lg font-bold">{p.name} <span className="font-semibold text-accent whitespace-nowrap">{p.sets}×{p.reps ?? (p.durationSec ? `${p.durationSec}s` : '')}{p.weight ? ` · ${u.show(p.weight)}${u.wUnit}` : ''}</span></span>
                          <span className="text-[15px] text-muted">{p.reason}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                  <button onClick={startPlan} className="btn-primary mt-4 w-full">{Icon.dumbbell}{t('start_plan')}</button>
                </div>
              ) : ai.text ? <div className="whitespace-pre-wrap text-[17px] leading-relaxed">{ai.text}</div> : ai.err ? <p className="text-muted">{ai.err}</p> : null}
              <button onClick={askAi} disabled={ai.busy} className={`btn-secondary w-full ${ai.text || ai.err || ai.plan?.length ? 'mt-3' : ''}`}>{Icon.sparkle}{ai.busy ? t('ai_thinking') : ai.plan?.length ? 'Suggest again' : 'Suggest exercises'}</button>
            </div>
          )}
        </div>
      </section>

      {recent.length > 0 && (
        <section>
          <h2 className="h2 mb-3">{t('history')}</h2>
          <div className="space-y-2">
            {recent.map((s) => (
              <button key={s.id} onClick={() => nav(`/sessions/${s.id}`)} className="card flex w-full items-center justify-between !py-4 text-left">
                <span><span className="block text-lg font-bold">{s.name || 'Workout'}</span><span className="text-muted">{new Date(s.date).toLocaleDateString()} · {s.sets.length} sets</span></span>
                <span className="text-muted">{Icon.chevron}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <Sheet open={sheet === 'weight'} onClose={() => setSheet(null)} title={t('log_weight')}>
        <Stepper big value={weight} onChange={setWeight} step={u.imp ? 0.5 : 0.1} unit={u.wUnit} />
        <button onClick={saveWeight} className="btn-primary btn-xl mt-6 w-full">{t('save')}</button>
      </Sheet>
      <Sheet open={sheet === 'sleep'} onClose={() => setSheet(null)} title={t('log_sleep')}>
        <Stepper big value={sleepH} onChange={setSleepH} step={0.5} unit="h" />
        <button onClick={saveSleep} className="btn-primary btn-xl mt-6 w-full">{t('save')}</button>
      </Sheet>
      {toast && <div role="status" className="fixed inset-x-0 top-6 z-50 mx-auto w-fit rounded-2xl bg-success px-6 py-3 text-lg font-bold text-black">{toast}</div>}
    </div>
  );
}
