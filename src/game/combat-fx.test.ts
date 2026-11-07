import { describe, expect, it } from "vitest";
import { rangedProfile, volleyOffsets, falloffMult, regenHeal, sanityChance, addSanity, STAMINA, DASH, RETREAT, retreatChance, damageCause } from "./combat-fx";

describe("ranged weapon profiles", () => {
  it("bow is a single slow shot", () => { const p = rangedProfile("ARCO"); expect(p.pellets).toBe(1); expect(p.burst).toBe(1); expect(p.speed).toBeLessThan(rangedProfile("PISTOLA").speed); });
  it("pistol fires fast bullets", () => expect(rangedProfile("PISTOLA").speed).toBeGreaterThanOrEqual(30));
  it("shotgun fans several slower bouncing pellets in a V", () => {
    const p = rangedProfile("ESCOPETA", 5);
    expect(p.pellets).toBeGreaterThan(5); expect(p.bounces).toBeGreaterThan(0); expect(p.speed).toBeLessThan(rangedProfile("PISTOLA").speed);
    const o = volleyOffsets(p, false); expect(o[0]).toBeLessThan(0); expect(o[o.length - 1]).toBeGreaterThan(0);
  });
  it("shotgun hits harder close than far", () => expect(falloffMult(0.5, 6)).toBeGreaterThan(falloffMult(5.5, 6)));
  it("staffs fire big slow orbs with a shockwave", () => { const p = rangedProfile("FOCO"); expect(p.wave).toBeGreaterThan(0); expect(p.size).toBeGreaterThan(rangedProfile("PISTOLA").size); expect(p.speed).toBeLessThan(10); });
  it.each(["RIFLE", "FUSIL", "SUBFUSIL"])("%s fires 3-round bursts", (t) => expect(rangedProfile(t).burst).toBe(3));
});

describe("stamina and regeneration", () => {
  it("jump, charged attack and dash cost stamina", () => { expect(STAMINA.jump).toBeGreaterThan(0); expect(STAMINA.charged).toBeGreaterThan(0); expect(STAMINA.dash).toBeGreaterThan(0); });
  it("dash pushes further than before (16)", () => expect(DASH.speed).toBeGreaterThan(16));
  it("only regenerating kinds heal, and only on a low roll", () => {
    expect(regenHeal("sanguijuela", 10, 40, 0.01)).toBe(10);
    expect(regenHeal("sanguijuela", 10, 40, 0.5)).toBe(0);
    expect(regenHeal("soldado", 10, 40, 0.01)).toBe(0);
  });
});

describe("hidden sanity", () => {
  it("no episodes early on", () => expect(sanityChance(15)).toBe(0));
  it("episodes stay rare mid-way and peak at about one per 50s", () => { expect(sanityChance(50)).toBeLessThan(0.005); expect(sanityChance(100)).toBeCloseTo(0.02); });
  it("scares raise it more than kills", () => expect(addSanity(0, "scream")).toBeGreaterThan(addSanity(0, "kill")));
});

describe("enemy retreat after being hit", () => {
  it("has a base chance with no kill streak", () => {
    expect(retreatChance(0, false)).toBeCloseTo(RETREAT.base);
    expect(retreatChance(1, false)).toBeCloseTo(RETREAT.base);
  });
  it("grows with each streak point from 2 onward", () => {
    expect(retreatChance(2, false)).toBeGreaterThan(retreatChance(1, false));
    expect(retreatChance(5, false)).toBeGreaterThan(retreatChance(2, false));
  });
  it("is capped so enemies still fight back", () => {
    expect(retreatChance(30, false)).toBeLessThanOrEqual(RETREAT.max);
  });
  it("heavy enemies rarely give ground", () => {
    expect(retreatChance(4, true)).toBeCloseTo(retreatChance(4, false) * RETREAT.heavyMult);
  });
});

describe("damage causes", () => {
  it("names poison, fire, bleed, hunger and thirst as life-loss causes", () => {
    expect(damageCause("veneno").label).toBe("Veneno");
    expect(damageCause("fuego").label).toBe("Fuego");
    expect(damageCause("sangrado").label).toBe("Sangrado");
    expect(damageCause("hambre").label).toBe("Hambre");
    expect(damageCause("sed").label).toBe("Sed");
  });
  it("names traps, projectiles and explosions", () => {
    expect(damageCause("trampa").label).toBe("Trampa");
    expect(damageCause("proyectil").label).toBe("Proyectil");
    expect(damageCause("explosión").label).toBe("Explosión");
  });
  it("falls back to naming the attacking enemy", () => {
    expect(damageCause("Perro sarnoso").label).toBe("Ataque de Perro sarnoso");
  });
});
