/**
 * Presentation-only world effects (pure, browser-safe, tested in world-fx.test.ts):
 * explosion ragdolls ("flyers") that bounce off walls/floor/ceiling and then shatter into gibs,
 * flame flicker, vegetation sway, light-dependent shadows, enemy eye/weapon glow cues,
 * fountain spray/puddles and dash/slide speed lines. Nothing here changes damage, loot or AI.
 */

/** A sprite thrown by an explosion: a dead enemy or a decorative prop. */
export interface Flyer {
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  rot: number; vr: number; t: number; bounces: number; scale: number; key: string; kind: 'enemy' | 'prop';
}
/** Small piece of a shattered sprite (sub-rect u,v,uw,vh in 0..1 image space). */
export interface Gib {
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  rot: number; vr: number; life: number; u: number; v: number; uw: number; vh: number; size: number; key: string;
}
export interface Puddle { x: number; y: number; r: number; t: number }

export const FLYER = {
  gravity: 14, wallRestitution: 0.55, floorRestitution: 0.42, ceiling: 2.6,
  /** Shatter after this many impacts or this many seconds. */
  maxBounces: 3, maxTime: 1.8, launch: 9, lift: 6.5,
};
export const GIB = { grid: 3, life: [0.9, 1.6] as [number, number], max: 160 };
export const PUDDLE = { max: 24, grow: 0.012, maxR: 0.55, life: 14 };

/** Launch velocity for a body at (x,y) from a blast at (bx,by); closer bodies fly harder. */
export function launchFrom(bx: number, by: number, x: number, y: number, radius: number) {
  const dx = x - bx, dy = y - by, d = Math.hypot(dx, dy) || 0.001, k = Math.max(0.35, 1 - d / Math.max(0.1, radius));
  return { vx: (dx / d) * FLYER.launch * k, vy: (dy / d) * FLYER.launch * k, vz: FLYER.lift * (0.6 + k * 0.6) };
}

/**
 * Advance a flyer. `solid(x,y,z)` is the map test. Returns true when it hit something this step.
 * Walls reflect the matching velocity axis, floor/ceiling reflect vz, every impact counts a bounce.
 */
export function stepFlyer(f: Flyer, dt: number, solid: (x: number, y: number, z: number) => boolean, floor = 0, ceiling = FLYER.ceiling) {
  let hit = false;
  f.t += dt; f.rot += f.vr * dt; f.vz -= FLYER.gravity * dt;
  const nx = f.x + f.vx * dt;
  if (solid(nx, f.y, f.z + 0.2)) { f.vx = -f.vx * FLYER.wallRestitution; f.vr = -f.vr; hit = true; } else f.x = nx;
  const ny = f.y + f.vy * dt;
  if (solid(f.x, ny, f.z + 0.2)) { f.vy = -f.vy * FLYER.wallRestitution; f.vr = -f.vr; hit = true; } else f.y = ny;
  f.z += f.vz * dt;
  if (f.z + f.scale * 0.5 > ceiling && f.vz > 0) { f.z = ceiling - f.scale * 0.5; f.vz = -f.vz * FLYER.wallRestitution; hit = true; }
  if (f.z < floor) { f.z = floor; if (f.vz < -1) { f.vz = -f.vz * FLYER.floorRestitution; hit = true; } else f.vz = 0; f.vx *= 0.7; f.vy *= 0.7; }
  if (hit) f.bounces++;
  return hit;
}
export const flyerDone = (f: Flyer) => f.bounces >= FLYER.maxBounces || f.t >= FLYER.maxTime;

/** Split a flyer into grid×grid gibs that inherit its momentum. */
export function shatterFlyer(f: Flyer, rnd: () => number = Math.random): Gib[] {
  const n = GIB.grid, out: Gib[] = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const a = rnd() * Math.PI * 2, s = 1.5 + rnd() * 3;
    out.push({ x: f.x, y: f.y, z: f.z + f.scale * (1 - (j + 0.5) / n), vx: f.vx * 0.3 + Math.cos(a) * s, vy: f.vy * 0.3 + Math.sin(a) * s, vz: 1.5 + rnd() * 3.5,
      rot: rnd() * 6, vr: (rnd() - 0.5) * 14, life: GIB.life[0] + rnd() * (GIB.life[1] - GIB.life[0]), u: i / n, v: j / n, uw: 1 / n, vh: 1 / n, size: f.scale / n, key: f.key });
  }
  return out;
}
export function stepGib(g: Gib, dt: number, solid: (x: number, y: number, z: number) => boolean, floor = 0) {
  g.life -= dt; g.rot += g.vr * dt; g.vz -= FLYER.gravity * dt;
  const nx = g.x + g.vx * dt; if (solid(nx, g.y, g.z)) g.vx *= -0.4; else g.x = nx;
  const ny = g.y + g.vy * dt; if (solid(g.x, ny, g.z)) g.vy *= -0.4; else g.y = ny;
  g.z += g.vz * dt; if (g.z > FLYER.ceiling) { g.z = FLYER.ceiling; g.vz = -Math.abs(g.vz) * 0.3; }
  if (g.z < floor) { g.z = floor; g.vz = Math.abs(g.vz) > 1 ? -g.vz * 0.35 : 0; g.vx *= 0.6; g.vy *= 0.6; g.vr *= 0.6; }
}

