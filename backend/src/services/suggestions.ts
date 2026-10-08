import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import { db, schema } from '../db';
import { daysAgo } from './util';

const S = schema;

export interface Ctx {
  goalType: string | null;
  secondaryGoal: string | null;
  sleepAvg7: number | null;
  sleepDebt7: number | null;
  weightAvg7: number | null;
  weightAvgPrev7: number | null;
  weeklyLossPct: number | null;
  sessions7: number;
  daysSinceLast: number | null;
  streakDays: number;
  legsTrained7: boolean;
  proteinAvg3: number | null;
  proteinTarget: number | null;
  calorieAvg3: number | null;
  waterToday: number;
  daysToEvent: number | null;
  avgRpe7: number | null;
  rpeProgress: { exercise: string; exerciseId: string; weight: number; rpe: number }[];
  weeksHard: number;
}

export async function buildContext(userId: string): Promise<Ctx> {
  const goals = await db.select().from(S.goals).where(and(eq(S.goals.userId, userId), eq(S.goals.active, true)));
  const primary = goals.find((g) => g.priority === 'primary') || goals[0];
  const secondary = goals.find((g) => g !== primary);
  const [settings] = await db.select().from(S.userSettings).where(eq(S.userSettings.userId, userId));

  const sleep = await db.select().from(S.sleepLogs).where(and(eq(S.sleepLogs.userId, userId), gte(S.sleepLogs.date, daysAgo(7))));
  const sleepAvg7 = sleep.length ? sleep.reduce((a, s) => a + s.hours, 0) / sleep.length : null;
  const sleepDebt7 = sleep.length ? sleep.reduce((a, s) => a + Math.max(0, 8 - s.hours), 0) : null;

  const body = await db.select().from(S.bodyMetrics).where(and(eq(S.bodyMetrics.userId, userId), gte(S.bodyMetrics.date, daysAgo(14))));
  const w = (from: number, to: number) => {
    const xs = body.filter((b) => b.weight && b.date >= daysAgo(from) && b.date < daysAgo(to)).map((b) => b.weight!);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };
  const weightAvg7 = w(7, 0), weightAvgPrev7 = w(14, 7);
  const weeklyLossPct = weightAvg7 && weightAvgPrev7 ? ((weightAvgPrev7 - weightAvg7) / weightAvgPrev7) * 100 : null;

  const sessions = await db.select().from(S.workoutSessions).where(and(eq(S.workoutSessions.userId, userId), gte(S.workoutSessions.date, daysAgo(60)))).orderBy(desc(S.workoutSessions.date));
  const sessions7 = sessions.filter((s) => s.date >= daysAgo(7)).length;
  const daysSinceLast = sessions[0] ? Math.floor((Date.now() - sessions[0].date.getTime()) / 86400000) : null;

  // streak: consecutive days (ending today or yesterday) with any session
  const daySet = new Set(sessions.map((s) => s.date.toISOString().slice(0, 10)));
  let streakDays = 0;
  for (let i = 0; i < 60; i++) {
    const d = daysAgo(i).toISOString().slice(0, 10);
    if (daySet.has(d)) streakDays++;
    else if (i > 0) break;
  }

  const recentIds = sessions.filter((s) => s.date >= daysAgo(7)).map((s) => s.id);
  const sets7 = recentIds.length ? await db.select().from(S.workoutSets).where(inArray(S.workoutSets.sessionId, recentIds)) : [];
  const exIds = [...new Set(sets7.map((s) => s.exerciseId))];
  const exRows = exIds.length ? await db.select().from(S.exercises).where(inArray(S.exercises.id, exIds)) : [];
  const legGroups = ['legs', 'quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors'];
  const legsTrained7 = exRows.some((e) => legGroups.includes(e.muscleGroup || ''));

  // Top-set RPE progress: last top set per exercise with rpe <= 8
  const rpeProgress: Ctx['rpeProgress'] = [];
  for (const ex of exRows.filter((e) => e.tracking === 'weight_reps')) {
    const sets = sets7.filter((s) => s.exerciseId === ex.id && s.weight && s.rpe && !s.isWarmup);
    if (!sets.length) continue;
    const top = sets.reduce((a, s) => (s.weight! > a.weight! ? s : a));
    if (top.rpe! <= 8) rpeProgress.push({ exercise: ex.name, exerciseId: ex.id, weight: top.weight!, rpe: top.rpe! });
  }
  const rpes = sessions.filter((s) => s.date >= daysAgo(7) && s.sessionRpe).map((s) => s.sessionRpe!);
  const avgRpe7 = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;

  // Weeks in a row with >= 3 sessions and avg RPE >= 7 (proxy for weeks since deload)
  let weeksHard = 0;
  for (let wk = 0; wk < 8; wk++) {
    const inWeek = sessions.filter((s) => s.date >= daysAgo((wk + 1) * 7) && s.date < daysAgo(wk * 7));
    const r = inWeek.filter((s) => s.sessionRpe).map((s) => s.sessionRpe!);
    const avg = r.length ? r.reduce((a, b) => a + b, 0) / r.length : 0;
    if (inWeek.length >= 3 && avg >= 7) weeksHard++; else break;
  }

  const food = await db.select().from(S.nutritionLogs).where(and(eq(S.nutritionLogs.userId, userId), gte(S.nutritionLogs.date, daysAgo(3))));
  const days = new Set(food.filter((f) => f.calories).map((f) => f.date.toISOString().slice(0, 10))).size || 0;
  const proteinAvg3 = days ? food.reduce((a, f) => a + (f.protein || 0), 0) / days : null;
  const calorieAvg3 = days ? food.reduce((a, f) => a + (f.calories || 0), 0) / days : null;
  const today = new Date().toISOString().slice(0, 10);
  const waterToday = food.filter((f) => f.date.toISOString().slice(0, 10) === today).reduce((a, f) => a + (f.waterMl || 0), 0);

  const ev = primary?.eventDate || primary?.targetDate;
  const daysToEvent = ev ? Math.ceil((ev.getTime() - Date.now()) / 86400000) : null;

  return {
    goalType: primary?.type || null, secondaryGoal: secondary?.type || null,
    sleepAvg7, sleepDebt7, weightAvg7, weightAvgPrev7, weeklyLossPct, sessions7, daysSinceLast, streakDays,
    legsTrained7, proteinAvg3, proteinTarget: settings?.proteinTarget ?? null, calorieAvg3, waterToday, daysToEvent,
    avgRpe7, rpeProgress, weeksHard,
  };
}

