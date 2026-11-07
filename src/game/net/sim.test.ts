// @ts-nocheck -- pruebas de la simulación compartida: acceso directo a contextos de jugador
import { describe, it, expect } from "vitest";
import { ExpeditionSim, ClientCache } from "./sim";
import { MP } from "./rules";

function make(mode: "coop" | "traicion" | "caos", n = 2) {
  const sim = new ExpeditionSim({ mode, difficulty: "facil", seed: 4242 });
  for (let i = 0; i < n; i++) sim.addPlayer(`p${i}`, "", `J${i}`);
  sim.start();
  // Sin enemigos ni eventos aleatorios: cada prueba aísla una regla.
  sim.g.enemies = []; sim.g.pickups = []; sim.marks = []; sim.eventT = 1e9; sim.duelT = 1e9;
  return sim;
}
const P = (sim, i) => sim.players.get(`p${i}`);
const place = (p, x, y, ang = 0) => { p.ctx.px = x; p.ctx.py = y; p.ctx.ang = ang; p.input.ang = ang; };
/** Punto libre fuera del refugio y lejos de cualquier objeto interactuable. */
const freeSpot = (sim) => {
  const g = sim.g, open = (x, y) => g.cell(x, y) === 0 && !g.isSafe(x, y, 1);
  for (let y = 2.5; y < 38; y++) for (let x = 2.5; x < 36; x++) {
    if ([[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [2, 0]].every(([dx, dy]) => open(x + dx, y + dy))) return { x, y };
  }
  throw new Error("sin sala libre");
};
const run = (sim, seconds) => { for (let t = 0; t < seconds; t += 1 / 30) sim.step(1 / 30); };

describe("expedición compartida", () => {
  it("todos los jugadores comparten piso y cada uno tiene su propio personaje", () => {
    const sim = make("coop", 3);
    expect(sim.phase).toBe("play");
    const ids = new Set([0, 1, 2].map(i => P(sim, i).ctx));
    expect(ids.size).toBe(3);
    run(sim, 1);
    for (const i of [0, 1, 2]) expect(P(sim, i).state).toBe("alive");
    const snap = sim.snapshotFor("p0", new ClientCache());
    expect(snap.pl).toHaveLength(3);
    expect(snap.floor.seed).toBe(sim.g.floorSeed);
  });

  it("un botín sólo lo recoge un jugador aunque dos lleguen a la vez", () => {
    const sim = make("coop");
    const s = freeSpot(sim);
    const pk = { x: s.x, y: s.y, kind: "gold", n: 37, bob: 0, used: false, netId: 9999 };
    sim.g.pickups.push(pk);
    const a = P(sim, 0), b = P(sim, 1);
    place(a, s.x, s.y); place(b, s.x + .05, s.y);
    const before = a.ctx.gold + b.ctx.gold;
    run(sim, .2);
    expect(pk.used).toBe(true);
    expect(a.ctx.gold + b.ctx.gold - before).toBe(37);
  });

  it("en cooperativa los golpes entre jugadores no hacen daño; en caótica sí", () => {
    for (const mode of ["coop", "caos"] as const) {
      const sim = make(mode); const s = freeSpot(sim); const a = P(sim, 0), b = P(sim, 1);
      place(a, s.x, s.y, 0); place(b, s.x + .9, s.y, Math.PI);
      const hp0 = b.ctx.hp;
      sim.setInput("p0", { attack: true, ang: 0, pitch: 0 }); sim.step(1 / 30); sim.setInput("p0", { attack: false, ang: 0, pitch: 0 });
      run(sim, .5);
      if (mode === "coop") expect(b.ctx.hp).toBe(hp0); else expect(b.ctx.hp).toBeLessThan(hp0);
    }
  });

  it("robar por la espalda sólo funciona en modos con robo", () => {
    for (const mode of ["coop", "traicion"] as const) {
      const sim = make(mode); const s = freeSpot(sim); const thief = P(sim, 0), victim = P(sim, 1);
      victim.ctx.gold = 100; thief.ctx.gold = 0;
      place(victim, s.x + 1, s.y, 0); place(thief, s.x, s.y, 0); // la víctima mira hacia +x: el ladrón está detrás
      sim.setInput("p0", { interact: true, ang: 0, pitch: 0 }); sim.step(1 / 30); sim.setInput("p0", { interact: false, ang: 0, pitch: 0 });
      if (mode === "coop") { expect(victim.ctx.gold).toBe(100); expect(thief.stats.stolen).toBe(0); }
      else { expect(victim.ctx.gold).toBe(85); expect(thief.stats.stolen).toBe(15); expect(thief.stats.betrayals).toBe(1); }
    }
  });

  it("un aliado caído se levanta manteniendo E el tiempo indicado", () => {
    const sim = make("coop"); const s = freeSpot(sim); const a = P(sim, 0), b = P(sim, 1);
    place(a, s.x, s.y); place(b, s.x + .8, s.y);
    b.pending.push({ dmg: 999, src: "prueba" }); run(sim, 1 / 30);
    expect(b.state).toBe("downed");
    sim.setInput("p0", { interact: true, ang: 0, pitch: 0 });
    run(sim, MP.reviveSeconds - .4);
    expect(b.state).toBe("downed");
    run(sim, .6);
    expect(b.state).toBe("alive");
    expect(a.stats.revives).toBe(1);
  });

  it("dar fichas exige estar cerca y no crea dinero", () => {
    const sim = make("coop"); const s = freeSpot(sim); const a = P(sim, 0), b = P(sim, 1);
    a.ctx.gold = 50; b.ctx.gold = 0;
    place(a, s.x, s.y); place(b, s.x + 10, s.y);
    expect(sim.give("p0", "p1", { gold: 20 })).toBe(false);
    place(b, s.x + 1, s.y);
    expect(sim.give("p0", "p1", { gold: 80 })).toBe(true);
    expect(a.ctx.gold + b.ctx.gold).toBe(50);
    expect(b.ctx.gold).toBe(50);
  });

  it("las acciones de menú rechazan métodos no permitidos y objetos falsificados", () => {
    const sim = make("coop");
    expect(sim.rpc("p0", "finishFloor", [])).toBe(false);
    expect(sim.rpc("p0", "acceptQuest", [{ reward: 99999 }, 1])).toBe(false);
    expect(sim.rpc("p0", "equip", [{ uid: 1, name: "Espada falsa" }])).toBe(false);
    expect(sim.rpc("p0", "use", ["venda"])).toBe(true);
  });
});
