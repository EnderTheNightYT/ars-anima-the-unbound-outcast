import { describe, it, expect, vi } from "vitest";
import { Game, emptyInput } from "./engine";
import { CLASSES } from "./data";
import { CHAINS } from "./melee-combo";
import { meleeStyle } from "./combat-fx";

const empty = () => emptyInput();

describe("melee combo in the engine", () => {
  it("consecutive hits advance the chain, pull the enemy, then the finisher launches it", () => {
    localStorage.clear(); vi.spyOn(Math, "random").mockReturnValue(0.97);
    const g = new Game(); g.start(CLASSES[0]!); g.restRoom = null;
    const w = g.melee; expect(w.base?.ranged).toBeFalsy();
    const n = CHAINS[meleeStyle(w.base?.type)].steps.length;
    g.enemies = g.enemies.slice(0, 1); const e = g.enemies[0]!;
    const steps: number[] = []; let finisherSpeed = 0;
    for (let i = 0; i < n; i++) {
      e.dead = false; e.hp = e.hpMax = 99999; e.def = 0; e.kx = e.ky = 0; e.grabbed = false;
      e.x = g.px + Math.cos(g.ang) * 1; e.y = g.py + Math.sin(g.ang) * 1; e.z = g.pz;
      g.attackCd = 0; g.playerStagger = 0; g.prev = {};
      g.update(0.016, { ...empty(), attack: true });
      steps.push(g.meleeStep);
      if (i === n - 1) finisherSpeed = Math.hypot(e.kx, e.ky);
      g.update(0.016, empty());
    }
    expect(steps).toEqual(Array.from({ length: n }, (_, i) => i + 1));
    expect(finisherSpeed).toBeGreaterThan(4);
    vi.restoreAllMocks();
  });
  it("plain-click chained swings come out faster than the first swing", () => {
    localStorage.clear(); vi.spyOn(Math, "random").mockReturnValue(0.97);
    const g = new Game(); g.start(CLASSES[0]!); g.restRoom = null;
    g.enemies = g.enemies.slice(0, 1); const e = g.enemies[0]!;
    const cds: number[] = [];
    for (let i = 0; i < 2; i++) {
      e.dead = false; e.hp = e.hpMax = 99999; e.def = 0; e.grabbed = false;
      e.x = g.px + Math.cos(g.ang) * 1; e.y = g.py + Math.sin(g.ang) * 1; e.z = g.pz;
      g.attackCd = 0; g.playerStagger = 0; g.prev = {};
      g.update(0.016, { ...empty(), attack: true });
      cds.push(g.attackCd);
      g.update(0.016, empty());
    }
    expect(g.meleeStep).toBe(2);
    expect(cds[1]!).toBeLessThan(cds[0]!);
    vi.restoreAllMocks();
  });
});
