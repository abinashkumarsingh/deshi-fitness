import { and, eq } from 'drizzle-orm';
import { db, schema } from '../db';
import { epley } from './util';

const { personalRecords: PR, workoutSets, workoutSessions } = schema;

type SetRow = typeof workoutSets.$inferSelect;
interface Candidate { exerciseId: string; type: string; value: number; unit: string; reps?: number | null; weight?: number | null; higherBetter: boolean }

function candidatesFor(sets: SetRow[]): Candidate[] {
  const byEx = new Map<string, SetRow[]>();
  for (const s of sets) if (!s.isWarmup) byEx.set(s.exerciseId, [...(byEx.get(s.exerciseId) || []), s]);
  const out: Candidate[] = [];
  for (const [exerciseId, list] of byEx) {
    const weighted = list.filter((s) => (s.weight ?? 0) > 0 && (s.reps ?? 0) > 0);
    if (weighted.length) {
      const best1rm = weighted.reduce((a, s) => (epley(s.weight!, s.reps!) > epley(a.weight!, a.reps!) ? s : a));
      out.push({ exerciseId, type: 'est_1rm', value: Math.round(epley(best1rm.weight!, best1rm.reps!) * 10) / 10, unit: 'kg', reps: best1rm.reps, weight: best1rm.weight, higherBetter: true });
      const heavy = weighted.reduce((a, s) => (s.weight! > a.weight! ? s : a));
      out.push({ exerciseId, type: 'max_weight', value: heavy.weight!, unit: 'kg', reps: heavy.reps, weight: heavy.weight, higherBetter: true });
      const vol = weighted.reduce((t, s) => t + s.weight! * s.reps!, 0);
      out.push({ exerciseId, type: 'best_volume', value: vol, unit: 'kg', higherBetter: true });
    }
    const repOnly = list.filter((s) => (s.reps ?? 0) > 0 && !(s.weight ?? 0));
    if (repOnly.length) out.push({ exerciseId, type: 'max_reps', value: Math.max(...repOnly.map((s) => s.reps!)), unit: 'reps', higherBetter: true });
    const dist = list.filter((s) => (s.distanceM ?? 0) > 0 && (s.durationSec ?? 0) > 0);
    // fastest time at the most common distance
    if (dist.length) {
      const d = dist[0].distanceM!;
      const same = dist.filter((s) => s.distanceM === d);
      out.push({ exerciseId, type: `fastest_${d}m`, value: Math.min(...same.map((s) => s.durationSec!)), unit: 'sec', higherBetter: false });
    }
    const timed = list.filter((s) => (s.durationSec ?? 0) > 0 && !(s.distanceM ?? 0));
    if (timed.length) out.push({ exerciseId, type: 'longest_duration', value: Math.max(...timed.map((s) => s.durationSec!)), unit: 'sec', higherBetter: true });
  }
  return out;
}

/** Compares a session's sets against stored PRs; stores and returns new ones. */
export async function detectPRs(userId: string, sessionId: string) {
  const [session] = await db.select().from(workoutSessions).where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, userId)));
  if (!session) return [];
  const sets = await db.select().from(workoutSets).where(eq(workoutSets.sessionId, sessionId));
  const newPRs: (typeof PR.$inferSelect & { previous: number | null })[] = [];
  for (const c of candidatesFor(sets)) {
    const existing = await db.select().from(PR).where(and(eq(PR.userId, userId), eq(PR.exerciseId, c.exerciseId), eq(PR.type, c.type)));
    const otherSessions = existing.filter((e) => e.sessionId !== sessionId);
    const best = otherSessions.length
      ? otherSessions.reduce((a, e) => (c.higherBetter ? (e.value > a.value ? e : a) : (e.value < a.value ? e : a))).value
      : null;
    const beats = best === null || (c.higherBetter ? c.value > best : c.value < best);
    // Remove stale record from this same session (re-detection after edit)
    await db.delete(PR).where(and(eq(PR.userId, userId), eq(PR.exerciseId, c.exerciseId), eq(PR.type, c.type), eq(PR.sessionId, sessionId)));
    if (!beats) continue;
    const [row] = await db.insert(PR).values({
      userId, exerciseId: c.exerciseId, type: c.type, value: c.value, unit: c.unit,
      reps: c.reps ?? null, weight: c.weight ?? null, sessionId, date: session.date,
    }).returning();
    // Only celebrate when there was something to beat (first-ever logs are baselines)
    if (best !== null) newPRs.push({ ...row, previous: best });
  }
  return newPRs;
}
