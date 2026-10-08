import { and, desc, eq, gte, inArray, isNull, or } from 'drizzle-orm';
import { db, schema } from '../db';
import { daysAgo } from './util';
import { aiGenerate } from './ai';

const S = schema;

export interface PlanItem { exerciseId: string | null; name: string; sets: number; reps: number | null; weight: number | null; durationSec: number | null; reason: string }

const SYSTEM = `You are an expert strength & conditioning coach inside a workout-logging app.
Your ONLY job: recommend which exercises the member should do in today's session, based strictly on their logged workout history and saved routines.

Rules:
- Use only exercise names from the provided EXERCISE LIBRARY (copy names exactly).
- Balance muscle groups: prioritise groups that have rested longest; avoid groups trained hard in the last 48 hours.
- Respect the member's goal and their usual split/routine if they have one scheduled today.
- Apply progressive overload from their last performance (e.g. +2.5 kg or +1 rep when last top set looked manageable, RPE <= 8). Never jump more than ~5%.
- If there is little or no history, suggest a balanced beginner full-body session with conservative loads (weight null if unknown).
- 4 to 6 exercises. Compounds first.
- Do NOT give nutrition, sleep, supplement, lifestyle, or medical advice. Exercises only.
- Write in plain English.

Respond with JSON only, no markdown, exactly this shape:
{"focus":"short session title, e.g. Pull + Hamstrings","exercises":[{"name":"Barbell Row","sets":4,"reps":8,"weight_kg":60,"duration_sec":null,"reason":"one short sentence"}]}`;

async function buildHistory(userId: string) {
  const sessions = await db.select().from(S.workoutSessions)
    .where(and(eq(S.workoutSessions.userId, userId), gte(S.workoutSessions.date, daysAgo(28))))
    .orderBy(desc(S.workoutSessions.date)).limit(20);
  const sets = sessions.length ? await db.select().from(S.workoutSets).where(inArray(S.workoutSets.sessionId, sessions.map((s) => s.id))) : [];
  const library = await db.select().from(S.exercises).where(or(isNull(S.exercises.userId), eq(S.exercises.userId, userId)));
  const byId = new Map(library.map((e) => [e.id, e]));

  // Per-session summary
  const history = sessions.map((s) => {
    const ss = sets.filter((x) => x.sessionId === s.id && !x.isWarmup);
    const exIds = [...new Set(ss.map((x) => x.exerciseId))];
    return {
      date: s.date.toISOString().slice(0, 10),
      daysAgo: Math.floor((Date.now() - s.date.getTime()) / 86400000),
      name: s.name, sessionRpe: s.sessionRpe,
      exercises: exIds.map((id) => {
        const e = byId.get(id);
        const xs = ss.filter((x) => x.exerciseId === id).sort((a, b) => a.setNumber - b.setNumber);
        return {
          name: e?.name || 'Unknown', muscle: e?.muscleGroup,
          sets: xs.map((x) => [x.weight ? `${x.weight}kg` : '', x.reps ? `x${x.reps}` : '', x.durationSec ? `${x.durationSec}s` : '', x.distanceM ? `${x.distanceM}m` : '', x.rpe ? `@${x.rpe}` : ''].join('')).join(', '),
        };
      }),
    };
  });

  // Days since each muscle group was trained
  const lastTrained: Record<string, number> = {};
  for (const h of history) for (const e of h.exercises) if (e.muscle && lastTrained[e.muscle] === undefined) lastTrained[e.muscle] = h.daysAgo;

  const routines = await db.select().from(S.routines).where(eq(S.routines.userId, userId));
  const blocks = routines.length ? await db.select().from(S.routineBlocks).where(inArray(S.routineBlocks.routineId, routines.map((r) => r.id))) : [];
  const rex = blocks.length ? await db.select().from(S.routineExercises).where(inArray(S.routineExercises.blockId, blocks.map((b) => b.id))) : [];
  const dow = new Date().getDay();
  const routineSummary = routines.map((r) => ({
    name: r.name, type: r.type, scheduledToday: r.days.includes(dow),
    days: r.days.map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]),
    exercises: blocks.filter((b) => b.routineId === r.id).sort((a, b) => a.order - b.order)
      .flatMap((b) => rex.filter((x) => x.blockId === b.id).sort((a, b) => a.order - b.order).map((x) => `${byId.get(x.exerciseId)?.name}${x.sets ? ` ${x.sets}x${x.reps ?? ''}` : ''}`)),
  }));

  const [goal] = await db.select().from(S.goals).where(and(eq(S.goals.userId, userId), eq(S.goals.active, true), eq(S.goals.priority, 'primary')));
  return { history, lastTrained, routineSummary, goal: goal?.type || null, library };
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{'); const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return null; }
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export async function suggestExercises(userId: string) {
  const h = await buildHistory(userId);
  const libraryNames = h.library.map((e) => `${e.name} (${e.muscleGroup || e.category})`).join('; ');
  const user = `TODAY: ${new Date().toDateString()}
GOAL: ${h.goal || 'general fitness'}
DAYS SINCE EACH MUSCLE GROUP WAS LAST TRAINED: ${JSON.stringify(h.lastTrained)}
SAVED ROUTINES: ${JSON.stringify(h.routineSummary)}
WORKOUT HISTORY (last 28 days, newest first): ${JSON.stringify(h.history)}
EXERCISE LIBRARY: ${libraryNames}`;

  const r = await aiGenerate(SYSTEM, user, 2048);
  if (!r.ok) return r;
  const parsed = extractJson(r.text) as { focus?: string; exercises?: { name: string; sets?: number; reps?: number | null; weight_kg?: number | null; duration_sec?: number | null; reason?: string }[] } | null;
  if (!parsed?.exercises?.length) return { ok: true as const, text: r.text, plan: [] as PlanItem[], focus: null, model: r.model };

  const lib = new Map(h.library.map((e) => [norm(e.name), e]));
  const plan: PlanItem[] = parsed.exercises.slice(0, 8).map((x) => {
    const e = lib.get(norm(x.name)) || [...lib.entries()].find(([k]) => k.includes(norm(x.name)) || norm(x.name).includes(k))?.[1];
    return {
      exerciseId: e?.id ?? null, name: e?.name || x.name,
      sets: Math.max(1, Math.min(10, Number(x.sets) || 3)),
      reps: x.reps != null ? Number(x.reps) || null : null,
      weight: x.weight_kg != null ? Number(x.weight_kg) || null : null,
      durationSec: x.duration_sec != null ? Number(x.duration_sec) || null : null,
      reason: String(x.reason || '').slice(0, 200),
    };
  });
  return { ok: true as const, text: '', plan, focus: parsed.focus || null, model: r.model };
}
