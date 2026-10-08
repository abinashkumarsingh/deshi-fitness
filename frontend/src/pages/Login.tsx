import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError, AuthState, API_URL } from '../lib/api';
import { useStore, useT } from '../lib/store';

export default function Login() {
  const t = useT();
  const setAuth = useStore((s) => s.setAuth);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [regOpen, setRegOpen] = useState(true);

  useEffect(() => {
    api<{ hasUsers: boolean; registrationOpen: boolean }>('/auth/status')
      .then((s) => { setRegOpen(s.registrationOpen); if (!s.hasUsers && s.registrationOpen) setMode('register'); })
      .catch(() => setErr(`Can't reach API at ${API_URL}`));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const a = await api<AuthState>(`/auth/${mode}`, { body: mode === 'register' ? { email, password, name } : { email, password } });
      setAuth(a);
    } catch (e) {
      const c = e instanceof ApiError ? e.code : 'network';
      setErr({ invalid_credentials: 'Wrong email or password', email_taken: 'Email already registered', registration_closed: 'Sign-ups are closed', validation: 'Check email and password (8+ chars)' }[c] || `Error: ${c}`);
    } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-10">
        <div className="display text-[48px] leading-none">Deshi<span className="grad-text">.</span></div>
        <p className="mt-2 text-xl text-muted">Fitness tracker · Log it, lift it.</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        {mode === 'register' && (
          <div><label className="label" htmlFor="name">{t('name')}</label><input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>
        )}
        <div><label className="label" htmlFor="email">{t('email')}</label><input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
        <div>
          <label className="label" htmlFor="pw">{t('password')}</label>
          <input id="pw" type="password" required minLength={8} className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          {mode === 'register' && <p className="mt-1 text-[15px] text-muted">{t('password_hint')}</p>}
        </div>
        {err && <p role="alert" className="rounded-xl bg-danger/15 p-3 font-semibold text-danger">{err}</p>}
        <button disabled={busy} className="btn-primary btn-xl w-full">{mode === 'login' ? t('login') : t('register')}</button>
        {regOpen && (
          <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="btn-ghost w-full text-muted">
            {mode === 'login' ? t('need_account') : t('have_account')}
          </button>
        )}
      </form>
    </div>
  );
}
