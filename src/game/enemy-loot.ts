/**
 * Botín de armas por enemigo: cada criatura suelta sólo ciertas armas, con modificadores propios y
 * probabilidades distintas. Nada está asegurado (probabilidad < 1 incluso para élites y jefes). Browser-safe.
 */
import type { AffixId } from "./data";

export interface LootEntry {
  /** Tipo de arma (WEAPONS[].type). */ type: string;
  /** Peso relativo dentro de la tabla del enemigo. */ weight: number;
  /** Variante de forja específica (si sale arma de esta entrada). */ variant?: string;
  /** Inscripción específica y su probabilidad de venir incluida. */ affix?: AffixId; affixChance?: number;
}
export interface LootTable { /** Probabilidad base de soltar un arma al morir. */ chance: number; entries: LootEntry[] }

const e = (type: string, weight: number, variant?: string, affix?: AffixId, affixChance = 0.35): LootEntry =>
  ({ type, weight, ...(variant ? { variant } : {}), ...(affix ? { affix, affixChance } : {}) });

export const ENEMY_LOOT: Record<string, LootTable> = {
  sombra: { chance: 0.07, entries: [e("DAGA", 6, "ligera", "SANGRANTE"), e("PISTOLA", 2, "agil")] },
  vigia: { chance: 0.08, entries: [e("RIFLE", 4, "larga"), e("ARCO", 3, undefined, "ENCADENADA", 0.2), e("PISTOLA", 2)] },
  amalgama: { chance: 0.1, entries: [e("HACHA", 5, "serrada", "SANGRANTE"), e("MARTILLO", 3, "pesada")] },
  espectro: { chance: 0.08, entries: [e("FOCO", 4, undefined, "INCANDESCENTE"), e("BASTON", 3, "ligera")] },
  carcelero: { chance: 0.1, entries: [e("MARTILLO", 5, "templada", "EBURNEA"), e("ESCOPETA", 2, "recortada")] },
  soldado: { chance: 0.09, entries: [e("FUSIL", 4, "ampliada"), e("SUBFUSIL", 3), e("LANZA", 2, "larga")] },
  hereje: { chance: 0.09, entries: [e("HACHA", 4, "gemela", "VORAZ", 0.25), e("REVOLVER", 2)] },
  bestia: { chance: 0.09, entries: [e("GUADAÑA", 3, "serrada", "SANGRANTE"), e("DAGA", 4, "corta")] },
  automata: { chance: 0.1, entries: [e("AMETRALLADORA", 3, "ampliada"), e("MARTILLO", 3, "pesada", "EBURNEA", 0.2)] },
  bruja: { chance: 0.09, entries: [e("FOCO", 4, undefined, "TOXICA"), e("DAGA", 2, "ligera", "TOXICA")] },
  ahogado: { chance: 0.08, entries: [e("LANZA", 4, "larga", "TOXICA", 0.2), e("ARCO", 2)] },
  tahur: { chance: 0.11, entries: [e("REVOLVER", 4, "agil", "DADO_LOCO", 0.45), e("DAGA", 2, undefined, "DADO_LOCO", 0.25)] },
  acechador: { chance: 0.09, entries: [e("DAGA", 5, "corta", "SANGRANTE", 0.4), e("BALLESTA", 2)] },
  fanatico: { chance: 0.09, entries: [e("ESPADA", 4, "templada", "INCANDESCENTE", 0.3), e("PISTOLA", 2)] },
  behemoth: { chance: 0.16, entries: [e("MANDOBLE", 4, "pesada", "EBURNEA"), e("MARTILLO", 3, "gemela", "INESTABLE", 0.2)] },
  screamer: { chance: 0.08, entries: [e("FOCO", 3, undefined, "ENCADENADA"), e("ESCOPETA", 2)] },
  caballero: { chance: 0.13, entries: [e("MANDOBLE", 4, "larga"), e("LANZA", 3, "templada"), e("ESPADA", 2, undefined, "SEGADORA", 0.2)] },
  ballestero: { chance: 0.11, entries: [e("BALLESTA", 6, "larga", "ENCADENADA", 0.25), e("ARCO", 2, "agil")] },
  alquimista: { chance: 0.1, entries: [e("ESCOPETA", 3, "recortada", "INESTABLE", 0.3), e("FOCO", 3, undefined, "TOXICA")] },
  obispo: { chance: 0.12, entries: [e("BASTON", 4, "templada", "VORAZ", 0.3), e("FOCO", 3, undefined, "INCANDESCENTE")] },
  tejedora: { chance: 0.1, entries: [e("DAGA", 3, "gemela", "TOXICA", 0.4), e("BALLESTA", 2)] },
  relojero: { chance: 0.11, entries: [e("SUBFUSIL", 3, "agil"), e("PISTOLA", 3, "ampliada", "DADO_LOCO", 0.2)] },
  portaestandarte: { chance: 0.12, entries: [e("LANZA", 5, "larga", "SEGADORA", 0.2), e("ESPADA", 2)] },
  sirena: { chance: 0.08, entries: [e("ARCO", 4, undefined, "ENCADENADA", 0.3), e("LANZA", 2)] },
  sanguijuela: { chance: 0.09, entries: [e("GUADAÑA", 3, "ligera", "VORAZ", 0.45), e("DAGA", 3, undefined, "VORAZ", 0.3)] },
  portador: { chance: 0.11, entries: [e("GUADAÑA", 4, "pesada", "TOXICA", 0.35), e("BASTON", 2)] },
  golem: { chance: 0.14, entries: [e("MARTILLO", 5, "pesada", "EBURNEA", 0.4), e("MANDOBLE", 2, "templada")] },
  espejo: { chance: 0.1, entries: [e("ESPADA", 4, "gemela", "INESTABLE", 0.25), e("REVOLVER", 2)] },
  librero: { chance: 0.85, entries: [e("FOCO", 3, "gemela", "INESTABLE", 0.6), e("FUSIL", 2, "larga", "SEGADORA", 0.5), e("GUADAÑA", 2, "serrada", "DADO_LOCO", 0.5)] },
};

