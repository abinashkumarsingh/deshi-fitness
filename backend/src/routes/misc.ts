import { Router } from 'express';
import { z } from 'zod';
import { and, asc, desc, eq, gte, inArray } from 'drizzle-orm';
import { db, schema } from '../db';
import { ah, daysAgo, HttpError } from '../services/util';
import { uid } from '../services/auth';
import { detectPRs } from '../services/prs';
import { buildContext, todaySuggestions } from '../services/suggestions';
import { suggestExercises } from '../services/coach';

const S = schema;

/* ---------- PRs ---------- */
export const prsRouter = Router();
prsRouter.get('/', ah(async (req, res) => {
  const rows = await db.select().from(S.personalRecords).where(eq(S.personalRecords.userId, uid(req))).orderBy(desc(S.personalRecords.date));
  // board = best per exercise+type
  const best = new Map<string, typeof rows[number]>();
  for (const r of rows) {
    const k = `${r.exerciseId}|${r.type}`;
    const lowerBetter = r.type.startsWith('fastest');
    const cur = best.get(k);
    if (!cur || (lowerBetter ? r.value < cur.value : r.value > cur.value)) best.set(k, r);
  }
  res.json({ board: [...best.values()], history: rows });
}));
prsRouter.get('/:exerciseId', ah(async (req, res) => {
  res.json(await db.select().from(S.personalRecords).where(and(eq(S.personalRecords.userId, uid(req)), eq(S.personalRecords.exerciseId, req.params.exerciseId))).orderBy(asc(S.personalRecords.date)));
}));
prsRouter.post('/detect', ah(async (req, res) => {
  const { sessionId } = z.object({ sessionId: z.string() }).parse(req.body);
  res.json(await detectPRs(uid(req), sessionId));
}));

/* ---------- Goals ---------- */
export const goalsRouter = Router();
const goalSchema = z.object({
  type: z.string().max(40), priority: z.enum(['primary', 'secondary']), startDate: z.coerce.date().default(() => new Date()),
  targetDate: z.coerce.date().nullish(), eventDate: z.coerce.date().nullish(), phaseName: z.string().max(60).nullish(),
  targetWeight: z.number().positive().nullish(), objective: z.any().nullish(), constraints: z.any().nullish(), active: z.boolean().default(true),
});
goalsRouter.get('/', ah(async (req, res) => {
  res.json(await db.select().from(S.goals).where(eq(S.goals.userId, uid(req))).orderBy(desc(S.goals.startDate)));
}));
goalsRouter.post('/', ah(async (req, res) => {
  const body = goalSchema.parse(req.body);
  // only one active goal per priority slot
  if (body.active) await db.update(S.goals).set({ active: false }).where(and(eq(S.goals.userId, uid(req)), eq(S.goals.priority, body.priority)));
  const [row] = await db.insert(S.goals).values({ ...body, userId: uid(req) }).returning();
  res.status(201).json(row);
}));
goalsRouter.put('/:id', ah(async (req, res) => {
  const body = goalSchema.partial().parse(req.body);
  const [row] = await db.update(S.goals).set(body).where(and(eq(S.goals.id, req.params.id), eq(S.goals.userId, uid(req)))).returning();
  if (!row) throw new HttpError(404, 'not_found');
  res.json(row);
}));
goalsRouter.delete('/:id', ah(async (req, res) => {
  await db.delete(S.goals).where(and(eq(S.goals.id, req.params.id), eq(S.goals.userId, uid(req))));
  res.status(204).end();
}));

/* ---------- Suggestions + AI ---------- */
async function lang(userId: string) {
  const [s] = await db.select().from(S.userSettings).where(eq(S.userSettings.userId, userId));
  return { lang: 'en', tone: 'trainer', aiEnabled: s?.aiEnabled ?? true };
}
export const suggestionsRouter = Router();
suggestionsRouter.get('/today', ah(async (req, res) => {
  const { lang: l } = await lang(uid(req));
  res.json(await todaySuggestions(uid(req), l));
}));
suggestionsRouter.post('/:id/:act(accept|dismiss)', ah(async (req, res) => {
  const set = req.params.act === 'accept' ? { accepted: true } : { dismissed: true };
  const [row] = await db.update(S.suggestions).set(set).where(and(eq(S.suggestions.id, req.params.id), eq(S.suggestions.userId, uid(req)))).returning();
  if (!row) throw new HttpError(404, 'not_found');
  res.json(row);
}));

export const aiRouter = Router();
aiRouter.post('/suggest', ah(async (req, res) => {
  const pref = await lang(uid(req));
  if (!pref.aiEnabled) return res.json({ ok: false, reason: 'disabled' });
  res.json(await suggestExercises(uid(req)));
}));

