import { describe, expect, it } from 'vitest';
import { addPuddle, castShadow, enemyGlow, flyerDone, FLYER, shatterFlyer, speedFx, stepFlyer, type Flyer, type Puddle } from './world-fx';

const flyer = (o: Partial<Flyer> = {}): Flyer => ({ x: 1, y: 1, z: 0.5, vx: 0, vy: 0, vz: 0, rot: 0, vr: 1, t: 0, bounces: 0, scale: 0.6, key: 'k', kind: 'enemy', ...o });

describe('explosion flyers', () => {
  it('bounce back off a wall', () => {
    const f = flyer({ vx: 8 });
    const hit = stepFlyer(f, 0.05, (x) => x > 1.2);
    expect(hit).toBe(true);
    expect(f.vx).toBeLessThan(0);
    expect(f.bounces).toBe(1);
  });
  it('bounce up off the floor when falling fast', () => {
    const f = flyer({ z: 0.01, vz: -6 });
    stepFlyer(f, 0.05, () => false);
    expect(f.vz).toBeGreaterThan(0);
  });
  it('bounce down off the ceiling', () => {
    const f = flyer({ z: FLYER.ceiling - 0.3, vz: 8 });
    stepFlyer(f, 0.05, () => false);
    expect(f.vz).toBeLessThan(0);
  });
  it('shatter after 3 bounces into 9 pieces', () => {
    expect(flyerDone(flyer({ bounces: 2 }))).toBe(false);
    expect(flyerDone(flyer({ bounces: 3 }))).toBe(true);
    expect(shatterFlyer(flyer())).toHaveLength(9);
  });
});

describe('shadows', () => {
  it('point away from the light', () => {
    const s = castShadow(3, 2, [{ x: 2, y: 2, radius: 4, strength: 1 }]);
    expect(s?.dx).toBeCloseTo(1);
    expect(castShadow(10, 10, [{ x: 2, y: 2, radius: 4, strength: 1 }])).toBeNull();
  });
});

describe('enemy glow', () => {
  const base = { tele: 0, stagger: 0, hp: 10, hpMax: 10, dead: false };
  it('glows red-to-white while winding up an attack', () => {
    expect(enemyGlow({ ...base, tele: 0.5, teleMax: 0.5 }, 0)?.kind).toBe('attack');
  });
  it('glows when staggered or below 25% life', () => {
    expect(enemyGlow({ ...base, stagger: 1 }, 0)?.kind).toBe('weak');
    expect(enemyGlow({ ...base, hp: 2 }, 0)?.kind).toBe('weak');
    expect(enemyGlow(base, 0)).toBeNull();
  });
});

describe('puddles and speed lines', () => {
  it('droplets grow one puddle instead of stacking', () => {
    const l: Puddle[] = [];
    addPuddle(l, 1, 1); addPuddle(l, 1.05, 1);
    expect(l).toHaveLength(1);
    expect(l[0]!.r).toBeGreaterThan(0.08);
  });
  it('dash gives full speed lines, standing still gives none', () => {
    expect(speedFx(0.1, 0, 0)).toBe(1);
    expect(speedFx(0, 0, 3)).toBe(0);
  });
});
