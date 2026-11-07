import { describe, expect, it } from "vitest";
import { WEAPONS } from "./data";
import { WEAPON_SHEETS, dmgMultRange, tierOdds } from "./weapon-wiki";

describe("fichas de armas de la wiki", () => {
  it("hay una ficha por cada arma del juego", () => {
    expect(WEAPON_SHEETS.map((s) => s.type)).toEqual(WEAPONS.map((w) => w.type));
    for (const s of WEAPON_SHEETS) { expect(s.combo.length).toBeGreaterThan(0); expect(s.affixes.length).toBe(9); expect(s.enemies.length).toBeGreaterThan(0); }
  });
  it("probabilidades de tier siguen d100 + piso×3", () => {
    const p1 = tierOdds(1);
    expect(p1[0]).toBeCloseTo(0.46); // 1..46 → <50
    expect(p1.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
  it("rango de daño de un arma Rara en el piso 1", () => {
    expect(dmgMultRange(2, 1)).toEqual({ min: 1.32, max: 1.57 });
  });
});
