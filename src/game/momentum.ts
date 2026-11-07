// Browser-safe tuning for kill-streak frenzy, enemy-miss openings, fatigue/needs,
// mirror buffs and randomized class attributes. Engine only reads these rules.

/** Seconds the streak survives without a new kill (shrinks slightly as it grows). */
export function frenzyWindow(streak: number) {
  if (streak <= 0) return 0;
  return Math.max(4, 7 - Math.min(3, (streak - 1) * 0.25));
}

/**
 * Cumulative frenzy from consecutive kills. Each kill after the first adds more speed;
 * gains grow then cap so the game stays controllable.
 * move: movement speed multiplier (≥1), rate: attack cooldown multiplier (≤1),
 * charge: charged-attack fill speed multiplier (≥1).
 */
export function frenzy(streak: number) {
  const s = Math.max(0, Math.min(15, streak - 1));
  return {
    move: 1 + Math.min(0.6, s * 0.06),
    rate: Math.max(0.45, 1 - s * 0.055),
    charge: 1 + Math.min(1.5, s * 0.15),
  };
}

/** Seconds an enemy stays open after missing an attack; hits during it deal double. */
export const OPENING = { seconds: 1.1, mult: 2 };

/** Survival needs: penalties only kick in at low values and come in brief episodes. */
export const NEEDS = {
  foodPerSec: 0.07, thirstPerSec: 0.1,
  lowFood: 20, lowThirst: 20,
  fatiguePerSec: 100 / 360, // full fatigue after ~6 minutes away from rest
  fatigueLimit: 100,
  episodeEvery: [25, 45] as const, // seconds between blur episodes
  episodeLength: 3.5,
  slow: 0.85, weak: 0.85,
};

export function needPenalty(food: number, thirst: number, fatigue: number) {
  const n = (food < NEEDS.lowFood ? 1 : 0) + (thirst < NEEDS.lowThirst ? 1 : 0) + (fatigue >= NEEDS.fatigueLimit ? 1 : 0);
  return { active: n > 0, move: n ? Math.pow(NEEDS.slow, n) : 1, damage: n ? Math.pow(NEEDS.weak, n) : 1 };
}

/** Lumbre regained per second in each rest situation. */
export const LUMBRE_REGEN = { still: 0.35, bench: 1.2, talk: 2, eat: 1.5, talkCooldown: 45 };

export type MirrorBuffId = "furia" | "celeridad" | "vampiro" | "coloso" | "frenesi";
export const MIRROR_BUFFS: Record<MirrorBuffId, { name: string; desc: string; damage: number; move: number; rate: number; lifesteal: number; armor: number }> = {
  furia: { name: "FURIA DEL REFLEJO", desc: "Daño ×2", damage: 2, move: 1, rate: 1, lifesteal: 0, armor: 0 },
  celeridad: { name: "CELERIDAD", desc: "Velocidad ×1.6", damage: 1, move: 1.6, rate: 1, lifesteal: 0, armor: 0 },
  vampiro: { name: "SED VAMPÍRICA", desc: "Robas 35% del daño", damage: 1.25, move: 1, rate: 1, lifesteal: 0.35, armor: 0 },
  coloso: { name: "COLOSO", desc: "Daño recibido −60%", damage: 1, move: 1, rate: 1, lifesteal: 0, armor: 0.6 },
  frenesi: { name: "FRENESÍ ESPECULAR", desc: "Ataques ×2 de rápidos", damage: 1, move: 1.15, rate: 0.5, lifesteal: 0, armor: 0 },
};
export const MIRROR = { seconds: 25, darkness: 0.72 };
export const mirrorPick = (r: number): MirrorBuffId => {
  const ids = Object.keys(MIRROR_BUFFS) as MirrorBuffId[];
  return ids[Math.min(ids.length - 1, Math.floor(r * ids.length))] ?? "furia";
};

/** Class base attributes with a random spread per attribute (±spread), clamped to the d120 scale. */
export const ATTR_SPREAD = 12;
export function rollAttributes(base: Record<string, number>, rand: () => number = Math.random) {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(base)) out[k] = Math.max(1, Math.min(120, Math.round(v + (rand() * 2 - 1) * ATTR_SPREAD)));
  return out;
}
/** Attribute points per level and raw gained per point. */
export const ATTR_UP = { perLevel: 1, step: 5, max: 120 };
