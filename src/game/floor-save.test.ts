// @ts-nocheck
import { describe, expect, it } from "vitest";
import { applyFloor, captureFloor } from "./floor-save";

const make = () => ({
  floor: 2, floorSeed: 77, floorKills: 0, bossDead: false,
  enemies: [{ oid: 0, dead: false, hp: 10 }, { oid: 1, dead: false, hp: 10 }],
  pickups: [{ oid: 0, kind: "chest" }, { oid: 1, kind: "chest" }] as { oid?: number; kind: string; used?: boolean; n?: number }[],
  doors: new Set<number>(), breakables: new Set<number>(), visitedZones: new Set<string>(), clearedZones: new Set<string>(), seals: { 5: {}, 9: {} } as Record<number, unknown>,
});

describe("floor save", () => {
  it("restores killed enemies, opened chests, doors and drops on the same floor", () => {
    const a = make();
    a.enemies[0].dead = true; a.enemies[1].hp = 4; a.pickups[1].used = true; a.pickups.push({ kind: "gold", n: 30 });
    a.doors.add(12); delete a.seals[5]; a.floorKills = 1; a.bossDead = true;
    const s = captureFloor(a), b = make();
    expect(applyFloor(b, s)).toBe(true);
    expect(b.enemies.map(e => [e.oid, e.hp])).toEqual([[1, 4]]);
    expect(b.pickups[1].used).toBe(true);
    expect(b.pickups.find(p => p.kind === "gold")?.n).toBe(30);
    expect([...b.doors]).toEqual([12]);
    expect(Object.keys(b.seals)).toEqual(["9"]);
    expect(b.floorKills).toBe(1); expect(b.bossDead).toBe(true);
  });
  it("ignores state from another floor or seed", () => {
    const s = captureFloor(make()), b = make(); b.floorSeed = 78;
    expect(applyFloor(b, s)).toBe(false);
  });
});
