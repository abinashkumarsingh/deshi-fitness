import { Router } from 'express';
import { z } from 'zod';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db, schema } from '../db';
import { ah, HttpError } from '../services/util';
import { uid } from '../services/auth';

const r = Router();
const { routines: R, routineBlocks: B, routineExercises: RE } = schema;

const exSchema = z.object({
  exerciseId: z.string(), sets: z.number().int().min(0).max(50).nullish(), reps: z.number().int().min(0).max(1000).nullish(),
  weight: z.number().min(0).nullish(), durationSec: z.number().int().min(0).nullish(), distanceM: z.number().min(0).nullish(),
  restSec: z.number().int().min(0).max(3600).nullish(), rpe: z.number().int().min(1).max(10).nullish(),
  tempo: z.string().max(20).nullish(), notes: z.string().max(500).nullish(), timerType: z.string().max(20).nullish(), timerConfig: z.any().nullish(),
});
const routineSchema = z.object({
  name: z.string().min(1).max(80), type: z.string().max(30), focus: z.string().max(60).nullish(), notes: z.string().max(2000).nullish(),
  estDuration: z.number().int().min(0).max(600).nullish(), days: z.array(z.number().int().min(0).max(6)).default([]),
  blocks: z.array(z.object({ name: z.string().max(40), exercises: z.array(exSchema).max(50) })).max(10).default([]),
});

async function hydrate(rows: (typeof R.$inferSelect)[]) {
  if (!rows.length) return [];
  const blocks = await db.select().from(B).where(inArray(B.routineId, rows.map((r) => r.id)));
  const exs = blocks.length ? await db.select().from(RE).where(inArray(RE.blockId, blocks.map((b) => b.id))) : [];
  return rows.map((r) => ({
    ...r,
    blocks: blocks.filter((b) => b.routineId === r.id).sort((a, b) => a.order - b.order)
      .map((b) => ({ ...b, exercises: exs.filter((e) => e.blockId === b.id).sort((a, b) => a.order - b.order) })),
  }));
}

async function writeBlocks(routineId: string, blocks: z.infer<typeof routineSchema>['blocks']) {
  await db.delete(B).where(eq(B.routineId, routineId));
  for (const [i, b] of blocks.entries()) {
    const [blk] = await db.insert(B).values({ routineId, name: b.name, order: i }).returning();
    if (b.exercises.length) await db.insert(RE).values(b.exercises.map((e, j) => ({ ...e, blockId: blk.id, order: j })));
  }
}

r.get('/', ah(async (req, res) => {
  res.json(await hydrate(await db.select().from(R).where(eq(R.userId, uid(req))).orderBy(desc(R.createdAt))));
}));
r.get('/:id', ah(async (req, res) => {
  const rows = await db.select().from(R).where(and(eq(R.id, req.params.id), eq(R.userId, uid(req))));
  if (!rows.length) throw new HttpError(404, 'not_found');
  res.json((await hydrate(rows))[0]);
}));
r.post('/', ah(async (req, res) => {
  const { blocks, ...body } = routineSchema.parse(req.body);
  const [row] = await db.insert(R).values({ ...body, userId: uid(req) }).returning();
  await writeBlocks(row.id, blocks);
  res.status(201).json((await hydrate([row]))[0]);
}));
r.put('/:id', ah(async (req, res) => {
  const { blocks, ...body } = routineSchema.partial().parse(req.body);
  const [row] = await db.update(R).set(body).where(and(eq(R.id, req.params.id), eq(R.userId, uid(req)))).returning();
  if (!row) throw new HttpError(404, 'not_found');
  if (blocks) await writeBlocks(row.id, blocks);
  res.json((await hydrate([row]))[0]);
}));
r.post('/:id/duplicate', ah(async (req, res) => {
  const rows = await db.select().from(R).where(and(eq(R.id, req.params.id), eq(R.userId, uid(req))));
  if (!rows.length) throw new HttpError(404, 'not_found');
  const [src] = await hydrate(rows);
  const [row] = await db.insert(R).values({ userId: uid(req), name: `${src.name} (copy)`, type: src.type, focus: src.focus, notes: src.notes, estDuration: src.estDuration, days: [] }).returning();
  await writeBlocks(row.id, src.blocks.map((b) => ({ name: b.name, exercises: b.exercises.map(({ id: _i, blockId: _b, order: _o, ...e }) => e) })));
  res.status(201).json((await hydrate([row]))[0]);
}));
r.post('/:id/schedule', ah(async (req, res) => {
  const { days } = z.object({ days: z.array(z.number().int().min(0).max(6)) }).parse(req.body);
  const [row] = await db.update(R).set({ days }).where(and(eq(R.id, req.params.id), eq(R.userId, uid(req)))).returning();
  if (!row) throw new HttpError(404, 'not_found');
  res.json(row);
}));
r.delete('/:id', ah(async (req, res) => {
  const del = await db.delete(R).where(and(eq(R.id, req.params.id), eq(R.userId, uid(req)))).returning();
  if (!del.length) throw new HttpError(404, 'not_found');
  res.status(204).end();
}));

export default r;
