import { describe, expect, it } from "vitest";
import { baseGlow, playerGlow, hexHue, hueGap, GLOW, CLASS_HUE } from "./glow";

describe("player glow colour", () => {
  it("starts from the class hue, within the allowed shifts", () => {
    const b = baseGlow({ clsId: "guardian", name: "Ana", role: "tanque", salt: .5 });
    expect(hueGap(b.h, CLASS_HUE["guardian"]!)).toBeLessThanOrEqual(6 + GLOW.jitter);
  });
  it("same class, name, roles and salt give the same colour", () => {
    const p = { clsId: "duelista", subclassId: "x", name: "Leo", role: "dano", role2: "control", salt: .3 };
    expect(playerGlow(p)).toBe(playerGlow({ ...p }));
  });
  it("salt only nudges the hue by at most the jitter", () => {
    const a = baseGlow({ clsId: "hereje", name: "Z", role: "dano", salt: 0 }), b = baseGlow({ clsId: "hereje", name: "Z", role: "dano", salt: .999 });
    expect(hueGap(a.h, b.h)).toBeLessThanOrEqual(GLOW.jitter * 2);
  });
  it("two players of the same class end up at least minGap degrees apart", () => {
    const first = playerGlow({ clsId: "cazador", name: "A", role: "dano", salt: .5 });
    const second = playerGlow({ clsId: "cazador", name: "A", role: "dano", salt: .5 }, [first]);
    expect(hueGap(hexHue(first)!, hexHue(second)!)).toBeGreaterThanOrEqual(GLOW.minGap - 2);
  });
});
