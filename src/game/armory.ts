/** Armas e inscripciones encontradas por el jugador (localStorage; se sincroniza con la cuenta por el prefijo ars_anima_). */
export const ARMORY_KEY = "ars_anima_armory_v1";
export interface ArmoryEntry { name: string; type: string; rarity: number; affixes: string[]; times: number; last: number }
export type Armory = Record<string, ArmoryEntry>;
type Store = Pick<Storage, "getItem" | "setItem">;

export function readArmory(store: Store = localStorage): Armory {
  try { const d = JSON.parse(store.getItem(ARMORY_KEY) || "{}"); return d && typeof d === "object" ? d as Armory : {}; } catch { return {}; }
}
export function recordArmory(w: { name: string; rarity?: number; affixes?: string[]; base?: { type: string } }, store: Store = localStorage, now = Date.now()) {
  if (!w.base) return;
  const a = readArmory(store); const prev = a[w.name];
  a[w.name] = { name: w.name, type: w.base.type, rarity: w.rarity ?? 0, affixes: [...new Set([...(prev?.affixes ?? []), ...(w.affixes ?? [])])], times: (prev?.times ?? 0) + 1, last: now };
  store.setItem(ARMORY_KEY, JSON.stringify(a));
}
/** Cuántas armas distintas llevan cada inscripción. */
export function inscriptionCounts(a: Armory) {
  const out: Record<string, number> = {};
  for (const e of Object.values(a)) for (const x of e.affixes) out[x] = (out[x] ?? 0) + 1;
  return out;
}
