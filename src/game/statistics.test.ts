import { describe, it, expect, beforeEach } from "vitest";
import { readStats, recordStat, statisticsTotals, mergeStats, parseStats, STATS_KEY } from "./statistics";
import { collectSave, applySave } from "./cloud-save";

beforeEach(() => localStorage.clear());
describe("personal statistics", () => {
  it("counts a started run once, including when resumed", () => {
    recordStat("run-a", "start"); recordStat("run-a", "start");
    expect(statisticsTotals(readStats()).played).toBe(1);
  });
  it("persists defeated enemies", () => {
    recordStat("run-a", "start"); recordStat("run-a", "kill"); recordStat("run-a", "kill");
    expect(statisticsTotals(parseStats(localStorage.getItem(STATS_KEY))).kills).toBe(2);
  });
  it("persists each connected combo extension", () => {
    recordStat("run-a", "combo"); recordStat("run-a", "combo");
    expect(statisticsTotals(readStats()).combos).toBe(2);
  });
  it("deduplicates weapon instances, but not different weapons with the same name", () => {
    recordStat("run-a", "find", { uid: 1, name: "ESPADA" });
    recordStat("run-a", "find", { uid: 1, name: "ESPADA" });
    recordStat("run-a", "find", { uid: 2, name: "ESPADA" });
    expect(statisticsTotals(readStats()).weapons).toBe(2);
  });
  it("restores all four statistics through the cloud snapshot", () => {
    recordStat("run-a", "start"); recordStat("run-a", "kill"); recordStat("run-a", "combo"); recordStat("run-a", "find", { uid: 1, name: "DAGA" });
    const snapshot = collectSave(localStorage); localStorage.clear(); applySave(localStorage, snapshot);
    expect(statisticsTotals(readStats())).toEqual({ played: 1, kills: 1, combos: 1, weapons: 1 });
  });
  it("merges separate device runs and same-run high water marks idempotently", () => {
    recordStat("a", "kill"); const a = readStats(); localStorage.clear();
    recordStat("a", "kill"); recordStat("a", "kill"); recordStat("b", "combo"); const b = readStats();
    const result = mergeStats(a, b);
    expect(statisticsTotals(result)).toEqual({ played: 2, kills: 2, combos: 1, weapons: 0 });
    expect(mergeStats(result, b)).toEqual(result);
  });
  it("retains historical run and kill totals", () => {
    localStorage.setItem("ars_anima_legacy", JSON.stringify({ runs: 7, kills: 24 }));
    recordStat("new", "start"); recordStat("new", "kill");
    expect(statisticsTotals(readStats())).toEqual({ played: 8, kills: 25, combos: 0, weapons: 0 });
  });
});