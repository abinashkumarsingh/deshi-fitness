import { useState } from 'react';
import { download } from '../lib/api';
import { useStore, useT } from '../lib/store';
import { PageHeader, Segmented } from '../components/ui';
import type { Settings } from '../lib/types';

export default function SettingsPage() {
  const t = useT();
  const { settings, updateSettings, setAuth } = useStore();
  const [targets, setTargets] = useState({ calorieTarget: settings.calorieTarget ?? '', proteinTarget: settings.proteinTarget ?? '', waterTargetMl: settings.waterTargetMl ?? '' });
  const set = <K extends keyof Settings>(k: K) => (v: Settings[K]) => updateSettings({ [k]: v } as Partial<Settings>);
  const saveTargets = () => updateSettings({
    calorieTarget: targets.calorieTarget === '' ? null : Number(targets.calorieTarget),
    proteinTarget: targets.proteinTarget === '' ? null : Number(targets.proteinTarget),
    waterTargetMl: targets.waterTargetMl === '' ? null : Number(targets.waterTargetMl),
  });
  const row = (label: string, el: React.ReactNode) => <div className="card space-y-3"><div className="text-lg font-bold">{label}</div>{el}</div>;

  return (
    <div className="space-y-4">
      <PageHeader title={t('settings')} back />
      {row(t('theme'), <Segmented value={settings.theme} onChange={set('theme')} options={[{ value: 'dark', label: t('dark') }, { value: 'light', label: t('light') }]} />)}
      {row(t('units'), <Segmented value={settings.units} onChange={set('units')} options={[{ value: 'metric', label: 'kg' }, { value: 'imperial', label: 'lb' }]} />)}
      {row(t('targets'), <>
        <div className="grid grid-cols-3 gap-2">
          {([['calorieTarget', 'kcal'], ['proteinTarget', 'Protein g'], ['waterTargetMl', 'Water ml']] as const).map(([k, l]) => (
            <label key={k}><span className="label">{l}</span><input inputMode="numeric" className="input" value={targets[k]} onChange={(e) => setTargets({ ...targets, [k]: e.target.value })} onBlur={saveTargets} /></label>
          ))}
        </div>
      </>)}
      {row(t('ai_enabled'), <>
        <Segmented value={settings.aiEnabled ? 'on' : 'off'} onChange={(v) => updateSettings({ aiEnabled: v === 'on' })} options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} />
        {settings.aiAvailable === false && <p className="text-[15px] text-muted">{t('ai_unavailable')} Add OPENROUTER_API_KEY or GEMINI_API_KEY to the backend.</p>}
      </>)}
      {row(t('export'), <div className="grid grid-cols-2 gap-2">
        <button className="btn-secondary" onClick={() => download('/export?format=csv', 'deshi-workouts.csv')}>CSV</button>
        <button className="btn-secondary" onClick={() => download('/export?format=json', 'deshi-export.json')}>JSON</button>
      </div>)}
      <button className="btn-ghost w-full text-danger" onClick={() => setAuth(null)}>{t('logout')}</button>
      <p className="text-center text-[14px] text-muted">{settings.user?.email}</p>
    </div>
  );
}
