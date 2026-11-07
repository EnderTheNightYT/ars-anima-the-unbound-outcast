// @ts-nocheck -- pruebas de la simulación compartida: acceso directo a contextos de jugador
import { describe, it, expect } from "vitest";
import { ExpeditionSim, ClientCache, netFind } from "./sim";
import { ENEMY_LOOT as LOOT } from "../enemy-loot";

function make() {
  const sim = new ExpeditionSim({ mode: "coop", difficulty: "facil", seed: 777 });
  sim.addPlayer("p0", "", "Ana"); sim.addPlayer("p1", "", "Beto");
  sim.start(); sim.g.enemies = []; sim.g.pickups = []; sim.marks = []; sim.eventT = 1e9; sim.duelT = 1e9;
  return sim;
}

describe("botín del servidor conectado a la wiki", () => {
  it("el arma que recoge un jugador viaja sólo a su cliente, recortada", () => {
    const sim = make(); const g = sim.g;
    const w = g.makeWeapon("DAGA", 3);
    sim.cur = sim.players.get("p0"); g.foundWeapon(w); sim.cur = null;
    const c0 = new ClientCache(), c1 = new ClientCache();
    const s0 = sim.snapshotFor("p0", c0), s1 = sim.snapshotFor("p1", c1);
    expect(s0.fd).toHaveLength(1);
    expect(s0.fd[0]).toEqual({ name: w.name, rarity: 3, affixes: w.affixes ?? [], base: { type: "DAGA" } });
    expect(s1.fd).toBeUndefined();
    // Se entrega una sola vez.
    expect(sim.snapshotFor("p0", c0).fd).toBeUndefined();
    // Las armas raras se anuncian a todos.
    expect(sim.feed.some(f => f.kind === "loot" && f.text.includes("Ana obtuvo"))).toBe(true);
  });

  it("los enemigos del servidor sueltan sólo armas de su propia tabla", () => {
    const sim = make(); const g = sim.g; const kind = Object.keys(LOOT)[0];
    const allowed = new Set(LOOT[kind].entries.map(e => e.type));
    const seen = new Set();
    for (let i = 0; i < 400; i++) {
      g.pickups = [];
      const r = g.rooms.at(-1); g.spawn(kind, r.x + r.w / 2, r.y + r.h / 2); const e = g.enemies.at(-1);
      expect(e).toBeTruthy();
      sim.cur = sim.players.get("p0"); g.killEnemy(e); sim.cur = null;
      for (const pk of g.pickups) if (pk.kind === "item" && pk.item?.kind === "weapon") seen.add(pk.item.base?.type ?? pk.item.type);
      g.enemies = [];
    }
    expect(seen.size).toBeGreaterThan(0);
    for (const t of seen) expect(allowed.has(t)).toBe(true);
  });

  it("netFind descarta datos inválidos", () => {
    expect(netFind(null)).toBeNull();
    expect(netFind({ name: 3 })).toBeNull();
    expect(netFind({ name: "x", rarity: 99, base: { type: "daga" }, affixes: ["A", 2] })).toEqual({ name: "x", rarity: 5, affixes: ["A"], base: { type: "daga" } });
  });
});
