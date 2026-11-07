import { describe, expect, it } from "vitest";
import { evolution, newTraits, threatLevel } from "./evolution";

describe("enemy evolution", () => {
  it("threat rises with floor, kills and player level", () => {
    expect(threatLevel(1, 0, 1)).toBe(1);
    expect(threatLevel(3, 0, 1)).toBe(3);
    expect(threatLevel(1, 24, 1)).toBe(3);
    expect(threatLevel(1, 0, 5)).toBe(3);
    expect(threatLevel(99, 9999, 99)).toBe(30);
  });
  it("higher threat means more hp and new traits", () => {
    expect(evolution(1).traits).toEqual([]);
    expect(evolution(5).traits).toEqual(["embestida", "disparo"]);
    expect(evolution(10).hp).toBeGreaterThan(evolution(2).hp);
    expect(newTraits(6, 9)).toEqual(["garra", "coraza"]);
  });
});
