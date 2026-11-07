/**
 * Player rating: level adjusted by performance (difficulty adaptation) and score (kills).
 * Used to balance merchant quests, AI weapon advice and Forbidden Zone enemies.
 */
export function playerScore(kills: number, floor: number, level: number) {
  return Math.max(0, Math.round(kills * 10 + (floor - 1) * 50 + level * 20));
}

/** Max levels the rating can sit above the real level. */
export const RATING_SPAN = 2;

export function playerRating(level: number, adapt: number, kills: number) {
  const perf = (adapt - 1) * 4;
  const scoreBonus = Math.log2(1 + Math.max(0, kills)) / 3;
  const bonus = Math.max(-2, Math.min(RATING_SPAN, Math.round(perf + scoreBonus)));
  return Math.max(1, Math.min(100, Math.floor(level) + bonus));
}

/** Forbidden Zone enemy level: never below the zone requirement, and grows with a stronger player. */
export function forbiddenEnemyLevel(rating: number, zoneLevel: number, extra = 2) {
  return Math.max(zoneLevel, rating) + extra;
}

/** HP multiplier for Forbidden Zone enemies; +4% per rating point (max +40%) above the zone level. */
export function forbiddenHpMult(rating: number, zoneLevel: number, base = 1.4) {
  return +(base * (1 + Math.min(0.4, 0.04 * Math.max(0, rating - zoneLevel)))).toFixed(3);
}
