import { canUseWeapon } from './weapon-access';
import type { Item } from './data';
import type { Quest } from './quests';

export const MERCHANT_TALKS = 3;
export type MerchantQuest = Quest & { progress: number; complete: boolean; claimed: boolean; floor: number; level: number; rewardKind: 'gold' | 'weapon'; gold: number };
export function merchantReward(level: number, floor: number) {
  const l = Math.max(1, Math.min(100, Math.floor(level))), f = Math.max(1, Math.min(6, Math.floor(floor)));
  return { gold: 15 + Math.min(30, l * 2) + f * 3,
    rarity: Math.min(f >= 5 ? 3 : f >= 2 ? 2 : 1, l >= 6 ? 3 : l >= 4 ? 2 : 1) };
}
export function eligibleMerchantWeapon(item: Item, level: number, floor: number) {
  return item.kind === 'weapon' && canUseWeapon(item, level) && item.rarity <= merchantReward(level, floor).rarity;
}
export function createMerchantQuest(level: number, floor: number, region: string, enemies: number, chests: number, roll: number): MerchantQuest {
  const killCount = Math.min(6, 2 + Math.floor(level / 4));
  const kind: Quest['kind'] = floor !== 4 && enemies >= killCount ? 'kill' : chests > 0 ? 'chest' : 'jump';
  const count = kind === 'kill' ? killCount : kind === 'chest' ? 1 : 8;
  return { title: kind === 'kill' ? 'El camino del farol' : kind === 'chest' ? 'Un cierre de tinta' : 'Pasos sobre la oscuridad',
    story: kind === 'kill' ? `«Derrota a ${count} enemigos en tu viaje por ${region} y vuelve a verme.»` : kind === 'chest' ? `«Abre un cofre durante tu viaje por ${region} y vuelve con noticias.»` : `«Realiza ${count} saltos durante tu viaje y regresa a mi farol.»`,
    kind, count, progress: 0, complete: false, claimed: false, floor, level, rewardKind: roll < .5 ? 'gold' : 'weapon', gold: merchantReward(level,floor).gold };
}
export function advanceMerchantQuest(q: MerchantQuest, kind: Quest['kind'], amount: number) {
  if (q.complete || q.claimed || q.kind !== kind || amount <= 0) return false;
  q.progress = Math.min(q.count, q.progress + amount);
  q.complete = q.progress >= q.count;
  return q.complete;
}