export interface Sug { key: string; type: string; priority: 'high' | 'medium' | 'low'; rank: number; message: string; action?: unknown }

const L = (lang: string, desi: string, en: string) => (lang === 'en' ? en : desi);

/** Rules engine. rank: 1 safety, 2 goal, 3 performance, 4 consistency, 5 optimisation */
export function runRules(c: Ctx, lang: string): Sug[] {
  const out: Sug[] = [];
  const g = c.goalType;
  const add = (s: Sug) => out.push(s);

  // 1. Safety
  if (c.sleepAvg7 !== null && c.sleepAvg7 < 6)
    add({ key: 'sleep_debt', type: 'reduce_intensity', priority: 'high', rank: 1,
      message: L(lang, `Neend kam hai bhai (${c.sleepAvg7.toFixed(1)}h avg). Aaj intensity 10% kam rakh.`, `Sleep debt is high (${c.sleepAvg7.toFixed(1)}h avg). Reduce intensity by 10% today.`) });
  if (c.weeksHard >= 7 || (c.avgRpe7 !== null && c.avgRpe7 >= 9 && c.sessions7 >= 4))
    add({ key: 'deload', type: 'deload', priority: 'medium', rank: 1,
      message: L(lang, 'Body thak gayi hai, ek hafta halka kar — deload week.', 'Fatigue is building up. Consider a deload week.') });

  // 2. Goal alignment
  if (g === 'fat_loss' && c.weeklyLossPct !== null && c.weeklyLossPct > 1)
    add({ key: 'loss_too_fast', type: 'reduce_deficit', priority: 'high', rank: 2,
      message: L(lang, `Bahut tez gir raha hai weight (${c.weeklyLossPct.toFixed(1)}%/week). 200 cal badha de.`, `Losing too fast (${c.weeklyLossPct.toFixed(1)}%/week). Add ~200 calories.`) });
  if (g === 'lean_bulk' && c.weeklyLossPct !== null && c.weeklyLossPct > 0)
    add({ key: 'bulk_not_gaining', type: 'increase_calories', priority: 'high', rank: 2,
      message: L(lang, 'Bulk pe hai aur weight gir raha hai? 250 cal aur kha.', 'Weight is dropping on a bulk. Add ~250 calories.') });
  if ((g === 'boxing') && c.daysToEvent !== null && c.daysToEvent <= 56 && c.daysToEvent > 0)
    add({ key: 'fight_cut', type: 'start_weight_cut', priority: 'high', rank: 2,
      message: L(lang, `Fight mein ${c.daysToEvent} din bache. Slow cut shuru kar.`, `${c.daysToEvent} days to fight. Start a slow weight cut.`) });
  if ((g === 'sprint' || g === 'peaking' || g === 'endurance') && c.daysToEvent !== null && c.daysToEvent <= 14 && c.daysToEvent > 0)
    add({ key: 'taper', type: 'taper', priority: 'high', rank: 2,
      message: L(lang, `Event ${c.daysToEvent} din mein hai — volume 30% kam kar, taper time.`, `Event in ${c.daysToEvent} days — cut volume ~30% and taper.`) });
  if (c.proteinTarget && c.proteinAvg3 !== null && c.proteinAvg3 < c.proteinTarget * 0.8)
    add({ key: 'protein_low', type: 'nutrition', priority: 'medium', rank: 2,
      message: L(lang, `Protein kam hai bhai (${Math.round(c.proteinAvg3)}g / ${c.proteinTarget}g). Paneer, anda ya chicken kha le.`, `Protein is low (${Math.round(c.proteinAvg3)}g of ${c.proteinTarget}g). Add paneer, eggs, or chicken.`) });
  if (['fat_loss', 'general_health', 'recomposition'].includes(g || '') && c.sessions7 < 3)
    add({ key: 'more_sessions', type: 'consistency', priority: 'medium', rank: 2,
      message: L(lang, `Is hafte sirf ${c.sessions7} session. Target 3–4 rakh.`, `Only ${c.sessions7} sessions this week. Aim for 3–4.`) });

  // 3. Performance
  if (['hypertrophy', 'bodybuilding', 'strength', 'lean_bulk', 'recomposition', null].includes(g))
    for (const p of c.rpeProgress.slice(0, 2))
      add({ key: `add_weight_${p.exerciseId}`, type: 'add_weight', priority: 'high', rank: 3, action: { exerciseId: p.exerciseId, weight: p.weight + 2.5 },
        message: L(lang, `${p.exercise} RPE ${p.rpe} tha — agli baar +2.5kg laga (${p.weight + 2.5}kg).`, `${p.exercise} was RPE ${p.rpe} — go +2.5kg next session (${p.weight + 2.5}kg).`) });
  if (!c.legsTrained7 && c.sessions7 >= 2)
    add({ key: 'leg_day', type: 'balance', priority: 'medium', rank: 3,
      message: L(lang, 'Leg day miss kar diya? Kal pakka karna 😤', 'No leg training this week. Schedule a leg session.') });

  // 4. Consistency
  if (c.streakDays >= 7)
    add({ key: `streak_${c.streakDays}`, type: 'celebrate', priority: 'low', rank: 4,
      message: L(lang, `${c.streakDays} din ka streak! Lage reh bhai 🔥`, `${c.streakDays}-day streak! Keep going.`) });
  if (c.daysSinceLast !== null && c.daysSinceLast >= 3)
    add({ key: 'comeback', type: 'consistency', priority: 'medium', rank: 4,
      message: L(lang, `${c.daysSinceLast} din se gym nahi gaya. Aaj chhota sa session hi kar le.`, `${c.daysSinceLast} days since your last workout. Even a short session today counts.`) });

  // 5. Optimisation
  if (c.waterToday < 1500 && new Date().getHours() >= 14)
    add({ key: 'water', type: 'hydration', priority: 'low', rank: 5,
      message: L(lang, 'Paani pee le, warna cramps aayenge 💧', 'Drink some water — you are under 1.5L today.') });
  if (c.daysSinceLast === null)
    add({ key: 'first_workout', type: 'start', priority: 'low', rank: 5,
      message: L(lang, 'Chalo bhai, pehla workout log karte hain 💪', 'Log your first workout to get personalised suggestions.') });

  const pr = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => a.rank - b.rank || pr[a.priority] - pr[b.priority]);
}

export async function todaySuggestions(userId: string, lang: string) {
  const ctx = await buildContext(userId);
  const rules = runRules(ctx, lang);
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const existing = await db.select().from(S.suggestions).where(and(eq(S.suggestions.userId, userId), gte(S.suggestions.date, start)));
  const result = [];
  for (const r of rules) {
    let row = existing.find((e) => e.key === r.key);
    if (!row) {
      [row] = await db.insert(S.suggestions).values({ userId, date: new Date(), key: r.key, type: r.type, priority: r.priority, message: r.message, action: r.action ?? null }).returning();
    } else if (row.message !== r.message) {
      [row] = await db.update(S.suggestions).set({ message: r.message }).where(eq(S.suggestions.id, row.id)).returning();
    }
    if (!row.dismissed) result.push(row);
  }
  return { context: ctx, suggestions: result };
}
