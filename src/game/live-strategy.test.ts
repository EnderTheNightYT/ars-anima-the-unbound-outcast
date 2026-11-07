import { describe, expect, it } from "vitest";
import { liveStrategyFromGame, liveStrategyInput } from "./live-strategy";

const base = { cls: { name: "Caballero" }, level: 3, floor: 2, region: { name: "Cripta" }, hp: 25, hpMax: 50, stam: 5, stamMax: 10, lumbre: 2, food: 80, thirst: 60, burn: 0, poison: 1, bleed: 0, wounds: { brazo: 1 }, fatigue: 0, px: 0, py: 0, slot: 0, melee: { type: "ESPADA" }, ranged: null };

describe("live strategy input", () => {
  it("groups only living enemies within 14 tiles, nearest first", () => {
    const enemies = [
      { kind: "esqueleto", x: 3, y: 0, dead: false }, { kind: "esqueleto", x: 5, y: 0, dead: false },
      { kind: "rata", x: 1, y: 0, dead: false }, { kind: "rata", x: 2, y: 0, dead: true }, { kind: "lobo", x: 20, y: 0, dead: false },
    ];
    const i = liveStrategyFromGame({ ...base, enemies }, "rodeado");
    expect(i.encounter).toEqual([{ kind: "rata", count: 1, nearest: 1 }, { kind: "esqueleto", count: 2, nearest: 3 }]);
    expect(i.condition.hpPct).toBe(50);
    expect(i.condition.statuses).toEqual(["envenenado"]);
    expect(liveStrategyInput.safeParse(i).success).toBe(true);
  });
});
