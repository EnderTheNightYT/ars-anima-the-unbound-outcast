import { describe, it, expect } from "vitest";
import { pickFeud, ascend, FEUD } from "./feuds";
const en = (id: number, kind: string, x: number, extra = {}) => ({ id, kind, x, y: 5, dead: false, ...extra });
describe("peleas entre enemigos", () => {
  it("solo enfrenta especies distintas", () => { expect(pickFeud([en(1, "a", 5), en(2, "a", 6)], 5, 5)).toBeNull(); expect(pickFeud([en(1, "a", 5), en(2, "b", 6)], 5, 5)?.map(e => e.id)).toEqual([1, 2]); });
  it("ignora enemigos que ya te vieron o jefes", () => { expect(pickFeud([en(1, "a", 5, { aware: true }), en(2, "b", 6)], 5, 5)).toBeNull(); expect(pickFeud([en(1, "a", 5, { miniBoss: true }), en(2, "b", 6)], 5, 5)).toBeNull(); });
  it("el ganador asciende a Tirano una sola vez con 1,6× de vida", () => { const e = { hp: 3, hpMax: 50 }; expect(ascend(e)).toBe(true); expect(e.hpMax).toBe(80); expect(e.hp).toBe(80); expect(ascend(e)).toBe(false); expect(FEUD.tyrantDmg).toBe(1.3); });
});
