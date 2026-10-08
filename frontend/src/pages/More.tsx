import { useStore, useT } from '../lib/store';
import { ListLink } from '../components/ui';

export default function More() {
  const t = useT();
  const { settings } = useStore();
  return (
    <div className="space-y-3">
      <h1 className="h1 pt-2 pb-2">{t('nav_more')}</h1>
      <ListLink to="/food" title={`🍛 ${t('food')}`} sub="Indian food DB · macros · water" />
      <ListLink to="/body" title={`⚖️ ${t('body')}`} sub={`${t('weight')} · ${t('body_fat')} · measurements`} />
      <ListLink to="/sleep" title={`😴 ${t('sleep')}`} sub={t('sleep_debt')} />
      <ListLink to="/goals" title={`🎯 ${t('goals')}`} />
      <ListLink to="/routines" title={`📋 ${t('routines')}`} />
      <ListLink to="/exercises" title={`🏋️ ${t('exercises')}`} />
      <ListLink to="/warmups" title={`🔥 ${t('warmups')}`} sub={t('ramp_up')} />
      <ListLink to="/settings" title={`⚙️ ${t('settings')}`} sub={settings.user?.email || ''} />
    </div>
  );
}
