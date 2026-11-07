import { describe, expect, it } from "vitest";
import { dmgTier, makeDmgNum, stepDmgNums, dmgNumLook, DMG_NUM } from "./dmg-numbers";
import { DustTracker, HpWatch } from "./net/client-fx";

describe("damage numbers", () => {
  it("tiers by damage and share of max hp", () => {
    expect(dmgTier(3, 100)).toBe("chip");
    expect(dmgTier(10, 100)).toBe("hit");
    expect(dmgTier(30, 400)).toBe("heavy");
    expect(dmgTier(5, 10)).toBe("heavy");
    expect(dmgTier(2, 100, true)).toBe("crit");
  });
  it("crits get a ! and pop bigger at spawn, then fade out", () => {
    const n = makeDmgNum(0, 0, 1, 12, 100, true, () => .5);
    expect(n.text).toBe("12!");
    expect(dmgNumLook(n).scale).toBeGreaterThan(1.5);
    const later = stepDmgNums([n], DMG_NUM.life + .1);
    expect(later).toHaveLength(0);
  });
  it("client derives numbers from enemy hp drops between snapshots", () => {
    const w = new HpWatch(), out: ReturnType<typeof makeDmgNum>[] = [];
    w.diff([{ id: 1, hp: 50, hpMax: 50, x: 0, y: 0 }], out);
    w.diff([{ id: 1, hp: 38, hpMax: 50, x: 0, y: 0 }], out);
    expect(out.map(n => n.text)).toEqual(["12"]);
  });
});

describe("multiplayer dust tracker", () => {
  it("emits jump then land from positions alone", () => {
    const t = new DustTracker(), dt = 1 / 30, evs: string[] = [];
    t.observe("a", 0, 0, 0, 0, dt);
    for (const z of [.3, .6, .4, 0]) evs.push(...t.observe("a", 0, 0, z, 0, dt).map(e => e.ev));
    expect(evs).toEqual(["jump", "land"]);
  });
  it("emits step dust while running on the ground", () => {
    const t = new DustTracker(), dt = 1 / 30; let n = 0;
    for (let i = 0; i < 60; i++) n += t.observe("a", i * 5 * dt, 0, 0, 0, dt).filter(e => e.ev === "step").length;
    expect(n).toBeGreaterThan(0);
  });
});
