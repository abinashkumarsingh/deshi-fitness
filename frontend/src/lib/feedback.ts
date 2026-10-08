import confetti from 'canvas-confetti';

let ctx: AudioContext | null = null;
function audio() {
  try { ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { return null; }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
/** Call from a user gesture once so iOS allows later beeps. */
export const unlockAudio = () => { audio(); };

export function beep(freq = 880, ms = 160, vol = 0.25) {
  const a = audio(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = 'square'; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + ms / 1000);
  o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + ms / 1000);
}

export const vibrate = (p: number | number[] = 40) => { try { navigator.vibrate?.(p); } catch { /* ignore */ } };

export function say(text: string, lang = 'en-IN') {
  try {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang; u.rate = 1.05;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch { /* ignore */ }
}

export function celebrate() {
  vibrate([60, 40, 120]);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 }, colors: ['#FF6B1A', '#FFFFFF', '#22C55E', '#FACC15'] });
}

/** Keep the screen on while a workout/timer is running (where supported). */
let lock: { release: () => Promise<void> } | null = null;
export async function keepAwake(on: boolean) {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    if (on && !lock && nav.wakeLock) lock = await nav.wakeLock.request('screen');
    if (!on && lock) { await lock.release(); lock = null; }
  } catch { /* ignore */ }
}
