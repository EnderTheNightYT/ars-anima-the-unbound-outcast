import { describe, it, expect } from "vitest";
import { emptyStats, mpMerits, stealAmount, killLoot, duelPenalty, pvpDamage, reviveTime, validCode, roomCode, podium } from "./rules";

describe("reglas de la expedición compartida", () => {
  it("el robo por la espalda quita el 15 % de las fichas, mínimo 5 y nunca más de lo que hay", () => {
    expect(stealAmount(100)).toBe(15);
    expect(stealAmount(20)).toBe(5);
    expect(stealAmount(3)).toBe(3);
  });
  it("derribar a un jugador en caótica roba el 30 % de sus fichas", () => {
    expect(killLoot(100)).toBe(30);
  });
  it("perder el duelo cuesta el 20 % de las fichas, mínimo 10", () => {
    expect(duelPenalty(100)).toBe(20);
    expect(duelPenalty(30)).toBe(10);
  });
  it("fuego amigo: 0 % en cooperativa, 50 % en traicionera, 100 % en caótica y en duelo", () => {
    expect(pvpDamage(10, "coop")).toBe(0);
    expect(pvpDamage(10, "traicion")).toBe(5);
    expect(pvpDamage(10, "caos")).toBe(10);
    expect(pvpDamage(10, "coop", true)).toBe(10);
  });
  it("soporte levanta aliados en 1,5 s; los demás en 2,5 s", () => {
    expect(reviveTime("soporte")).toBe(1.5);
    expect(reviveTime("dano", "soporte")).toBe(1.5);
    expect(reviveTime("tanque")).toBe(2.5);
  });
  it("matar no basta para ganar: las bajas tienen rendimientos decrecientes", () => {
    const killer = { ...emptyStats(), kills: 100 };
    const support = { ...emptyStats(), healing: 400, revives: 4, objectives: 2 };
    expect(mpMerits(killer, "dano").total).toBeLessThan(100 * 40 * 1.6);
    expect(mpMerits(support, "soporte").total).toBeGreaterThan(mpMerits({ ...emptyStats(), kills: 25 }, "dano").total);
  });
  it("los códigos de sala tienen 6 caracteres sin letras ambiguas", () => {
    for (let i = 0; i < 50; i++) expect(validCode(roomCode())).toBe(true);
    expect(validCode("ABC10O")).toBe(false);
  });
  it("el podio ordena por puntos y desempata por menos caídas", () => {
    const a = { id: "a", name: "A", score: 500, stats: { ...emptyStats(), downs: 2 } };
    const b = { id: "b", name: "B", score: 500, stats: { ...emptyStats(), downs: 0 } };
    const c = { id: "c", name: "C", score: 900, stats: emptyStats() };
    expect(podium([a, b, c]).map(x => x.id)).toEqual(["c", "b", "a"]);
  });
});
