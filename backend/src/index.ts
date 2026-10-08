import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { sql, isNull } from 'drizzle-orm';
import { db, pool, runMigrations, schema } from './db';
import { seedExercises } from './data/exercises';
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
  const existing = await db.select({ slug: schema.exercises.slug }).from(schema.exercises).where(isNull(schema.exercises.userId));
  const have = new Set(existing.map((e) => e.slug));
  const missing = seedExercises.filter((e) => !have.has(e.slug));
  if (missing.length) await db.insert(schema.exercises).values(missing);
  if (missing.length) console.log(`Seeded ${missing.length} exercises`);
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
