import { xpForLevel } from './xp';
import type { Item } from './data';

/** Ownership is unrestricted; mastery of high-output weapons uses the current XP level. */
export function weaponLevel(item: Item): number {
  if (item.kind !== 'weapon') return 1;
  const rarity = item.rarity >= 4 ? 10 : item.rarity >= 3 ? 6 : item.rarity >= 2 ? 3 : 1;
  const effects = new Set(item.affixes ?? []).size;
  const effectLevel = effects >= 4 ? 10 : effects >= 3 ? 6 : effects >= 2 ? 4 : 1;
  const damage = (item.dmgMult ?? 1) >= 2.5 ? 10 : (item.dmgMult ?? 1) >= 2 ? 6 : 1;
  const typeLevel = ({ SUBFUSIL: 3, FUSIL: 4, AMETRALLADORA: 6 } as Record<string, number>)[item.base?.type ?? ''] ?? 1;
  return Math.max(rarity, effectLevel, damage, typeLevel);
}

export const canUseWeapon = (item: Item, level: number) => level >= weaponLevel(item);

/** Category used by inventory filters. */
export function weaponCategory(item: Item): 'cuerpo' | 'distancia' | 'otro' {
  if (item.kind !== 'weapon') return 'otro';
  return item.base?.ranged ? 'distancia' : 'cuerpo';
}

/** XP still needed to reach `target` level, following the engine's `xpForLevel` curve. */
export function xpToReach(level: number, xp: number, xpNext: number, target: number): number {
  let total = 0;
  for (let l = level; l < target; l++) total += l === level ? xpNext : xpForLevel(l);
  return Math.max(0, total - (target > level ? xp : 0));
}

/** How much progress is missing to unlock a sealed weapon. */
export function weaponLockInfo(item: Item, level: number, xp = 0, xpNext = 100): { req: number; missing: number; locked: boolean; xpMissing: number } {
  const req = weaponLevel(item);
  const missing = Math.max(0, req - level);
  return { req, missing, locked: missing > 0, xpMissing: xpToReach(level, xp, xpNext, req) };
}