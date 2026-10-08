import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart } from 'recharts';
import { api } from '../lib/api';
import { fmtTime, useStore, useT, useUnits } from '../lib/store';
import { Empty, Icon, Segmented, Skeleton } from '../components/ui';
import type { PR, Session } from '../lib/types';

const PR_LABEL: Record<string, string> = { est_1rm: 'Est. 1RM', max_weight: 'Max weight', best_volume: 'Best volume', max_reps: 'Max reps', longest_duration: 'Longest' };

export function ChartBox({ title, children, h = 220 }: { title: string; children: React.ReactElement; h?: number }) {
  return (
    <div className="card">
      <h3 className="mb-3 text-lg font-bold">{title}</h3>
      <div style={{ height: h }}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>
    </div>
  );
}
export const axis = { stroke: 'rgb(var(--muted))', fontSize: 13, fontWeight: 600, tickLine: false, axisLine: false };
export const tip = { contentStyle: { background: 'rgb(var(--elevated))', border: '1px solid rgb(var(--line))', borderRadius: 12, color: 'rgb(var(--fg))', fontWeight: 600 } };
const short = (d: string) => d.slice(5);

export default function Progress() {
  const t = useT();
  const [tab, setTab] = useState<'prs' | 'charts' | 'history'>('prs');
  return (
    <div className="space-y-5">
      <h1 className="h1 pt-2">{t('nav_progress')}</h1>
      <Segmented value={tab} onChange={setTab} options={[{ value: 'prs', label: t('prs') }, { value: 'charts', label: t('charts') }, { value: 'history', label: t('history') }]} />
      {tab === 'prs' && <PRBoard />}
      {tab === 'charts' && <Charts />}
      {tab === 'history' && <History />}
    </div>
  );
}

function fmtPR(p: PR, u: ReturnType<typeof useUnits>) {
  if (p.unit === 'kg') return `${u.show(p.value)} ${u.wUnit}`;
  if (p.unit === 'sec') return fmtTime(p.value);
  return `${p.value} ${p.unit || ''}`;
}

