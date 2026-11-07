import { describe, expect, it } from 'vitest';
import { fragmentImpact, fragmentMotion, fragmentRandom } from './enemy-fragments';
import { stepGib } from './world-fx';
describe('enemy sprite fragments', () => {
  it('bursts on a lethal hit of exactly one third of maximum life', () => {
    expect(fragmentImpact(30, 90, 0)).toBe('burst');
    expect(fragmentImpact(29, 90, 0)).toBe('none');
    expect(fragmentImpact(30, 90, 1)).toBe('none');
  });
  it('bursts on a lethal critical even below the one-third threshold', () => {
    expect(fragmentImpact(5, 90, 0, { critical: true })).toBe('burst');
    expect(fragmentImpact(5, 90, 85, { critical: true })).toBe('none');
  });
  it('detaches a chip on every successful melee impact, never on zero damage', () => {
    expect(fragmentImpact(1, 90, 89, { melee: true, style: 'cut' })).toBe('chip');
    expect(fragmentImpact(1, 90, 89, { melee: true, style: 'smash' })).toBe('chip');
    expect(fragmentImpact(0, 90, 90, { melee: true })).toBe('none');
  });
  it('pieces retain their source key, rotate, fall and settle on the raised floor', () => {
    const piece = fragmentMotion(2, 2, 1, 1, { u: .3, v: .3, uw: .2, vh: .2, round: false }, 'enemy-piece', 0, false, fragmentRandom(7));
    expect(piece.key).toBe('enemy-piece');
    expect(piece.size).toBeCloseTo(.2);
    const initialRot = piece.rot;
    for (let i = 0; i < 240; i++) stepGib(piece, 1 / 60, () => false, 1);
    expect(piece.z).toBeCloseTo(1, 1);
    expect(piece.rot).not.toBe(initialRot);
    expect(piece.life).toBeGreaterThan(0);
  });
  it('uses a repeatable visual stream independent of combat randomness', () => {
    const a = fragmentRandom(12), b = fragmentRandom(12);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});