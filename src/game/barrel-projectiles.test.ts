import { describe, expect, it } from 'vitest';
import { Game } from './engine';
import { CLASSES, WEAPONS } from './data';
import { rangedProfile } from './combat-fx';
function arena() {
  const cls = CLASSES[0]; if (!cls) throw new Error('Missing class');
  const g = new Game(); g.start(cls); g.map.fill(0); g.restRoom = null;
  g.enemies = []; g.pickups = []; g.projs = []; g.px = 10; g.py = 15.5; g.pz = 0;
  const keg = { x: 18.5, y: 15.5, kind: 'decor' as const, deco: 'powder', bob: 0, used: false };
  g.pickups.push(keg); return { g, keg };
}
describe('Ranged barrel impacts', () => {
  it.each(WEAPONS.filter(w => w.ranged).map(w => [w.type, w] as const))('%s detonates a barrel crossed between frames', (_, base) => {
    const { g, keg } = arena(); const profile = rangedProfile(base.type);
    g.projs.push({ x: 17.5, y: 15.5, z: .4, dx: 60, dy: 0, life: 1, dmg: 1, friendly: true, color: base.color, sprite: profile.sprite });
    g.updateProjs(.05); expect(keg.used).toBe(true); expect(g.projs).toHaveLength(0);
    expect(g.explosions.some(fx => fx.x === keg.x && fx.y === keg.y)).toBe(true);
  });
  it('shots passing above a barrel do not detonate it', () => {
    const { g, keg } = arena();
    g.projs.push({ x: 17.5, y: 15.5, z: 1.4, dx: 60, dy: 0, life: 1, dmg: 1, friendly: true, color: '#fff' });
    g.updateProjs(.05); expect(keg.used).not.toBe(true);
  });
  it('a wall stops a shot from reaching a barrel', () => {
    const { g, keg } = arena(); g.map[15 * 40 + 17] = 1;
    g.projs.push({ x: 16.5, y: 15.5, z: .4, dx: 60, dy: 0, life: 1, dmg: 1, friendly: true, color: '#fff' });
    g.updateProjs(.05); expect(keg.used).not.toBe(true);
  });
  it('the explosion chains to nearby barrels and its visual effect expires', () => {
    const { g, keg } = arena(); const next = { ...keg, x: 19.5 }; g.pickups.push(next);
    g.projs.push({ x: 17.5, y: 15.5, z: .4, dx: 60, dy: 0, life: 1, dmg: 1, friendly: true, color: '#fff' });
    g.updateProjs(.05); expect(keg.used).toBe(true); expect(next.used).toBe(true);
    expect(g.explosions).toHaveLength(2); g.updateProjs(.9); expect(g.explosions).toHaveLength(0);
  });
});