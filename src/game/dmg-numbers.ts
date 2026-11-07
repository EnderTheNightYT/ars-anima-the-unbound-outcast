/**
 * Números de daño flotantes: tiers visuales, pequeño salto lateral y "pop" de escala.
 * Puro (sin DOM): lo usan el motor (un jugador) y el cliente multijugador.
 */
export type DmgTier = "chip" | "hit" | "heavy" | "crit";
export interface DmgNum { x: number; y: number; z: number; text: string; color: string; t: number; t0?: number; vx?: number; vy?: number; tier?: DmgTier }

export const DMG_NUM = { life: 1.05, rise: 0.75, pop: 0.14, max: 32 } as const;

/** Tier por daño absoluto y por fracción de la vida máxima del objetivo. */
export function dmgTier(dmg: number, hpMax = 100, crit = false): DmgTier {
  if (crit) return "crit";
  const share = dmg / Math.max(1, hpMax);
  if (dmg >= 30 || share >= 0.35) return "heavy";
  if (dmg >= 8 || share >= 0.12) return "hit";
  return "chip";
}

export const TIER_STYLE: Record<DmgTier, { color: string; px: number; suffix: string }> = {
  chip: { color: "#d8d2c4", px: 6, suffix: "" },
  hit: { color: "#ffffff", px: 8, suffix: "" },
  heavy: { color: "#ffd34a", px: 10, suffix: "" },
  crit: { color: "#ff5a2a", px: 11, suffix: "!" },
};

/** Crea un número con deriva lateral pseudoaleatoria (rnd inyectable para pruebas). */
export function makeDmgNum(x: number, y: number, z: number, dmg: number, hpMax = 100, crit = false, rnd: () => number = Math.random): DmgNum {
  const tier = dmgTier(dmg, hpMax, crit), st = TIER_STYLE[tier], a = rnd() * Math.PI * 2, s = 0.25 + rnd() * 0.35;
  return { x: x + Math.cos(a) * .12, y: y + Math.sin(a) * .12, z, text: String(Math.max(1, Math.round(dmg))) + st.suffix, color: st.color, t: DMG_NUM.life, t0: DMG_NUM.life, vx: Math.cos(a) * s, vy: Math.sin(a) * s, tier };
}

/** Avanza la animación: sube, frena la deriva y caduca. */
export function stepDmgNums(list: DmgNum[], dt: number): DmgNum[] {
  for (const n of list) { n.t -= dt; n.z += dt * DMG_NUM.rise * Math.max(.2, n.t / (n.t0 ?? DMG_NUM.life)); if (n.vx) { n.x += n.vx * dt; n.vx *= Math.exp(-4 * dt); } if (n.vy) { n.y += n.vy * dt; n.vy *= Math.exp(-4 * dt); } }
  return list.filter(n => n.t > 0).slice(-DMG_NUM.max);
}

/** Escala del "pop" inicial (1.6 → 1) y opacidad final. */
export function dmgNumLook(n: DmgNum): { scale: number; alpha: number; px: number } {
  const life = n.t0 ?? DMG_NUM.life, age = life - n.t, st = TIER_STYLE[n.tier ?? "hit"];
  const pop = age < DMG_NUM.pop ? 1 + (1 - age / DMG_NUM.pop) * (n.tier === "crit" ? .9 : .6) : 1;
  return { scale: pop, alpha: Math.max(0, Math.min(1, n.t * 2.5)), px: st.px };
}
