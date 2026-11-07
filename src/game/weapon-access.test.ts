import { describe, expect, it } from 'vitest';
import { Game, emptyInput } from './engine';
import { CLASSES } from './data';
import { canUseWeapon, weaponLevel, weaponCategory, weaponLockInfo } from './weapon-access';
import { xpToReach as xpToReach2 } from './weapon-access';
import { rangedProfile } from './combat-fx';

function start() { localStorage.clear(); const g = new Game(); const cls = CLASSES[0]; if (!cls) throw new Error('Missing class'); g.start(cls); g.enemies = []; g.restRoom = null; return g; }

describe('weapon mastery', () => {
  it.each([[0, 1], [1, 1], [2, 3], [3, 6], [4, 10]])('rarity %i requires level %i', (rarity, level) => {
    const g = start(); const w = g.makeWeapon('ESPADA', rarity); w.affixes = []; w.dmgMult = 1;
    expect(weaponLevel(w)).toBe(level);
    expect(canUseWeapon(w, level)).toBe(true);
    if (level > 1) expect(canUseWeapon(w, level - 1)).toBe(false);
  });
  it.each([['SUBFUSIL', 3], ['FUSIL', 4], ['AMETRALLADORA', 6]] as const)('%s has a base level gate of %i', (type, level) => {
    const w = start().makeWeapon(type, 0); w.dmgMult = 1; expect(weaponLevel(w)).toBe(level);
  });
  it('multiple unique effects and high damage increase requirements', () => {
    const w = start().makeWeapon('ESPADA', 0);
    w.affixes = ['SANGRANTE', 'VORAZ']; expect(weaponLevel(w)).toBe(4);
    w.affixes.push('INESTABLE'); expect(weaponLevel(w)).toBe(6);
    w.affixes.push('ENCADENADA'); expect(weaponLevel(w)).toBe(10);
    w.affixes = []; w.dmgMult = 2; expect(weaponLevel(w)).toBe(6);
    w.dmgMult = 2.5; expect(weaponLevel(w)).toBe(10);
  });
  it('keeps sealed loot in the bag, equips it at level 10 without paying', () => {
    const g = start(); const w = g.makeWeapon('ESPADA', 4); g.bag.push(w); const old = g.melee, gold = g.gold;
    g.equip(w.uid); expect(g.melee).toBe(old); expect(g.bag).toContain(w); expect(g.gold).toBe(gold);
    g.level = 10; g.equip(w.uid); expect(g.melee).toBe(w); expect(g.bag).toContain(old); expect(g.gold).toBe(gold);
  });
  it('blocks attacks and volleys even if a sealed weapon is already equipped', () => {
    const g = start(); const w = g.makeWeapon('FUSIL', 4); g.ranged = w; g.slot = 1;
    const mag = w.mag; g.update(.016, { ...emptyInput(), attack: true });
    expect(w.mag).toBe(mag); expect(g.projs).toHaveLength(0);
    g.fireVolley(w, rangedProfile('FUSIL'), 1, false); expect(g.projs).toHaveLength(0);
    g.spawn('sombra', g.px + 1, g.py); const e = g.enemies[0]; if (!e) throw new Error('Missing enemy');
    const hp = e.hp; expect(g.attackEnemy(e, w, 1, { noRoll: true })).toBe(false); expect(e.hp).toBe(hp);
  });
  it('leaves every class starting loadout usable', () => {
    const g = start(); for (const cls of CLASSES) { g.start(cls); expect(canUseWeapon(g.melee, 1)).toBe(true); expect(canUseWeapon(g.ranged, 1)).toBe(true); }
  });
  it('cancels sealed bursts, reloads and retained projectiles without resources or damage', () => {
    const g = start(); const w = g.makeWeapon('FUSIL', 4); g.ranged = w; g.slot = 1; w.mag = 0;
    const ammo = g.ammo; g.beginReload(); expect(g.reloadT).toBe(0); g.finishReload(); expect(g.ammo).toBe(ammo); expect(w.mag).toBe(0);
    g.burstQueue = { w, prof: rangedProfile('FUSIL'), mult: 1, precision: false, left: 2, t: 0 };
    g.update(.016, emptyInput()); expect(g.burstQueue).toBeNull(); expect(g.ammo).toBe(ammo);
    g.level = 10; g.fireVolley(w, rangedProfile('FUSIL'), 1, false); expect(g.projs.length).toBeGreaterThan(0);
    g.level = 1; g.updateProjs(.016); expect(g.projs).toHaveLength(0);
  });
  it('reports missing progress toward a sealed weapon requirement', () => {
    const g = start(); const w = g.makeWeapon('ESPADA', 4); w.affixes = []; w.dmgMult = 1;
    expect(weaponLockInfo(w, 1)).toMatchObject({ req: 10, missing: 9, locked: true });
    expect(weaponLockInfo(w, 7)).toMatchObject({ req: 10, missing: 3, locked: true });
    expect(weaponLockInfo(w, 10)).toMatchObject({ req: 10, missing: 0, locked: false });
    const plain = g.makeWeapon('ESPADA', 0); plain.affixes = []; plain.dmgMult = 1;
    expect(weaponLockInfo(plain, 1)).toMatchObject({ req: 1, missing: 0, locked: false });
  });
  it('classifies weapons by category for inventory filters', () => {
    const g = start();
    expect(weaponCategory(g.makeWeapon('ESPADA', 0))).toBe('cuerpo');
    expect(weaponCategory(g.makeWeapon('FUSIL', 0))).toBe('distancia');
    expect(weaponCategory(g.armor!)).toBe('otro');
  });
});
describe('lock progress', () => {
  it('reports levels and XP missing using the xpForLevel curve', () => {
    expect(xpToReach2(1, 0, 100, 3)).toBe(261);
    expect(xpToReach2(1, 40, 100, 2)).toBe(60);
    expect(xpToReach2(5, 0, 100, 3)).toBe(0);
  });
});
