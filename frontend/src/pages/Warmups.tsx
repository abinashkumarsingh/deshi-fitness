import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { fmtTime, useT, useUnits } from '../lib/store';
import { beep, keepAwake, unlockAudio, vibrate } from '../lib/feedback';
import { PageHeader, Segmented, Stepper } from '../components/ui';
import type { Flow } from '../lib/types';

export default function Warmups() {
  const t = useT();
  const u = useUnits();
  const [tab, setTab] = useState<'ramp' | 'warmup' | 'cooldown' | 'mobility'>('ramp');
  const [w, setW] = useState(100);
  const [reps, setReps] = useState(5);
  const [bar, setBar] = useState(20);
  const [ramp, setRamp] = useState<{ weight: number; reps: number; label: string }[]>([]);
  const [flows, setFlows] = useState<Record<string, Flow[]>>({});
  const [run, setRun] = useState<Flow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => api<typeof ramp>(`/warmups/ramp-up?weight=${u.toKg(w)}&reps=${reps}&bar=${u.toKg(bar)}`).then(setRamp).catch(() => {}), 200);
    return () => clearTimeout(t);
  }, [w, reps, bar]); // eslint-disable-line
  useEffect(() => {
    Promise.all([api<Flow[]>('/warmups/templates'), api<Flow[]>('/cooldowns/templates'), api<Flow[]>('/mobility/routines')])
      .then(([warmup, cooldown, mobility]) => setFlows({ warmup, cooldown, mobility })).catch(() => {});
  }, []);

  if (run) return <FlowRunner flow={run} onClose={() => setRun(null)} />;

  return (
    <div className="space-y-5">
      <PageHeader title={t('warmups')} back />
      <Segmented value={tab} onChange={setTab} options={[{ value: 'ramp', label: 'Ramp-up' }, { value: 'warmup', label: t('warmup') }, { value: 'cooldown', label: t('cooldown') }, { value: 'mobility', label: t('mobility') }]} />
      {tab === 'ramp' ? (
        <>
          <div className="card space-y-4">
            <Stepper big value={w} onChange={setW} step={u.step} unit={u.wUnit} label={t('work_weight')} />
            <div className="space-y-4">
              <Stepper value={reps} onChange={setReps} step={1} min={1} label={t('work_reps')} />
              <Stepper value={bar} onChange={setBar} step={u.imp ? 5 : 2.5} label={t('bar_weight')} />
            </div>
          </div>
          <ol className="space-y-2">
            {ramp.map((s, i) => (
              <li key={i} className={`card flex items-center justify-between !py-4 ${s.label === 'Work' ? '!border-accent' : ''}`}>
                <span className="w-20 text-lg font-bold text-muted">{s.label}</span>
                <span className={`num text-[36px] ${s.label === 'Work' ? 'text-accent' : ''}`}>{u.show(s.weight)}<span className="text-lg text-muted"> {u.wUnit}</span> × {s.reps}</span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <div className="space-y-3">
          {(flows[tab] || []).map((f) => (
            <div key={f.id} className="card">
              <div className="text-xl font-extrabold">{f.name}</div>
              <ol className="mt-2 space-y-1 text-[16px] text-muted">{f.steps.map((s, i) => <li key={i}>{i + 1}. <span className="text-fg">{s.name}</span>{s.durationSec ? ` · ${fmtTime(s.durationSec)}` : ''}{s.reps ? ` · ×${s.reps}` : ''}{s.note ? ` · ${s.note}` : ''}</li>)}</ol>
              <button className="btn-primary mt-4 w-full" onClick={() => { unlockAudio(); setRun(f); }}>{t('start')}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FlowRunner({ flow, onClose }: { flow: Flow; onClose: () => void }) {
  const t = useT();
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(flow.steps[0].durationSec || 0);
  const [paused, setPaused] = useState(false);
  const step = flow.steps[i];
  useEffect(() => { keepAwake(true); return () => { keepAwake(false); }; }, []);
  useEffect(() => { setLeft(step?.durationSec || 0); }, [i]); // eslint-disable-line
  useEffect(() => {
    if (!step?.durationSec || paused) return;
    const id = setInterval(() => setLeft((l) => {
      if (l <= 4 && l > 1) beep(784, 90, 0.15);
      if (l <= 1) { beep(1046, 350); vibrate(200); setI((x) => x + 1); return 0; }
      return l - 1;
    }), 1000);
    return () => clearInterval(id);
  }, [i, paused]); // eslint-disable-line
  if (!step) return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 text-center">
      <div className="text-[64px]">✅</div><h1 className="text-[32px] font-extrabold">{flow.name} — {t('done')}</h1>
      <button className="btn-primary btn-xl w-full" onClick={onClose}>{t('done')}</button>
    </div>
  );
  return (
    <div className="flex min-h-[80vh] flex-col">
      <div className="flex items-center justify-between"><span className="text-lg font-bold text-muted">{flow.name} · {i + 1}/{flow.steps.length}</span><button className="chip" onClick={onClose}>{t('cancel')}</button></div>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h1 className="text-[36px] font-extrabold leading-tight">{step.name}</h1>
        {step.durationSec ? <div className="num my-4 text-[112px] leading-none text-accent">{fmtTime(left)}</div>
          : <div className="num my-4 text-[80px] text-accent">{step.reps ? `×${step.reps}` : '—'}</div>}
        {step.note && <p className="text-xl text-muted">{step.note}</p>}
        {flow.steps[i + 1] && <p className="mt-6 text-xl">{t('next')}: {flow.steps[i + 1].name}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {step.durationSec ? <button className="btn-secondary btn-xl" onClick={() => setPaused(!paused)}>{paused ? t('resume') : t('pause')}</button> : <button className="btn-secondary btn-xl" onClick={() => setI(Math.max(0, i - 1))}>←</button>}
        <button className="btn-primary btn-xl" onClick={() => setI(i + 1)}>{t('next')} →</button>
      </div>
    </div>
  );
}
