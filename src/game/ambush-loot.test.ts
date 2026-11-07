import { describe, it, expect, vi, afterEach } from 'vitest';
import { Game, MAP_SIZE } from './engine';
import { CLASSES } from './data';
import { propBreakOutcome, levelBonus, SPLINTER } from './world-rules';
const cls = CLASSES[0];
const arena = { x: 12, y: 12, w: 10, h: 10 };
function game() { if (!cls) throw new Error('Missing class'); const g = new Game(); g.start(cls); g.enemies = []; g.pickups = []; g.map.fill(0); g.seals = {}; g.doorAnim = {}; g.alteredZones = []; g.rooms = [{ x: 2, y: 2, w: 7, h: 7 }, arena]; g.restRoom = g.rooms[0]!; g.zones = [{ ...arena, name: 'Arena' }]; g.px = 15.5; g.py = 15.5; g.pz = 0; g.bossRoom = null; g.eventT = 999; g.mode = 'play'; return g; }
afterEach(() => vi.restoreAllMocks());

describe('Breakable scenery', () => {
  it('fountains and trees never break', () => { expect(propBreakOutcome('fountain', 0.1)).toBe('none'); expect(propBreakOutcome('tree', 0.9)).toBe('none'); });
  it('crates give loot 60% of the time and splinters otherwise', () => { expect(propBreakOutcome('crate', 0.59)).toBe('reward'); expect(propBreakOutcome('crate', 0.61)).toBe('splinters'); });
  it('benches always splinter', () => { expect(propBreakOutcome('bench', 0.01)).toBe('splinters'); });
  it('splinters hurt the player and cause a short bleed', () => {
    const g = game(); vi.spyOn(Math, 'random').mockReturnValue(0.5);
    g.pickups.push({ x: 16, y: 15.5, kind: 'decor', deco: 'bench', bob: 0 });
    const hp = g.hp; g.environmentImpact(16, 15.5, 0.5);
    expect(g.hp).toBeLessThan(hp); expect(g.bleed).toBe(SPLINTER.bleed);
  });
  it('a reward prop drops a pickup', () => {
    const g = game(); vi.spyOn(Math, 'random').mockReturnValue(0.3);
    g.pickups.push({ x: 16, y: 15.5, kind: 'decor', deco: 'skeleton', bob: 0 });
    g.environmentImpact(16, 15.5, 0.5);
    expect(g.pickups.some((p) => p.kind === 'gold')).toBe(true);
  });
});

describe('Level progression', () => {
  it('each level adds 4 max HP and 4% damage', () => { expect(levelBonus(1)).toEqual({ hp: 0, stam: 0, damage: 1 }); expect(levelBonus(3).hp).toBe(8); expect(levelBonus(3).damage).toBeCloseTo(1.08); });
  it('leveling offers a growth choice that raises max HP', () => {
    const g = game(); const before = g.hpMax; g.gainXp(g.xpNext);
    expect(g.mode).toBe('choice'); g.choice!.options[0]!.apply();
    expect(g.hpMax).toBe(before + 4 + 6);
  });
});

describe('Door ambush', () => {
  it('an enemy hidden behind a door bursts through when the player is in the room', () => {
    const g = game();
    for (let y = 11; y <= 22; y++) for (let x = 11; x <= 22; x++) if (x === 11 || y === 11 || x === 22 || y === 22) g.map[y * MAP_SIZE + x] = 1;
    const door = 16 * MAP_SIZE + 22; g.map[door] = 6; g.doors = new Set([door]);
    g.spawn('sombra', 16.5, 16.5); const e = g.enemies[0]!;
    g.placeAmbusher(e, arena, 'Arena', 'puerta', [e]);
    expect(e.ambush?.door).toBe(door); expect(e.x).toBeGreaterThan(22);
    g.px = 19.5; g.py = 16.5;
    g.updateAmbush(e, 0.05); expect(e.ambush?.stage).toBe('warning');
    g.updateAmbush(e, 1); expect(g.doorAnim[door]).toBeDefined(); expect(e.aware).toBe(true);
  });
});

describe('Powder kegs', () => {
  it('shooting a keg explodes it and damages nearby enemies', () => {
    const g = game(); g.pickups.push({ x: 18.5, y: 15.5, kind: 'decor', deco: 'powder', bob: 0 });
    g.spawn('sombra', 19.5, 15.5); const e = g.enemies[0]!; const hp = e.hp;
    g.projs.push({ x: 18.1, y: 15.5, z: 0.4, dx: 6, dy: 0, life: 1, dmg: 1, friendly: true, color: '#fff' });
    g.updateProjs(0.05);
    expect(g.pickups[0]!.used).toBe(true); expect(e.hp < hp || e.dead).toBe(true); expect(g.shake).toBeGreaterThan(0.3);
  });
  it('walking up and interacting steals 1-2 bombs instead', () => {
    const g = game(); g.pickups.push({ x: 16.3, y: 15.5, kind: 'decor', deco: 'powder', bob: 0 });
    const b = g.bombs; g.interact();
    expect(g.bombs - b).toBeGreaterThanOrEqual(1); expect(g.bombs - b).toBeLessThanOrEqual(2); expect(g.pickups[0]!.used).toBe(true);
  });
});

describe('Exposed enemies and hit feedback', () => {
  it('an enemy left at 25% HP or less becomes exposed, and a final kick gives ammo and life', () => {
    const g = game(); g.spawn('sombra', 16.5, 15.5); const e = g.enemies[0]!;
    // Spawns can roll an explosive elite or kamikaze role whose death blast would hurt the player.
    delete e.elite; delete e.role;
    g.damageEnemy(e, e.hpMax * 0.8, 0); expect(e.exposed).toBe(4);
    g.hp = 10; const ammo = g.ammo; g.execute(e, 'kick');
    expect(e.dead).toBe(true); expect(g.ammo).toBe(ammo + 6); expect(g.hp).toBe(20);
  });
  it('robbing an exposed enemy drops equipment', () => {
    const g = game(); g.spawn('sombra', 16.3, 15.5); const e = g.enemies[0]!;
    g.damageEnemy(e, e.hpMax * 0.8, 0); g.interact();
    expect(e.dead).toBe(true); expect(g.pickups.some((p) => p.kind === 'item')).toBe(true);
  });
  it('a hit from a projectile records its direction', () => {
    const g = game(); g.hurtPlayer(2, 'proyectil', false, { x: g.px + 3, y: g.py });
    expect(g.hitDirs[0]!.a).toBeCloseTo(0);
  });
});
