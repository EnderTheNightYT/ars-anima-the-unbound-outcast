import { describe, expect, it } from "vitest";
import { allAffixCombos, comboResult, floorComparison } from "./affix-combos";

describe("combinaciones de inscripciones", () => {
  it("cubre todas las combinaciones de 1 a 4 de las 9 inscripciones", () => {
    expect(allAffixCombos().length).toBe(9 + 36 + 84 + 126);
  });
  it("suma daños continuos y salto con reglas del motor", () => {
    const c = comboResult(["SANGRANTE", "INCANDESCENTE", "TOXICA", "ENCADENADA"], 10, 4);
    expect(c.dot).toBe(34);
    expect(c.chain).toBe(20);
    expect(c.total).toBe(40 + 34 + 20);
  });
  it("DADO LOCO multiplica de media ×1,25 y VORAZ cura 15%", () => {
    const c = comboResult(["DADO_LOCO", "VORAZ"], 10, 4);
    expect(c.direct).toBe(50);
    expect(c.heal).toBe(7.5);
  });
  it("EBURNEA suma 3 de Break por golpe", () => {
    expect(comboResult(["EBURNEA"], 10, 1, 2).breakPerHit).toBe(5);
  });
  it("pisos más altos dan más daño medio esperado", () => {
    const a = floorComparison(1).find((r) => r.type === "ESPADA")!;
    const b = floorComparison(7).find((r) => r.type === "ESPADA")!;
    expect(b.attack).toBeGreaterThan(a.attack);
  });
});
