import { describe, expect, it } from "vitest";
import { ENEMY_TYPES } from "./data";
import { enemySheet } from "./enemy-wiki";
import { compareWithWorld } from "./cloud-save";

describe("enemy wiki sheets", () => {
  it("every enemy has stats, attacks and counters, and grows with floor", () => {
    for (const id of Object.keys(ENEMY_TYPES)) {
      const s = enemySheet(id)!;
      expect(s.pattern.attacks.length).toBeGreaterThan(0);
      expect(s.pattern.beat && s.pattern.dodge).toBeTruthy();
      expect(s.scale[2]!.hp).toBeGreaterThan(s.scale[0]!.hp);
    }
  });
});
describe("compare with world", () => {
  it("ranks a player against others by best score", () => {
    const r = (user_id: string, score: number) => ({ user_id, player_name: user_id, title: "", class_name: "", subclass: "", difficulty: "", outcome: "death", score, floor: 1, kills: 0, melee: "", ranged: "", armor: "" });
    const c = compareWithWorld([r("a", 100), r("b", 300), r("me", 200), r("me", 50)], "me")!;
    expect(c.rank).toBe(2); expect(c.players).toBe(3); expect(c.score.top).toBe(300); expect(c.score.mine).toBe(200);
  });
});
import { floorStats } from "./cloud-save";
import { Game } from "./engine";
import { affixGuide } from "./weapon-wiki";
import { AFFIXES, type AffixId } from "./data";
describe("floor stats", () => {
  it("averages runs, deaths, time and kills per floor", () => {
    const r = (user_id: string, floor: number, outcome: string, seconds: number, kills: number) => ({ user_id, player_name: "", title: "", class_name: "", subclass: "", difficulty: "", outcome, score: 0, floor, kills, seconds, melee: "", ranged: "", armor: "" });
    const s = floorStats([r("a", 1, "floor", 100, 4), r("b", 1, "death", 200, 2), r("a", 2, "death", 50, 1)]);
    expect(s[0]).toMatchObject({ floor: 1, runs: 2, deaths: 1, avgSecs: 150, avgKills: 3, deathRate: 50 });
    expect(floorStats([r("a", 1, "floor", 100, 4), r("b", 1, "death", 200, 2)], "a")[0]?.runs).toBe(1);
  });
});
describe("weapon generation", () => {
  it("produces thousands of distinct random weapons from bases", () => {
    const g = new Game(); g.floor = 4; const seen = new Set<string>();
    for (let i = 0; i < 4000; i++) { const w = g.makeWeapon(); seen.add(`${w.name}|${w.dmgMult}|${w.crit}|${w.acc}|${w.affixes?.join(",")}`); expect(w.base).toBeTruthy(); }
    expect(seen.size).toBeGreaterThan(1500);
  });
  it("every inscription has a rule and damage examples", () => {
    for (const id of Object.keys(AFFIXES) as AffixId[]) expect(affixGuide(id).ex.length).toBeGreaterThan(0);
    expect(affixGuide("DADO_LOCO", 10).ex[0]).toContain("30");
  });
});
