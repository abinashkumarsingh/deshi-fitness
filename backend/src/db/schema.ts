import {
  pgTable, text, integer, real, boolean, timestamp, jsonb, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

const id = () => text('id').primaryKey().$defaultFn(() => randomUUID());
const userRef = () => text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' });

export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull(),
  name: text('name'),
  password: text('password').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('users_email_idx').on(t.email)]);

export const userSettings = pgTable('user_settings', {
  id: id(),
  userId: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  languageMode: text('language_mode').notNull().default('desi'),
  tone: text('tone').notNull().default('bhai'),
  theme: text('theme').notNull().default('dark'),
  units: text('units').notNull().default('metric'),
  foodDb: text('food_db').notNull().default('indian'),
  region: text('region'),
  festivalMode: text('festival_mode'),
  aiEnabled: boolean('ai_enabled').notNull().default(true),
  calorieTarget: integer('calorie_target'),
  proteinTarget: integer('protein_target'),
  waterTargetMl: integer('water_target_ml'),
});

export const exercises = pgTable('exercises', {
  id: id(),
  slug: text('slug'),
  name: text('name').notNull(),
  nameDesi: text('name_desi'),
  category: text('category').notNull(),
  muscleGroup: text('muscle_group'),
  equipment: text('equipment'),
  difficulty: text('difficulty'),
  type: text('type'),
  tracking: text('tracking').notNull().default('weight_reps'), // weight_reps | reps | time | distance_time
  isCustom: boolean('is_custom').notNull().default(false),
  variationOf: text('variation_of'),
  videoUrl: text('video_url'),
  userId: text('user_id'),
}, (t) => [index('exercises_user_idx').on(t.userId), uniqueIndex('exercises_slug_idx').on(t.slug)]);

export const routines = pgTable('routines', {
  id: id(),
  userId: userRef(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  focus: text('focus'),
  notes: text('notes'),
  estDuration: integer('est_duration'),
  days: jsonb('days').$type<number[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const routineBlocks = pgTable('routine_blocks', {
  id: id(),
  routineId: text('routine_id').notNull().references(() => routines.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  order: integer('order').notNull(),
});

export const routineExercises = pgTable('routine_exercises', {
  id: id(),
  blockId: text('block_id').notNull().references(() => routineBlocks.id, { onDelete: 'cascade' }),
  exerciseId: text('exercise_id').notNull(),
  order: integer('order').notNull(),
  sets: integer('sets'),
  reps: integer('reps'),
  weight: real('weight'),
  durationSec: integer('duration_sec'),
  distanceM: real('distance_m'),
  restSec: integer('rest_sec'),
  rpe: integer('rpe'),
  tempo: text('tempo'),
  notes: text('notes'),
  timerType: text('timer_type'),
  timerConfig: jsonb('timer_config'),
});

export const workoutSessions = pgTable('workout_sessions', {
  id: id(),
  userId: userRef(),
  routineId: text('routine_id'),
  name: text('name'),
  type: text('type'),
  date: timestamp('date', { withTimezone: true }).notNull(),
  duration: integer('duration'),
  notes: text('notes'),
  sessionRpe: integer('session_rpe'),
  readiness: jsonb('readiness'),
  warmupDone: boolean('warmup_done').notNull().default(false),
  cooldownDone: boolean('cooldown_done').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('sessions_user_date_idx').on(t.userId, t.date)]);

export const workoutSets = pgTable('workout_sets', {
  id: id(),
  sessionId: text('session_id').notNull().references(() => workoutSessions.id, { onDelete: 'cascade' }),
  exerciseId: text('exercise_id').notNull(),
  setNumber: integer('set_number').notNull(),
  reps: integer('reps'),
  weight: real('weight'),
  durationSec: integer('duration_sec'),
  distanceM: real('distance_m'),
  rpe: integer('rpe'),
  restSec: integer('rest_sec'),
  isWarmup: boolean('is_warmup').notNull().default(false),
});

export const personalRecords = pgTable('personal_records', {
  id: id(),
  userId: userRef(),
  exerciseId: text('exercise_id').notNull(),
  type: text('type').notNull(), // est_1rm | max_weight | max_reps | fastest_time | longest_duration | best_volume
  value: real('value').notNull(),
  unit: text('unit'),
  reps: integer('reps'),
  weight: real('weight'),
  sessionId: text('session_id'),
  date: timestamp('date', { withTimezone: true }).notNull(),
}, (t) => [index('prs_user_ex_idx').on(t.userId, t.exerciseId, t.type)]);

export const timerPresets = pgTable('timer_presets', {
  id: id(),
  userId: userRef(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  workSec: integer('work_sec'),
  restSec: integer('rest_sec'),
  rounds: integer('rounds'),
  totalSec: integer('total_sec'),
});

export const goals = pgTable('goals', {
  id: id(),
  userId: userRef(),
  type: text('type').notNull(),
  priority: text('priority').notNull(), // primary | secondary
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  targetDate: timestamp('target_date', { withTimezone: true }),
  phaseName: text('phase_name'),
  objective: jsonb('objective'),
  constraints: jsonb('constraints'),
  targetWeight: real('target_weight'),
  eventDate: timestamp('event_date', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
});

export const suggestions = pgTable('suggestions', {
  id: id(),
  userId: userRef(),
  date: timestamp('date', { withTimezone: true }).notNull(),
  goalId: text('goal_id'),
  key: text('key'),
  type: text('type').notNull(),
  priority: text('priority').notNull(),
  message: text('message').notNull(),
  action: jsonb('action'),
  accepted: boolean('accepted').notNull().default(false),
  dismissed: boolean('dismissed').notNull().default(false),
});

export const bodyMetrics = pgTable('body_metrics', {
  id: id(),
  userId: userRef(),
  date: timestamp('date', { withTimezone: true }).notNull(),
  weight: real('weight'),
  bodyFat: real('body_fat'),
  waist: real('waist'),
  chest: real('chest'),
  arms: real('arms'),
  thighs: real('thighs'),
  hips: real('hips'),
  notes: text('notes'),
});

export const nutritionLogs = pgTable('nutrition_logs', {
  id: id(),
  userId: userRef(),
  date: timestamp('date', { withTimezone: true }).notNull(),
  meal: text('meal').notNull(),
  foodKey: text('food_key'),
  quantity: real('quantity'),
  calories: integer('calories'),
  protein: real('protein'),
  carbs: real('carbs'),
  fat: real('fat'),
  waterMl: integer('water_ml'),
  notes: text('notes'),
});

export const sleepLogs = pgTable('sleep_logs', {
  id: id(),
  userId: userRef(),
  date: timestamp('date', { withTimezone: true }).notNull(),
  hours: real('hours').notNull(),
  bedtime: text('bedtime'),
  wakeTime: text('wake_time'),
  quality: integer('quality'),
});
