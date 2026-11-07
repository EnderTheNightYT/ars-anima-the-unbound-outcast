import { describe, expect, it } from "vitest";
import { emptyInput as emptyInputLocal } from "./engine";
import { Game } from "./engine";
import { CLASSES } from "./data";

const startGame = () => { localStorage.clear(); const cls=CLASSES[0];if(!cls)throw new Error('Missing class');const g = new Game(); g.start(cls); g.enemies = []; g.restRoom=null; return g; };
const place = (g: Game) => {
  g.spawn("sombra", g.px + 1, g.py);
  const e = g.enemies[0]!; e.x = g.px + 1; e.y = g.py; e.def = 99; e.hp = e.hpMax = 9999;
  return e;
};

describe("stealth", () => {
  it("unaware enemy struck from behind always takes a critical hit", () => {
    const g = startGame(); const e = place(g);
    e.aware = false; e.face = 0; // mirando en dirección opuesta al jugador (que está a su izquierda)
    const before = e.hp;
    g.attackEnemy(e, g.melee);
    expect(e.hp).toBeLessThan(before);
    expect(g.legacy.backstabs).toBe(1);
  });
  it("any hit makes the enemy aware", () => {
    const g = startGame(); const e = place(g); e.aware = false; e.face = Math.PI;
    g.attackEnemy(e, g.melee);
    expect(e.aware).toBe(true);
  });
  it("a prepared aimed ranged shot skips the miss roll", () => {
    const g = startGame(); const e = place(g); e.aware = true; g.stillT = 1;
    const before = e.hp; g.attackEnemy(e, g.ranged, 1.2, {precision:true});
    expect(e.hp).toBeLessThan(before);
  });
});

describe("lockpicking", () => {
  it("levels up after lvl*3+3 experience and persists", () => {
    const g = startGame();
    g.lockXp(6);
    expect(g.legacy.lockLvl).toBe(2);
    expect(JSON.parse(localStorage.getItem("ars_anima_legacy")!).lockLvl).toBe(2);
  });
});

describe("doors", () => {
  const withDoor = () => { const g = startGame(); const x = Math.floor(g.px) + 1, y = Math.floor(g.py); g.map[y * 40 + x] = 6; g.ang = 0; return { g, x, y }; };
  it("E opens slowly (still closed after 1s)", () => {
    const { g, x, y } = withDoor(); g.openDoor(x + 0.5, y + 0.5);
    g.updateSurvival(1); expect(g.map[y * 40 + x]).toBe(6);
    g.updateSurvival(1.2); expect(g.map[y * 40 + x]).toBe(0);
  });
  it("breaching stuns a nearby enemy for 3 seconds", () => {
    const { g, x, y } = withDoor(); g.spawn("sombra", x + 1.5, y + 0.5); const e = g.enemies[0]!; e.hp = e.hpMax = 999;
    expect(g.breachDoor(x + 0.5, y + 0.5)).toBe(true);
    expect(e.stun).toBe(3);
  });
  it("firearms alert distant enemies, daggers do not", () => {
    const g = startGame(); g.spawn("sombra", g.px + 1, g.py); const e = g.enemies[0]!; e.x = g.px + 10; e.aware = false;
    const gun = { ...g.ranged, base: { ...g.ranged.base!, type: "ESCOPETA", ranged: true } };
    const dagger = { ...g.melee, base: { ...g.melee.base!, type: "DAGA", ranged: false } };
    g.weaponNoise(dagger); expect(e.aware).toBe(false);
    g.weaponNoise(gun); expect(e.aware).toBe(true);
  });
});

describe("chip streak", () => {
  it("adds +0.5x chips per consecutive kill and resets after the window", () => {
    const g = startGame(); g.combo = 0;
    for (let i = 0; i < 3; i++) { g.spawn("sombra", g.px + 1, g.py); g.killEnemy(g.enemies[g.enemies.length - 1]!); }
    expect(g.killStreak).toBe(3);
    expect(g.chipMult()).toBe(2);
    g.mode = "play"; g.streakT = 0.01; g.update(0.05, { ...emptyInputLocal() });
    expect(g.killStreak).toBe(0);
  });
});
