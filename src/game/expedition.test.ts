import { describe, expect, it } from "vitest";
import { canExtract, collapseSeconds, expeditionPhase, lairOpen, COLLAPSE } from "./expedition";

const base = { noteRead: false, unlocked: false, hasMap: false, bossSpawned: false, bossDead: false, extracted: false };

describe("Expedition Collapse sequence", () => {
  it("follows document → code → map → lair → boss → collapse", () => {
    expect(expeditionPhase(base)).toBe(1);
    expect(expeditionPhase({ ...base, noteRead: true })).toBe(2);
    expect(expeditionPhase({ ...base, noteRead: true, unlocked: true })).toBe(3);
    expect(expeditionPhase({ ...base, noteRead: true, unlocked: true, hasMap: true })).toBe(4);
    expect(expeditionPhase({ ...base, hasMap: true, bossSpawned: true })).toBe(5);
    expect(expeditionPhase({ ...base, hasMap: true, bossSpawned: true, bossDead: true })).toBe(6);
  });
  it("collapse phase only starts after the boss dies", () => {
    expect(expeditionPhase({ ...base, hasMap: true, bossSpawned: true })).not.toBe(6);
  });
  it("the guardian only awakens with the map fragment", () => {
    expect(lairOpen({ hasMap: false })).toBe(false);
    expect(lairOpen({ hasMap: true })).toBe(true);
  });
  it("no automatic extraction: needs active collapse, time left and the player at the portal", () => {
    expect(canExtract(true, 10, true)).toBe(true);
    expect(canExtract(true, 10, false)).toBe(false);
    expect(canExtract(true, 0, true)).toBe(false);
    expect(canExtract(false, 10, true)).toBe(false);
  });
  it("deeper floors and harder difficulty give less time, never below the minimum", () => {
    expect(collapseSeconds(1)).toBe(150);
    expect(collapseSeconds(4)).toBeLessThan(collapseSeconds(1));
    expect(collapseSeconds(3, 1.5)).toBeLessThan(collapseSeconds(3, 1));
    expect(collapseSeconds(40, 1.6)).toBe(COLLAPSE.minSeconds);
  });
});

import { debrisAreaDamage, collapseSpawnInterval, collapseSpawnCap, canSpawnNearPlayer, debrisDamage as dd } from "./expedition";
describe("collapse fairness", () => {
  it("debris core hits full, edge 35%, outside zero", () => {
    expect(debrisAreaDamage(2, 0.5, 200)).toBe(dd(2));
    expect(debrisAreaDamage(2, 1.6, 200)).toBe(0);
    expect(debrisAreaDamage(2, 1.59, 200)).toBeLessThan(dd(2) * 0.4);
  });
  it("one impact never exceeds 18% of max HP", () => {
    expect(debrisAreaDamage(6, 0, 50)).toBe(9);
  });
  it("reinforcements every 25s tightening to 18s", () => {
    expect(collapseSpawnInterval(0)).toBe(25);
    expect(collapseSpawnInterval(1)).toBe(18);
  });
  it("reinforcement cap 1 + floor/4, max 2, paused under 25% HP", () => {
    expect(collapseSpawnCap(1)).toBe(1);
    expect(collapseSpawnCap(6)).toBe(2);
    expect(canSpawnNearPlayer(1, 1, 100, 100)).toBe(false);
    expect(canSpawnNearPlayer(0, 1, 20, 100)).toBe(false);
    expect(canSpawnNearPlayer(0, 1, 60, 100)).toBe(true);
  });
});

import { dreadLevel, refugePortalSpot, DREAD } from "./expedition";
describe("refuge portal and dread", () => {
  it("darkens more after the boss than after the map", () => {
    expect(dreadLevel(false, false, 0)).toBe(0);
    expect(dreadLevel(true, false, 0)).toBe(DREAD.map);
    expect(dreadLevel(true, true, 0)).toBe(DREAD.boss);
    expect(dreadLevel(false, false, 1)).toBeGreaterThan(0);
  });
  it("places the portal away from bench and merchant", () => {
    const cands = [{ x: 1.5, y: 1.5 }, { x: 5.5, y: 5.5 }, { x: 2.5, y: 1.5 }];
    expect(refugePortalSpot(cands, [{ x: 1.5, y: 2 }, { x: 2.5, y: 1 }])).toEqual({ x: 5.5, y: 5.5 });
    expect(refugePortalSpot([{ x: 1, y: 1 }], [{ x: 1.2, y: 1 }])).toBeNull();
  });
});
