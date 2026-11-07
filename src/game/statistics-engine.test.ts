import { it, expect, vi } from "vitest";
import { Game, emptyInput } from "./engine";
import { CLASSES } from "./data";
import { readStats, statisticsTotals } from "./statistics";

it("counts actual kills once, received weapons once and connected plain-click extensions per swing", () => {
  localStorage.clear(); const random = vi.spyOn(Math, "random").mockReturnValue(.97);
  try {
    const cls = CLASSES[0]; if (!cls) throw new Error("Missing class");
    const g = new Game(); g.start(cls); g.restRoom = null;
    const enemies = g.enemies.slice(0, 2); if (enemies.length < 2) throw new Error("Missing enemies");
    g.enemies = enemies;
    const hit = vi.spyOn(g, "attackEnemy").mockReturnValue(true);
    for (let i = 0; i < 2; i++) {
      for (const e of enemies) { e.dead = false; e.hp = e.hpMax = 99999; e.x = g.px + Math.cos(g.ang); e.y = g.py + Math.sin(g.ang); e.z = g.pz; e.grabbed = false; }
      g.attackCd = 0; g.playerStagger = 0; g.prev = {}; g.update(.016, { ...emptyInput(), attack: true }); g.update(.016, emptyInput());
    }
    expect(hit).toHaveBeenCalledTimes(4);
    expect(statisticsTotals(readStats()).combos).toBe(1);
    hit.mockRestore(); const enemy = enemies[0]; if (!enemy) throw new Error("Missing enemy");
    g.killEnemy(enemy); g.killEnemy(enemy);
    expect(statisticsTotals(readStats()).kills).toBe(1);
    const weapon = g.makeWeapon("ESPADA", 0); g.receiveItem(weapon); g.foundWeapon(weapon);
    expect(statisticsTotals(readStats()).weapons).toBe(1);
    expect(statisticsTotals(readStats()).played).toBe(1);
  } finally { random.mockRestore(); }
});