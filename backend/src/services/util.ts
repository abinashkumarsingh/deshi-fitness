import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodError, ZodSchema } from 'zod';

export const ah = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => { fn(req, res, next).catch(next); };

export function parse<T>(schema: ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) return res.status(400).json({ error: 'validation', issues: err.issues });
  const e = err as { status?: number; message?: string };
  if (e.status) return res.status(e.status).json({ error: e.message });
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
}

export class HttpError extends Error { constructor(public status: number, msg: string) { super(msg); } }

export const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);
export const epley = (w: number, r: number) => (r <= 1 ? w : w * (1 + r / 30));
