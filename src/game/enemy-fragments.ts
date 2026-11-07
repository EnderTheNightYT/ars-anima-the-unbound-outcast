import type { Gib } from './world-fx';
import type { SpriteImage } from './render-performance';

export const FRAGMENT = { lethalShare: 1 / 3, burstGrid: 4, life: 7, maxCuts: 24 };
export type FragmentHit = { melee?: boolean; critical?: boolean; style?: string };
export function fragmentImpact(damage: number, maxHp: number, hpAfter: number, hit: FragmentHit = {}) {
  if (damage <= 0 || maxHp <= 0) return 'none';
  if (hpAfter <= 0 && (damage >= maxHp * FRAGMENT.lethalShare || hit.critical)) return 'burst';
  return hit.melee ? 'chip' : 'none';
}
export type Cut = { u: number; v: number; uw: number; vh: number; round: boolean };
/** Separate deterministic visual stream: never consumes the combat dice. */
export function fragmentRandom(seed: number) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
export function fragmentMotion(x: number, y: number, z: number, scale: number, cut: Cut, key: string, angle: number, burst: boolean, random: () => number): Gib {
  const a = burst ? random() * Math.PI * 2 : angle + (random() - .5) * 1.8;
  const speed = burst ? 2 + random() * 4 : .8 + random() * 2;
  return { x, y, z: z + scale * (1 - cut.v - cut.vh), vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
    vz: (burst ? 3 : 1.8) + random() * 2.5, rot: 0, vr: (random() - .5) * 12,
    life: FRAGMENT.life + random(), u: 0, v: 0, uw: 1, vh: 1, size: scale * cut.vh, key };
}

function surface(image: SpriteImage) {
  const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false; ctx.drawImage(image, 0, 0);
  return { canvas, ctx };
}
function cutPath(ctx: CanvasRenderingContext2D, cut: Cut, w: number, h: number) {
  const x = cut.u * w, y = cut.v * h, cw = cut.uw * w, ch = cut.vh * h;
  ctx.beginPath();
  if (cut.round) ctx.ellipse(x + cw / 2, y + ch / 2, cw / 2, ch / 2, 0, 0, Math.PI * 2);
  else { ctx.moveTo(x, y + ch * .2); ctx.lineTo(x + cw * .7, y); ctx.lineTo(x + cw, y + ch * .75); ctx.lineTo(x + cw * .2, y + ch); ctx.closePath(); }
}
export function damagedSprite(image: SpriteImage, cuts: Cut[]) {
  if (!cuts.length) return image;
  const result = surface(image); if (!result) return image;
  result.ctx.globalCompositeOperation = 'destination-out';
  for (const cut of cuts) { cutPath(result.ctx, cut, image.width, image.height); result.ctx.fill(); }
  return result.canvas;
}
/** Occupied pixels only: transparent corners never become invisible chips. */
export function chipCut(image: SpriteImage, random: () => number, smash: boolean): Cut | null {
  const s = surface(image); if (!s) return null;
  const pixels = s.ctx.getImageData(0, 0, image.width, image.height).data;
  const occupied: number[] = [];
  for (let i = 0; i < pixels.length; i += 4) if ((pixels[i + 3] ?? 0) > 100) occupied.push(i / 4);
  if (!occupied.length) return null;
  const pixel = occupied[Math.floor(random() * occupied.length)]; if (pixel === undefined) return null;
  const uw = .16 + random() * .08, vh = .12 + random() * .07;
  return { u: Math.max(0, Math.min(1 - uw, (pixel % image.width) / image.width - uw / 2)),
    v: Math.max(0, Math.min(1 - vh, Math.floor(pixel / image.width) / image.height - vh / 2)), uw, vh, round: smash };
}
export function cropFragment(image: SpriteImage, cut: Cut, whole = false): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.ceil(image.width * cut.uw)); canvas.height = Math.max(1, Math.ceil(image.height * cut.vh));
  const ctx = canvas.getContext('2d'); if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  if (!whole) { cutPath(ctx, { ...cut, u: 0, v: 0, uw: 1, vh: 1 }, canvas.width, canvas.height); ctx.clip(); }
  ctx.drawImage(image, cut.u * image.width, cut.v * image.height, cut.uw * image.width, cut.vh * image.height, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  return data.some((value, index) => index % 4 === 3 && value > 40) ? canvas : null;
}