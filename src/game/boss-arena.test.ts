import { describe, expect, it } from "vitest";
import { BOSS_ARENA, arenaScorePenalty, canSlam, rubbleDamage, slamArc, slamCloud, summonInterval } from "./boss-arena";

describe("boss arena", () => {
  it("gives a long time limit", () => expect(BOSS_ARENA.timeLimit).toBeGreaterThanOrEqual(180));
  it("rubble takes a sizeable chunk of life", () => expect(rubbleDamage(100)).toBe(9));
  it("standing still costs much more score than moving", () => {
    expect(arenaScorePenalty(1, 3, false)).toBeLessThan(arenaScorePenalty(1, 0, false) * 4);
    expect(arenaScorePenalty(1, 0, true)).toBeLessThan(arenaScorePenalty(1, 0, false));
  });
  it("summons faster in overtime", () => expect(summonInterval(true)).toBeLessThan(summonInterval(false)));
  it("slams only after losing 40% life", () => { expect(canSlam(70, 100)).toBe(false); expect(canSlam(60, 100)).toBe(true); });
  it("arc lands at ground", () => { expect(slamArc(0)).toBe(0); expect(slamArc(1)).toBe(0); expect(slamArc(.5)).toBeCloseTo(BOSS_ARENA.slamHeight); });
  it("slam cloud is many slow shots and spawns 2 adds", () => {
    const c = slamCloud(Math.random); expect(c.length).toBe(BOSS_ARENA.slamShots);
    expect(Math.max(...c.map(s => s.speed))).toBeLessThan(4); expect(BOSS_ARENA.slamAdds).toBe(2); expect(BOSS_ARENA.slamBounces).toBeGreaterThanOrEqual(8);
  });
});
