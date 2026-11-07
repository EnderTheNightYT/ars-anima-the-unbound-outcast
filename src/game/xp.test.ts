import { describe, expect, it } from 'vitest';
import { xpForLevel, damageXp, merchantXp, DAMAGE_XP } from './xp';
describe('xp curve', () => {
  it('starts at 100 and grows gently', () => { expect(xpForLevel(1)).toBe(100); expect(xpForLevel(2)).toBe(161); expect(xpForLevel(10)).toBe(1081); });
  it('damage XP is 1 per 5 damage, capped per floor', () => { expect(damageXp(10, 0)).toBe(2); expect(damageXp(500, 0)).toBe(DAMAGE_XP.capPerFloor); expect(damageXp(10, 40)).toBe(0); });
  it('merchant XP scales with rating', () => { expect(merchantXp(5)).toBe(70); });
});
