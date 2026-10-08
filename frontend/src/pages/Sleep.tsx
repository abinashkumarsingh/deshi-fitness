import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useT } from '../lib/store';
import { Icon, PageHeader, Stat, Stepper } from '../components/ui';

interface SL { id: string; date: string; hours: number; bedtime?: string | null; wakeTime?: string | null; quality?: number | null }

function hoursBetween(bed: string, wake: string) {
  const [bh, bm] = bed.split(':').map(Number), [wh, wm] = wake.split(':').map(Number);
  let mins = wh * 60 + wm - (bh * 60 + bm); if (mins <= 0) mins += 1440;
  return Math.round((mins / 60) * 4) / 4;
}

export default function Sleep() {
  const t = useT();
  const [rows, setRows] = useState<SL[]>([]);
  const [hours, setHours] = useState(7.5);
  const [bed, setBed] = useState('23:00');
  const [wake, setWake] = useState('06:30');
  const [q, setQ] = useState(3);
  const load = () => api<SL[]>('/sleep?days=60').then(setRows).catch(() => {});
  useEffect(() => { load(); }, []);

  const last7 = rows.filter((r) => new Date(r.date) > new Date(Date.now() - 7 * 86400000));
  const avg = last7.length ? last7.reduce((a, r) => a + r.hours, 0) / last7.length : null;
  const debt = last7.reduce((a, r) => a + Math.max(0, 8 - r.hours), 0);

  const save = async () => { await api('/sleep', { body: { hours, bedtime: bed, wakeTime: wake, quality: q } }); load(); };
  const del = async (id: string) => { await api(`/sleep/${id}`, { method: 'DELETE' }); load(); };

  return (
    <div className="space-y-5">
      <PageHeader title={t('sleep')} back />
      <div className="grid grid-cols-2 gap-3">
        <Stat label={t('avg7')} value={avg !== null ? avg.toFixed(1) : '–'} unit="h" accent={avg !== null && avg >= 7} />
        <Stat label={t('sleep_debt')} value={debt.toFixed(1)} unit="h" />
      </div>
      <div className="card space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="bed">{t('bedtime')}</label><input id="bed" type="time" className="input" value={bed} onChange={(e) => { setBed(e.target.value); setHours(hoursBetween(e.target.value, wake)); }} /></div>
          <div><label className="label" htmlFor="wake">{t('wake_time')}</label><input id="wake" type="time" className="input" value={wake} onChange={(e) => { setWake(e.target.value); setHours(hoursBetween(bed, e.target.value)); }} /></div>
        </div>
        <Stepper big value={hours} onChange={setHours} step={0.25} unit="h" label={t('hours')} />
        <div>
          <div className="label">{t('quality')}</div>
          <div className="grid grid-cols-5 gap-2">{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setQ(n)} className={`chip justify-center ${q === n ? 'chip-on' : ''}`}>{n}</button>)}</div>
        </div>
        <button className="btn-primary btn-xl w-full" onClick={save}>{t('save')}</button>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="card flex items-center !py-3">
            <span className="flex-1"><span className="num text-2xl">{r.hours}h</span>
              <span className="block text-[15px] text-muted">{new Date(r.date).toLocaleDateString()}{r.bedtime ? ` · ${r.bedtime}–${r.wakeTime}` : ''}{r.quality ? ` · ${'★'.repeat(r.quality)}` : ''}</span></span>
            <button aria-label="Delete" onClick={() => del(r.id)} className="flex h-12 w-12 items-center justify-center text-muted">{Icon.trash}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