/** Fire flicker: height scale, sideways tremble (screen px at depth 1) and brightness. */
export function flameFlicker(time: number, seed: number) {
  const a = Math.sin(time * 13 + seed * 7.1), b = Math.sin(time * 23.7 + seed * 3.3), c = Math.sin(time * 5.3 + seed);
  return { scale: 1 + a * 0.06 + b * 0.04, dx: b * 1.6 + a * 0.8, bright: 0.75 + 0.25 * (0.5 + 0.5 * a * c), crackle: b > 0.93 };
}
export const FLAME_DECOS = new Set(['fire', 'healing_brazier', 'votive', 'gothic_lantern']);
export const PLANT_DECOS = new Set(['vegetation', 'plant', 'flowerpot', 'tree', 'dead_tree', 'leaves', 'moss_planter']);
/** Gentle wind sway: horizontal offset (fraction of sprite width) applied increasingly towards the top. */
export function swayAmount(time: number, x: number, y: number, deco: string, wind = 0) {
  const big = deco === 'tree' || deco === 'dead_tree' ? 0.035 : 0.06;
  return (Math.sin(time * 1.3 + x * 1.7 + y * 0.9) * 0.7 + Math.sin(time * 2.9 + x * 0.4) * 0.3) * big + wind * 0.02;
}

export interface ShadowLight { x: number; y: number; radius: number; strength: number }
/**
 * Shadow cast by an object at (x,y): it points away from the strongest nearby light.
 * Returns the unit direction, length in world units and opacity; null when no light reaches it.
 */
export function castShadow(x: number, y: number, lights: ShadowLight[]) {
  let best: ShadowLight | null = null, bw = 0;
  for (const l of lights) { const d = Math.hypot(x - l.x, y - l.y); if (d >= l.radius || d < 0.05) continue; const w = (1 - d / l.radius) * l.strength; if (w > bw) { bw = w; best = l; } }
  if (!best) return null;
  const dx = x - best.x, dy = y - best.y, d = Math.hypot(dx, dy);
  return { dx: dx / d, dy: dy / d, len: Math.min(2.2, 0.5 + d * 0.45), alpha: Math.min(0.55, 0.18 + bw * 0.45) };
}

export type GlowCue = { kind: 'attack' | 'weak'; intensity: number; color: string } | null;
/** Eyes/weapon glow: red ramp while winding up an attack; blinking gold when exploitable. */
export function enemyGlow(e: { tele: number; teleMax?: number; stagger: number; downT?: number; exposed?: number; hp: number; hpMax: number; dead: boolean }, time: number): GlowCue {
  if (e.dead) return null;
  if (e.tele > 0) { const k = 1 - Math.min(1, e.tele / Math.max(0.2, e.teleMax ?? e.tele)); return { kind: 'attack', intensity: 0.45 + k * 0.55, color: k > 0.7 ? '#fff0a0' : '#ff3a1a' }; }
  const weak = e.stagger > 0 || (e.downT ?? 0) > 0 || (e.exposed ?? 0) > 0 || e.hp < e.hpMax * 0.25;
  if (weak) return { kind: 'weak', intensity: 0.5 + 0.5 * Math.abs(Math.sin(time * 6)), color: '#7ae8ff' };
  return null;
}

/** Fountain spray droplets per second and the arc of one droplet. */
export const FOUNTAIN = { rate: 22, height: 0.85, speed: 1.3 };
export function fountainDrop(x: number, y: number, z: number, rnd: () => number = Math.random) {
  const a = rnd() * Math.PI * 2, s = FOUNTAIN.speed * (0.5 + rnd() * 0.7);
  return { x: x + Math.cos(a) * 0.05, y: y + Math.sin(a) * 0.05, z: z + FOUNTAIN.height, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 1.6 + rnd() * 1.4, life: 1.4, color: rnd() < 0.3 ? '#cfefff' : '#6fb3d8', size: 0.016 + rnd() * 0.012, water: true };
}
/** Grow the nearest puddle or create one when a droplet lands. Mutates and returns the list. */
export function addPuddle(list: Puddle[], x: number, y: number) {
  const near = list.find(p => Math.hypot(p.x - x, p.y - y) < p.r + 0.15);
  if (near) { near.r = Math.min(PUDDLE.maxR, near.r + PUDDLE.grow); near.t = PUDDLE.life; }
  else { list.push({ x, y, r: 0.08, t: PUDDLE.life }); if (list.length > PUDDLE.max) list.shift(); }
  return list;
}

/** 0..1 strength of speed lines / motion blur while dashing or sliding. */
export function speedFx(dashT: number, slideT: number, speed: number) {
  const d = dashT > 0 ? 1 : 0, s = slideT > 0 ? Math.min(1, speed / 11) * 0.8 : 0;
  return Math.max(d, s);
}
