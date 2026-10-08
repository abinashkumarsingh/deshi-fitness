import { useEffect, useState } from 'react';
import { Line, LineChart, XAxis, YAxis, Tooltip } from 'recharts';
import { api } from '../lib/api';
import { useT, useUnits } from '../lib/store';
import { Icon, PageHeader, Stepper } from '../components/ui';
import { ChartBox, axis, tip } from './Progress';

interface BM { id: string; date: string; weight?: number | null; bodyFat?: number | null; waist?: number | null; chest?: number | null; arms?: number | null; thighs?: number | null; hips?: number | null }
const MEAS = ['waist', 'chest', 'arms', 'thighs', 'hips'] as const;

export default function Body() {
  const t = useT();
  const u = useUnits();
  const [rows, setRows] = useState<BM[]>([]);
  const [series, setSeries] = useState<{ date: string; weight: number; avg7: number }[]>([]);
  const [w, setW] = useState(70);
  const [bf, setBf] = useState('');
  const [m, setM] = useState<Record<string, string>>({});
  const [more, setMore] = useState(false);

  const load = () => {
    api<BM[]>('/body?days=365').then((r) => { setRows(r); const last = r.find((x) => x.weight); if (last?.weight) setW(Number(u.show(last.weight))); }).catch(() => {});
    api<typeof series>('/metrics/weight?days=90').then(setSeries).catch(() => {});
  };
  useEffect(load, []); // eslint-disable-line

  const save = async () => {
    const body: Record<string, unknown> = { weight: u.toKg(w) };
    if (bf) body.bodyFat = Number(bf);
    for (const k of MEAS) if (m[k]) body[k] = Number(m[k]);
    await api('/body', { body });
    setBf(''); setM({}); load();
  };
  const del = async (id: string) => { await api(`/body/${id}`, { method: 'DELETE' }); load(); };
  const latest = series[series.length - 1];

  return (
    <div className="space-y-5">
      <PageHeader title={t('body')} back />
      {latest && (
        <div className="card text-center">
          <div className="text-[14px] font-semibold uppercase text-muted">{t('avg7')}</div>
          <div className="num text-big">{u.show(latest.avg7)}<span className="ml-1 text-2xl text-muted">{u.wUnit}</span></div>
        </div>
      )}
      <div className="card space-y-4">
        <Stepper big value={w} onChange={setW} step={u.imp ? 0.5 : 0.1} unit={u.wUnit} label={t('weight')} />
        <button className="btn-ghost w-full text-muted" onClick={() => setMore(!more)}>{more ? '−' : '+'} Body fat & measurements</button>
        {more && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">{t('body_fat')}</label><input inputMode="decimal" className="input" value={bf} onChange={(e) => setBf(e.target.value)} /></div>
            {MEAS.map((k) => <div key={k}><label className="label capitalize">{k === 'waist' ? t('waist') : k}</label><input inputMode="decimal" className="input" value={m[k] || ''} onChange={(e) => setM({ ...m, [k]: e.target.value })} /></div>)}
          </div>
        )}
        <button className="btn-primary btn-xl w-full" onClick={save}>{t('save')}</button>
      </div>
      {series.length > 1 && (
        <ChartBox title={`${t('weight')} · ${t('avg7')}`}>
          <LineChart data={series.map((s) => ({ date: s.date.slice(5), w: Number(u.show(s.weight)), a: Number(u.show(s.avg7)) }))}>
            <XAxis dataKey="date" {...axis} minTickGap={24} /><YAxis {...axis} width={40} domain={['auto', 'auto']} /><Tooltip {...tip} />
            <Line dataKey="w" stroke="rgb(var(--muted))" strokeWidth={0} dot={{ r: 3, fill: 'rgb(var(--muted))' }} />
            <Line dataKey="a" stroke="rgb(var(--accent))" strokeWidth={3} dot={false} />
          </LineChart>
        </ChartBox>
      )}
      <ul className="space-y-2">
        {rows.slice(0, 30).map((r) => (
          <li key={r.id} className="card flex items-center !py-3">
            <span className="flex-1">
              <span className="num text-2xl">{r.weight ? `${u.show(r.weight)} ${u.wUnit}` : '—'}</span>
              <span className="block text-[15px] text-muted">{new Date(r.date).toLocaleDateString()}{r.bodyFat ? ` · ${r.bodyFat}% BF` : ''}{MEAS.filter((k) => r[k]).map((k) => ` · ${k} ${r[k]}`).join('')}</span>
            </span>
            <button aria-label="Delete" onClick={() => del(r.id)} className="flex h-12 w-12 items-center justify-center text-muted">{Icon.trash}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
