import { describe, expect, it } from 'vitest';
import { WEAR, ensureWear, applyWear, wearState, failChance, repair, upgrade, payCost, hasCost } from './weapon-wear';
import { rollEnemyRole, cloudPattern, ROLES } from './enemy-roles';
import type { Item } from './data';

const sword = (): Item => ({ uid: 1, kind: 'weapon', name: 'Espada', rarity: 0, base: { type: 'ESPADA', dice: [1, 8], ranged: false, range: 1.5, rate: .5, breakB: 2, color: '#fff' } as never, dmgMult: 1, crit: 0, affixes: [] });

describe('desgaste de armas', () => {
  it('se gasta de a poco, falla al estar rota y se repara', () => {
    const w = ensureWear(sword()); expect(w.dur).toBe(WEAR.baseDur);
    applyWear(w, 1); expect(w.dur).toBe(WEAR.baseDur - 1); expect(failChance(w)).toBe(0);
    applyWear(w, 999); expect(wearState(w)).toBe('broken'); expect(failChance(w)).toBe(WEAR.brokenFail);
    repair(w); expect(w.dur).toBe(w.durMax);
  });
  it('subir de nivel aumenta daño y durabilidad', () => {
    const w = ensureWear(sword()); upgrade(w); expect(w.wlvl).toBe(1); expect(w.dmgMult).toBe(1 + WEAR.levelDamage); expect(w.durMax).toBe(WEAR.baseDur + WEAR.perLevel);
  });
  it('los materiales sólo se gastan si alcanzan', () => {
    const mats = { chatarra: 1 }; expect(hasCost(mats, { chatarra: 2 })).toBe(false); expect(payCost(mats, { chatarra: 2 })).toBe(false); expect(mats.chatarra).toBe(1);
  });
});

describe('roles de enemigo y nubes de jefe', () => {
  it('sólo enemigos cuerpo a cuerpo reciben rol', () => {
    expect(rollEnemyRole('chase', 0)).toBe('kamikaze');
    expect(rollEnemyRole('chase', ROLES.kamikazeChance + .01)).toBe('gunner');
    expect(rollEnemyRole('ranged', 0)).toBeUndefined();
    expect(rollEnemyRole('chase', .99)).toBeUndefined();
  });
  it('la nube enfurecida tiene más proyectiles', () => {
    const fixed = () => .5;
    expect(cloudPattern(fixed, true).length).toBe(cloudPattern(fixed, false).length + 12);
  });
});
