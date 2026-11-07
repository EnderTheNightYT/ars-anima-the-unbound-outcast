/** Ficha completa de cada arma para la wiki, derivada de las reglas reales del generador. Browser-safe. */
import { AFFIXES, ENEMY_TYPES, PREFIX, RARITY, SUFFIX, WEAPONS, type AffixId, type WeaponBase } from "./data";
import { meleeMode } from "./weapon-modes";
import { meleeStyle, rangedProfile } from "./combat-fx";
import { CHAINS } from "./melee-combo";
import { weaponGuide } from "./weapon-guide";
import { weaponLevel } from "./weapon-access";
import { RHYTHM } from "./beat";
import { RICOCHET } from './ricochet';

/** Probabilidad de cada tier en un piso (mismas reglas que makeWeapon: d100 + piso×3). */
export function tierOdds(floor: number): number[] {
  const out = [0, 0, 0, 0, 0];
  for (let roll = 1; roll <= 100; roll++) {
    const x = roll + floor * 3;
    out[x < 50 ? 0 : x < 75 ? 1 : x < 90 ? 2 : x < 98 ? 3 : 4]! += 1;
  }
  return out.map((n) => n / 100);
}

/** Rango del multiplicador de daño de un tier en un piso. */
export function dmgMultRange(rarity: number, floor: number) {
  const mid = 1 + rarity * 0.18 + floor * 0.06;
  return { min: +(mid - 0.1).toFixed(2), max: +(mid + 0.15).toFixed(2) };
}

/** Qué hace cada inscripción con este tipo de arma concreto. */
export function affixNote(id: AffixId, base: WeaponBase): string {
  const hits = base.pellets ? `cada uno de los ${Math.max(7, base.pellets + 2)} perdigones` : base.ranged ? "cada proyectil" : "cada golpe del combo";
  switch (id) {
    case "SANGRANTE": return `Sangrado al impactar con ${hits}; ideal contra jefes de mucha vida.`;
    case "INCANDESCENTE": return `Quemadura con ${hits}; daño continuo aunque el enemigo huya.`;
    case "TOXICA": return `Veneno con ${hits}; se acumula con sangrado y fuego.`;
    case "VORAZ": return `Curas el 15% del daño infligido${base.rate <= 0.2 ? "; con esta cadencia alta sostiene combates largos" : ""}.`;
    case "EBURNEA": return `+3 Break por impacto (base ${base.breakB} → ${base.breakB + 3}); rompe guardias y derriba antes.`;
    case "INESTABLE": return `10% por impacto: estallido en área${base.pellets ? "; con perdigones se activa a menudo" : ""}.`;
    case "ENCADENADA": return "Parte del daño salta a un enemigo cercano: limpia grupos.";
    case "SEGADORA": return base.ammo ? "Cada baja recarga munición y Aguante." : "Cada baja devuelve Aguante (sin munición que recargar).";
    case "DADO_LOCO": return "Cada impacto tira 1d6: un 6 triplica el daño, un 1 lo reduce a la mitad.";
  }
}

export interface WeaponSheet {
  id: string; type: string; ranged: boolean; dice: string; avgHit: number; range: number; rate: number; breakB: number;
  minLevel: number; modes: { label: string; text: string }[]; combo: { number: number; label: string; multiplier: number; min: number; max: number; average: number; break: number }[];
  finisher: string; tiers: { name: string; dmg: string; crit: string; acc: string; affixes: string; level: number }[];
  odds: { floor: number; text: string }[]; affixes: { id: AffixId; desc: string; note: string }[];
  examples: { name: string; stats: string }[]; enemies: { id: string; name: string; hp: number; def: number; hits: number }[]; rhythm: string;
}