/* ---------- Simple logs: body, sleep, nutrition ---------- */
function crud<T extends typeof S.bodyMetrics | typeof S.sleepLogs | typeof S.nutritionLogs>(table: T, shape: z.ZodRawShape) {
  const r = Router();
  const sch = z.object({ date: z.coerce.date().default(() => new Date()), ...shape });
  const t = table as typeof S.bodyMetrics; // shared columns: id, userId, date
  r.get('/', ah(async (req, res) => {
    const days = z.coerce.number().int().min(1).max(3650).default(90).parse(req.query.days ?? 90);
    res.json(await db.select().from(t).where(and(eq(t.userId, uid(req)), gte(t.date, daysAgo(days)))).orderBy(desc(t.date)));
  }));
  r.post('/', ah(async (req, res) => {
    const body = sch.parse(req.body);
    const [row] = await db.insert(t).values({ ...(body as object), userId: uid(req) } as typeof t.$inferInsert).returning();
    res.status(201).json(row);
  }));
  r.put('/:id', ah(async (req, res) => {
    const body = sch.partial().parse(req.body);
    const [row] = await db.update(t).set(body as object).where(and(eq(t.id, req.params.id), eq(t.userId, uid(req)))).returning();
    if (!row) throw new HttpError(404, 'not_found');
    res.json(row);
  }));
  r.delete('/:id', ah(async (req, res) => {
    await db.delete(t).where(and(eq(t.id, req.params.id), eq(t.userId, uid(req))));
    res.status(204).end();
  }));
  return r;
}
const n = () => z.number().finite().nonnegative().nullish();
export const bodyRouter = crud(S.bodyMetrics, { weight: n(), bodyFat: n(), waist: n(), chest: n(), arms: n(), thighs: n(), hips: n(), notes: z.string().max(500).nullish() });
export const sleepRouter = crud(S.sleepLogs, { hours: z.number().min(0).max(24), bedtime: z.string().max(10).nullish(), wakeTime: z.string().max(10).nullish(), quality: z.number().int().min(1).max(5).nullish() });
export const nutritionRouter = crud(S.nutritionLogs, {
  meal: z.string().min(1).max(120), foodKey: z.string().max(60).nullish(), quantity: n(), calories: z.number().int().nonnegative().nullish(),
  protein: n(), carbs: n(), fat: n(), waterMl: z.number().int().nonnegative().nullish(), notes: z.string().max(500).nullish(),
});

/* ---------- Metrics (aggregates for charts) ---------- */
export const metricsRouter = Router();
const rangeDays = (q: unknown) => z.coerce.number().int().min(7).max(3650).default(90).parse(q ?? 90);
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

metricsRouter.get('/weight', ah(async (req, res) => {
  const rows = await db.select().from(S.bodyMetrics).where(and(eq(S.bodyMetrics.userId, uid(req)), gte(S.bodyMetrics.date, daysAgo(rangeDays(req.query.days) + 7)))).orderBy(asc(S.bodyMetrics.date));
  const pts = rows.filter((r) => r.weight);
  res.json(pts.map((p) => {
    const win = pts.filter((q) => q.date <= p.date && q.date > new Date(p.date.getTime() - 7 * 86400000));
    return { date: dayKey(p.date), weight: p.weight, avg7: Math.round((win.reduce((a, q) => a + q.weight!, 0) / win.length) * 10) / 10, bodyFat: p.bodyFat, waist: p.waist };
  }));
}));
metricsRouter.get('/sleep', ah(async (req, res) => {
  const rows = await db.select().from(S.sleepLogs).where(and(eq(S.sleepLogs.userId, uid(req)), gte(S.sleepLogs.date, daysAgo(rangeDays(req.query.days))))).orderBy(asc(S.sleepLogs.date));
  res.json(rows.map((r) => ({ date: dayKey(r.date), hours: r.hours, quality: r.quality })));
}));
metricsRouter.get('/macros', ah(async (req, res) => {
  const rows = await db.select().from(S.nutritionLogs).where(and(eq(S.nutritionLogs.userId, uid(req)), gte(S.nutritionLogs.date, daysAgo(rangeDays(req.query.days)))));
  const m = new Map<string, { date: string; calories: number; protein: number; carbs: number; fat: number; waterMl: number }>();
  for (const r of rows) {
    const k = dayKey(r.date);
    const e = m.get(k) || { date: k, calories: 0, protein: 0, carbs: 0, fat: 0, waterMl: 0 };
    e.calories += r.calories || 0; e.protein += r.protein || 0; e.carbs += r.carbs || 0; e.fat += r.fat || 0; e.waterMl += r.waterMl || 0;
    m.set(k, e);
  }
  res.json([...m.values()].sort((a, b) => a.date.localeCompare(b.date)));
}));
metricsRouter.get('/volume', ah(async (req, res) => {
  const sessions = await db.select().from(S.workoutSessions).where(and(eq(S.workoutSessions.userId, uid(req)), gte(S.workoutSessions.date, daysAgo(rangeDays(req.query.days))))).orderBy(asc(S.workoutSessions.date));
  const sets = sessions.length ? await db.select().from(S.workoutSets).where(inArray(S.workoutSets.sessionId, sessions.map((s) => s.id))) : [];
  const exerciseId = req.query.exerciseId as string | undefined;
  res.json(sessions.map((s) => {
    const ss = sets.filter((x) => x.sessionId === s.id && !x.isWarmup && (!exerciseId || x.exerciseId === exerciseId));
    return {
      date: dayKey(s.date), sessionId: s.id, name: s.name, duration: s.duration, rpe: s.sessionRpe,
      volume: ss.reduce((a, x) => a + (x.weight || 0) * (x.reps || 0), 0), sets: ss.length,
      topWeight: ss.reduce((a, x) => Math.max(a, x.weight || 0), 0),
    };
  }).filter((x) => !exerciseId || x.sets > 0));
}));

