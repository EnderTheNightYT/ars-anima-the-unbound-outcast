import { describe, it, expect } from "vitest";
import { WEAPONS } from "./data";
import { starterStats } from "./weapon-forge";
describe("equipo inicial", () => {
  it("las armas iniciales salen con daño entre 0.85 y 1.0, crítico 0-2 y sin rareza", () => {
    for (let i = 0; i < 200; i++) { const s = starterStats(WEAPONS[i % WEAPONS.length]!);
      expect(s.dmgMult).toBeGreaterThanOrEqual(0.85); expect(s.dmgMult).toBeLessThanOrEqual(1);
      expect(s.crit).toBeGreaterThanOrEqual(0); expect(s.crit).toBeLessThanOrEqual(2); expect(s.rarity).toBe(0); }
  });
  it("las estadísticas se generan desde la base (distintas tiradas dan valores distintos)", () => {
    expect(starterStats(WEAPONS[0]!, () => 0).dmgMult).toBe(0.85);
    expect(starterStats(WEAPONS[0]!, () => 0.999).dmgMult).toBe(1);
  });
});
