/** Todas las combinaciones de inscripciones (1 a 4, sin repetir) con daño, combo y efectos según las reglas del motor. Browser-safe. */
import { AFFIXES, WEAPONS, type AffixId, type Item, type WeaponBase } from "./data";
import { REGIONS } from "./regions";
import { weaponGuide } from "./weapon-guide";
import { rangedProfile } from "./combat-fx";
import { tierOdds, dmgMultRange } from "./weapon-wiki";

export const AFFIX_IDS = Object.keys(AFFIXES) as AffixId[];
export const MAX_AFFIXES = 4;
/** Daño continuo total por inscripción (engine: sangrado 4 s × 2,5; fuego 4 s × 3; veneno 6 s × 2). Se renueva, no se apila consigo mismo. */
export const DOT_TOTAL: Partial<Record<AffixId, number>> = { SANGRANTE: 10, INCANDESCENTE: 12, TOXICA: 12 };

export function allAffixCombos(max = MAX_AFFIXES): AffixId[][] {
  const out: AffixId[][] = [];
  const rec = (start: number, cur: AffixId[]) => {
    if (cur.length) out.push([...cur]);
    if (cur.length === max) return;
    for (let i = start; i < AFFIX_IDS.length; i++) rec(i + 1, [...cur, AFFIX_IDS[i]!]);
  };
  rec(0, []);
  return out;
}

export interface ComboResult {
  ids: AffixId[]; key: string; direct: number; dot: number; chain: number; blast: number; total: number;
  heal: number; breakPerHit: number; refill: boolean; effects: string[]; synergies: string[];
}

/** Resultado medio de un combo/ráfaga: `hit` daño medio por impacto, `hits` impactos, un enemigo vecino. */
export function comboResult(ids: AffixId[], hit: number, hits: number, breakB = 2): ComboResult {
  const has = (a: AffixId) => ids.includes(a);
  const mult = has("DADO_LOCO") ? 1.25 : 1;
  const direct = hit * hits * mult;
  const dot = ids.reduce((n, a) => n + (DOT_TOTAL[a] ?? 0), 0);
  const chain = has("ENCADENADA") ? direct * 0.5 : 0;
  const blast = has("INESTABLE") ? 0.1 * hits * hit * mult * 0.6 : 0;
  const r = (n: number) => Math.round(n * 10) / 10;
  const effects = ids.map((a) => `${a.replace("_", " ")}: ${AFFIXES[a]}`);
  const synergies: string[] = [];
  if (has("DADO_LOCO") && has("ENCADENADA")) synergies.push("El salto copia el resultado del dado: un 6 triplica también el daño al vecino.");
  if (has("DADO_LOCO") && has("INESTABLE")) synergies.push("El estallido usa el daño ya tirado: un 6 deja un estallido ×3.");
  if (has("DADO_LOCO") && has("VORAZ")) synergies.push("La curación sigue al dado: un 6 cura el triple.");
  if (dot >= 22) synergies.push(`Daños continuos sumados: +${dot} por objetivo aunque huya.`);
  if (has("SEGADORA") && (has("ENCADENADA") || has("INESTABLE"))) synergies.push("El daño en grupo provoca más bajas y más recargas de Aguante.");
  if (has("EBURNEA") && hits >= 3) synergies.push(`Combo largo: +${hits * 3} Break extra por cadena.`);
  return {
    ids, key: ids.join("+"), direct: r(direct), dot, chain: r(chain), blast: r(blast), total: r(direct + dot + chain + blast),
    heal: has("VORAZ") ? r(direct * 0.15) : 0, breakPerHit: breakB + (has("EBURNEA") ? 3 : 0), refill: has("SEGADORA"), effects, synergies,
  };
}

/** Daño medio por impacto e impactos por ataque (combo melee o disparo con perdigones). */
export function attackShape(base: WeaponBase) {
  const g = weaponGuide(base);
  if (!base.ranged) return { hit: g.reduce((n, s) => n + s.average, 0) / Math.max(1, g.length), hits: g.length, seconds: base.rate * g.length };
  const p = rangedProfile(base.type, base.pellets ?? 1);
  const pellets = base.pellets ? Math.max(7, base.pellets + 2) : 1;
  return { hit: (g[0]?.average ?? 0) * p.damageMult, hits: pellets * Math.max(1, p.burst ?? 1), seconds: base.rate };
}

export function weaponCombos(base: WeaponBase, max = MAX_AFFIXES) {
  const s = attackShape(base);
  return allAffixCombos(max).map((ids) => comboResult(ids, s.hit, s.hits, base.breakB)).sort((a, b) => b.total - a.total);
}

export interface FloorRow { type: string; ranged: boolean; mult: number; attack: number; dps: number; hits: number; expAffixes: number; best: ComboResult; bestTotal: number; owned?: string | undefined }

/** Comparativa por piso: multiplicador esperado según probabilidades de calidad, daño medio del ataque, DPS y mejor inscripción alcanzable. */
export function floorComparison(floor: number, owned: Item[] = []): FloorRow[] {
  const odds = tierOdds(floor);
  const mult = odds.reduce((n, p, r) => { const d = dmgMultRange(r, floor); return n + p * (d.min + d.max) / 2; }, 0);
  const expAffixes = odds.reduce((n, p, r) => n + p * r, 0);
  const maxAff = Math.max(1, odds.reduce((last: number, p: number, i: number) => (p > 0 ? i : last), -1));
  const row = (base: WeaponBase, m: number, ids?: AffixId[], name?: string): FloorRow => {
    const s = attackShape(base);
    const attack = s.hit * s.hits * m;
    const best = ids ? comboResult(ids, s.hit * m, s.hits, base.breakB) : weaponCombos(base, maxAff).map((c) => comboResult(c.ids, s.hit * m, s.hits, base.breakB))[0]!;
    const r = (n: number) => Math.round(n * 10) / 10;
    return { type: base.type, ranged: base.ranged, mult: r(m * 100) / 100, attack: r(attack), dps: r(attack / Math.max(0.05, s.seconds)), hits: s.hits, expAffixes: r(expAffixes), best, bestTotal: best.total, owned: name };
  };
  const mine = owned.filter((i) => i.kind === "weapon" && i.base).map((i) => row(i.base!, i.dmgMult ?? 1, i.affixes ?? [], i.name));
  return [...mine, ...WEAPONS.map((b) => row(b, mult))];
}

export const FLOOR_COUNT = REGIONS.length;
