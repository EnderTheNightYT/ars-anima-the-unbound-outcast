/** Variantes de forja: modifican una copia de la base del arma y amplían los nombres al azar. Browser-safe. */
import { AFFIXES, PREFIX, SUFFIX, type AffixId, type WeaponBase } from "./data";

export interface ForgeVariant {
  id: string; label: string; desc: string; melee: boolean; ranged: boolean;
  apply: (b: WeaponBase) => Partial<WeaponBase>;
}

export const VARIANTS: ForgeVariant[] = [
  { id: "pesada", label: "Pesada", desc: "+1 cara al dado y +1 Break, 15% más lenta", melee: true, ranged: true, apply: (b) => ({ dice: [b.dice[0], b.dice[1] + 1], breakB: b.breakB + 1, rate: +(b.rate * 1.15).toFixed(3) }) },
  { id: "ligera", label: "Ligera", desc: "15% más rápida, −1 cara al dado", melee: true, ranged: true, apply: (b) => ({ dice: [b.dice[0], Math.max(3, b.dice[1] - 1)], rate: +(b.rate * 0.85).toFixed(3) }) },
  { id: "larga", label: "Larga", desc: "+0,4 de alcance (melee) o +3 (distancia)", melee: true, ranged: true, apply: (b) => ({ range: +(b.range + (b.ranged ? 3 : 0.4)).toFixed(2) }) },
  { id: "corta", label: "Corta", desc: "−0,2 de alcance, 10% más rápida y +1 Break", melee: true, ranged: false, apply: (b) => ({ range: +(b.range - 0.2).toFixed(2), rate: +(b.rate * 0.9).toFixed(3), breakB: b.breakB + 1 }) },
  { id: "serrada", label: "Serrada", desc: "+2 caras al dado, −0,1 de alcance", melee: true, ranged: false, apply: (b) => ({ dice: [b.dice[0], b.dice[1] + 2], range: +(b.range - 0.1).toFixed(2) }) },
  { id: "gemela", label: "Gemela", desc: "+1 dado, 25% más lenta", melee: true, ranged: true, apply: (b) => ({ dice: [b.dice[0] + 1, b.dice[1]], rate: +(b.rate * 1.25).toFixed(3) }) },
  { id: "templada", label: "Templada", desc: "+2 Break", melee: true, ranged: true, apply: (b) => ({ breakB: b.breakB + 2 }) },
  { id: "ampliada", label: "de Tambor", desc: "+50% de cargador, recarga 20% más lenta", melee: false, ranged: true, apply: (b) => ({ ...(b.magazine ? { magazine: Math.ceil(b.magazine * 1.5) } : {}), ...(b.reloadTime ? { reloadTime: +(b.reloadTime * 1.2).toFixed(2) } : {}) }) },
  { id: "recortada", label: "Recortada", desc: "+2 perdigones, −40% de alcance", melee: false, ranged: true, apply: (b) => ({ pellets: (b.pellets ?? 1) + 2, range: +(b.range * 0.6).toFixed(2) }) },
  { id: "agil", label: "de Gatillo Fino", desc: "recarga 25% más rápida", melee: false, ranged: true, apply: (b) => (b.reloadTime ? { reloadTime: +(b.reloadTime * 0.75).toFixed(2) } : {}) },
];

export const EPITHETS = ["Sin Nombre", "del Eco", "de Ceniza", "de la Vela Negra", "del Reloj Roto", "de la Rosa Muda", "del Pozo", "del Cuervo", "de la Marea", "del Tintero", "de la Última Misa", "del Espejo Ciego"];
export const ALL_SUFFIXES = [...SUFFIX, ...EPITHETS];

export function variantsFor(base: WeaponBase) { return VARIANTS.filter((v) => (base.ranged ? v.ranged : v.melee)); }

/** Copia la base y aplica la variante sin tocar la tabla original. */
export function forgeBase(base: WeaponBase, variantId?: string): WeaponBase {
  const v = VARIANTS.find((x) => x.id === variantId);
  return v ? { ...base, ...v.apply(base) } : { ...base };
}

export function weaponName(type: string, rarity: number, variant: string | undefined, suffix: string) {
  const v = VARIANTS.find((x) => x.id === variant)?.label;
  return [type, v, rarity ? PREFIX[rarity] : "", suffix].filter(Boolean).join(" ");
}

function choose(n: number, k: number) { let r = 1; for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1); return Math.round(r); }

/** Combinaciones distintas de nombre + variante + calidad + inscripciones (sin contar valores numéricos). */
export function combinationCount(bases: WeaponBase[]) {
  const nAff = Object.keys(AFFIXES).length; let total = 0;
  for (const b of bases) {
    const variants = variantsFor(b).length + 1;
    for (let r = 0; r < PREFIX.length; r++) {
      let affSets = 0; for (let k = r === 0 ? 0 : 1; k <= r; k++) affSets += choose(nAff, k);
      total += variants * ALL_SUFFIXES.length * affSets;
    }
  }
  return total;
}

export type { AffixId };

/** Equipo inicial: arma básica de la clase, sin variante ni inscripciones; las estadísticas se tiran desde la base. */
export const STARTER = { dmgMin: 0.85, dmgMax: 1.0, critMax: 2, label: "de Iniciado" } as const;
export function starterStats(base: WeaponBase, rand: () => number = Math.random) {
  const dmgMult = +(STARTER.dmgMin + rand() * (STARTER.dmgMax - STARTER.dmgMin)).toFixed(2);
  const crit = Math.floor(rand() * (STARTER.critMax + 1));
  return { name: `${base.type} ${STARTER.label}`, dmgMult, crit, acc: 0, variant: undefined, rarity: 0 };
}
