import { describe, expect, it } from "vitest";
import { WEAPONS } from "./data";
import { combinationCount, forgeBase, weaponName } from "./weapon-forge";

describe("weapon forge", () => {
  it("modifies a copy of the base, never the shared table", () => {
    const espada = WEAPONS.find((w) => w.type === "ESPADA")!;
    const heavy = forgeBase(espada, "pesada");
    expect(heavy.dice).toEqual([1, 9]);
    expect(heavy.breakB).toBe(3);
    expect(espada.dice).toEqual([1, 8]);
  });
  it("builds names with variant, quality prefix and suffix", () => {
    expect(weaponName("HACHA", 2, "serrada", "del Cuervo")).toBe("HACHA Serrada Rúnica del Cuervo");
    expect(weaponName("ARCO", 0, undefined, "de Babel")).toBe("ARCO de Babel");
  });
  it("offers thousands of combinations", () => {
    expect(combinationCount(WEAPONS)).toBeGreaterThan(10000);
  });
});
