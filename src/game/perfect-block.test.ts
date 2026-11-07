import { describe, it, expect } from "vitest";
import { PERFECT_BLOCK } from "./combat-fx";
describe("bloqueo perfecto", () => {
  it("reduce el daño recibido", () => expect(PERFECT_BLOCK.taken).toBeLessThan(1));
  it("devuelve el daño multiplicado", () => expect(PERFECT_BLOCK.reflect).toBeGreaterThan(1));
});
