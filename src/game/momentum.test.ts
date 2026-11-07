import { describe, it, expect } from "vitest";
import { frenzy, frenzyWindow, OPENING, needPenalty, rollAttributes, ATTR_SPREAD, mirrorPick } from "./momentum";

describe("momentum rules", () => {
  it("no frenzy on the first kill, then grows cumulatively", () => {
    expect(frenzy(1)).toEqual({ move: 1, rate: 1, charge: 1 });
    const a = frenzy(3), b = frenzy(6);
    expect(b.move).toBeGreaterThan(a.move);
    expect(b.rate).toBeLessThan(a.rate);
    expect(b.charge).toBeGreaterThan(a.charge);
  });
  it("frenzy is capped", () => {
    expect(frenzy(99).move).toBeLessThanOrEqual(1.6);
    expect(frenzy(99).rate).toBeGreaterThanOrEqual(0.45);
  });
  it("streak window ends at zero streak", () => {
    expect(frenzyWindow(0)).toBe(0);
    expect(frenzyWindow(1)).toBe(7);
  });
  it("opening after enemy miss doubles damage", () => { expect(OPENING.mult).toBe(2); });
  it("needs penalise only when low", () => {
    expect(needPenalty(80, 80, 10).active).toBe(false);
    expect(needPenalty(10, 80, 10).damage).toBeLessThan(1);
  });
  it("rolled attributes stay within spread of class base", () => {
    const r = rollAttributes({ FUE: 90 });
    expect(Math.abs((r["FUE"] ?? 0) - 90)).toBeLessThanOrEqual(ATTR_SPREAD);
  });
  it("mirror pick always returns a buff", () => { expect(mirrorPick(0.999)).toBeTruthy(); });
});
