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
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false as const, reason: 'no_key' };
  const system = `${PROMPTS[opts.lang === 'en' ? 'en' : 'desi']}\n${TONES[opts.tone] || ''}`;
  const user = `User context (JSON): ${JSON.stringify(opts.ctx)}
${opts.recent ? `Recent sessions: ${opts.recent}\n` : ''}Question: ${opts.question || 'What should I focus on today?'}`;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
  });

  // "AQ." keys are Vertex AI (express mode) keys; "AIza" keys are Google AI Studio keys.
  const vertex = key.startsWith('AQ.') || process.env.GEMINI_PROVIDER === 'vertex';
  const url = (m: string) => vertex
    ? `https://aiplatform.googleapis.com/v1/publishers/google/models/${encodeURIComponent(m)}:generateContent`
    : `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`;

  // Try the configured model first, then fall back if Google has retired/renamed it (404).
  const candidates = [...new Set([workingModel, process.env.GEMINI_MODEL, ...FALLBACK_MODELS].filter(Boolean) as string[])];
  let last = 'unknown';
  for (const model of candidates) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    try {
      const res = await fetch(url(model), {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body, signal: ctrl.signal,
      });
      if (res.status === 404) { last = `http_404 (${model})`; continue; }
      if (!res.ok) {
        const detail = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 160);
        console.warn(`Gemini ${model} -> ${res.status}: ${detail}`);
        return { ok: false as const, reason: res.status === 429 ? 'rate_limited' : `http_${res.status}: ${detail}` };
      }
      workingModel = model;
      const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
      const text = data.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text || '').join('').trim();
      return text ? { ok: true as const, text, model } : { ok: false as const, reason: 'empty' };
    } catch (e) {
      return { ok: false as const, reason: (e as Error).name === 'AbortError' ? 'timeout' : 'network' };
    } finally { clearTimeout(t); }
  }
  console.warn(`Gemini: no model available (${vertex ? 'vertex' : 'ai-studio'}), tried ${candidates.join(', ')}`);
  return { ok: false as const, reason: `${last} — no model found for this key` };
}

const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-2.0-flash'];
let workingModel: string | null = null;
