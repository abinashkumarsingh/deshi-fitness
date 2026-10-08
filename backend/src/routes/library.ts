import { Router } from 'express';
import { z } from 'zod';
import { and, eq, isNull, or } from 'drizzle-orm';
import { db, schema } from '../db';
import { ah, HttpError } from '../services/util';
import { uid } from '../services/auth';
import { foods } from '../data/foods';
import { warmups, cooldowns, mobility, rampUp } from '../data/templates';

const E = schema.exercises;

export const exercisesRouter = Router();
const exSchema = z.object({
  name: z.string().min(1).max(80), nameDesi: z.string().max(80).nullish(), category: z.string().max(40),
  muscleGroup: z.string().max(40).nullish(), equipment: z.string().max(40).nullish(), difficulty: z.string().max(20).nullish(),
  type: z.string().max(20).nullish(), tracking: z.enum(['weight_reps', 'reps', 'time', 'distance_time']).default('weight_reps'),
  variationOf: z.string().nullish(), videoUrl: z.string().url().nullish().or(z.literal('')),
});
const visible = (userId: string) => or(isNull(E.userId), eq(E.userId, userId));

exercisesRouter.get('/', ah(async (req, res) => {
  const rows = await db.select().from(E).where(visible(uid(req)));
  res.json(rows.sort((a, b) => a.name.localeCompare(b.name)));
}));
exercisesRouter.get('/:id', ah(async (req, res) => {
  const [row] = await db.select().from(E).where(and(eq(E.id, req.params.id), visible(uid(req))));
  if (!row) throw new HttpError(404, 'not_found');
  res.json(row);
}));
exercisesRouter.post('/', ah(async (req, res) => {
  const body = exSchema.parse(req.body);
  const [row] = await db.insert(E).values({ ...body, videoUrl: body.videoUrl || null, isCustom: true, userId: uid(req) }).returning();
  res.status(201).json(row);
}));
exercisesRouter.put('/:id', ah(async (req, res) => {
  const body = exSchema.partial().parse(req.body);
  const [row] = await db.update(E).set(body).where(and(eq(E.id, req.params.id), eq(E.userId, uid(req)))).returning();
  if (!row) throw new HttpError(404, 'not_found_or_builtin');
  res.json(row);
}));
exercisesRouter.delete('/:id', ah(async (req, res) => {
  const del = await db.delete(E).where(and(eq(E.id, req.params.id), eq(E.userId, uid(req)))).returning();
  if (!del.length) throw new HttpError(404, 'not_found_or_builtin');
  res.status(204).end();
}));

export const foodsRouter = Router();
foodsRouter.get('/', (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  res.json(q ? foods.filter((f) => f.name.toLowerCase().includes(q) || f.key.includes(q)) : foods);
});

export const flowsRouter = Router();
flowsRouter.get('/warmups/templates', (_req, res) => res.json(warmups));
flowsRouter.get('/cooldowns/templates', (_req, res) => res.json(cooldowns));
flowsRouter.get('/mobility/routines', (_req, res) => res.json(mobility));
flowsRouter.get('/warmups/ramp-up', (req, res) => {
  const q = z.object({ weight: z.coerce.number().positive().max(1000), reps: z.coerce.number().int().positive().max(50).default(5), bar: z.coerce.number().nonnegative().max(50).default(20) }).parse(req.query);
  res.json(rampUp(q.weight, q.reps, q.bar));
});