function PRBoard() {
  const t = useT();
  const u = useUnits();
  const { exMap } = useStore();
  const [data, setData] = useState<{ board: PR[]; history: PR[] } | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => { api<{ board: PR[]; history: PR[] }>('/prs').then(setData).catch(() => setData({ board: [], history: [] })); }, []);
  const byEx = useMemo(() => {
    const m = new Map<string, PR[]>();
    data?.board.forEach((p) => m.set(p.exerciseId, [...(m.get(p.exerciseId) || []), p]));
    return [...m.entries()];
  }, [data]);
  if (!data) return <Skeleton h={120} />;
  if (!byEx.length) return <Empty>{t('no_data')}</Empty>;
  const hist = sel ? data.history.filter((p) => p.exerciseId === sel && p.type === 'est_1rm').slice().reverse() : [];
  return (
    <div className="space-y-3">
      {byEx.map(([exId, prs]) => {
        const main = prs.find((p) => p.type === 'est_1rm') || prs.find((p) => p.type.startsWith('fastest')) || prs[0];
        return (
          <button key={exId} onClick={() => setSel(sel === exId ? null : exId)} className="card w-full text-left">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xl font-bold">{exMap[exId]?.name || 'Exercise'}</span>
              <span className="num text-[32px] text-accent">{fmtPR(main, u)}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 text-[15px] text-muted">
              {prs.filter((p) => p !== main).map((p) => <span key={p.id}>{PR_LABEL[p.type] || p.type.replace(/_/g, ' ')}: <b className="text-fg">{fmtPR(p, u)}</b></span>)}
              {main.type === 'est_1rm' && main.weight && <span>from {u.show(main.weight)}×{main.reps}</span>}
            </div>
            {sel === exId && hist.length > 1 && (
              <div className="mt-4 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={hist.map((p) => ({ date: p.date.slice(5, 10), v: Number(u.show(p.value)) }))}>
                    <XAxis dataKey="date" {...axis} /><YAxis {...axis} width={40} domain={['auto', 'auto']} /><Tooltip {...tip} />
                    <Line type="monotone" dataKey="v" stroke="rgb(var(--accent))" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Charts() {
  const t = useT();
  const u = useUnits();
  const [days, setDays] = useState('90');
  const [weight, setWeight] = useState<{ date: string; weight: number; avg7: number }[]>([]);
  const [vol, setVol] = useState<{ date: string; volume: number; duration?: number }[]>([]);
  const [sleep, setSleep] = useState<{ date: string; hours: number }[]>([]);
  const [macros, setMacros] = useState<{ date: string; calories: number; protein: number }[]>([]);
  useEffect(() => {
    api<typeof weight>(`/metrics/weight?days=${days}`).then(setWeight).catch(() => {});
    api<typeof vol>(`/metrics/volume?days=${days}`).then(setVol).catch(() => {});
    api<typeof sleep>(`/metrics/sleep?days=${days}`).then(setSleep).catch(() => {});
    api<typeof macros>(`/metrics/macros?days=${days}`).then(setMacros).catch(() => {});
  }, [days]);
  // weekly volume
  const weekly = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of vol) {
      const d = new Date(v.date); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const k = d.toISOString().slice(5, 10);
      m.set(k, (m.get(k) || 0) + v.volume);
    }
    return [...m.entries()].map(([week, volume]) => ({ week, volume: Math.round(Number(u.show(volume))) }));
  }, [vol, u]);
  return (
    <div className="space-y-4">
      <Segmented value={days} onChange={setDays} options={[{ value: '30', label: '30d' }, { value: '90', label: '90d' }, { value: '365', label: '1y' }]} />
      <Heatmap dates={vol.map((v) => v.date)} />
      {weight.length > 0 ? (
        <ChartBox title={`${t('weight')} (${u.wUnit})`}>
          <LineChart data={weight.map((w) => ({ date: short(w.date), w: Number(u.show(w.weight)), avg: Number(u.show(w.avg7)) }))}>
            <CartesianGrid stroke="rgb(var(--line))" vertical={false} />
            <XAxis dataKey="date" {...axis} minTickGap={24} /><YAxis {...axis} width={40} domain={['auto', 'auto']} /><Tooltip {...tip} />
            <Line type="monotone" dataKey="w" name={t('weight')} stroke="rgb(var(--muted))" strokeWidth={0} dot={{ r: 3, fill: 'rgb(var(--muted))' }} />
            <Line type="monotone" dataKey="avg" name={t('avg7')} stroke="rgb(var(--accent))" strokeWidth={3} dot={false} />
          </LineChart>
        </ChartBox>
      ) : <Empty>{t('weight')}: {t('no_data')}</Empty>}
      {weekly.length > 0 && (
        <ChartBox title={`${t('volume')} / week (${u.wUnit})`}>
          <BarChart data={weekly}><XAxis dataKey="week" {...axis} /><YAxis {...axis} width={50} /><Tooltip {...tip} cursor={{ fill: 'rgb(var(--elevated))' }} /><Bar dataKey="volume" fill="rgb(var(--accent))" radius={[6, 6, 0, 0]} /></BarChart>
        </ChartBox>
      )}
      {sleep.length > 0 && (
        <ChartBox title={`${t('sleep')} (h)`}>
          <BarChart data={sleep.map((s) => ({ date: short(s.date), h: s.hours }))}><XAxis dataKey="date" {...axis} minTickGap={20} /><YAxis {...axis} width={30} domain={[0, 10]} /><Tooltip {...tip} cursor={{ fill: 'rgb(var(--elevated))' }} /><Bar dataKey="h" fill="rgb(var(--info))" radius={[6, 6, 0, 0]} /></BarChart>
        </ChartBox>
      )}
      {macros.length > 0 && (
        <ChartBox title={`${t('protein')} (g)`}>
          <BarChart data={macros.map((m) => ({ date: short(m.date), p: Math.round(m.protein) }))}><XAxis dataKey="date" {...axis} minTickGap={20} /><YAxis {...axis} width={36} /><Tooltip {...tip} cursor={{ fill: 'rgb(var(--elevated))' }} /><Bar dataKey="p" fill="rgb(var(--success))" radius={[6, 6, 0, 0]} /></BarChart>
        </ChartBox>
      )}
    </div>
  );
}

function Heatmap({ dates }: { dates: string[] }) {
  const set = new Set(dates);
  const weeks = 15;
  const start = new Date(); start.setDate(start.getDate() - (weeks * 7 - 1) - ((start.getDay() + 6) % 7) + 6);
  const cells: { d: string; on: boolean }[] = [];
  const s0 = new Date(); s0.setDate(s0.getDate() - weeks * 7 + 1);
  for (let i = 0; i < weeks * 7; i++) { const d = new Date(s0); d.setDate(s0.getDate() + i); const k = d.toISOString().slice(0, 10); cells.push({ d: k, on: set.has(k) }); }
  return (
    <div className="card">
      <h3 className="mb-3 text-lg font-bold">Last {weeks} weeks · {dates.length} sessions</h3>
      <div className="grid grid-flow-col grid-rows-7 gap-1" role="img" aria-label={`${dates.length} workout days`}>
        {cells.map((c) => <div key={c.d} title={c.d} className={`aspect-square rounded-[4px] ${c.on ? 'bg-accent' : 'bg-elevated'}`} />)}
      </div>
    </div>
  );
}

function History() {
  const t = useT();
  const nav = useNavigate();
  const u = useUnits();
  const [list, setList] = useState<Session[] | null>(null);
  useEffect(() => { api<Session[]>('/workouts?limit=100').then(setList).catch(() => setList([])); }, []);
  if (!list) return <Skeleton h={80} />;
  if (!list.length) return <Empty>{t('no_data')}</Empty>;
  return (
    <div className="space-y-2">
      {list.map((s) => {
        const vol = s.sets.reduce((a, x) => a + (x.weight || 0) * (x.reps || 0), 0);
        return (
          <button key={s.id} onClick={() => nav(`/sessions/${s.id}`)} className="card flex w-full items-center justify-between !py-4 text-left">
            <span>
              <span className="block text-lg font-bold">{s.name || 'Workout'}</span>
              <span className="text-[15px] text-muted">{new Date(s.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · {s.sets.length} sets{vol ? ` · ${u.show(vol)}${u.wUnit}` : ''}{s.sessionRpe ? ` · RPE ${s.sessionRpe}` : ''}</span>
            </span>
            <span className="text-muted">{Icon.chevron}</span>
          </button>
        );
      })}
    </div>
  );
}
