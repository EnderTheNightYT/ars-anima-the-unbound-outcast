import { describe, expect, it } from "vitest";
import { dz, hatAxis, padActive, PAD_BUTTONS, readPads } from "./gamepad";

const b = (n: number, on: number[] = []) => Array.from({ length: n }, (_, i) => ({ pressed: on.includes(i), value: on.includes(i) ? 1 : 0 }));

describe("gamepad", () => {
  it("ignores stick drift inside the deadzone", () => { expect(dz(0.1)).toBe(0); expect(dz(1)).toBe(1); });
  it("only activates after a real move or press", () => {
    expect(padActive([0.05, -0.1], [false, false])).toBe(false);
    expect(padActive([0.8], [false])).toBe(true);
    expect(padActive([0], [true])).toBe(true);
  });
  it("maps triggers to attacks", () => { expect(PAD_BUTTONS[7]).toBe("attack"); expect(PAD_BUTTONS[6]).toBe("alternate"); });
  it("L3 deslizar / agacharse / machacar", () => expect(PAD_BUTTONS[10]).toBe("slide"));
  it("reconoce un mando estándar", () => {
    const s = readPads([{ mapping: "standard", axes: [1, 0, 0, -1], buttons: b(17, [0]) }]);
    expect(s.lsX).toBe(1); expect(s.rsY).toBe(-1); expect(s.pressed[0]).toBe(true);
  });
  it("mando Android sin mapeo: gatillos en ejes y cruceta en ejes", () => {
    const s = readPads([{ mapping: "", axes: [0, 0, 0, 0, 1, -1, 0, -1], buttons: b(6) }]);
    expect(s.pressed[6]).toBe(true); expect(s.pressed[7]).toBe(false); expect(s.pressed[12]).toBe(true);
  });
  it("ignora sensores sin botones y combina varios mandos", () => {
    const s = readPads([{ mapping: "", axes: [0.9, 0.9], buttons: [] }, { mapping: "standard", axes: [0, 0, 0, 0], buttons: b(17, [7]) }]);
    expect(s.lsX).toBe(0); expect(s.pressed[7]).toBe(true);
  });
  it("cruceta hat de un solo eje (PC/Android genérico)", () => {
    const rest = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1.2857];
    expect(hatAxis(rest)).toEqual([0, 0]);
    const s = readPads([{ mapping: "", axes: [0, 0, 0, 0, 0, 0, 0, 0, 0, 3 / 7], buttons: b(12) }]);
    expect(s.dpadX).toBe(-1); expect(s.pressed[14]).toBe(true);
  });
});
