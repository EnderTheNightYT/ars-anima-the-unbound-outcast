import { describe, expect, it } from 'vitest';
import { clampPitch, MAX_PITCH, verticalRay, projectHeight, shotRange, smoothFactor } from './camera';
describe('Full look and smoother input', () => {
  it('allows looking up/down 89 degrees with finite rays', () => {
    expect(clampPitch(10)).toBe(MAX_PITCH); expect(clampPitch(-10)).toBe(-MAX_PITCH);
    expect(verticalRay(100, 200, MAX_PITCH)).toBeGreaterThan(50);
    expect(verticalRay(100, 200, -MAX_PITCH)).toBeLessThan(-50);
    expect(Number.isFinite(projectHeight(1, .5, 1, 200, MAX_PITCH))).toBe(true);
  });
  it('projects a target on the aiming ray to screen center', () => {
    const pitch = .6; expect(projectHeight(.5 + Math.tan(pitch) * 3, .5, 3, 200, pitch)).toBeCloseTo(100);
  });
  it('smooths consistently at different frame rates', () => {
    expect(1 - (1 - smoothFactor(12, 1/120)) ** 2).toBeCloseTo(smoothFactor(12, 1/60));
  });
  it('doubles ranged reach without changing melee data', () => { expect(shotRange(12)).toBe(24); expect(shotRange(18)).toBe(36); });
});