declare global { interface Window { __CONFIG__?: { API_URL?: string; APP_NAME?: string } } }

export const API_URL = (window.__CONFIG__?.API_URL || import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');

const KEY = 'deshi.auth';
export interface AuthState { accessToken: string; refreshToken: string; user: { id: string; email: string; name?: string | null } }

export const authStore = {
  get(): AuthState | null { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } },
  set(a: AuthState | null) { try { a ? localStorage.setItem(KEY, JSON.stringify(a)) : localStorage.removeItem(KEY); } catch { /* ignore */ } },
};

export class ApiError extends Error { constructor(public status: number, public code: string) { super(code); } }

let refreshing: Promise<boolean> | null = null;
async function refresh(): Promise<boolean> {
  const a = authStore.get();
  if (!a) return false;
  refreshing ??= fetch(`${API_URL}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: a.refreshToken }) })
    .then(async (r) => { if (!r.ok) return false; authStore.set(await r.json()); return true; })
    .catch(() => false)
    .finally(() => { refreshing = null; });
  return refreshing;
}

export let onUnauthorized: () => void = () => {};
export const setOnUnauthorized = (fn: () => void) => { onUnauthorized = fn; };

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; raw?: boolean } = {}, retry = true): Promise<T> {
  const a = authStore.get();
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: { ...(opts.body ? { 'Content-Type': 'application/json' } : {}), ...(a ? { Authorization: `Bearer ${a.accessToken}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401 && retry && a && !path.startsWith('/auth/')) {
    if (await refresh()) return api<T>(path, opts, false);
    authStore.set(null); onUnauthorized();
  }
  if (!res.ok) {
    let code = `http_${res.status}`;
    try { code = (await res.json()).error || code; } catch { /* ignore */ }
    throw new ApiError(res.status, code);
  }
  if (opts.raw) return res as unknown as T;
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function download(path: string, filename: string) {
  const res = await api<Response>(path, { raw: true });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
