import { AFFIXES, type Item } from './data';
import { rangedProfile } from './combat-fx';
import { meleeMode } from './weapon-modes';
import { weaponLevel } from './weapon-access';

/** Item-only facts: not final damage, which also depends on player and target. */
export function weaponFacts(item: Item) {
  const b = item.base;
  if (item.kind !== 'weapon' || !b) return null;
  const profile = rangedProfile(b.type, b.pellets);
  const mode = meleeMode(b, true);
  return {
    uid: item.uid, name: item.name, type: b.type, ranged: b.ranged, rarity: item.rarity,
    requiredLevel: weaponLevel(item), dice: `${b.dice[0]}d${b.dice[1]}`,
    damage: +(b.dice[0] * (b.dice[1] + 1) / 2 * (item.dmgMult ?? 1)).toFixed(2),
    multiplier: item.dmgMult ?? 1, crit: item.crit ?? 0, accuracy: item.acc ?? 0,
    break: b.breakB + ((item.affixes ?? []).includes('EBURNEA') ? 3 : 0),
    range: b.range, interval: +(b.rate * (b.ranged ? profile.cooldownMult : 1)).toFixed(2),
    ammo: b.ammo, magazine: b.magazine ?? 0, reload: b.reloadTime ?? 0,
    effects: (item.affixes ?? []).map(id => ({ id, description: AFFIXES[id] })),
    behavior: b.ranged ? [profile.burst > 1 ? `Ráfaga de ${profile.burst}` : 'Disparo único',
      profile.pellets > 1 ? `${profile.pellets} perdigones` : '', profile.bounces ? `${profile.bounces} rebote` : '',
      profile.falloff ? 'Daño disminuye con distancia' : '', profile.pierce ? 'Perfora' : '',
      profile.wave ? `Onda de choque ${profile.wave}` : '', `Daño por proyectil ×${profile.damageMult}`].filter(Boolean).join(' · ')
      : `Ataque cargado ×${mode.damage} · alcance ${mode.range.toFixed(2)} · hasta ${mode.targets} objetivos · carga ${mode.charge.toFixed(2)} s · recuperación ${mode.cooldown.toFixed(2)} s`,
  };
}
export type WeaponFacts = NonNullable<ReturnType<typeof weaponFacts>>;

export function weaponDifference(candidate: Item, reference: Item) {
  const a = weaponFacts(candidate), b = weaponFacts(reference);
  if (!a || !b || a.ranged !== b.ranged) return null;
  return { damage: +(a.damage - b.damage).toFixed(2), break: a.break - b.break,
    range: +(a.range - b.range).toFixed(2), interval: +(a.interval - b.interval).toFixed(2),
    crit: a.crit - b.crit, accuracy: a.accuracy - b.accuracy };
}