import { describe, it, expect } from "vitest";
import { CHAINS, COMBO_WINDOW, nextComboStep, comboStep, isFinisher, comboSwingMult } from "./melee-combo";

describe("melee combos", () => {
  it("chains hits inside the window and restarts after it", () => {
    expect(nextComboStep("cut", 1, COMBO_WINDOW - .1)).toBe(2);
    expect(nextComboStep("cut", 2, COMBO_WINDOW + .1)).toBe(1);
  });
  it("restarts after the finisher", () => {
    const n = CHAINS.smash.steps.length;
    expect(isFinisher("smash", n)).toBe(true);
    expect(nextComboStep("smash", n, .1)).toBe(1);
  });
  it("intermediate hits pull the enemy, finishers push it away", () => {
    for (const st of ["cut", "smash", "pierce", "punch"] as const) {
      const n = CHAINS[st].steps.length;
      expect(comboStep(st, 1).push).toBeLessThan(0);
      expect(comboStep(st, n).push).toBeGreaterThan(5);
      expect(comboStep(st, n).dmg).toBeGreaterThan(comboStep(st, 1).dmg);
    }
  });
  it("each weapon family has its own finisher", () => {
    expect(CHAINS.smash.finisher).toBe("slam");
    expect(CHAINS.pierce.finisher).toBe("thrust");
    expect(CHAINS.cut.finisher).toBe("sweep");
    expect(CHAINS.punch.finisher).toBe("uppercut");
  });
  it("quick-click chains swing faster each step and the finisher winds up slower", () => {
    expect(comboSwingMult(1, false)).toBe(1);
    expect(comboSwingMult(2, false)).toBeLessThan(comboSwingMult(1, false));
    expect(comboSwingMult(3, false)).toBeLessThan(comboSwingMult(2, false));
    expect(comboSwingMult(9, false)).toBeGreaterThanOrEqual(0.62);
    expect(comboSwingMult(3, true)).toBeGreaterThan(1);
  });
});
