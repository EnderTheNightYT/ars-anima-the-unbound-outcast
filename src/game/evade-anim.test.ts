import { describe, expect, it } from "vitest";
import { EVADE_ANIM, evadeMotion, evadeStyle } from "./combat-fx";

describe("animación visible de esquiva", () => {
  it("sin esquiva activa el sprite no se mueve", () => {
    expect(evadeMotion(0, .4, "side", 1)).toEqual({ lat: 0, up: 0, shake: 0, squash: 1 });
  });
  it("el paso lateral llega a su máximo a mitad de la esquiva y vuelve al terminar", () => {
    expect(evadeMotion(.2, .4, "side", 0).lat).toBeCloseTo(EVADE_ANIM.lateral);
    expect(evadeMotion(.0001, .4, "side", 0).lat).toBeLessThan(.01);
  });
  it("el salto eleva el sprite y desplaza menos a los lados", () => {
    const m = evadeMotion(.2, .4, "hop", 0);
    expect(m.up).toBeCloseTo(EVADE_ANIM.hop);
    expect(m.lat).toBeLessThan(EVADE_ANIM.lateral);
  });
  it("tiembla durante la esquiva", () => {
    const vals = [0.01, 0.02, 0.03, 0.04].map(t => evadeMotion(.3, .4, "side", t).shake);
    expect(Math.max(...vals.map(Math.abs))).toBeGreaterThan(0);
  });
  it("los enemigos pesados nunca saltan; los ágiles a veces", () => {
    expect(evadeStyle(true, () => 0)).toBe("side");
    expect(evadeStyle(false, () => 0)).toBe("hop");
    expect(evadeStyle(false, () => .99)).toBe("side");
  });
});
