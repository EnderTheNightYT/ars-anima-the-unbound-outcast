import type { Item } from './data';

export const CARRY_LIMIT = 2000;
export const SUPPLY_WEIGHT: Record<string, number> = { venda: 0.5, racion: 1, agua: 1.5, antidoto: 0.5, tonico: 0.5, espejo: 2, bomba: 2, municion: 0.05, ganzua: 0.2 };
export function itemWeight(it: Item) {
  const unit = it.kind === 'weapon' ? (['MANDOBLE', 'MARTILLO', 'AMETRALLADORA'].includes(it.base?.type ?? '') ? 6 : it.base?.type === 'DAGA' ? 1 : 3) : it.kind === 'armor' ? 5 : it.kind === 'material' ? 0.25 : it.kind === 'key' ? 0.2 : SUPPLY_WEIGHT[it.name.toLowerCase()] ?? 1;
  return unit * (it.qty ?? 1);
}
export function itemPrice(it: Item) {
  const dice = it.base?.dice;
  const damage = dice ? dice[0] * (dice[1] + 1) / 2 * (it.dmgMult ?? 1) : 0;
  const condition = it.kind === 'weapon' ? Math.max(0, Math.min(1, (it.dur ?? it.durMax ?? 1) / Math.max(1, it.durMax ?? 1))) : 1;
  return Math.max(1, Math.round((20 + it.rarity * 35 + damage * 5 + (it.def ?? 0) * 12 + (it.affixes?.length ?? 0) * 25 + (it.crit ?? 0) * 2 + (it.wlvl ?? 0) * 15) * (0.25 + 0.75 * condition)));
}
export const sellPrice = (it: Item) => Math.max(1, Math.floor(itemPrice(it) * 0.4));
export function carryWeight(bag: Item[], equipped: Item[], mats: Record<string, number>, cons: Record<string, number>, ammo: number, bombs: number, keys: number) {
  return [...bag, ...equipped].reduce((n, it) => n + itemWeight(it), 0) + Object.values(mats).reduce((n, qty) => n + qty * 0.25, 0) + Object.entries(cons).reduce((n, [id, qty]) => n + qty * (SUPPLY_WEIGHT[id] ?? 1), 0) + ammo * 0.05 + bombs * 2 + keys * 0.2;
}
export const fitsCarry = (current: number, added: number) => current + added <= CARRY_LIMIT + 1e-8;