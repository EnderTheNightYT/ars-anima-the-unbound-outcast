import { describe, expect, it } from "vitest";
import { actorFog, enemyRim, rimWidth, LEGIBILITY, RIM } from "./sprite-legibility";

describe("legibilidad de figuras", () => {
  it("la niebla nunca tapa a un actor más que el tope", () => {
    expect(actorFog(1, true)).toBe(LEGIBILITY.actorFogCap);
    expect(actorFog(1, false)).toBeCloseTo(0.85);
  });
  it("el contorno crece con la figura dentro de límites", () => {
    expect(rimWidth(20)).toBe(LEGIBILITY.rimMin);
    expect(rimWidth(172)).toBe(4);
    expect(rimWidth(10000)).toBe(LEGIBILITY.rimMax);
    expect(rimWidth(172, 30)).toBe(6); // figura chica en pantalla: contorno de al menos 1 px visible
  });
  it("jefes y élites tienen contorno propio", () => {
    expect(enemyRim({ kind: "librero" })).toBe(RIM.boss);
    expect(enemyRim({ elite: "VELOZ" })).toBe(RIM.elite);
    expect(enemyRim({})).toBe(RIM.enemy);
  });
});
