import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { fmtTime, useStore, useT } from '../lib/store';
import { beep, keepAwake, say, unlockAudio, vibrate } from '../lib/feedback';
import { Icon, Stepper } from '../components/ui';

type TType = 'stopwatch' | 'countdown' | 'interval' | 'tabata' | 'emom' | 'boxing' | 'amrap' | 'pyramid';
interface Cfg { work: number; rest: number; rounds: number; total: number; prep: number }
interface Phase { kind: 'prep' | 'work' | 'rest'; sec: number; round: number }
interface Preset { id: string; name: string; type: TType; workSec?: number; restSec?: number; rounds?: number; totalSec?: number }

const DEFAULTS: Record<TType, Partial<Cfg>> = {
  stopwatch: {}, countdown: { total: 600 }, interval: { work: 40, rest: 20, rounds: 10 }, tabata: { work: 20, rest: 10, rounds: 8 },
  emom: { work: 60, rest: 0, rounds: 10 }, boxing: { work: 180, rest: 60, rounds: 6 }, amrap: { total: 720 }, pyramid: { work: 20, rest: 20, rounds: 5 },
};

function buildPhases(type: TType, c: Cfg): Phase[] {
  const p: Phase[] = c.prep ? [{ kind: 'prep', sec: c.prep, round: 0 }] : [];
  if (type === 'countdown' || type === 'amrap') return [...p, { kind: 'work', sec: c.total, round: 1 }];
  for (let r = 1; r <= c.rounds; r++) {
    const work = type === 'pyramid' ? c.work * (r <= Math.ceil(c.rounds / 2) ? r : c.rounds - r + 1) : c.work;
    p.push({ kind: 'work', sec: work, round: r });
    if (c.rest && r < c.rounds) p.push({ kind: 'rest', sec: c.rest, round: r });
  }
  return p;
}

