import { describe, it, expect } from "vitest";
import { WEAPONS } from "./data";
import { weaponGuide, referenceDamage, enemyExamples } from "./weapon-guide";
import { rangedProfile } from './combat-fx';
describe("weapon damage reference", () => {
  it("documents every weapon with concrete base damage", () => {
    expect(WEAPONS).toHaveLength(18);
    for (const w of WEAPONS) expect(weaponGuide(w)[0]?.min).toBe((w.dice[0] + 3) * (w.ranged ? rangedProfile(w.type,w.pellets??1).damageMult : w.type === "DAGA" || w.type === "LANZA" || w.type === "BASTON" ? .9 : 1));
  });
  it("uses actual sword multipliers and the +3 flat damage bonus", () => {
    const w = WEAPONS.find(w => w.type === "ESPADA"); if (!w) throw new Error("Missing sword");
    expect(weaponGuide(w).map(s => s.average)).toEqual([7.5, 8.25, 9, 14.25]);
    expect(referenceDamage(w)).toEqual({ min: 4, max: 11, average: 7.5 });
  });
  it("uses real enemy base HP without subtracting DEF from hit damage", () => {
    const w = WEAPONS.find(w => w.type === "ESPADA"); if (!w) throw new Error("Missing sword");
    expect(enemyExamples(w).map(e => [e.hp, e.average, e.remaining])).toEqual([[22, 39, 0], [46, 39, 7]]);
  });
});