import { describe, it, expect } from "vitest";
import { collectSave, applySave, shouldPull, playerStandings, CLOUD_STAMP_KEY, type GlobalRun } from "./cloud-save";

const store = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return { get length() { return m.size; }, key: (i: number) => [...m.keys()][i] ?? null, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, m };
};

describe("cloud save", () => {
  it('includes chronicles, titles and the saved character state in account snapshots', () => {
    const s = store({ ars_anima_chronicles_v1: 'titles', ars_anima_run_save_v1: 'character' });
    const target = store(); applySave(target, collectSave(s));
    expect(target.getItem('ars_anima_chronicles_v1')).toBe('titles');
    expect(target.getItem('ars_anima_run_save_v1')).toBe('character');
  });
  it("only game progress keys travel, never the sync stamp", () => {
    const s = store({ ars_anima_meta: "12", other_app: "x", [CLOUD_STAMP_KEY]: "5" });
    expect(collectSave(s)).toEqual({ ars_anima_meta: "12" });
  });
  it("restores progress on another device", () => {
    const s = store();
    expect(applySave(s, { ars_anima_grado: "3", evil: "1" })).toBe(1);
    expect(s.getItem("ars_anima_grado")).toBe("3");
    expect(s.getItem("evil")).toBeNull();
  });
  it("cloud copy wins only when newer", () => {
    expect(shouldPull(100, 200)).toBe(true);
    expect(shouldPull(200, 100)).toBe(false);
    expect(shouldPull(0, null)).toBe(false);
  });
  it("global players ranked by their best score", () => {
    const r = (user_id: string, score: number): GlobalRun => ({ user_id, player_name: user_id, title: "", class_name: "c", subclass: "", difficulty: "normal", outcome: "death", score, floor: 1, kills: 0, melee: "", ranged: "", armor: "" });
    const s = playerStandings([r("a", 50), r("b", 90), r("a", 120)]);
    expect(s.map((p) => [p.user_id, p.best, p.runs])).toEqual([["a", 120, 2], ["b", 90, 1]]);
  });
});

import { appendLiveLog, type LiveSnap } from "./cloud-save";
describe("live run log", () => {
  const snap = (o: Partial<LiveSnap> = {}): LiveSnap => ({ floor: 1, region: "Port", level: 1, score: 0, kills: 0, seconds: 0, hp: 10, hpMax: 10, melee: "Espada", ranged: "Revolver", armor: "", ...o });
  it("writes a line only when floor, level or gear change", () => {
    let log = appendLiveLog([], snap());
    log = appendLiveLog(log, snap({ score: 50 }));
    expect(log).toHaveLength(1);
    log = appendLiveLog(log, snap({ floor: 2 }));
    log = appendLiveLog(log, snap({ floor: 2, melee: "Hacha" }));
    expect(log.map((e) => e.text.split(" · ")[0])).toEqual(["Comienza la run", "Desciende al nivel 2", "Cambia de equipo"]);
  });
});

import { filterRuns, NO_FILTER } from "./cloud-save";
describe("world board filters", () => {
  const row = (o: Partial<GlobalRun & { level: number; seconds: number; created_at: string }>) => ({ user_id: "u", player_name: "p", title: "", class_name: "DUELISTA", subclass: "", difficulty: "normal", outcome: "death", score: 0, floor: 1, kills: 0, melee: "ESPADA", ranged: "REVOLVER", armor: "", level: 1, seconds: 60, created_at: "2026-01-01", ...o });
  it("filters by class, difficulty and gear and sorts by kills", () => {
    const rows = [row({ kills: 5 }), row({ kills: 9, melee: "HACHA Rúnica" }), row({ class_name: "CAZADORA", kills: 20 }), row({ difficulty: "dificil", kills: 30 })];
    expect(filterRuns(rows, { ...NO_FILTER, cls: "DUELISTA", diff: "normal", sort: "kills" }).map((r) => r.kills)).toEqual([9, 5]);
    expect(filterRuns(rows, { ...NO_FILTER, gear: "hacha" })).toHaveLength(1);
  });
  it("fastest time sorts first when sorting by time", () => {
    expect(filterRuns([row({ seconds: 300 }), row({ seconds: 90 })], { ...NO_FILTER, sort: "seconds" })[0]?.seconds).toBe(90);
  });
});

import { WIKI, searchWiki } from "./wiki-data";
describe("wiki search", () => {
  it("finds weapons by damage dice and inscriptions by effect", () => {
    expect(searchWiki(WIKI, "2d8", "armas").map((e) => e.name)).toContain("REVOLVER");
    expect(searchWiki(WIKI, "sangrado", "objetos").some((e) => e.name === "SANGRANTE")).toBe(true);
  });
  it("filters by tier", () => {
    expect(searchWiki(WIKI, "", "objetos", "", 4).map((e) => e.name)[0]).toContain("Legendaria");
  });
});
