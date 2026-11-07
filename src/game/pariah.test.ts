import { describe, it, expect, beforeEach } from "vitest";
import {
  pariahStep, notePariahAction, readPariahState, redeemPariahCode, euphoria, paroxysm, painBonus, tempBonus, fistDamage,
  napeHit, takenMult, accelMult, splitPain, ruptureRadius, waveHits, rupturePush, impulsePower, pariahXp, growthAttrs, PARIAH,
  stackWound, woundLevel, voidChance,
} from "./pariah";
import { Game } from "./engine";
import { CLASSES } from "./data";

beforeEach(() => localStorage.clear());

describe("P.A.R.I.A.H · desbloqueo secreto", () => {
  it("las cinco acciones en orden la desbloquean", () => {
    let s = 0; for (const a of ["bench", "food", "drink", "meleeKill", "merchant"] as const) s = pariahStep(s, a);
    expect(s).toBe(6);
  });
  it("una acción fuera de orden reinicia el progreso a cero", () => {
    expect(pariahStep(2, "meleeKill")).toBe(0);
    expect(pariahStep(3, "otherKill")).toBe(0);
    expect(pariahStep(3, "merchant")).toBe(0);
  });
  it("el progreso persiste en almacenamiento y sobrevive a recargas", () => {
    notePariahAction("bench"); notePariahAction("food");
    expect(readPariahState()).toBe(2);
    expect(notePariahAction("drink")).toBe(false); expect(notePariahAction("meleeKill")).toBe(false);
    expect(notePariahAction("merchant")).toBe(true); expect(readPariahState()).toBe(6);
  });
  it("el código secreto de prueba desbloquea la clase", () => {
    expect(redeemPariahCode("otra cosa")).toBe(false); expect(readPariahState()).toBe(0);
    expect(redeemPariahCode("sin dueño")).toBe(true); expect(readPariahState()).toBe(6);
  });
});

describe("P.A.R.I.A.H · combate", () => {
  it("daño de puño determinista ×1,8 sin aleatoriedad", () => {
    const o = { fueMod: 2, temp: 1, combo: { dmg: 0 }, pain: 0, euphoria: { str: 0 }, situation: 1 };
    const a = fistDamage(o), b = fistDamage(o);
    expect(a).toBe(b); expect(a).toBeCloseTo((4.5 + 2 * 1.6 * 2 + 3) * 1.8, 2);
  });
  it("Paroxismo y Euforia respetan sus techos (+30 % y +20 %)", () => {
    expect(paroxysm(500).dmg).toBe(.3); expect(paroxysm(20).active).toBe(true); expect(paroxysm(4).dmg).toBe(0);
    expect(euphoria(1).str).toBe(0); expect(euphoria(2).str).toBeCloseTo(.08); expect(euphoria(30).str).toBe(.2);
  });
  it("las bonificaciones temporales combinadas nunca pasan de +50 %", () => {
    expect(tempBonus(.3, .2, .4)).toBe(.5);
    const o = { fueMod: 0, temp: 1, combo: { dmg: .3 }, pain: .4, euphoria: { str: .2 }, situation: 1 };
    expect(fistDamage(o)).toBeCloseTo(7.5 * 1.8 * 1.5, 2);
    expect(painBonus(1000, 100)).toBe(.4);
  });
  it("Dolor Diferido: 60 % acumulado, 15 % reflejado, nunca más que lo recibido", () => {
    const s = splitPain(20, true);
    expect(s.store).toBeCloseTo(12); expect(s.now).toBeCloseTo(8); expect(s.reflect).toBeCloseTo(3);
    expect(splitPain(20, false)).toEqual({ now: 20, store: 0, reflect: 0 });
  });
  it("la nuca sólo multiplica ×2,5 golpes posteriores a la cabeza", () => {
    expect(napeHit(0, 0, 0, -2, 0, true)).toBe(true);
    expect(napeHit(0, 0, 0, -2, 0, false)).toBe(false);
    expect(napeHit(0, 0, 0, 2, 0, true)).toBe(false);
    expect(napeHit(0, 0, 0, 0, 2, true)).toBe(false);
    expect(takenMult({ res: 0 }, true) / takenMult({ res: 0 }, false)).toBeCloseTo(2.5);
  });
  it("Arranque Pesado: 65 % al empezar, 75 % tras 5 s", () => {
    expect(accelMult(0)).toBeCloseTo(.65); expect(accelMult(5)).toBeCloseTo(.75); expect(accelMult(99)).toBeCloseTo(.75);
  });
});

