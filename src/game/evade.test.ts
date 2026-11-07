import { describe, expect, it } from "vitest";
import { EVADE, evadeChance } from "./combat-fx";

describe("enemy evasion stays moderate", () => {
  it("dodges at most about a third of incoming shots", () => { expect(evadeChance("projectile", 1 / 60, false)).toBeCloseTo(.35); });
  it("heavy enemies dodge much less", () => { expect(evadeChance("projectile", 1 / 60, true)).toBeLessThan(.15); });
  it("cooldown between dodges is at least 1.8s", () => { expect(EVADE.cooldown[0]).toBeGreaterThanOrEqual(1.8); });
  it("an evade leaves a punish window before striking", () => { expect(EVADE.recover).toBeGreaterThan(0); });
});
