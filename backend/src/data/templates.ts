export interface FlowStep { name: string; durationSec?: number; reps?: number; note?: string }
export interface Flow { id: string; name: string; type: 'warmup' | 'cooldown' | 'mobility'; sport?: string; steps: FlowStep[] }

export const warmups: Flow[] = [
  { id: 'wu-strength', name: 'Strength Warmup', type: 'warmup', sport: 'strength', steps: [
    { name: 'Bike / easy cardio', durationSec: 300 }, { name: 'Leg swings', reps: 20 },
    { name: 'Hip openers', reps: 10 }, { name: 'Empty bar sets', reps: 10 }, { name: 'Ramp-up sets', note: 'Use the ramp-up calculator' },
  ] },
  { id: 'wu-boxing', name: 'Boxing Warmup', type: 'warmup', sport: 'boxing', steps: [
    { name: 'Jump rope', durationSec: 180 }, { name: 'Shadow boxing', durationSec: 180 },
    { name: 'Footwork drills', durationSec: 120 }, { name: 'Neck & shoulder circles', durationSec: 60 }, { name: 'Easy bag round', durationSec: 180 },
  ] },
  { id: 'wu-sprint', name: 'Sprint Warmup', type: 'warmup', sport: 'sprint', steps: [
    { name: 'Easy jog', durationSec: 300 }, { name: 'A-skips, B-skips, high knees', durationSec: 240 },
    { name: 'Strides ×4', note: '60–80m at 70%' }, { name: 'Build-ups ×3', note: 'to 90%' },
  ] },
  { id: 'wu-push', name: 'Push Day Warmup', type: 'warmup', sport: 'push', steps: [
    { name: 'Band pull-aparts', reps: 20 }, { name: 'Arm circles', durationSec: 60 },
    { name: 'Shoulder dislocates', reps: 10 }, { name: 'Push-up ramp', reps: 10 },
  ] },
  { id: 'wu-legs', name: 'Leg Day Warmup', type: 'warmup', sport: 'legs', steps: [
    { name: 'Bike', durationSec: 300 }, { name: 'Leg swings', reps: 20 },
    { name: 'Bodyweight squats', reps: 15 }, { name: 'Hip hinges', reps: 10 }, { name: 'Ramp-up sets' },
  ] },
  { id: 'wu-bodyweight', name: 'Bodyweight Warmup', type: 'warmup', sport: 'bodyweight', steps: [
    { name: 'Jumping jacks', durationSec: 60 }, { name: 'Arm circles', durationSec: 30 },
    { name: 'Leg swings', reps: 20 }, { name: 'Inchworms', reps: 6 },
  ] },
];

export const cooldowns: Flow[] = [
  { id: 'cd-general', name: 'General Cooldown', type: 'cooldown', steps: [
    { name: 'Easy walk', durationSec: 180 }, { name: 'Hamstring stretch', durationSec: 60 },
    { name: 'Hip flexor stretch', durationSec: 60 }, { name: 'Chest doorway stretch', durationSec: 60 }, { name: 'Box breathing', durationSec: 120 },
  ] },
  { id: 'cd-legs', name: 'Leg Cooldown', type: 'cooldown', steps: [
    { name: 'Foam roll quads & glutes', durationSec: 180 }, { name: 'Pigeon pose', durationSec: 90 },
    { name: 'Calf stretch', durationSec: 60 }, { name: 'Box breathing', durationSec: 60 },
  ] },
  { id: 'cd-upper', name: 'Upper Body Cooldown', type: 'cooldown', steps: [
    { name: 'Lat stretch', durationSec: 60 }, { name: 'Cross-body shoulder stretch', durationSec: 60 },
    { name: 'Tricep stretch', durationSec: 60 }, { name: 'Thoracic rotations', reps: 10 },
  ] },
];

export const mobility: Flow[] = [
  { id: 'mob-daily', name: 'Daily 10-min Flow', type: 'mobility', steps: [
    { name: 'Cat-cow', reps: 10 }, { name: "World's greatest stretch", reps: 5 },
    { name: 'Deep squat hold', durationSec: 60 }, { name: 'Pigeon pose', durationSec: 60 },
    { name: 'Thoracic rotations', reps: 10 }, { name: 'Surya Namaskar', reps: 3 },
  ] },
  { id: 'mob-posture', name: 'Posture Fix', type: 'mobility', steps: [
    { name: 'Chin tucks', reps: 15 }, { name: 'Wall angels', reps: 12 },
    { name: 'Band pull-aparts', reps: 20 }, { name: 'Hip flexor stretch', durationSec: 60 },
  ] },
  { id: 'mob-recovery', name: 'Recovery Day', type: 'mobility', steps: [
    { name: 'Easy walk', durationSec: 900 }, { name: 'Foam rolling', durationSec: 300 }, { name: 'Box breathing', durationSec: 180 },
  ] },
];

/** Ramp-up sets for a working weight (kg). Rounds to the nearest 2.5 kg. */
export function rampUp(workWeight: number, workReps = 5, barWeight = 20) {
  const r = (x: number) => Math.max(barWeight, Math.round(x / 2.5) * 2.5);
  const scheme: [number, number][] = [[0.4, 8], [0.6, 5], [0.8, 3], [0.9, 1]];
  const sets: { weight: number; reps: number; pct: number | null; label: string }[] = [
    { weight: barWeight, reps: 10, pct: null, label: 'Bar' },
  ];
  for (const [pct, reps] of scheme) {
    const w = r(workWeight * pct);
    if (w > sets[sets.length - 1].weight && w < workWeight) sets.push({ weight: w, reps, pct: Math.round(pct * 100), label: `${Math.round(pct * 100)}%` });
  }
  sets.push({ weight: workWeight, reps: workReps, pct: 100, label: 'Work' });
  return sets;
}
