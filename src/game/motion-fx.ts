/**
 * Movement particles (presentation only): dust and pebbles when running, jumping, landing and
 * sliding, plus ceiling drips. Pure and browser-safe; engine pushes the returned specs into `parts`.
 * Ground kinds come from engine.groundKind: 0 earth/grass, 1 sand/wet port, 2 path, 3 paving.
 */
export interface FxPart { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; color: string; size: number }
export type MotionEvent = 'step' | 'jump' | 'land' | 'slide' | 'stop' | 'dash' | 'airjump';

const PALETTE: Record<number, { dust: string[]; stone: string[] }> = {
  0: { dust: ['#6b5a3e', '#7d6a4a', '#5a4b33'], stone: ['#4a3c2a', '#3a2f22'] },
  1: { dust: ['#b8a47a', '#a8946b', '#c9b78d'], stone: ['#7a6a4c', '#6a5a40'] },
  2: { dust: ['#8f8577', '#a49885', '#7d7366'], stone: ['#5d564c', '#4a443c'] },
  3: { dust: ['#9a948c', '#b1aaa0', '#857f77'], stone: ['#605a54', '#4c4742'] },
};
/** Particle counts per event before the quality multiplier (tested). */
export const MOTION_COUNTS: Record<MotionEvent, { dust: number; stones: number }> = {
  step: { dust: 3, stones: 1 }, jump: { dust: 6, stones: 2 }, land: { dust: 10, stones: 4 }, slide: { dust: 5, stones: 2 }, stop: { dust: 9, stones: 3 }, dash: { dust: 12, stones: 4 }, airjump: { dust: 8, stones: 0 },
};
/** Seconds between running footstep puffs. */
export const STEP_INTERVAL = 0.16;
/** Landing impact speed (units/s) at which the burst is doubled. */
export const HARD_LANDING = 7;

/** Build the particles for one movement event. `rnd` is injectable so tests are deterministic. */
export function motionBurst(ev: MotionEvent, x: number, y: number, z: number, ground: number, vx: number, vy: number,
  opts: { impact?: number; quality?: number; rnd?: () => number } = {}): FxPart[] {
  const rnd = opts.rnd ?? Math.random, r = (a: number, b: number) => a + (b - a) * rnd();
  const pal = PALETTE[ground] ?? PALETTE[2]!, q = Math.max(0.25, opts.quality ?? 1);
  const hard = ev === 'land' ? Math.min(2, Math.max(0.5, (opts.impact ?? 4) / HARD_LANDING) * 1.4) : 1;
  const c = MOTION_COUNTS[ev], nd = Math.round(c.dust * q * hard), ns = Math.round(c.stones * q * hard);
  // Pasos/deslizar: estela que sale disparada hacia atrás; frenazo: derrape hacia delante.
  const back = ev === 'step' || ev === 'slide' ? -0.6 : ev === 'dash' ? -1.4 : ev === 'stop' ? 0.5 : 0, out: FxPart[] = [];
  const sp = Math.hypot(vx, vy) || 1, ox = ev === 'step' || ev === 'slide' || ev === 'dash' ? -vx / sp * 0.18 : 0, oy = ev === 'step' || ev === 'slide' || ev === 'dash' ? -vy / sp * 0.18 : 0;
  for (let i = 0; i < nd; i++) {
    const a = rnd() * Math.PI * 2, s = ev === 'land' ? r(0.8, 2.2) * hard : r(0.2, 0.9);
    out.push({ x: x + ox + r(-0.12, 0.12), y: y + oy + r(-0.12, 0.12), z: z + 0.03, vx: Math.cos(a) * s + vx * back, vy: Math.sin(a) * s + vy * back,
      vz: ev === 'airjump' ? r(-1.2, -0.2) : ev === 'jump' ? r(0.3, 1.1) : r(0.4, 1.4), life: r(0.35, 0.8), color: pal.dust[i % pal.dust.length]!, size: r(0.03, 0.065) });
  }
  for (let i = 0; i < ns; i++) {
    const a = rnd() * Math.PI * 2, s = r(0.8, 2.4) * (ev === 'land' ? hard : 1);
    out.push({ x, y, z: z + 0.05, vx: Math.cos(a) * s - vx * 0.15, vy: Math.sin(a) * s - vy * 0.15, vz: r(1.6, 3.4), life: r(0.5, 1), color: pal.stone[i % pal.stone.length]!, size: r(0.018, 0.032) });
  }
  return out;
}

/** Drips per second by region (wet regions drip more); rain adds more. */
export function dripRate(region: string, raining: boolean) {
  const base = region === 'port' ? 1.6 : region === 'garden' ? 1 : region === 'aethryon' ? 0.8 : region === 'pits' ? 0.6 : 0.35;
  return base * (raining ? 2 : 1);
}
export const DRIP_COLOR: Record<string, string> = { port: '#6fa3b8', garden: '#7fbf9a', pits: '#9d6bd6', aethryon: '#8fa8ff', cogspire: '#8a7a5a', babel: '#7a5a8a' };
/** A single drop falling from the ceiling near (x, y). */
export function drip(x: number, y: number, ceiling: number, region: string, rnd: () => number = Math.random): FxPart {
  const a = rnd() * Math.PI * 2, d = 0.8 + rnd() * 3;
  return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, z: ceiling - 0.05, vx: 0, vy: 0, vz: -0.4, life: 1.6, color: DRIP_COLOR[region] ?? '#6fa3b8', size: 0.018 };
}
/** Tiny splash ring when a drip reaches the floor. */
export function splash(x: number, y: number, z: number, color: string, rnd: () => number = Math.random): FxPart[] {
  return Array.from({ length: 4 }, (_, i) => { const a = i * Math.PI / 2 + rnd(); return { x, y, z: z + 0.01, vx: Math.cos(a) * 0.6, vy: Math.sin(a) * 0.6, vz: 0.9 + rnd() * 0.5, life: 0.3, color, size: 0.012 }; });
}
