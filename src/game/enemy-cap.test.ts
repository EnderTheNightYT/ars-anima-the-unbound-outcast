import { describe, it, expect } from "vitest";
import { enemyCap } from "./enemy-cap";
describe("enemyCap", () => {
  it("piso 1: 14 en el nivel y 4 cerca", () => expect(enemyCap(1)).toEqual({ level: 14, nearby: 4 }));
  it("crece con el piso con techo", () => expect(enemyCap(20)).toEqual({ level: 22, nearby: 7 }));
});
