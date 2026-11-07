import { describe, it, expect } from "vitest";
import { getDifficulty, adaptOnHurt, adaptOnKill, ADAPT, challenge } from "./difficulty";

describe("difficulty", () => {
  it("defaults to normal", () => expect(getDifficulty("x").id).toBe("normal"));
  it("pesadilla hits harder than fácil", () => expect(getDifficulty("pesadilla").enemyDmg).toBeGreaterThan(getDifficulty("facil").enemyDmg));
  it("taking damage eases the challenge but never below min", () => {
    expect(adaptOnHurt(1, 10, 50, 40)).toBeLessThan(1);
    let a = 1; for (let i = 0; i < 200; i++) a = adaptOnHurt(a, 50, 50, 1);
    expect(a).toBe(ADAPT.min);
  });
  it("healthy kills raise the challenge up to max", () => {
    let a = 1; for (let i = 0; i < 200; i++) a = adaptOnKill(a, 50, 50);
    expect(a).toBe(ADAPT.max);
  });
  it("normal at neutral adapt is unchanged", () => expect(challenge(getDifficulty("normal"), 1)).toEqual({ dmg: 1, hp: 1, evade: 1 }));
});
import { performanceDelta, dodgeNotice } from "./difficulty";
describe("performance & notices", () => {
  it("heavy damage eases", () => expect(performanceDelta(40, 50, 0)).toBeLessThan(0));
  it("clean kills harden", () => expect(performanceDelta(0, 50, 3)).toBeGreaterThan(0));
  it("off hides notices", () => expect(dodgeNotice("off", 1, "X", "feint")).toBeNull());
  it("cerca hides far notices", () => expect(dodgeNotice("cerca", 6, "X", "feint")).toBeNull());
  it("reason text", () => expect(dodgeNotice("todos", 6, "X", "projectile")?.text).toContain("DISPARO"));
});
