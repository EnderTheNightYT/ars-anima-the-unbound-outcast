import { describe, it, expect } from "vitest";
import { kickDamage, meleeStyle, KICK } from "./combat-fx";

describe("kick and melee fx", () => {
  it("kick always deals at least base damage and scales with strength", () => {
    expect(kickDamage(-2)).toBe(KICK.base);
    expect(kickDamage(3)).toBe(KICK.base + 3 * KICK.perStr);
  });
  it("kick shoves staggered enemies harder", () => { expect(KICK.pushStaggered).toBeGreaterThan(KICK.push); });
  it("weapon types pick cut / smash / pierce impacts", () => {
    expect(meleeStyle("ESPADA")).toBe("cut");
    expect(meleeStyle("MARTILLO")).toBe("smash");
    expect(meleeStyle("LANZA")).toBe("pierce");
  });
});
