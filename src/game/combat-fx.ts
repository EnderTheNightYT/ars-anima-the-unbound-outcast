// Browser-safe combat tuning: ranged shot profiles, stamina costs, enemy regeneration and hidden sanity.
// Engine reads these tables; keeping them here makes the rules testable without a canvas.

export type ShotSprite = "arrow" | "bullet" | "pellet" | "orb";
export interface RangedProfile {
  sprite: ShotSprite; speed: number; size: number;
  burst: number; burstGap: number; pellets: number; spread: number;
  bounces: number; wave: number; falloff: boolean; pierce: boolean; cooldownMult: number; damageMult: number;
}

const base: RangedProfile = { sprite: "bullet", speed: 30, size: .1, burst: 1, burstGap: 0, pellets: 1, spread: 0, bounces: 0, wave: 0, falloff: false, pierce: false, cooldownMult: 1, damageMult: 1 };

export function rangedProfile(type: string, pellets = 1): RangedProfile {
  switch (type) {
    case "ARCO": return { ...base, sprite: "arrow", speed: 13, size: .16, cooldownMult: 1.25, damageMult: 1.35 };
    case "BALLESTA": return { ...base, sprite: "arrow", speed: 19, size: .15, pierce: true, damageMult: 1.2 };
    case "PISTOLA": return { ...base, sprite: "bullet", speed: 36 };
    case "REVOLVER": return { ...base, sprite: "bullet", speed: 32, size: .12 };
    case "ESCOPETA": return { ...base, sprite: "pellet", speed: 17, size: .07, pellets: Math.max(7, pellets + 2), spread: .55, bounces: 1, falloff: true, damageMult: .55 };
    case "RIFLE": case "FUSIL": case "SUBFUSIL": return { ...base, sprite: "bullet", speed: 34, size: .09, burst: 3, burstGap: .07, cooldownMult: type === "SUBFUSIL" ? 2.4 : 3, damageMult: type === "FUSIL" ? 1.1 : .9 };
    case "AMETRALLADORA": return { ...base, sprite: "bullet", speed: 30, size: .09, spread: .06 };
    case "FOCO": case "BASTON": return { ...base, sprite: "orb", speed: 7.5, size: .32, wave: 1.7, cooldownMult: 1.2 };
    default: return { ...base };
  }
}

/** Angle offsets for a volley: shotguns fan in a V, single shots go straight. */
export function volleyOffsets(p: RangedProfile, aiming: boolean) {
  const n = p.pellets, spread = p.spread * (aiming ? .6 : 1);
  if (n <= 1) return [0];
  return Array.from({ length: n }, (_, i) => -spread / 2 + spread * (i / (n - 1)));
}

/** Shotgun pellets hit harder up close: ×1.5 at the muzzle down to ×0.4 at max range. */
export function falloffMult(traveled: number, range: number) {
  const k = Math.min(1, Math.max(0, traveled / Math.max(.1, range)));
  return 1.5 - 1.1 * k;
}

export const STAMINA = { jump: 1, airJump: 1.5, wallJump: 1.5, charged: 2, dash: 2, sprintPerSec: 1.6 };
export const DASH = { speed: 21, time: .22 };
export const SPRINT_MULT = 1.65;
export const TAP_DASH_SECONDS = .2;

/** Kinds that may knit themselves back together when an ally falls nearby. */
export const REGEN = { kinds: ["sanguijuela", "hereje", "obispo", "bruja", "golem", "ahogado", "espectro", "alquimista"] as string[], chance: .12, radius: 8, heal: .25 };
export function regenHeal(kind: string, hp: number, hpMax: number, roll: number) {
  if (!REGEN.kinds.includes(kind) || roll >= REGEN.chance || hp >= hpMax) return 0;
  return Math.min(hpMax - hp, Math.ceil(hpMax * REGEN.heal));
}

/** Enemies too heavy to be knocked flat by a slide or kick (they only stagger). */
export const HEAVY = ["librero", "behemoth", "golem", "carcelero"];
export const KNOCKDOWN_SECONDS = 1.4;

