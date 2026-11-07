import { describe, expect, it } from "vitest";
import { levelEdge, mpXpMult, pvpDamage } from "./rules";

describe("PvP y fuego amigo según el nivel", () => {
  it("a igual nivel el daño no cambia", () => {
    expect(levelEdge(5, 5)).toBe(1);
    expect(pvpDamage(20, "caos", false, 5, 5)).toBe(20);
  });
  it("10 niveles por encima multiplica el daño por 4 (tope)", () => {
    expect(levelEdge(15, 5)).toBe(4);
    expect(pvpDamage(20, "caos", false, 15, 5)).toBe(80);
  });
  it("la ventaja crece rápido: 5 niveles más ≈ ×2,6", () => {
    expect(levelEdge(10, 5)).toBeCloseTo(2.6);
  });
  it("el más débil hace mucho menos daño (mínimo ×0,35)", () => {
    expect(levelEdge(5, 10)).toBeCloseTo(.6);
    expect(levelEdge(1, 20)).toBe(.35);
    expect(pvpDamage(20, "caos", false, 1, 20)).toBe(7);
  });
  it("en traicionera el fuego amigo sigue al 50 % antes de la ventaja de nivel", () => {
    expect(pvpDamage(20, "traicion", false, 15, 5)).toBe(40);
  });
  it("en cooperativa nadie se hace daño, sea cual sea el nivel", () => {
    expect(pvpDamage(20, "coop", false, 30, 1)).toBe(0);
  });
});

describe("experiencia equilibrada en multijugador", () => {
  it("jugando solo no cambia", () => { expect(mpXpMult(3, [3])).toBe(1); });
  it("quien va 2 niveles por detrás del grupo sube un 30 % más rápido", () => {
    expect(mpXpMult(2, [2, 6])).toBeCloseTo(1.3);
  });
  it("quien va por delante sube más lento (mínimo ×0,6)", () => {
    expect(mpXpMult(6, [2, 6])).toBeCloseTo(.8);
    expect(mpXpMult(30, [1, 30])).toBe(.6);
  });
  it("el que va por detrás nunca supera ×1,6", () => { expect(mpXpMult(1, [1, 30])).toBe(1.6); });
});
