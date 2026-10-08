import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useStore, useT, today } from '../lib/store';
import { Icon, PageHeader, Sheet, Stepper } from '../components/ui';
import type { Food as FoodT } from '../lib/types';

interface Log { id: string; date: string; meal: string; foodKey?: string | null; quantity?: number | null; calories?: number | null; protein?: number | null; carbs?: number | null; fat?: number | null; waterMl?: number | null }
const CATS: Record<string, string> = { roti_chawal: 'Breads & Rice', dal: 'Lentils & Beans', sabzi: 'Vegetables', protein: 'Protein', dairy: 'Dairy', snacks: 'Snacks', sweets: 'Sweets', street: 'Street Food', south_indian: 'South Indian', regional: 'Regional', supplements: 'Supplements', vrat: 'Fasting' };

export default function Food() {
  const t = useT();
  const { settings } = useStore();
  const [foods, setFoods] = useState<FoodT[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [pick, setPick] = useState<FoodT | null>(null);
  const [qty, setQty] = useState(1);
  const [custom, setCustom] = useState(false);
  const [cm, setCm] = useState({ meal: '', calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [day, setDay] = useState(today());

  const load = () => api<Log[]>('/nutrition?days=30').then(setLogs).catch(() => {});
  useEffect(() => { api<FoodT[]>('/foods').then(setFoods).catch(() => {}); load(); }, []);

  const dayLogs = logs.filter((l) => l.date.slice(0, 10) === day);
  const tot = dayLogs.reduce((a, l) => ({ cal: a.cal + (l.calories || 0), p: a.p + (l.protein || 0), c: a.c + (l.carbs || 0), f: a.f + (l.fat || 0), w: a.w + (l.waterMl || 0) }), { cal: 0, p: 0, c: 0, f: 0, w: 0 });
  const list = useMemo(() => foods.filter((f) => (cat === 'all' || f.category === cat) && (!q || f.name.toLowerCase().includes(q.toLowerCase()))), [foods, q, cat]);
  const dateIso = () => (day === today() ? new Date().toISOString() : new Date(`${day}T12:00:00`).toISOString());

  const add = async () => {
    if (!pick) return;
    await api('/nutrition', { body: { date: dateIso(), meal: `${pick.name} × ${qty} (${pick.unit})`, foodKey: pick.key, quantity: qty, calories: Math.round(pick.cal * qty), protein: +(pick.p * qty).toFixed(1), carbs: +(pick.c * qty).toFixed(1), fat: +(pick.f * qty).toFixed(1) } });
    setPick(null); setQty(1); load();
  };
  const addCustom = async () => {
    if (!cm.meal) return;
    await api('/nutrition', { body: { date: dateIso(), ...cm } });
    setCustom(false); setCm({ meal: '', calories: 0, protein: 0, carbs: 0, fat: 0 }); load();
  };
  const water = async (ml: number) => { await api('/nutrition', { body: { date: dateIso(), meal: 'Water', waterMl: ml } }); load(); };
  const del = async (id: string) => { await api(`/nutrition/${id}`, { method: 'DELETE' }); load(); };
  const shift = (n: number) => { const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() + n); setDay(d.toISOString().slice(0, 10)); };

  const calT = settings.calorieTarget, pT = settings.proteinTarget, wT = settings.waterTargetMl || 3000;
  return (
    <div className="space-y-5">
      <PageHeader title={t('food')} back />
      <div className="flex items-center justify-between">
        <button aria-label="Previous day" className="btn-ghost !px-3" onClick={() => shift(-1)}>{Icon.back}</button>
        <span className="text-lg font-bold">{day === today() ? t('today') : new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
        <button aria-label="Next day" disabled={day >= today()} className="btn-ghost !px-3" onClick={() => shift(1)}>{Icon.chevron}</button>
      </div>
      <div className="card grid grid-cols-2 gap-4">
        <Meter label={t('calories')} v={tot.cal} target={calT} unit="kcal" />
        <Meter label={t('protein')} v={Math.round(tot.p)} target={pT} unit="g" />
        <div className="col-span-2 text-[15px] font-semibold text-muted">{t('carbs')} <b className="text-fg">{Math.round(tot.c)}g</b> · {t('fat')} <b className="text-fg">{Math.round(tot.f)}g</b></div>
        <div className="col-span-2">
          <Meter label={t('water')} v={+(tot.w / 1000).toFixed(2)} target={wT / 1000} unit="L" color="bg-info" />
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[250, 500, 1000].map((ml) => <button key={ml} className="btn-secondary !min-h-[48px] !text-base" onClick={() => water(ml)}>💧 +{ml >= 1000 ? '1L' : `${ml}ml`}</button>)}
          </div>
        </div>
      </div>

      <section>
        <input className="input mb-3" placeholder={`${t('search')} — roti, dal, chicken…`} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
          {['all', ...Object.keys(CATS)].map((c) => <button key={c} onClick={() => setCat(c)} className={`chip shrink-0 ${cat === c ? 'chip-on' : ''}`}>{c === 'all' ? t('all') : CATS[c]}</button>)}
        </div>
        <ul className="max-h-[360px] divide-y divide-line overflow-y-auto rounded-2xl border border-line bg-surface">
          {list.map((f) => (
            <li key={f.key}>
              <button onClick={() => { setPick(f); setQty(1); }} className="flex min-h-[60px] w-full items-center justify-between px-4 py-2 text-left">
                <span><span className="block font-bold">{f.name}</span><span className="text-[15px] text-muted">{f.unit} · {f.cal} kcal · {f.p}g P</span></span>
                <span className="text-accent">{Icon.plus}</span>
              </button>
            </li>
          ))}
        </ul>
        <button className="btn-secondary mt-3 w-full" onClick={() => setCustom(true)}>+ Custom meal</button>
      </section>

      <section>
        <h2 className="h2 mb-3">{t('today')}</h2>
        {!dayLogs.length && <p className="text-muted">{t('no_data')}</p>}
        <ul className="space-y-2">
          {dayLogs.map((l) => (
            <li key={l.id} className="card flex items-center !py-3">
              <span className="flex-1"><span className="block font-bold">{l.meal}</span><span className="text-[15px] text-muted">{l.waterMl ? `${l.waterMl} ml` : `${l.calories ?? 0} kcal · ${l.protein ?? 0}g P`}</span></span>
              <button aria-label="Delete" onClick={() => del(l.id)} className="flex h-12 w-12 items-center justify-center text-muted">{Icon.trash}</button>
            </li>
          ))}
        </ul>
      </section>

      <Sheet open={!!pick} onClose={() => setPick(null)} title={pick?.name}>
        {pick && <>
          <Stepper big value={qty} onChange={setQty} step={0.5} min={0.5} label={`${t('quantity')} (${pick.unit})`} />
          <p className="mt-4 text-center text-xl font-semibold"><span className="num text-3xl">{Math.round(pick.cal * qty)}</span> kcal · {(pick.p * qty).toFixed(1)}g P · {(pick.c * qty).toFixed(0)}g C · {(pick.f * qty).toFixed(0)}g F</p>
          <button className="btn-primary btn-xl mt-6 w-full" onClick={add}>{t('add')}</button>
        </>}
      </Sheet>
      <Sheet open={custom} onClose={() => setCustom(false)} title="Custom meal">
        <div className="space-y-3">
          <div><label className="label">Meal</label><input className="input" value={cm.meal} onChange={(e) => setCm({ ...cm, meal: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            {(['calories', 'protein', 'carbs', 'fat'] as const).map((k) => (
              <div key={k}><label className="label">{t(k)}</label><input inputMode="decimal" className="input" value={cm[k] || ''} onChange={(e) => setCm({ ...cm, [k]: Number(e.target.value) || 0 })} /></div>
            ))}
          </div>
          <button className="btn-primary btn-xl w-full" onClick={addCustom}>{t('add')}</button>
        </div>
      </Sheet>
    </div>
  );
}

function Meter({ label, v, target, unit, color = 'bg-accent' }: { label: string; v: number; target?: number | null; unit: string; color?: string }) {
  const pct = target ? Math.min(100, (v / target) * 100) : 0;
  return (
    <div>
      <div className="text-[14px] font-semibold uppercase text-muted">{label}</div>
      <div className="num text-[36px] leading-tight">{v}<span className="ml-1 text-base font-semibold text-muted">{target ? `/ ${target}` : ''} {unit}</span></div>
      {target ? <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-elevated"><div className={`h-full ${color}`} style={{ width: `${pct}%` }} /></div> : null}
    </div>
  );
}