// Hidden sanity. Grows slowly; events only become plausible after a long session.
export type SanityEvent = "scream" | "hurt" | "kill" | "pact";
export type SanityFx = "vision" | "mute" | "shake" | "sweat" | "tremor" | "dark";
export const SANITY = { scream: 3, hurt: .35, kill: .5, pact: 6, max: 100, threshold: 20, peakRate: .02 };
export function addSanity(value: number, ev: SanityEvent) { return Math.min(SANITY.max, value + SANITY[ev]); }
/** Per-second chance of a sanity episode: 0 below 20, quadratic up to 2%/s at 100 (≈ one every 50s). */
export function sanityChance(value: number) {
  if (value <= SANITY.threshold) return 0;
  const k = (value - SANITY.threshold) / (SANITY.max - SANITY.threshold);
  return SANITY.peakRate * k * k;
}
export const SANITY_FX: SanityFx[] = ["vision", "mute", "shake", "sweat", "tremor", "dark"];

/**
 * Enemy evasive footwork (moderate, balanced). Chances are per second unless noted.
 * After any evade the enemy cannot strike for `recover` seconds: a fair punish window.
 */
export const EVADE = {
  projectile: .35,   // one-time chance per incoming player shot
  charge: 1.6,       // while the player holds a charged attack nearby
  afterSwing: 1.0,   // right after the enemy attacked
  lowHp: 1.2,        // below lowHpRatio of max health
  feint: .15,        // random erratic sidestep at close range
  lowHpRatio: .3,
  heavyMult: .35,    // heavy enemies barely dodge
  speedMult: 1.3,
  cooldown: [1.8, 3] as [number, number],
  recover: .4,
  maxRange: 7,
};
/** Chance that a single frame/event triggers an evade. */
export function evadeChance(kind: "projectile" | "charge" | "afterSwing" | "lowHp" | "feint", dt: number, heavy: boolean) {
  const base = kind === "projectile" ? EVADE.projectile : EVADE[kind] * dt;
  return Math.min(1, base * (heavy ? EVADE.heavyMult : 1));
}

/** Visible dodge: lateral step or upward hop with a tremble, synced with the AI's evade timer. */
export type EvadeStyle = "side" | "hop";
export const EVADE_ANIM = {
  hopChance: .35,  // share of dodges shown as a small jump
  lateral: .32,    // extra world-units of sideways sprite displacement at the peak
  hop: .38,        // world-units of jump height at the peak
  shake: .06,      // world-units of tremble amplitude (fades out)
  shakeHz: 38,
};
/** Pick how a dodge looks: projectiles and charges favour hops for agile kinds, heavy enemies never hop. */
export function evadeStyle(heavy: boolean, rand: () => number = Math.random): EvadeStyle {
  return !heavy && rand() < EVADE_ANIM.hopChance ? "hop" : "side";
}
/**
 * Sprite offsets for an enemy that is evading. `left` = remaining evade seconds, `total` = evade duration.
 * Returns lateral displacement (along the dodge direction), vertical lift and a decaying tremble.
 */
export function evadeMotion(left: number, total: number, style: EvadeStyle, time: number) {
  if (!(left > 0) || !(total > 0)) return { lat: 0, up: 0, shake: 0, squash: 1 };
  const p = Math.min(1, Math.max(0, 1 - left / total)), arc = Math.sin(Math.PI * p);
  const shake = Math.sin(time * EVADE_ANIM.shakeHz * Math.PI * 2) * EVADE_ANIM.shake * (1 - p * .7);
  if (style === "hop") return { lat: EVADE_ANIM.lateral * .4 * arc, up: EVADE_ANIM.hop * arc, shake, squash: p < .15 ? .9 : 1 };
  return { lat: EVADE_ANIM.lateral * arc, up: .04 * arc, shake, squash: 1 };
}

