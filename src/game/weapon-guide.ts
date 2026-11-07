import { ENEMY_TYPES, type WeaponBase } from "./data";
import { meleeStyle } from "./combat-fx";
import { CHAINS } from "./melee-combo";
import { rangedProfile } from './combat-fx';

/** Reference damage: successful non-critical hit, attribute modifier 0 and all bonuses ×1. */
export function referenceDamage(base: WeaponBase, multiplier = 1) {
  const [n, sides] = base.dice;
  return { min: (n + 3) * multiplier, max: (n * sides + 3) * multiplier, average: (n * (sides + 1) / 2 + 3) * multiplier };
}
export function weaponGuide(base: WeaponBase) {
  const steps = base.ranged ? [{ label: "DISPARO", dmg: rangedProfile(base.type, base.pellets ?? 1).damageMult, brk: 0 }] : CHAINS[meleeStyle(base.type)].steps;
  return steps.map((s, i) => ({ number: i + 1, label: s.label, multiplier: s.dmg, break: base.breakB + s.brk, ...referenceDamage(base, s.dmg) }));
}
export function enemyExamples(base: WeaponBase) {
  const average = weaponGuide(base).reduce((n, s) => n + s.average, 0);
  return (['sombra', 'amalgama'] as const).map(id => { const e = ENEMY_TYPES[id]; return { id, name: e.name, hp: e.hp, defense: e.def, average, remaining: Math.max(0, e.hp - average) }; });
}