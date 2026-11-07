import { describe, it, expect } from "vitest";
import { formatBeat } from "./BeatCue";
describe("cuenta del grave", () => {
  it("muestra segundos y milisegundos", () => { expect(formatBeat(1.4532)).toBe("1 s 453 ms"); expect(formatBeat(0.05)).toBe("0 s 050 ms"); expect(formatBeat(-0.1)).toBe("0 s 000 ms"); });
});