/**
 * Hit-and-run: after taking a hit an enemy may back off a few steps.
 * The player's kill streak makes them warier: from streak 2 onward the
 * chance grows with each consecutive kill.
 */
export const RETREAT = {
  base: 0.3,                       // chance after a hit with no streak
  perStreak: 0.12,                 // extra chance per streak point from 2 onward
  max: 0.92,
  seconds: [0.5, 0.95] as [number, number],
  speedMult: 0.95,
  heavyMult: 0.35,                 // heavy enemies rarely give ground
  cooldown: [1.2, 2.2] as [number, number],
};
export function retreatChance(streak: number, heavy: boolean) {
  const c = Math.min(RETREAT.max, RETREAT.base + Math.max(0, streak - 1) * RETREAT.perStreak);
  return c * (heavy ? RETREAT.heavyMult : 1);
}

/** Bloqueo perfecto: ventana tras alzar la guardia; daño recibido y reflejado como multiplicadores. */
export const PERFECT_BLOCK = { window: 0.22, taken: 0.2, reflect: 1.8 };

/** Melee hit style by weapon: blades cut, heavies smash, thrusts pierce, empty hands punch. */
export type MeleeStyle = "cut" | "smash" | "pierce" | "punch";
export function meleeStyle(type?: string): MeleeStyle {
  if (type === "MARTILLO" || type === "HACHA" || type === "MANDOBLE") return "smash";
  if (type === "LANZA" || type === "DAGA" || type === "BASTON") return "pierce";
  if (type === "ESPADA" || type === "GUADAÑA") return "cut";
  return "punch";
}
/** Kick: always damages and shoves; stronger on staggered foes and with strength (FUE). */
export const KICK = { base: 6, perStr: 2, brk: 4, push: 9, pushStaggered: 16 };
export const kickDamage = (strMod: number) => Math.max(KICK.base, KICK.base + strMod * KICK.perStr);
/** Bullet holes left on walls: lifetime in seconds and how many stay at once. */
export const BULLET_MARKS = { seconds: 14, max: 60 };

/** Causa visible de cada pérdida de vida: etiqueta y color del aviso en pantalla.
 *  Las fuentes sin entrada propia se anuncian como ataque enemigo con su nombre. */
const DAMAGE_CAUSES: Record<string, { label: string; color: string }> = {
  veneno: { label: "Veneno", color: "#8aff5a" },
  fuego: { label: "Fuego", color: "#ff7a2a" },
  sangrado: { label: "Sangrado", color: "#ff5050" },
  hambre: { label: "Hambre", color: "#ffb347" },
  sed: { label: "Sed", color: "#7ad8ff" },
  astillas: { label: "Astillas", color: "#ff5050" },
  emboscada: { label: "Emboscada", color: "#ff2a4a" },
  "inmolación": { label: "Inmolación", color: "#ff5a2a" },
  chillido: { label: "Chillido", color: "#c58aff" },
  reflejo: { label: "Daño reflejado", color: "#9cf" },
  contraataque: { label: "Contraataque", color: "#c58aff" },
  "explosión": { label: "Explosión", color: "#ff9a2a" },
  cerradura: { label: "Aguja de la cerradura", color: "#ffb347" },
  trampa: { label: "Trampa", color: "#ff5a4a" },
  mecanismo: { label: "Derrumbe", color: "#fa6" },
  salto: { label: "Salto aplastante", color: "#fa6" },
  "golpe sísmico": { label: "Golpe sísmico", color: "#fa6" },
  tinta: { label: "Tinta atrapante", color: "#8a7aff" },
  gancho: { label: "Gancho", color: "#5ff" },
  embestida: { label: "Embestida", color: "#ff6e83" },
  proyectil: { label: "Proyectil", color: "#ffd34a" },
  escombros: { label: "Escombros", color: "#aaa" },
};
export function damageCause(src: string): { label: string; color: string } {
  return DAMAGE_CAUSES[src.toLowerCase()] ?? { label: src ? `Ataque de ${src}` : "Daño desconocido", color: "#ff6e83" };
}
