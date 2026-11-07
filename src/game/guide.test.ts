import { describe, expect, it } from "vitest";
import { GUIDE, compassWord } from "./guide";
describe("map guidance", () => {
  it("waits 150 s before the first hint, then every 45 s", () => { expect(GUIDE.first).toBe(150); expect(GUIDE.every).toBe(45); });
  it("names the direction relative to the view", () => {
    expect(compassWord(0)).toBe("delante");
    expect(compassWord(Math.PI)).toBe("detrás de ti");
    expect(compassWord(Math.PI / 3)).toBe("hacia la derecha");
    expect(compassWord(-Math.PI / 3)).toBe("hacia la izquierda");
  });
});
