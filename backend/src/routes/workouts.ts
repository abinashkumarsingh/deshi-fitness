import { Router } from 'express';
import { z } from 'zod';
import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { db, schema } from '../db';
import { ah, HttpError } from '../services/util';
import { uid } from '../services/auth';
import { detectPRs } from '../services/prs';

const r = Router();
const { workoutSessions: WS, workoutSets: WSet } = schema;

const num = z.number().finite().nonnegative();
const setSchema = z.object({
  exerciseId: z.string(), setNumber: z.number().int().positive(),
  reps: z.number().int().nonnegative().nullish(), weight: num.nullish(), durationSec: z.number().int().nonnegative().nullish(),
  distanceM: num.nullish(), rpe: z.number().int().min(1).max(10).nullish(), restSec: z.number().int().nonnegative().nullish(),
  isWarmup: z.boolean().optional(),
});
const sessionSchema = z.object({
  routineId: z.string().nullish(), name: z.string().max(120).nullish(), type: z.string().max(40).nullish(),
  date: z.coerce.date(), duration: z.number().int().nonnegative().nullish(), notes: z.string().max(2000).nullish(),
  sessionRpe: z.number().int().min(1).max(10).nullish(), readiness: z.record(z.any()).nullish(),
  warmupDone: z.boolean().optional(), cooldownDone: z.boolean().optional(),
  sets: z.array(setSchema).max(500).default([]),
});

async function withSets(sessions: (typeof WS.$inferSelect)[]) {
  if (!sessions.length) return [];
  const sets = await db.select().from(WSet).where(inArray(WSet.sessionId, sessions.map((s) => s.id)));
  return sessions.map((s) => ({ ...s, sets: sets.filter((x) => x.sessionId === s.id).sort((a, b) => a.setNumber - b.setNumber) }));
}

r.get('/', ah(async (req, res) => {
  const q = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional(), limit: z.coerce.number().int().min(1).max(500).default(50) }).parse(req.query);
  const conds = [eq(WS.userId, uid(req))];
  if (q.from) conds.push(gte(WS.date, q.from));
  if (q.to) conds.push(lte(WS.date, q.to));
  const rows = await db.select().from(WS).where(and(...conds)).orderBy(desc(WS.date)).limit(q.limit);
  res.json(await withSets(rows));
}));

r.get('/last', ah(async (req, res) => {
  const routineId = req.query.routineId as string | undefined;
  const conds = [eq(WS.userId, uid(req))];
  if (routineId) conds.push(eq(WS.routineId, routineId));
  const rows = await db.select().from(WS).where(and(...conds)).orderBy(desc(WS.date)).limit(1);
  const [s] = await withSets(rows);
  res.json(s || null);
}));

/** Last logged sets for an exercise — used to prefill weight/reps. */
r.get('/exercise/:exerciseId/last', ah(async (req, res) => {
  const rows = await db.select({ set: WSet, date: WS.date }).from(WSet).innerJoin(WS, eq(WSet.sessionId, WS.id))
    .where(and(eq(WS.userId, uid(req)), eq(WSet.exerciseId, req.params.exerciseId))).orderBy(desc(WS.date), desc(WSet.setNumber)).limit(20);
  if (!rows.length) return res.json(null);
  const latest = rows[0].date.getTime();
  res.json({ date: rows[0].date, sets: rows.filter((r) => r.date.getTime() === latest).map((r) => r.set).reverse() });
}));

r.get('/:id', ah(async (req, res) => {
  const rows = await db.select().from(WS).where(and(eq(WS.id, req.params.id), eq(WS.userId, uid(req))));
  if (!rows.length) throw new HttpError(404, 'not_found');
  res.json((await withSets(rows))[0]);
}));

r.post('/', ah(async (req, res) => {
  const body = sessionSchema.parse(req.body);
  const { sets, ...s } = body;
  const [session] = await db.insert(WS).values({ ...s, userId: uid(req) }).returning();
  if (sets.length) await db.insert(WSet).values(sets.map((x) => ({ ...x, sessionId: session.id })));
  const newPRs = await detectPRs(uid(req), session.id);
  res.status(201).json({ ...(await withSets([session]))[0], newPRs });
}));

r.put('/:id', ah(async (req, res) => {
  const body = sessionSchema.partial().parse(req.body);
  const { sets, ...s } = body;
  const [session] = await db.update(WS).set(s).where(and(eq(WS.id, req.params.id), eq(WS.userId, uid(req)))).returning();
  if (!session) throw new HttpError(404, 'not_found');
  if (sets) {
    await db.delete(WSet).where(eq(WSet.sessionId, session.id));
    if (sets.length) await db.insert(WSet).values(sets.map((x) => ({ ...x, sessionId: session.id })));
  }
  const newPRs = await detectPRs(uid(req), session.id);
  res.json({ ...(await withSets([session]))[0], newPRs });
}));

r.delete('/:id', ah(async (req, res) => {
  const del = await db.delete(WS).where(and(eq(WS.id, req.params.id), eq(WS.userId, uid(req)))).returning();
  if (!del.length) throw new HttpError(404, 'not_found');
  await db.delete(schema.personalRecords).where(and(eq(schema.personalRecords.userId, uid(req)), eq(schema.personalRecords.sessionId, req.params.id)));
  res.status(204).end();
}));

export default r;
