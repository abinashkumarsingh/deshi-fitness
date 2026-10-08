import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { sql, isNull, and, eq } from 'drizzle-orm';
import { db, pool, runMigrations, schema } from './db';
import { seedExercises, curatedDetailsFrom } from './data/exercises';
import exerciseDb from './data/exercise-db.json';
import { requireAuth } from './services/auth';
import { errorHandler } from './services/util';
import authRouter from './routes/auth';
import workoutsRouter from './routes/workouts';
import routinesRouter from './routes/routines';
import { exercisesRouter, foodsRouter, flowsRouter } from './routes/library';
import {
  prsRouter, goalsRouter, suggestionsRouter, aiRouter, bodyRouter, sleepRouter, nutritionRouter,
  metricsRouter, settingsRouter, timerRouter, exportRouter,
} from './routes/misc';

async function seed() {
  const existing = await db.select({ slug: schema.exercises.slug, name: schema.exercises.name }).from(schema.exercises).where(isNull(schema.exercises.userId));
  const have = new Set(existing.map((e) => e.slug));
  const norm = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, '');
  const curated = seedExercises.filter((e) => !have.has(e.slug));
  const names = new Set([...existing.map((e) => norm(e.name)), ...seedExercises.map((e) => norm(e.name))]);
  // Open public-domain exercise library (free-exercise-db, Unlicense)
  const imported = (exerciseDb as { slug: string; name: string; category: string; muscleGroup: string; equipment: string; difficulty: string | null; type: string; tracking: string; secondary: string[]; instructions: string[]; images: string[] }[])
    .filter((e) => !have.has(e.slug) && !names.has(norm(e.name)))
    .map(({ secondary, ...e }) => ({ ...e, secondaryMuscles: secondary, nameDesi: null }));
  const rows = [...curated, ...imported];
  for (let i = 0; i < rows.length; i += 200) await db.insert(schema.exercises).values(rows.slice(i, i + 200));
  if (rows.length) console.log(`Seeded ${curated.length} curated + ${imported.length} library exercises`);

  // Give curated lifts the instructions/images of their library twin (only where missing)
  const lib = new Map((exerciseDb as { slug: string; instructions: string[]; images: string[]; secondary: string[] }[]).map((e) => [e.slug, e]));
  let enriched = 0;
  for (const [slug, src] of Object.entries(curatedDetailsFrom)) {
    const e = lib.get('fedb:' + src);
    if (!e) continue;
    const r = await db.update(schema.exercises).set({ instructions: e.instructions, images: e.images, secondaryMuscles: e.secondary })
      .where(and(eq(schema.exercises.slug, slug), isNull(schema.exercises.instructions))).returning({ id: schema.exercises.id });
    enriched += r.length;
  }
  if (enriched) console.log(`Added instructions & images to ${enriched} curated exercises`);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');
  await runMigrations();
  await seed();

  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  const origins = (process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim());
  app.use(cors({ origin: origins.includes('*') ? true : origins }));
  app.use(express.json({ limit: '1mb' }));
  app.use(rateLimit({ windowMs: 60 * 1000, max: Number(process.env.RATE_LIMIT_MAX || 300), standardHeaders: true, legacyHeaders: false }));

  app.get('/health', async (_req, res) => {
    try { await db.execute(sql`select 1`); res.json({ ok: true, db: 'up' }); }
    catch { res.status(503).json({ ok: false, db: 'down' }); }
  });

  app.use('/auth', authRouter);
  app.use(requireAuth);
  app.use('/workouts', workoutsRouter);
  app.use('/routines', routinesRouter);
  app.use('/exercises', exercisesRouter);
  app.use('/foods', foodsRouter);
  app.use('/', flowsRouter);
  app.use('/prs', prsRouter);
  app.use('/goals', goalsRouter);
  app.use('/suggestions', suggestionsRouter);
  app.use('/ai', aiRouter);
  app.use('/body', bodyRouter);
  app.use('/sleep', sleepRouter);
  app.use('/nutrition', nutritionRouter);
  app.use('/metrics', metricsRouter);
  app.use('/settings', settingsRouter);
  app.use('/timer-presets', timerRouter);
  app.use('/export', exportRouter);
  app.use((_req, res) => res.status(404).json({ error: 'not_found' }));
  app.use(errorHandler);

  const port = Number(process.env.PORT || 4000);
  const server = app.listen(port, () => console.log(`Deshi API on :${port}`));
  const stop = () => server.close(() => pool.end().then(() => process.exit(0)));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

main().catch((e) => { console.error(e); process.exit(1); });