describe("Ruptura del Desposeído", () => {
  it("radios 1 / 1,6 / 2,3 con colisión independiente", () => {
    expect(ruptureRadius(1) / ruptureRadius(0)).toBeCloseTo(1.6); expect(ruptureRadius(2) / ruptureRadius(0)).toBeCloseTo(2.3);
    const near = 1, mid = 2.4, far = 3.6;
    expect([0, 1, 2].filter(w => waveHits(w, near, .3))).toEqual([0, 1, 2]);
    expect([0, 1, 2].filter(w => waveHits(w, mid, .3))).toEqual([1, 2]);
    expect([0, 1, 2].filter(w => waveHits(w, far, .3))).toEqual([2]);
  });
  it("jefes inmunes al empuje, pesados a la mitad", () => {
    expect(rupturePush(0, false, true)).toBe(0); expect(rupturePush(0, true, false)).toBe(rupturePush(0, false, false) / 2);
  });
});

describe("Impulso y progresión", () => {
  it("carga parcial desde 1 s, completa a 2,5 s", () => {
    expect(impulsePower(.9)).toBe(0); expect(impulsePower(1)).toBeCloseTo(.4); expect(impulsePower(2.5)).toBe(1); expect(impulsePower(9)).toBe(1);
  });
  it("+25 % de EXP por nivel y crecimiento sólo en FUE/RES/AGI desde el nivel 6", () => {
    expect(pariahXp(100)).toBe(125); expect(growthAttrs(5)).toEqual([]);
    for (let l = 6; l < 20; l++) for (const a of growthAttrs(l)) expect(PARIAH.growth.attrs).toContain(a);
  });
  it("heridas acumulables con niveles; críticas sólo con golpe crítico", () => {
    const a = stackWound(undefined, false); expect(woundLevel(a)).toBe(0);
    const b = stackWound(a, false); expect(woundLevel(b)).toBe(1);
    expect(woundLevel(stackWound(b, true))).toBe(3);
    expect(voidChance({ dark: 1, fatigue: 1, hunger: 1, head: true, wounds: 9, hpFrac: .1, danger: 1 })).toBeLessThanOrEqual(.45);
  });
});

describe("integración con el motor", () => {
  const pariah = () => CLASSES.find(c => c.id === "pariah")!;
  it("empieza con puños y escombros, sin armadura, y con +25 % de EXP necesaria", () => {
    const g = new Game(); g.start(pariah());
    expect(g.melee.base?.type).toBe("PUÑOS"); expect(g.ranged.base?.type).toBe("RUINAS"); expect(g.armor).toBeNull();
    const other = new Game(); other.start(CLASSES[0]!);
    expect(g.xpNext).toBe(Math.round(other.xpNext * 1.25));
  });
  it("no puede equipar armas: al usarlas las lanza", () => {
    const g = new Game(); g.start(pariah()); const w = g.makeWeapon("ESPADA", 0); g.bag.push(w);
    const before = g.projs.length; g.equip(w.uid);
    expect(g.melee.base?.type).toBe("PUÑOS"); expect(g.bag.includes(w)).toBe(false); expect(g.projs.length).toBe(before + 1);
  });
  it("las demás clases no reciben modificadores de P.A.R.I.A.H", () => {
    const g = new Game(); g.start(CLASSES[0]!); const w = g.makeWeapon("ESPADA", 0); g.bag.push(w); g.equip(w.uid);
    expect(g.melee.uid).toBe(w.uid); expect(g.armor).not.toBeNull();
  });
  it("la mochila admite el 60 % del peso normal", () => {
    const g = new Game(); g.start(pariah()); const o = new Game(); o.start(CLASSES[0]!);
    expect(g.canCarry(1500)).toBe(false); expect(o.canCarry(1500)).toBe(true);
  });
});
