import { describe, it, expect } from "vitest";
import { playerHitbox, projectileHitsPlayer, cellVolume, BODY_HEIGHT, LOW_PROFILE } from "./world-rules";

describe("perfil bajo al agacharse/deslizarse", () => {
  it("la caja es más baja y estrecha", () => {
    expect(playerHitbox(true).height).toBeLessThan(BODY_HEIGHT);
    expect(playerHitbox(true).radius).toBeLessThan(playerHitbox(false).radius);
    expect(playerHitbox(true).reach).toBeLessThan(playerHitbox(false).reach);
  });
  it("un disparo a la altura del pecho pasa por encima si estás agachado", () => {
    expect(projectileHitsPlayer(false, 0, 0.6, 0.1)).toBe(true);
    expect(projectileHitsPlayer(true, 0, 0.6, 0.1)).toBe(false);
  });
  it("un disparo al costado del torso roza de pie pero pasa por encima agachado", () => {
    expect(projectileHitsPlayer(false, 0, 0.4, 0.19)).toBe(true);
    expect(projectileHitsPlayer(true, 0, 0.4, 0.19)).toBe(false);
  });
  it("el conducto solo deja pasar un cuerpo bajo", () => {
    const [lo] = cellVolume(11)!;
    expect(LOW_PROFILE.height).toBeLessThan(lo);
    expect(BODY_HEIGHT).toBeGreaterThan(lo);
  });
});
