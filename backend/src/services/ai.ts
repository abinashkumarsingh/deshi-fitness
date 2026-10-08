import type { Ctx } from './suggestions';

const PROMPTS: Record<string, string> = {
  desi: `You are a friendly Indian fitness coach.
Speak in casual Hinglish (Hindi + English mix, Roman script).
Use words like bhai, yaar, mast, badhiya, chalo.
Be motivating but not cheesy. Suggest Indian foods (roti, dal, paneer, chawal) when food is relevant.
Keep it short and practical: max 4 short bullet points. Never be overly formal.
Safety first: if sleep is low or fatigue is high, recommend backing off. Do not give medical advice.`,
  en: `You are a professional fitness coach.
Be clear, concise, and practical. Use evidence-based recommendations.
Keep suggestions short and actionable: max 4 short bullet points.
Safety first: if sleep is low or fatigue is high, recommend backing off. Do not give medical advice.`,
};

const TONES: Record<string, string> = {
  coach: 'Tone: strict coach, direct.',
  bhai: 'Tone: casual gym bhai.',
  dost: 'Tone: warm, supportive friend.',
  trainer: 'Tone: professional trainer.',
};

export async function aiSuggest(opts: { lang: string; tone: string; ctx: Ctx; question?: string; recent?: string }) {
  const orKey = process.env.OPENROUTER_API_KEY || (process.env.GEMINI_API_KEY?.startsWith('sk-or-') ? process.env.GEMINI_API_KEY : undefined);
  const key = process.env.GEMINI_API_KEY;
  if (!orKey && !key) return { ok: false as const, reason: 'no_key' };
  const system = `${PROMPTS[opts.lang === 'en' ? 'en' : 'desi']}\n${TONES[opts.tone] || ''}`;
  const user = `User context (JSON): ${JSON.stringify(opts.ctx)}
${opts.recent ? `Recent sessions: ${opts.recent}\n` : ''}Question: ${opts.question || 'What should I focus on today?'}`;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
  });

  if (orKey) return openRouter(orKey, system, user);
  if (!key) return { ok: false as const, reason: 'no_key' };

  type Provider = 'studio' | 'vertex';
  const order: Provider[] = process.env.GEMINI_PROVIDER === 'vertex' ? ['vertex'] : process.env.GEMINI_PROVIDER === 'studio' ? ['studio'] : ['studio', 'vertex'];
  const url = (p: Provider, m: string) => p === 'vertex'
    ? `https://aiplatform.googleapis.com/v1/publishers/google/models/${encodeURIComponent(m)}:generateContent`
    : `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`;

  const errors: string[] = [];
  for (const provider of order) {
    const discovered = provider === 'studio' ? await discoverModels(key) : [];
    const candidates = [...new Set([working[provider], process.env.GEMINI_MODEL, ...discovered, ...FALLBACK_MODELS].filter(Boolean) as string[])].slice(0, 8);
    for (const model of candidates) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 25000);
      try {
        const res = await fetch(url(provider, model), {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body, signal: ctrl.signal,
        });
        if (res.status === 429) return { ok: false as const, reason: 'rate_limited' };
        if (res.status === 404) { errors.push(`${provider}/${model}: 404`); continue; }
        if (!res.ok) {
          const detail = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200);
          console.warn(`Gemini ${provider}/${model} -> ${res.status}: ${detail}`);
          errors.push(`${provider}: http_${res.status}: ${detail}`);
          break; // auth/billing problem with this provider — try the next provider
        }
        working[provider] = model;
        const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
        const text = data.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text || '').join('').trim();
        return text ? { ok: true as const, text, model } : { ok: false as const, reason: 'empty' };
      } catch (e) {
        errors.push(`${provider}/${model}: ${(e as Error).name === 'AbortError' ? 'timeout' : 'network'}`);
        break;
      } finally { clearTimeout(t); }
    }
  }
  console.warn('Gemini failed:', errors.join(' | '));
  // Prefer showing the AI Studio error (the free path) since that is the one the user can usually fix.
  return { ok: false as const, reason: errors.find((e) => e.startsWith('studio: http')) || errors[errors.length - 1] || 'unknown' };
}

/** Ask AI Studio which models this key can use, so retired model names never break the app. */
let discoveredCache: { at: number; models: string[] } | null = null;
async function discoverModels(key: string): Promise<string[]> {
  if (discoveredCache && Date.now() - discoveredCache.at < 6 * 3600 * 1000) return discoveredCache.models;
  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key } });
    if (!res.ok) return [];
    const data = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
    const names = (data.models || [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''))
      .filter((n) => /gemini/.test(n) && !/(image|tts|audio|live|embedding|vision|exp|preview)/.test(n));
    const rank = (n: string) => (/flash-latest$/.test(n) ? 0 : /flash$/.test(n) ? 1 : /flash/.test(n) && !/lite/.test(n) ? 2 : /flash-lite/.test(n) ? 3 : 4);
    const models = names.sort((a, b) => rank(a) - rank(b) || b.localeCompare(a)).slice(0, 5);
    discoveredCache = { at: Date.now(), models };
    console.log('Gemini models available:', models.join(', '));
    return models;
  } catch { return []; }
}

const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
const working: Record<string, string | null> = { studio: null, vertex: null };

/* ---------------- OpenRouter (OpenAI-compatible) ---------------- */
let orFreeCache: { at: number; models: string[] } | null = null;
async function openRouterFreeModels(): Promise<string[]> {
  if (orFreeCache && Date.now() - orFreeCache.at < 6 * 3600 * 1000) return orFreeCache.models;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models');
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: { id: string; pricing?: { prompt?: string; completion?: string } }[] };
    const free = (data.data || []).filter((m) => m.id.endsWith(':free') || (m.pricing?.prompt === '0' && m.pricing?.completion === '0')).map((m) => m.id);
    const rank = (id: string) => (/google\/gemini/.test(id) ? 0 : /deepseek/.test(id) ? 1 : /llama/.test(id) ? 2 : /qwen|mistral/.test(id) ? 3 : 4);
    const models = free.sort((a, b) => rank(a) - rank(b)).slice(0, 6);
    orFreeCache = { at: Date.now(), models };
    console.log('OpenRouter free models:', models.join(', '));
    return models;
  } catch { return []; }
}

let orWorking: string | null = null;
async function openRouter(key: string, system: string, user: string) {
  const configured = process.env.OPENROUTER_MODEL;
  const candidates = [...new Set([orWorking, configured, ...(await openRouterFreeModels()), 'openrouter/auto'].filter(Boolean) as string[])].slice(0, 7);
  const errors: string[] = [];
  for (const model of candidates) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'X-Title': 'Deshi Fitness' },
        body: JSON.stringify({ model, temperature: 0.7, max_tokens: 1200, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
        signal: ctrl.signal,
      });
      if (res.status === 401) return { ok: false as const, reason: 'openrouter: invalid API key (401)' };
      if (!res.ok) {
        const detail = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200);
        errors.push(`${model}: http_${res.status}: ${detail}`);
        console.warn(`OpenRouter ${model} -> ${res.status}: ${detail}`);
        continue; // model unavailable / rate-limited / needs credits — try next model
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) { errors.push(`${model}: empty${data.error?.message ? ` (${data.error.message})` : ''}`); continue; }
      orWorking = model;
      return { ok: true as const, text, model };
    } catch (e) {
      errors.push(`${model}: ${(e as Error).name === 'AbortError' ? 'timeout' : 'network'}`);
    } finally { clearTimeout(t); }
  }
  return { ok: false as const, reason: `openrouter: ${errors[0] || 'no model worked'}` };
}