export function weaponSheet(base: WeaponBase): WeaponSheet {
  const guide = weaponGuide(base);
  const avgHit = guide[0]?.average ?? 0;
  const modes: WeaponSheet["modes"] = [];
  if (base.ranged) {
    const p = rangedProfile(base.type, base.pellets ?? 1);
    modes.push({ label: "Disparo", text: `Proyectil ${p.sprite} a ${p.speed} u/s · daño ×${p.damageMult}${p.pellets > 1 ? ` · ${p.pellets} perdigones (dispersión ${p.spread})` : ""}${p.burst > 1 ? ` · ráfaga de ${p.burst}` : ""}${p.pierce ? " · atraviesa" : ""}${p.bounces ? ` · rebota ${p.bounces}` : ""}${p.falloff ? " · pierde daño con la distancia" : ""}` });
    modes.push({ label: "Rebotes", text: `${Math.max(RICOCHET.bounces, p.bounces)} rebotes en superficies o cuerpos; velocidad ×${RICOCHET.restitution} y daño ×${RICOCHET.damageKeep} por rebote. Un mismo proyectil no daña dos veces al mismo enemigo.` });
    modes.push({ label: "Apuntar (mantener 1 s)", text: "Disparo de precisión: daño ×1,2 y cadencia ×1,3." });
    if (base.magazine) modes.push({ label: "Cargador", text: `${base.magazine} disparos · recarga ${base.reloadTime}s` });
    else modes.push({ label: "Recurso", text: "Consume 0,5 de Lumbre por disparo en lugar de munición." });
  } else {
    const a = meleeMode(base, false), c = meleeMode(base, true);
    modes.push({ label: "Golpe (clic)", text: `Forma ${a.shape} · alcance ${a.range.toFixed(1)} · hasta ${a.targets} objetivo(s) · ${a.cooldown.toFixed(2)}s` });
    modes.push({ label: "Cargado (mantener clic derecho)", text: `Daño ×2 · alcance ${c.range.toFixed(1)} · hasta ${c.targets} objetivos · carga ${c.charge.toFixed(2)}s · recuperación ${c.cooldown.toFixed(2)}s` });
  }
  const chain = base.ranged ? null : CHAINS[meleeStyle(base.type)];
  const sampleItem = (r: number) => ({ uid: 0, kind: "weapon" as const, name: "", rarity: r, base, dmgMult: 1 + r * 0.18, affixes: (Object.keys(AFFIXES) as AffixId[]).slice(0, r) });
  const tiers = RARITY.map((name, r) => {
    const d = dmgMultRange(r, 1);
    return { name: r ? `${name} («${PREFIX[r]}»)` : name, dmg: `×${d.min}–${d.max} en el piso 1 (+0,06 por piso)`, crit: `0–${4 + r * 2}%`, acc: `+0–${r}`, affixes: r ? `hasta ${r} inscripción(es) al azar, sin repetir` : "ninguna", level: weaponLevel(sampleItem(r)) };
  });
  const odds = [1, 3, 5, 7].map((f) => ({ floor: f, text: tierOdds(f).map((p, i) => `${RARITY[i]} ${Math.round(p * 100)}%`).join(" · ") }));
  const ids = Object.keys(AFFIXES) as AffixId[];
  const examples = [1, 2, 3, 4].map((r, i) => {
    const aff = [0, 1, 2, 3].slice(0, r).map((k) => ids[(i * 3 + k * 2 + base.type.length) % ids.length]!);
    const uniq = [...new Set(aff)];
    const d = dmgMultRange(r, r + 1);
    return { name: `${base.type} ${PREFIX[r]} ${SUFFIX[(i + base.type.length) % SUFFIX.length]}`, stats: `Piso ${r + 1} · daño ×${((d.min + d.max) / 2).toFixed(2)} · crítico ${2 + r * 2}% · precisión +${Math.max(0, r - 1)} · ${uniq.join(", ")}` };
  });
  const chainAvg = guide.reduce((n, s) => n + s.average, 0);
  const perAttack = base.ranged ? avgHit * rangedProfile(base.type, base.pellets ?? 1).pellets : chainAvg / Math.max(1, guide.length);
  const enemies = (["sombra", "librero", "amalgama", "golem"] as const).filter((k) => k in ENEMY_TYPES).map((k) => {
    const e = ENEMY_TYPES[k as keyof typeof ENEMY_TYPES];
    return { id: k, name: e.name, hp: e.hp, def: e.def, hits: Math.max(1, Math.ceil(e.hp / Math.max(0.1, perAttack))) };
  });
  const rhythm = base.ranged
    ? `Disparar sobre un golpe grave de la música del piso 1: mini crítico ×${RHYTHM.shotCrit}.`
    : `Atacar sobre un golpe grave de la música del piso 1: mini crítico ×${RHYTHM.meleeCrit} en cada golpe del combo.`;
  return {
    id: `weapon:${base.type}`, type: base.type, ranged: base.ranged, dice: `${base.dice[0]}d${base.dice[1]}${base.pellets ? ` ×${base.pellets}` : ""}`,
    avgHit, range: base.range, rate: base.rate, breakB: base.breakB, minLevel: weaponLevel(sampleItem(0)), modes, combo: guide,
    finisher: chain ? `${chain.finisherLabel} (${chain.finisher})` : "—", tiers, odds,
    affixes: ids.map((id) => ({ id, desc: AFFIXES[id], note: affixNote(id, base) })), examples, enemies, rhythm,
  };
}

