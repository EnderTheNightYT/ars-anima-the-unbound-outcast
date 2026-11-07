import { describe, expect, it } from "vitest";
import { ScoreKeeper, SCORE, bonusFor, gradeFor } from "./score";

describe("puntaje", () => {
  it("la jerarquía de méritos va de recoger objetos a completar el nivel al 100%", () => {
    const order = ["pickup","gold","kill","barrel","chest","keyDoor","glory","defense","opening","mechCombo","attackCombo","killCombo","mission","pact","levelUp","skill","secret","secretDoor","secretRoom","boss","map","portal","floor","perfect"] as const;
    for (let i = 1; i < order.length; i++) expect(SCORE[order[i]!]).toBeGreaterThan(SCORE[order[i - 1]!]);
  });
  it("resta un punto cada 2 segundos", () => {
    const s = new ScoreKeeper(); s.tick(10, 100, 100); expect(s.total).toBe(-5);
  });
  it("hambre o sed en cero restan un punto cada 3 segundos", () => {
    const s = new ScoreKeeper(); s.tick(6, 0, 100); expect(s.total).toBe(-3 - 2);
  });
  it("gastar fichas resta 1 punto por cada 10", () => {
    const s = new ScoreKeeper(); s.spend(45); expect(s.total).toBe(-5);
  });
  it("3 mecánicas distintas antes de golpear dan combo de mecánicas", () => {
    const s = new ScoreKeeper(); s.mech("dash", 0); s.mech("salto", .5); s.mech("disparo", 1);
    expect(s.mechHit(1.2)).toBe(SCORE.mechCombo);
  });
  it("el bono de fichas es moderado y nulo con calificación F", () => {
    expect(bonusFor("S", 1)).toBe(85); expect(bonusFor("F", 3)).toBe(0); expect(bonusFor("S", 99)).toBe(110);
    expect(gradeFor(0, 1)).toBe("F");
  });
});
