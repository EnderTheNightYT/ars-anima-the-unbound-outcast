import { describe, expect, it } from "vitest";
import { walkSway, SWAY } from "./walk-sway";

describe("walk sway", () => {
  it("stays still when standing", () => {
    expect(walkSway(1.3, 0)).toEqual({ x: 0, y: 0, rot: 0, blur: 0, lines: 0 });
  });
  it("is subtle at full speed (blur under half a pixel, roll under 1 degree)", () => {
    for (let t = 0; t < 2; t += 0.07) {
      const s = walkSway(t, 10);
      expect(s.blur).toBeLessThanOrEqual(SWAY.maxBlur);
      expect(s.blur).toBeLessThan(0.5);
      expect(Math.abs(s.rot)).toBeLessThan(1);
      expect(Math.abs(s.x)).toBeLessThan(4);
    }
  });
  it("shows side lines only when moving fast", () => {
    expect(walkSway(0.5, 1.5).lines).toBe(0);
    expect(walkSway(0.5, 6).lines).toBe(1);
  });
});

describe("figuras cercanas", () => {
  it("con un enemigo o compañero cerca no hay desenfoque ni giro", () => {
    const s = walkSway(1.1, 6, true, true);
    expect(s.blur).toBe(0); expect(s.rot).toBe(0);
  });
});
