import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import rateLimit from 'express-rate-limit';
import { db, schema } from '../db';
import { ah, HttpError } from '../services/util';
import { signAccess, signRefresh, verify } from '../services/auth';

const r = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

const creds = z.object({ email: z.string().email().transform((s) => s.toLowerCase().trim()), password: z.string().min(8).max(200), name: z.string().max(80).optional() });

const tokens = (id: string) => ({ accessToken: signAccess(id), refreshToken: signRefresh(id) });
const publicUser = (u: typeof schema.users.$inferSelect) => ({ id: u.id, email: u.email, name: u.name });

r.get('/status', ah(async (_req, res) => {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.users);
  res.json({ hasUsers: count > 0, registrationOpen: process.env.ALLOW_REGISTRATION !== 'false' });
}));

r.post('/register', limiter, ah(async (req, res) => {
  if (process.env.ALLOW_REGISTRATION === 'false') throw new HttpError(403, 'registration_closed');
  const body = creds.parse(req.body);
  const exists = await db.select().from(schema.users).where(eq(schema.users.email, body.email));
  if (exists.length) throw new HttpError(409, 'email_taken');
  const [u] = await db.insert(schema.users).values({ email: body.email, name: body.name, password: await bcrypt.hash(body.password, 11) }).returning();
  await db.insert(schema.userSettings).values({ userId: u.id });
  res.status(201).json({ user: publicUser(u), ...tokens(u.id) });
}));

r.post('/login', limiter, ah(async (req, res) => {
  const body = creds.omit({ name: true }).parse(req.body);
  const [u] = await db.select().from(schema.users).where(eq(schema.users.email, body.email));
  if (!u || !(await bcrypt.compare(body.password, u.password))) throw new HttpError(401, 'invalid_credentials');
  res.json({ user: publicUser(u), ...tokens(u.id) });
}));

r.post('/refresh', ah(async (req, res) => {
  const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);
  const id = verify(refreshToken, 'refresh');
  if (!id) throw new HttpError(401, 'invalid_refresh');
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, id));
  if (!u) throw new HttpError(401, 'invalid_refresh');
  res.json({ user: publicUser(u), ...tokens(u.id) });
}));

export default r;
