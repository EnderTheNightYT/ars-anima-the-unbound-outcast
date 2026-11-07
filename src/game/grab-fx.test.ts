import { describe, it, expect } from 'vitest';
import { grabFx, GRABBABLE } from './engine';

describe('ground loot calls attention', () => {
  it('consumables, materials and weapons are animated', () => {
    for (const k of ['food', 'water', 'mat', 'item']) expect(GRABBABLE.has(k)).toBe(true);
  });
  it('floats above the floor, pulses ±10% and spins (width shrinks while turning)', () => {
    const s = Array.from({ length: 400 }, (_, i) => grabFx(i * 0.05, 0.3));
    expect(Math.min(...s.map(f => f.lift))).toBeGreaterThan(0);
    expect(Math.max(...s.map(f => f.pulse))).toBeCloseTo(1.1, 1);
    expect(Math.min(...s.map(f => f.spin))).toBeLessThan(0.3);
    expect(s.some(f => f.flash)).toBe(true);
  });
});
