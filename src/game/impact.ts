/**
 * Body-impact rules: kicked/struck enemies fly, slam into walls and other enemies,
 * and chain a few weaker, slower bounces. Browser-safe, no engine imports.
 */
export const IMPACT = {
  /** Minimum knockback speed for a body to count as a flying projectile. */
  flyMin: 5,
  /** Body damage per unit of impact speed. */
  bodyDmgPerSpeed: 1.1,
  /** Wall slam damage multiplier over body damage. */
  wallMult: 1.5,
  /** Fraction of speed kept after bouncing off a wall. */
  wallRestitution: 0.45,
  /** Speed passed to a struck enemy at chain depth 0; shrinks each step. */
  transfer: 0.7,
  /** Speed kept by the striker after hitting another body. */
  strikerKeep: 0.35,
  /** Each chain step multiplies transfer and continuation chance by this. */
  decay: 0.55,
  /** Max chain hops after the first impact. */
  maxDepth: 3,
  /** Contact distance for body-to-body impacts. */
  contact: 0.7,
  /** Extra damage taken by downed enemies (slide knockdown). */
  downedMult: 1.6,
  /** Extra push when an enemy stands this close to a wall in the push direction. */
  wallNear: 1.4,
  wallNearPush: 1.5,
} as const;

export const bodyDamage = (speed: number, depth: number) =>
  Math.max(0, Math.round(speed * IMPACT.bodyDmgPerSpeed * Math.pow(IMPACT.decay, depth) * 10) / 10);

export const wallSlamDamage = (speed: number, depth: number) => Math.round(bodyDamage(speed, depth) * IMPACT.wallMult * 10) / 10;

/** Speed after bouncing off a wall; also slower each chain step. */
export const wallBounceSpeed = (speed: number, depth: number) => speed * IMPACT.wallRestitution * Math.pow(IMPACT.decay, depth);

/**
 * Chance a flying body continues into another body. Lower with depth and with
 * the gap the struck body would need to cover to reach the next enemy.
 */
export function chainChance(depth: number, gapToNext: number) {
  if (depth >= IMPACT.maxDepth) return 0;
  const near = Math.max(0, 1 - gapToNext / 3);
  return Math.min(1, Math.pow(IMPACT.decay, depth) * (0.35 + 0.65 * near));
}

/** Speed handed to the struck body at this chain depth. */
export const transferSpeed = (speed: number, depth: number) => speed * IMPACT.transfer * Math.pow(IMPACT.decay, depth);

export const downedBonus = (downed: boolean) => (downed ? IMPACT.downedMult : 1);
