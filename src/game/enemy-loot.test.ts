import { describe, expect, it } from "vitest";
import { ENEMY_LOOT, ELITE_LOOT_MULT, MAX_DROP_CHANCE, dropChance, rollEnemyLoot, weaponSources } from "./enemy-loot";
import { ENEMY_TYPES, WEAPONS } from "./data";

/** Secuencia fija de "dados" para las tiradas. */
const seq = (...v: number[]) => { let i = 0; return () => v[i++ % v.length]!; };

describe("botín de armas por enemigo", () => {
  it("ningún enemigo tiene el arma asegurada, ni siendo élite", () => {
    for (const kind of Object.keys(ENEMY_LOOT)) {
      expect(dropChance(kind)).toBeLessThan(1);
      expect(dropChance(kind, true, 5)).toBeLessThanOrEqual(MAX_DROP_CHANCE);
    }
  });
  it("una sombra suelta arma el 7 % de las veces y una élite el triple", () => {
    expect(dropChance("sombra")).toBeCloseTo(.07);
    expect(dropChance("sombra", true)).toBeCloseTo(.07 * ELITE_LOOT_MULT);
  });
  it("si la tirada supera la probabilidad no cae nada", () => {
    expect(rollEnemyLoot("sombra", false, 1, seq(.5))).toBeNull();
  });
  it("cada enemigo sólo suelta las armas de su tabla, con su variante", () => {
    const r = rollEnemyLoot("sombra", false, 1, seq(0, 0, .99));
    expect(r).toEqual({ type: "DAGA", variant: "ligera" });
    const r2 = rollEnemyLoot("sombra", false, 1, seq(0, .9));
    expect(r2?.type).toBe("PISTOLA");
  });
  it("la inscripción específica sólo viene con su probabilidad", () => {
    expect(rollEnemyLoot("sombra", false, 1, seq(0, 0, 0))?.affix).toBe("SANGRANTE");
    expect(rollEnemyLoot("sombra", false, 1, seq(0, 0, .5))?.affix).toBeUndefined();
  });
  it("no todos los enemigos sueltan la misma arma", () => {
    const sets = Object.values(ENEMY_LOOT).map(t => t.entries.map(e => e.type).sort().join(","));
    expect(new Set(sets).size).toBeGreaterThan(Object.keys(ENEMY_LOOT).length * .7);
  });
  it("todas las tablas usan enemigos y armas que existen en el juego", () => {
    const types = new Set(WEAPONS.map(w => w.type));
    for (const [kind, t] of Object.entries(ENEMY_LOOT)) {
      expect(ENEMY_TYPES[kind as keyof typeof ENEMY_TYPES], kind).toBeDefined();
      for (const e of t.entries) expect(types.has(e.type), `${kind} → ${e.type}`).toBe(true);
    }
  });
  it("la frecuencia real coincide con la probabilidad publicada en la wiki", () => {
    let s = 7; const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
    let daggers = 0; const N = 40000;
    for (let i = 0; i < N; i++) if (rollEnemyLoot("sombra", false, 1, rand)?.type === "DAGA") daggers++;
    const wiki = weaponSources("DAGA").find(x => x.kind === "sombra")!.chance;
    expect(wiki).toBeCloseTo(.07 * 6 / 8);
    expect(daggers / N).toBeCloseTo(wiki, 2);
  });
});
