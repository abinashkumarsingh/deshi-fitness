import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const SECRET = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return s;
};

export interface AuthedRequest extends Request { userId: string }

export function signAccess(userId: string) {
  return jwt.sign({ sub: userId, typ: 'access' }, SECRET(), { expiresIn: '1d' });
}
export function signRefresh(userId: string) {
  return jwt.sign({ sub: userId, typ: 'refresh' }, SECRET(), { expiresIn: '60d' });
}
export function verify(token: string, typ: 'access' | 'refresh'): string | null {
  try {
    const p = jwt.verify(token, SECRET()) as jwt.JwtPayload;
    return p.typ === typ && typeof p.sub === 'string' ? p.sub : null;
  } catch { return null; }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const uid = token ? verify(token, 'access') : null;
  if (!uid) return res.status(401).json({ error: 'unauthorized' });
  (req as AuthedRequest).userId = uid;
  next();
}

export const uid = (req: Request) => (req as AuthedRequest).userId;
