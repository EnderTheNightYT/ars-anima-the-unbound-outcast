import { describe, it, expect, vi, afterEach } from 'vitest';
import { floorPressure, usesTouchControls } from './progression';
import { Game } from './engine';
import { CLASSES, ENEMY_TYPES } from './data';
afterEach(() => vi.restoreAllMocks());
describe('Progressive combat', () => {
  it('starts at base strength and rises gradually per floor', () => {
    expect(floorPressure(1)).toEqual({ hp: 1, damage: 1, eliteChance: .08 });
    expect(floorPressure(6).hp).toBeCloseTo(1.9);
    expect(floorPressure(6).damage).toBeCloseTo(1.5);
    expect(floorPressure(100).eliteChance).toBe(.3);
    expect(floorPressure(100)).toEqual(floorPressure(30));
  });
  it('applies progressive health to actual spawned enemies', () => {
    vi.spyOn(Math, 'random').mockReturnValue(.99);
    const cls = CLASSES[0]; if (!cls) throw new Error('Class missing');
    const g = new Game(); g.start(cls); g.map.fill(0); g.enemies = []; g.restRoom = null; g.alteredZones = [];
    g.floor = 1; g.spawn('sombra', 15, 15); g.floor = 6; g.spawn('sombra', 18, 15);
    expect(g.enemies[0]?.hpMax).toBe(ENEMY_TYPES.sombra.hp);
    expect(g.enemies[1]?.hpMax).toBeCloseTo(ENEMY_TYPES.sombra.hp * 1.9);
  });
  it('a level grants a skill point, carries remaining XP and increases health', () => {
    const cls = CLASSES[0]; if (!cls) throw new Error('Class missing');
    const g = new Game(); g.start(cls); g.alteredZones = []; const hp = g.hpMax; const sp = g.sp;
    g.gainXp(110);
    expect(g.level).toBe(2); expect(g.xp).toBe(10); expect(g.xpNext).toBe(161);
    expect(g.sp).toBe(sp + 1); expect(g.hpMax).toBe(hp + 4); expect(g.mode).toBe('choice');
  });
});
describe('Platform controls', () => {
  it('keeps Android touch controls even when a mouse is attached', () => expect(usesTouchControls('Android', false, 5)).toBe(true));
  it('hides touch controls on PCs including touchscreen Windows', () => {
    expect(usesTouchControls('Windows NT 10.0', true, 10)).toBe(false);
    expect(usesTouchControls('Linux x86_64', false, 0)).toBe(false);
  });
});