/** Enemy evolution: threat grows with map depth, total kills and player level. */
export type Trait = "embestida" | "disparo" | "garra" | "coraza" | "furia" | "eco";

/** Unlock order: each tier adds a move, attack or effect. */
export const TRAIT_TIERS: readonly [number, Trait][] = [
  [3, "embestida"], // lunges across the room
  [5, "disparo"],   // melee enemies also throw bolts
  [7, "garra"],     // melee hits cause bleeding
  [9, "coraza"],    // extra defence
  [11, "furia"],    // enrage under 35% HP
  [13, "eco"],      // their projectiles split in three
];

export const TRAIT_LABEL: Record<Trait, string> = {
  embestida: "EMBESTIDA", disparo: "DISPAROS", garra: "GARRAS SANGRANTES", coraza: "CORAZA", furia: "FURIA", eco: "PROYECTILES ECO",
};

export const THREAT_MAX = 30;
export const KILLS_PER_THREAT = 12;

export function threatLevel(floor: number, kills: number, playerLevel: number) {
  const t = 1 + Math.max(0, Math.floor(floor) - 1) + Math.floor(Math.max(0, kills) / KILLS_PER_THREAT) + Math.floor(Math.max(0, playerLevel - 1) / 2);
  return Math.min(THREAT_MAX, t);
}

export function evolution(threat: number) {
  const s = Math.max(0, Math.min(THREAT_MAX, threat) - 1);
  return {
    hp: 1 + s * .06,
    damage: 1 + s * .035,
    speed: Math.min(1.35, 1 + s * .015),
    def: Math.floor(s / 4),
    traits: TRAIT_TIERS.filter(([lv]) => threat >= lv).map(([, t]) => t),
  };
}

/** Newly unlocked traits when moving from one threat level to another. */
export function newTraits(from: number, to: number): Trait[] {
  return TRAIT_TIERS.filter(([lv]) => lv > from && lv <= to).map(([, t]) => t);
}
