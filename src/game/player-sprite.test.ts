import { describe, expect, it } from "vitest";
import { atlasCell, bodyFacing, pickAction, spriteDir, spriteMotion } from "./player-sprite";

const base = { speed: 0, sprinting: false, dashing: false, crouching: false, sliding: false, swinging: false, heavy: false, ranged: false, aiming: false };
describe("player sprite", () => {
  it("back to camera is N, facing camera is S, screen-right is E", () => {
    expect(spriteDir(1, 1)).toBe("N"); expect(spriteDir(1 + Math.PI, 1)).toBe("S");
    expect(spriteDir(Math.PI / 2, 0)).toBe("E"); expect(spriteDir(-Math.PI / 4, 0)).toBe("NW");
  });
  it("picks the 7 actions", () => {
    expect(pickAction(base)).toBe("idle");
    expect(pickAction({ ...base, speed: 2 })).toBe("walk");
    expect(pickAction({ ...base, speed: 2, dashing: true })).toBe("run");
    expect(pickAction({ ...base, crouching: true })).toBe("crouch");
    expect(pickAction({ ...base, ranged: true, aiming: true })).toBe("shoot");
    expect(pickAction({ ...base, swinging: true })).toBe("melee_light");
    expect(pickAction({ ...base, swinging: true, heavy: true })).toBe("melee_heavy");
  });
  it("walking faces movement, shooting faces the aim", () => {
    expect(bodyFacing(0, 0, 2, "walk")).toBeCloseTo(Math.PI / 2);
    expect(bodyFacing(0, 0, 2, "shoot")).toBe(0);
  });
  it("walk alternates source rows 2 and 3", () => {
    const rows = new Set([0, .2, .4, .6].map(t => atlasCell("walk", "S", t, 2.2).row));
    expect(rows).toEqual(new Set([1, 2]));
  });
  it("breathing is barely perceptible", () => {
    for (let t = 0; t < 4; t += .3) { const m = spriteMotion(t, 0, 0, 0); expect(Math.abs(m.scaleY - 1)).toBeLessThanOrEqual(.0151); expect(Math.abs(m.sway)).toBe(0); }
  });
});

describe("mirrored frames", () => {
  it("run alternates the facing cell with the flipped opposite-side cell", () => {
    const a = atlasCell("run", "E", 0), b = atlasCell("run", "E", 0.1);
    expect([a.col, a.flip]).toEqual([2, false]);
    expect([b.col, b.flip]).toEqual([6, true]);
  });
  it("N/S mirror onto themselves; idle never flips", () => {
    expect(atlasCell("run", "S", 0.1).col).toBe(4);
    expect([0, .3, .6].some(t => atlasCell("idle", "E", t).flip)).toBe(false);
  });
});
