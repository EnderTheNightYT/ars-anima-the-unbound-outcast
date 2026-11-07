import { describe, expect, it } from 'vitest';
import { fallingRubbleHits, rubbleHeight } from './falling-rubble';
const player = { x: 3, y: 4, z: 0, height: .65, radius: .4 };
describe('falling rubble contact', () => {
  it('damages on contact above the ground while still falling', () => {
    const r = { x: 3, y: 4, t: .08 };
    expect(rubbleHeight(r.t)).toBeGreaterThan(0);
    expect(fallingRubbleHits(r, .15, player)).toBe(true);
  });
  it('does not damage before the stone reaches the body', () => expect(fallingRubbleHits({ x: 3, y: 4, t: .5 }, .6, player)).toBe(false));
  it('does not hit a player outside the falling stone', () => expect(fallingRubbleHits({ x: 5, y: 4, t: .08 }, .15, player)).toBe(false));
  it('one stone cannot damage the player twice', () => expect(fallingRubbleHits({ x: 3, y: 4, t: .04, hit: true }, .08, player)).toBe(false));
  it('detects a swept contact even when a frame skips past the body', () => expect(fallingRubbleHits({ x: 3, y: 4, t: -.02 }, .4, player)).toBe(true));
  it('uses the actual jumping or crouching body height', () => {
    expect(fallingRubbleHits({ x: 3, y: 4, t: .4 }, .5, { ...player, z: 1.6 })).toBe(true);
    expect(fallingRubbleHits({ x: 3, y: 4, t: .1 }, .12, { ...player, height: .34 })).toBe(false);
  });
});