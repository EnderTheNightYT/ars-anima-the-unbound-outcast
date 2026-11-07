// Weapon wear, failure, repair, upgrade and enchant rules (browser-safe, pure).
import type { AffixId, Item } from "./data";

export const WEAR = {
  baseDur: 60, perRarity: 15, perLevel: 10,
  meleeUse: 0.2, shotUse: 0.12, chargedUse: 0.4,
  wornAt: 0.25,          // below this ratio the weapon is "worn"
  wornDamage: 0.8, brokenDamage: 0.45,
  wornFail: 0.06, brokenFail: 0.3,   // chance a swing/shot fails (jam/slip)
  maxLevel: 5, levelDamage: 0.08, levelCrit: 2,
  maxAffixes: 4,
  repairGoldPerPoint: 0.6, upgradeGold: 60, enchantGold: 120,
} as const;

export type Cost = Record<string, number>;

export function maxDurability(it: Item) { return WEAR.baseDur + it.rarity * WEAR.perRarity + (it.wlvl ?? 0) * WEAR.perLevel; }
/** Lazily gives older/saved weapons durability. */
export function ensureWear(it: Item) {
  if (it.kind !== "weapon") return it;
  const max = maxDurability(it);
  if (it.durMax === undefined || it.durMax < max) { const missing = (it.durMax ?? max) - (it.dur ?? max); it.durMax = max; it.dur = Math.max(0, max - Math.max(0, missing)); }
  it.dur = Math.min(it.dur ?? max, it.durMax);
  return it;
}
export function wearRatio(it: Item) { ensureWear(it); return (it.dur ?? 0) / Math.max(1, it.durMax ?? 1); }
export type WearState = "ok" | "worn" | "broken";
export function wearState(it: Item): WearState { if (it.kind !== "weapon") return "ok"; const r = wearRatio(it); return r <= 0 ? "broken" : r < WEAR.wornAt ? "worn" : "ok"; }
export function wearDamage(it: Item) { const s = wearState(it); return s === "broken" ? WEAR.brokenDamage : s === "worn" ? WEAR.wornDamage : 1; }
export function failChance(it: Item) { const s = wearState(it); return s === "broken" ? WEAR.brokenFail : s === "worn" ? WEAR.wornFail : 0; }
/** Spends durability; returns true when this use just crossed into worn/broken. */
export function applyWear(it: Item, amount: number): WearState | null {
  if (it.kind !== "weapon") return null;
  const before = wearState(it); it.dur = Math.max(0, (it.dur ?? 0) - amount);
  const after = wearState(it); return after !== before ? after : null;
}

export function repairCost(it: Item): Cost {
  ensureWear(it); const missing = (it.durMax ?? 0) - (it.dur ?? 0); if (missing <= 0) return {};
  const units = Math.max(1, Math.ceil(missing / 25));
  return it.base?.ranged ? { chatarra: units, polvora: Math.ceil(units / 2) } : { chatarra: units, hueso: Math.ceil(units / 2) };
}
export function repairGold(it: Item) { ensureWear(it); return Math.ceil(((it.durMax ?? 0) - (it.dur ?? 0)) * WEAR.repairGoldPerPoint * (1 + it.rarity * 0.25)); }
export function repair(it: Item) { ensureWear(it); it.dur = it.durMax ?? maxDurability(it); }

export function canUpgrade(it: Item) { return it.kind === "weapon" && (it.wlvl ?? 0) < WEAR.maxLevel; }
export function upgradeCost(it: Item): Cost { const l = (it.wlvl ?? 0) + 1; return { chatarra: 2 + l, ...(l >= 2 ? { hueso: l - 1 } : {}), ...(l >= 4 ? { fragmento: l - 3 } : {}) }; }
export function upgradeGold(it: Item) { return WEAR.upgradeGold * ((it.wlvl ?? 0) + 1) + it.rarity * 20; }
export function upgrade(it: Item) {
  if (!canUpgrade(it)) return false;
  it.wlvl = (it.wlvl ?? 0) + 1; it.dmgMult = +((it.dmgMult ?? 1) + WEAR.levelDamage).toFixed(2); it.crit = (it.crit ?? 0) + WEAR.levelCrit;
  ensureWear(it); repair(it); return true;
}

export function enchantOptions(it: Item, all: AffixId[]) { return all.filter(a => !it.affixes?.includes(a)); }
export function canEnchant(it: Item) { return it.kind === "weapon" && (it.affixes?.length ?? 0) < WEAR.maxAffixes; }
export function enchantCost(it: Item): Cost { const n = (it.affixes?.length ?? 0) + 1; return { brasa: n, fragmento: Math.max(1, n - 1), hierba: 1 }; }
export function enchantGold(it: Item) { return WEAR.enchantGold * ((it.affixes?.length ?? 0) + 1); }
export function enchant(it: Item, affix: AffixId) {
  if (!canEnchant(it) || it.affixes?.includes(affix)) return false;
  it.affixes = [...(it.affixes ?? []), affix]; return true;
}

export function hasCost(mats: Record<string, number>, c: Cost) { return Object.entries(c).every(([k, v]) => (mats[k] ?? 0) >= v); }
export function payCost(mats: Record<string, number>, c: Cost) { if (!hasCost(mats, c)) return false; for (const [k, v] of Object.entries(c)) mats[k] = (mats[k] ?? 0) - v; return true; }
