import { describe, expect, it } from "vitest";
import { stepWalkSway, WALK_SWAY } from "./camera";
import { musicFades } from "./beat";

describe("walk sway", () => {
  it("stays still when standing", () => {
    const s = { phase: 0, amount: 0 };
    for (let i = 0; i < 60; i++) { const r = stepWalkSway(s, 1 / 60, 0, true); expect(r.x).toBe(0); }
  });
  it("sways only a couple of pixels while walking", () => {
    const s = { phase: 0, amount: 0 }; let max = 0;
    for (let i = 0; i < 300; i++) max = Math.max(max, Math.abs(stepWalkSway(s, 1 / 60, 3, true).x));
    expect(max).toBeGreaterThan(0.5);
    expect(max).toBeLessThanOrEqual(WALK_SWAY.sidePx);
  });
});

describe("music loop fades", () => {
  it("fades in and out on a full song", () => {
    expect(musicFades(180)).toEqual({ fadeIn: 4, fadeOut: 6 });
  });
});
