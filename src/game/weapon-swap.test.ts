import { describe, expect, it } from "vitest";
import { nextSwapStacks, swapDamageMult, swapStaggers } from "./weapon-swap";

describe("alternancia de armas", () => {
  it("cambiar tras acertar en combate suma una carga", () => expect(nextSwapStacks(1, 1, true)).toBe(2));
  it("fuera de combate no da ventaja", () => expect(nextSwapStacks(2, 0.5, false)).toBe(0));
  it("sin golpe reciente se pierde el ritmo", () => expect(nextSwapStacks(3, 3, true)).toBe(0));
  it("tope de 4 cargas", () => expect(nextSwapStacks(4, 0.2, true)).toBe(4));
  it("cada carga da +12% daño", () => expect(swapDamageMult(4)).toBeCloseTo(1.48));
  it("aturde desde 3 cargas", () => { expect(swapStaggers(2)).toBe(false); expect(swapStaggers(3)).toBe(true); });
});