/** Multiplicador por élite; el resultado nunca alcanza el 100 %. */
export const ELITE_LOOT_MULT = 3;
export const MAX_DROP_CHANCE = 0.9;

export function dropChance(kind: string, elite = false, mult = 1) {
  const t = ENEMY_LOOT[kind]; if (!t) return 0;
  return Math.min(MAX_DROP_CHANCE, t.chance * (elite ? ELITE_LOOT_MULT : 1) * mult);
}

export interface LootRoll { type: string; variant?: string; affix?: AffixId }
/** Tira el botín de un enemigo: null si no suelta arma. */
export function rollEnemyLoot(kind: string, elite = false, mult = 1, rand: () => number = Math.random): LootRoll | null {
  const t = ENEMY_LOOT[kind]; if (!t || rand() >= dropChance(kind, elite, mult)) return null;
  const total = t.entries.reduce((a, x) => a + x.weight, 0); let r = rand() * total;
  const pickE = t.entries.find(x => (r -= x.weight) < 0) ?? t.entries.at(-1)!;
  const out: LootRoll = { type: pickE.type };
  if (pickE.variant) out.variant = pickE.variant;
  if (pickE.affix && rand() < (pickE.affixChance ?? 0)) out.affix = pickE.affix;
  return out;
}

export interface WeaponSource { kind: string; chance: number; variant?: string; affix?: AffixId; affixChance?: number }
/** Para la wiki: de qué enemigos sale un tipo de arma y con qué probabilidad por muerte (no élite). */
export function weaponSources(type: string): WeaponSource[] {
  const out: WeaponSource[] = [];
  for (const [kind, t] of Object.entries(ENEMY_LOOT)) {
    const total = t.entries.reduce((a, x) => a + x.weight, 0);
    for (const x of t.entries) if (x.type === type) out.push({ kind, chance: t.chance * x.weight / total, ...(x.variant ? { variant: x.variant } : {}), ...(x.affix ? { affix: x.affix, affixChance: x.affixChance ?? 0 } : {}) });
  }
  return out.sort((a, b) => b.chance - a.chance);
}