/* ---------- Settings ---------- */
export const settingsRouter = Router();
const settingsSchema = z.object({
  languageMode: z.enum(['desi', 'en', 'hi']), tone: z.enum(['coach', 'bhai', 'dost', 'trainer']), theme: z.enum(['dark', 'light']),
  units: z.enum(['metric', 'imperial']), foodDb: z.string().max(20), region: z.string().max(40).nullable(), festivalMode: z.string().max(40).nullable(),
  aiEnabled: z.boolean(), calorieTarget: z.number().int().positive().nullable(), proteinTarget: z.number().int().positive().nullable(), waterTargetMl: z.number().int().positive().nullable(),
}).partial();
settingsRouter.get('/', ah(async (req, res) => {
  let [s] = await db.select().from(S.userSettings).where(eq(S.userSettings.userId, uid(req)));
  if (!s) [s] = await db.insert(S.userSettings).values({ userId: uid(req) }).returning();
  const [u] = await db.select({ email: S.users.email, name: S.users.name }).from(S.users).where(eq(S.users.id, uid(req)));
  res.json({ ...s, user: u, aiAvailable: Boolean(process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY) });
}));
settingsRouter.put('/', ah(async (req, res) => {
  const body = settingsSchema.parse(req.body);
  const [s] = await db.update(S.userSettings).set(body).where(eq(S.userSettings.userId, uid(req))).returning();
  res.json(s);
}));

/* ---------- Timer presets ---------- */
export const timerRouter = Router();
timerRouter.get('/', ah(async (req, res) => res.json(await db.select().from(S.timerPresets).where(eq(S.timerPresets.userId, uid(req))))));
timerRouter.post('/', ah(async (req, res) => {
  const b = z.object({ name: z.string().min(1).max(60), type: z.string().max(20), workSec: z.number().int().nullish(), restSec: z.number().int().nullish(), rounds: z.number().int().nullish(), totalSec: z.number().int().nullish() }).parse(req.body);
  const [row] = await db.insert(S.timerPresets).values({ ...b, userId: uid(req) }).returning();
  res.status(201).json(row);
}));
timerRouter.delete('/:id', ah(async (req, res) => {
  await db.delete(S.timerPresets).where(and(eq(S.timerPresets.id, req.params.id), eq(S.timerPresets.userId, uid(req))));
  res.status(204).end();
}));

/* ---------- Export ---------- */
export const exportRouter = Router();
exportRouter.get('/', ah(async (req, res) => {
  const id = uid(req);
  const format = req.query.format === 'csv' ? 'csv' : 'json';
  const sessions = await db.select().from(S.workoutSessions).where(eq(S.workoutSessions.userId, id)).orderBy(asc(S.workoutSessions.date));
  const sets = sessions.length ? await db.select().from(S.workoutSets).where(inArray(S.workoutSets.sessionId, sessions.map((s) => s.id))) : [];
  const ex = await db.select().from(S.exercises);
  const exName = new Map(ex.map((e) => [e.id, e.name]));
  if (format === 'csv') {
    const esc = (v: unknown) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = ['date,session,exercise,set,reps,weight_kg,duration_sec,distance_m,rpe,warmup'];
    for (const s of sessions) for (const x of sets.filter((y) => y.sessionId === s.id).sort((a, b) => a.setNumber - b.setNumber))
      lines.push([s.date.toISOString(), s.name, exName.get(x.exerciseId) || x.exerciseId, x.setNumber, x.reps, x.weight, x.durationSec, x.distanceM, x.rpe, x.isWarmup].map(esc).join(','));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="deshi-workouts.csv"');
    return res.send(lines.join('\n'));
  }
  res.setHeader('Content-Disposition', 'attachment; filename="deshi-export.json"');
  res.json({
    exportedAt: new Date().toISOString(),
    sessions: sessions.map((s) => ({ ...s, sets: sets.filter((x) => x.sessionId === s.id) })),
    customExercises: ex.filter((e) => e.userId === id),
    routines: await db.select().from(S.routines).where(eq(S.routines.userId, id)),
    prs: await db.select().from(S.personalRecords).where(eq(S.personalRecords.userId, id)),
    goals: await db.select().from(S.goals).where(eq(S.goals.userId, id)),
    body: await db.select().from(S.bodyMetrics).where(eq(S.bodyMetrics.userId, id)),
    sleep: await db.select().from(S.sleepLogs).where(eq(S.sleepLogs.userId, id)),
    nutrition: await db.select().from(S.nutritionLogs).where(eq(S.nutritionLogs.userId, id)),
  });
}));
