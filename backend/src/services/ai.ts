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
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const system = `${PROMPTS[opts.lang === 'en' ? 'en' : 'desi']}\n${TONES[opts.tone] || ''}`;
  const user = `User context (JSON): ${JSON.stringify(opts.ctx)}
${opts.recent ? `Recent sessions: ${opts.recent}\n` : ''}Question: ${opts.question || 'What should I focus on today?'}`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) return { ok: false as const, reason: res.status === 429 ? 'rate_limited' : `http_${res.status}` };
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
    return text ? { ok: true as const, text } : { ok: false as const, reason: 'empty' };
  } catch (e) {
    return { ok: false as const, reason: (e as Error).name === 'AbortError' ? 'timeout' : 'network' };
  } finally { clearTimeout(t); }
}
