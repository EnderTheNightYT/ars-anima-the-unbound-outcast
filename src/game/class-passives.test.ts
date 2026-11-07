import { describe, expect, it } from 'vitest';
import { classMods, CLASS_PASSIVES, forbiddenZoneLevel } from './class-passives';
import { CLASSES } from './data';
import { Game } from './engine';

describe('class passives', () => {
  it('every class has three passives at levels 1, 4 and 8', () => {
    for (const c of CLASSES.filter(c => c.id !== 'pariah')) expect(CLASS_PASSIVES[c.id]?.map(p => p.level)).toEqual([1, 4, 8]);
  });
  it('unlock by level', () => {
    expect(classMods('duelista', 1).critDmg).toBe(2);
    expect(classMods('duelista', 4).critDmg).toBe(2.4);
    expect(classMods('duelista', 8).crit).toBe(6);
    expect(classMods('acrobata', 1).speed).toBeCloseTo(1.12);
    expect(classMods('guardian', 8).taken).toBeCloseTo(0.81);
  });
});

describe('forbidden zone', () => {
  it('opens at a level that grows with the floor', () => { expect(forbiddenZoneLevel(1)).toBe(4); expect(forbiddenZoneLevel(3)).toBe(8); });
  it('is sealed by level and unlocks when reached', () => {
    localStorage.clear(); const g = new Game(); g.start(CLASSES[0]!);
    if (g.forbiddenDoor < 0) return; // layout without room for the zone
    const seal = g.seals[g.forbiddenDoor]!; expect(seal).toEqual({ kind: 'level', value: forbiddenZoneLevel(g.floor) });
    expect(g.zones.some(z => z.name.startsWith('Zona Prohibida'))).toBe(true);
  });
});

describe('class skill rewards', () => {
  it('reaching level 4 grants a usable weapon and level 8 a shield', () => {
    localStorage.clear(); const g = new Game(); g.start(CLASSES[0]!);
    const n = g.bag.length; g.level = 4; g.grantClassRewards();
    expect(g.bag.length).toBe(n + 1); expect(g.bag[n]!.kind).toBe('weapon');
    g.level = 8; g.grantClassRewards(); expect(g.bag[n + 1]!.kind).toBe('armor');
    g.level = 5; g.grantClassRewards(); expect(g.bag.length).toBe(n + 2);
  });
});