export const WEAPON_SHEETS = WEAPONS.map(weaponSheet);

/** Explicación completa de una inscripción con números del motor y ejemplos de daño y combo. */
export function affixGuide(id: AffixId, hit = 10, comboHits = 4) {
  const r = (n: number) => Math.round(n * 10) / 10;
  const total = hit * comboHits;
  const g: Record<AffixId, { rule: string; ex: string[] }> = {
    SANGRANTE: { rule: "Cada impacto deja 4 s de sangrado: 2,5 daño/s (10 daño total), se renueva con cada golpe.", ex: [`Golpe de ${hit}: ${hit} + 10 de sangrado = ${hit + 10}.`, `Combo de ${comboHits} golpes rápidos (${total}): el sangrado se reinicia en cada golpe, ~${total + 10} en total.`] },
    INCANDESCENTE: { rule: "Cada impacto quema 4 s: 3 daño/s (12 total), aunque el enemigo huya.", ex: [`Golpe de ${hit}: ${hit} + 12 de fuego = ${hit + 12}.`, `Combo de ${comboHits} (${total}) + 12 al final ≈ ${total + 12}.`] },
    TOXICA: { rule: "Cada impacto envenena 6 s: 2 daño/s (12 total); se apila con sangrado y fuego.", ex: [`Golpe de ${hit}: ${hit} + 12 de veneno = ${hit + 12}.`, "Con SANGRANTE + INCANDESCENTE: +34 daño continuo por golpe."] },
    VORAZ: { rule: "Te curas el 15% del daño que haces.", ex: [`Golpe de ${hit}: curas ${r(hit * 0.15)} PV.`, `Combo de ${comboHits} (${total}): curas ${r(total * 0.15)} PV.`] },
    EBURNEA: { rule: "+3 Break por impacto: el enemigo se derrumba (queda expuesto) mucho antes.", ex: ["Espada (Break 4) → 7 por golpe: un enemigo con Break 14 cae en 2 golpes en vez de 4.", `Combo de ${comboHits}: +${comboHits * 3} Break extra.`] },
    INESTABLE: { rule: "10% por impacto: explosión de radio 1,8 que hace el 60% del golpe a todos alrededor.", ex: [`Golpe de ${hit}: si estalla, ${r(hit * 0.6)} a cada enemigo cercano.`, `Escopeta de 7 perdigones: ~${r((1 - 0.9 ** 7) * 100)}% de probabilidad de al menos un estallido por disparo.`] },
    ENCADENADA: { rule: "El 50% del daño salta a otro enemigo a menos de 3 casillas.", ex: [`Golpe de ${hit}: ${hit} al objetivo + ${hit * 0.5} al vecino.`, `Combo de ${comboHits} (${total}): +${total * 0.5} repartido al grupo.`] },
    SEGADORA: { rule: "Cada baja recarga +3 munición y todo tu Aguante.", ex: ["Matar con el último golpe del combo te deja con aguante lleno para un dash o un nuevo combo.", "Ideal para encadenar grupos sin pausa."] },
    DADO_LOCO: { rule: "Cada impacto tira 1d6: 6 = ×3, 1 = ×0,5, resto normal. Media ×1,25.", ex: [`Golpe de ${hit}: ${hit * 0.5} / ${hit} / ${hit * 3} (media ${r(hit * 1.25)}).`, `Combo de ${comboHits} (${total}): media ${r(total * 1.25)}, máximo ${total * 3}.`] },
  };
  return g[id];
}
