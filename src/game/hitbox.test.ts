import { describe, it, expect } from "vitest";
import { projectileHitsBody, sweptProjectileHits, meleeReachesBody } from "./hitbox";
import { projectileHitsPlayer } from "./world-rules";

describe("hitbox ajustada al borde del sprite", () => {
  it("una bala que pasa a 0.3 del eje ya no te golpea (antes la caja medía 0.4)", () => {
    expect(projectileHitsPlayer(false, 0, 0.3, 0.3)).toBe(false);
    expect(projectileHitsPlayer(false, 0, 0.3, 0.12)).toBe(true);
  });
  it("por encima de la cabeza no hay aire extra", () => {
    expect(projectileHitsBody(false, 0, .65, .75, 0)).toBe(false);
    expect(projectileHitsBody(false, 0, .65, .6, .1)).toBe(true);
  });
  it("la cabeza es más estrecha que el torso", () => {
    expect(projectileHitsBody(false, 0, .65, .4, .18)).toBe(true);
    expect(projectileHitsBody(false, 0, .65, .62, .18)).toBe(false);
  });
  it("un disparo rápido no atraviesa el cuerpo entre fotogramas", () => {
    expect(sweptProjectileHits(false, 0, .65, -2, 0, .4, 2, 0, .4, 0, .05)).toBe(true);
    expect(sweptProjectileHits(false, 0, .65, -2, .5, .4, 2, .5, .4, 0, 0)).toBe(false);
  });
  it("el golpe enemigo necesita llegar al borde del cuerpo", () => {
    const base = { attackerRadius: .3, reach: .9, angleOff: 0, halfArc: .8, low: false };
    expect(meleeReachesBody({ ...base, dist: 1.3 })).toBe(true);
    expect(meleeReachesBody({ ...base, dist: 1.7 })).toBe(false);
    expect(meleeReachesBody({ ...base, dist: 1.0, angleOff: 1.4 })).toBe(false);
  });
});