export default function Timer() {
  const t = useT();
  const lang = useStore((s) => s.settings.languageMode);
  const [type, setType] = useState<TType>('tabata');
  const [cfg, setCfg] = useState<Cfg>({ work: 20, rest: 10, rounds: 8, total: 600, prep: 10 });
  const [running, setRunning] = useState(false);
  const [startAt, setStartAt] = useState<number | null>(null);
  const [pausedMs, setPausedMs] = useState(0);
  const [pauseStart, setPauseStart] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [voice, setVoice] = useState(true);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [full, setFull] = useState(false);
  const lastSec = useRef<number>(-1);
  const lastPhase = useRef<number>(-1);

  useEffect(() => { api<Preset[]>('/timer-presets').then(setPresets).catch(() => {}); }, []);
  useEffect(() => { if (!running) return; const i = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(i); }, [running]);
  useEffect(() => { keepAwake(running); return () => { keepAwake(false); }; }, [running]);

  const phases = useMemo(() => buildPhases(type, cfg), [type, cfg]);
  const elapsed = startAt ? ((pauseStart ?? now) - startAt - pausedMs) / 1000 : 0;

  // locate current phase
  let acc = 0, idx = -1, left = 0;
  if (type !== 'stopwatch') {
    for (let i = 0; i < phases.length; i++) { if (elapsed < acc + phases[i].sec) { idx = i; left = acc + phases[i].sec - elapsed; break; } acc += phases[i].sec; }
  }
  const finished = type !== 'stopwatch' && startAt !== null && idx === -1;
  const ph = idx >= 0 ? phases[idx] : null;
  const totalRounds = type === 'countdown' || type === 'amrap' ? 1 : cfg.rounds;

  // cues
  useEffect(() => {
    if (!running || type === 'stopwatch') return;
    const s = Math.ceil(left);
    if (idx !== lastPhase.current) {
      lastPhase.current = idx;
      if (ph) {
        beep(ph.kind === 'work' ? 1046 : 523, 350); vibrate(ph.kind === 'work' ? [150, 80, 150] : 300);
        if (voice) say(ph.kind === 'work' ? (ph.round > 0 && totalRounds > 1 ? `${t('round')} ${ph.round}. ${t('go')}` : t('go')) : ph.kind === 'rest' ? t('rest') : 'Get ready', lang === 'en' ? 'en-IN' : 'hi-IN');
      }
    } else if (s !== lastSec.current && s <= 3 && s > 0) beep(784, 100, 0.2);
    if (type === 'emom' && ph?.kind === 'work' && s !== lastSec.current && s === 30 && cfg.work === 60) beep(660, 80, 0.15);
    lastSec.current = s;
    if (finished) { beep(1318, 700); vibrate([300, 100, 300, 100, 300]); if (voice) say(t('done'), lang === 'en' ? 'en-IN' : 'hi-IN'); setRunning(false); }
  }); // eslint-disable-line

  const start = () => { unlockAudio(); setStartAt(Date.now()); setPausedMs(0); setPauseStart(null); setRunning(true); lastPhase.current = -1; setFull(true); };
  const pause = () => { setPauseStart(Date.now()); setRunning(false); };
  const resume = () => { if (pauseStart) setPausedMs((p) => p + Date.now() - pauseStart); setPauseStart(null); setRunning(true); };
  const reset = () => { setRunning(false); setStartAt(null); setPausedMs(0); setPauseStart(null); setFull(false); };
  const pick = (ty: TType) => { setType(ty); setCfg((c) => ({ ...c, ...DEFAULTS[ty] })); reset(); };
  const savePreset = async () => {
    const name = prompt('Preset name'); if (!name) return;
    const p = await api<Preset>('/timer-presets', { body: { name, type, workSec: cfg.work, restSec: cfg.rest, rounds: cfg.rounds, totalSec: cfg.total } });
    setPresets((x) => [...x, p]);
  };
  const loadPreset = (p: Preset) => { setType(p.type); setCfg((c) => ({ ...c, work: p.workSec ?? c.work, rest: p.restSec ?? c.rest, rounds: p.rounds ?? c.rounds, total: p.totalSec ?? c.total })); reset(); };

  const types: TType[] = ['tabata', 'emom', 'interval', 'boxing', 'amrap', 'countdown', 'stopwatch', 'pyramid'];
  const display = type === 'stopwatch' ? elapsed : finished ? 0 : left;
  const color = ph?.kind === 'rest' ? 'text-success' : ph?.kind === 'prep' ? 'text-warning' : 'text-fg';
  const phaseLabel = finished ? t('done') : ph?.kind === 'rest' ? t('rest') : ph?.kind === 'prep' ? 'Ready' : startAt ? t('work') : '';
  const progress = ph ? 1 - left / ph.sec : finished ? 1 : 0;

  if (full && startAt) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-bg px-6 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-[max(16px,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <span className="text-xl font-bold uppercase text-muted">{type}</span>
          <button aria-label="Exit full screen" onClick={() => setFull(false)} className="flex h-14 w-14 items-center justify-center">{Icon.close}</button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center text-center" aria-live="polite">
          <div className={`text-[32px] font-extrabold uppercase tracking-widest ${ph?.kind === 'rest' ? 'text-success' : 'text-accent'}`}>{phaseLabel}</div>
          <div className={`num my-3 text-[120px] leading-none sm:text-[180px] ${color} ${running ? 'tick' : ''}`}>{fmtTime(display)}</div>
          {type !== 'stopwatch' && totalRounds > 1 && <div className="text-[32px] font-bold text-accent">{t('round').toUpperCase()} {Math.max(1, ph?.round || (finished ? totalRounds : 1))} / {totalRounds}</div>}
          {type !== 'stopwatch' && <div className="mt-8 h-3 w-full overflow-hidden rounded-full bg-elevated"><div className={`h-full ${ph?.kind === 'rest' ? 'bg-success' : 'bg-accent'}`} style={{ width: `${progress * 100}%` }} /></div>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={reset} className="btn-secondary btn-xl">{t('reset')}</button>
          {finished ? <button onClick={start} className="btn-primary btn-xl">{t('start')}</button>
            : running ? <button onClick={pause} className="btn-primary btn-xl">{t('pause')}</button>
              : <button onClick={resume} className="btn-primary btn-xl">{t('resume')}</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="h1 pt-2">{t('timer')}</h1>
      <div className="flex flex-wrap gap-2">{types.map((ty) => <button key={ty} onClick={() => pick(ty)} className={`chip capitalize ${type === ty ? 'chip-on' : ''}`}>{ty}</button>)}</div>
      {startAt && <button onClick={() => setFull(true)} className="card w-full text-center"><div className="num text-[64px] text-accent">{fmtTime(display)}</div><div className="text-muted">{phaseLabel} · tap for full screen</div></button>}
      <div className="card space-y-5">
        {(type === 'countdown' || type === 'amrap') && <Stepper value={cfg.total / 60} onChange={(v) => setCfg({ ...cfg, total: Math.round(v * 60) })} step={1} min={1} unit={t('min')} label={t('min')} />}
        {['interval', 'tabata', 'emom', 'boxing', 'pyramid'].includes(type) && <>
          <Stepper value={cfg.work} onChange={(v) => setCfg({ ...cfg, work: v })} step={type === 'boxing' ? 30 : 5} min={5} unit={t('sec')} label={`${t('work')} (${fmtTime(cfg.work)})`} />
          {type !== 'emom' && <Stepper value={cfg.rest} onChange={(v) => setCfg({ ...cfg, rest: v })} step={5} unit={t('sec')} label={`${t('rest')} (${fmtTime(cfg.rest)})`} />}
          <Stepper value={cfg.rounds} onChange={(v) => setCfg({ ...cfg, rounds: Math.max(1, v) })} step={1} min={1} label={t('round')} />
        </>}
        {type !== 'stopwatch' && <Stepper value={cfg.prep} onChange={(v) => setCfg({ ...cfg, prep: v })} step={5} unit={t('sec')} label="Prep" />}
        <label className="flex min-h-[48px] items-center gap-3 text-lg"><input type="checkbox" className="h-6 w-6" checked={voice} onChange={(e) => setVoice(e.target.checked)} /> Voice cues</label>
        {type !== 'stopwatch' && <p className="text-muted">Total: {fmtTime(phases.reduce((a, p) => a + p.sec, 0))}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={savePreset} className="btn-secondary">{t('save')} preset</button>
        <button onClick={start} className="btn-primary">{t('start')}</button>
      </div>
      {presets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => <button key={p.id} onClick={() => loadPreset(p)} className="chip">{p.name}</button>)}
        </div>
      )}
    </div>
  );
}
