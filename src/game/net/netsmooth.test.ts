import { describe, expect, it } from "vitest";
import { Track, ServerClock, INTERP } from "./interp";
import { Predictor, PREDICT } from "./predict";

const open = () => false;

describe("interpolación de compañeros y enemigos", () => {
  it("interpola entre dos muestras del servidor", () => {
    const t = new Track(); t.push(1, 0, 0, 0); t.push(1.1, 1, 0, 0);
    expect(t.at(1.05)!.x).toBeCloseTo(0.5);
  });
  it("extrapola poco cuando faltan paquetes", () => {
    const t = new Track(); t.push(1, 0, 0, 0); t.push(1.1, 1, 0, 0);
    expect(t.at(5)!.x).toBeCloseTo(1 + 10 * INTERP.maxExtrapolate);
  });
  it("no interpola un teletransporte", () => {
    const t = new Track(); t.push(1, 0, 0, 0); t.push(1.1, 20, 0, 0);
    expect(t.at(1.05)!.x).toBe(20);
  });
  it("el reloj del servidor sigue al paquete más rápido", () => {
    const c = new ServerClock(); c.observe(10, 100.2); c.observe(10.1, 100.25);
    expect(c.now(100.3)).toBeGreaterThan(10.1);
    expect(c.now(100.3)).toBeLessThan(10.25);
  });
});

describe("predicción del propio jugador", () => {
  it("se mueve al instante con la velocidad del motor", () => {
    const p = new Predictor(); p.reset(5, 5);
    for (let i = 0; i < 60; i++) p.step(1 / 60, { fx: 1, fy: 0, speed: 3.6, grounded: true }, open);
    expect(p.x).toBeGreaterThan(7.5); expect(p.x).toBeLessThan(8.6);
  });
  it("no atraviesa paredes", () => {
    const p = new Predictor(); p.reset(5, 5);
    for (let i = 0; i < 120; i++) p.step(1 / 60, { fx: 1, fy: 0, speed: 3.6, grounded: true }, (x) => x >= 6);
    expect(p.x).toBeLessThan(6);
  });
  it("corrige el error del servidor sin salto visible", () => {
    const p = new Predictor(); p.reset(0, 0); p.mark(1);
    const err = p.reconcile(1, 0.4, 0);
    expect(err).toBeCloseTo(0.4); expect(p.x).toBeCloseTo(0.4); expect(p.view().x).toBeCloseTo(0);
    for (let i = 0; i < 60; i++) p.step(1 / 60, { fx: 0, fy: 0, speed: 0, grounded: true }, open);
    expect(p.view().x).toBeCloseTo(0.4, 2);
  });
  it("si coincide con el servidor no corrige nada", () => {
    const p = new Predictor(); p.reset(1, 1); p.mark(7);
    expect(p.reconcile(7, 1, 1)).toBe(0);
  });
  it("un error grande salta directo a la posición del servidor", () => {
    const p = new Predictor(); p.reset(0, 0); p.mark(3);
    p.reconcile(3, PREDICT.snap + 1, 0);
    expect(p.view().x).toBeCloseTo(PREDICT.snap + 1);
  });
});
