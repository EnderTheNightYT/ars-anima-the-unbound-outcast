import { describe, it, expect } from "vitest";
import { floorRankings, profileSummary, mpStandings } from "./cloud-save";
import { recordArmory, readArmory, inscriptionCounts } from "./armory";
const r = (o: Partial<Parameters<typeof floorRankings>[0][0]>) => ({ user_id: "a", player_name: "A", title: "", outcome: "floor", floor: 1, kills: 0, score: 0, seconds: 100, ...o });
describe("rankings por piso", () => {
  it("mejor tiempo solo cuenta pisos superados, el menor primero", () => {
    const f = floorRankings([r({ seconds: 90 }), r({ seconds: 50, outcome: "death" }), r({ seconds: 70 })])[0]!;
    expect(f.time.map((x) => x.seconds)).toEqual([70, 90]);
  });
  it("más bajas y más puntos ordenan de mayor a menor", () => {
    const f = floorRankings([r({ kills: 3, score: 10 }), r({ kills: 9, score: 5 })])[0]!;
    expect(f.kills[0]!.kills).toBe(9); expect(f.score[0]!.score).toBe(10);
  });
  it("perfil cuenta partidas, muertes, pisos y victorias del jugador", () => {
    const s = profileSummary([r({}), r({ outcome: "death" }), r({ outcome: "won", floor: 6 }), r({ outcome: "death", user_id: "b" })], "a");
    expect(s).toEqual({ runs: 2, deaths: 1, floors: 1, wins: 1, best: 6 });
  });
  it("armería acumula inscripciones sin duplicar", () => {
    const m = new Map<string, string>(); const st = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    recordArmory({ name: "X", affixes: ["SANGRANTE"], base: { type: "espada" } }, st);
    recordArmory({ name: "X", affixes: ["SANGRANTE", "VORAZ"], base: { type: "espada" } }, st);
    expect(readArmory(st)["X"]!.times).toBe(2); expect(inscriptionCounts(readArmory(st))).toEqual({ SANGRANTE: 1, VORAZ: 1 });
  });
});

describe("ranking multijugador", () => {
  const p = (o: Partial<Parameters<typeof mpStandings>[0][0]>) => ({ user_id: "a", name: "A", matches: 1, wins: 0, podiums: 0, victories: 0, best_score: 0, total_score: 0, kills: 0, pvp_kills: 0, revives: 0, healing: 0, betrayals: 0, ...o });
  it("ordena por mejor puntuación; empate: más primeros puestos, luego menos partidas", () => {
    const st = mpStandings([p({ user_id: "x", best_score: 500, wins: 1, matches: 4 }), p({ user_id: "y", best_score: 900 }), p({ user_id: "z", best_score: 500, wins: 1, matches: 2 }), p({ user_id: "w", best_score: 500, wins: 3, matches: 9 })]);
    expect(st.map(r => r.user_id)).toEqual(["y", "w", "z", "x"]);
  });
  it("sin partidas no aparece", () => { expect(mpStandings([p({ matches: 0, best_score: 999 })])).toEqual([]); });
});
