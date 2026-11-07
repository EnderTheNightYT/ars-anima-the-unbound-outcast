import { describe, expect, it } from "vitest";
import { cleanAdvice, cleanStats, strategyInput, strategyShareText, topHurt, type StrategyInput } from "./strategy-tips";

const base: StrategyInput = { mode: "multi", name: "Ana", className: "Duelista", role: "Soporte", ruleMode: "Traicionera", difficulty: "normal", outcome: "Victoria", floor: 2, level: 7, score: 4200, place: 1, players: 3, seconds: 754, stats: { kills: 12, healing: 340, revives: 3 }, hurt: [], gear: [], title: "La Que Vuelve" };

describe("estadísticas y consejos de estrategia", () => {
  it("sólo se envían números finitos y como mucho 40 estadísticas", () => {
    const many = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`k${i}`, i]));
    expect(Object.keys(cleanStats({ ...many, bad: NaN, txt: "x" as unknown as number })).length).toBe(40);
    expect(cleanStats({ a: 1.234, b: Infinity })).toEqual({ a: 1.2 });
  });
  it("las causas de daño se ordenan de más a menos frecuente", () => {
    expect(topHurt({ fuego: 2, garras: 9, caída: 0 })).toEqual([{ cause: "garras", n: 9 }, { cause: "fuego", n: 2 }]);
  });
  it("el texto compartido incluye puesto, puntaje y estadísticas clave", () => {
    const t = strategyShareText(base);
    expect(t).toContain("#1 de 3");
    expect(t).toContain("Puntaje 4200");
    expect(t).toContain("Curación 340");
    expect(t).toContain("12:34");
  });
  it("si hay consejos de la IA se añaden numerados", () => {
    const t = strategyShareText(base, { headline: "Sostén al grupo", tips: [{ title: "Revive antes", detail: "Ganas puntos." }] });
    expect(t).toContain("Consejo IA: Sostén al grupo");
    expect(t).toContain("1. Revive antes: Ganas puntos.");
  });
  it("rechaza respuestas de la IA sin consejos y recorta los textos largos", () => {
    expect(cleanAdvice({ headline: "x", tips: [] })).toBeNull();
    const a = cleanAdvice({ headline: "h".repeat(500), tips: [{ title: "t", detail: "d".repeat(900) }] })!;
    expect(a.headline.length).toBe(160);
    expect(a.tips[0]!.detail.length).toBe(320);
  });
  it("el servidor rechaza entradas manipuladas", () => {
    expect(strategyInput.safeParse({ ...base, score: -5 }).success).toBe(false);
    expect(strategyInput.safeParse({ ...base, place: 20 }).success).toBe(false);
    expect(strategyInput.safeParse(base).success).toBe(true);
  });
});
