/** Shared falling-body collision. Warning time is followed by a physical descent. */
export const RUBBLE_FALL = { duration: .6, height: 2.4, radius: .16 } as const;
export interface FallingRubble { x: number; y: number; t: number; hit?: boolean }
export function rubbleHeight(t: number, ground = 0) {
  const remaining = Math.max(0, Math.min(1, t / RUBBLE_FALL.duration));
  return ground + RUBBLE_FALL.height * (1 - (1 - remaining) ** 2);
}
export function fallingRubbleHits(r: FallingRubble, previousT: number, player: { x: number; y: number; z: number; height: number; radius: number }, ground = 0) {
  if (r.hit || r.t > RUBBLE_FALL.duration || Math.hypot(r.x - player.x, r.y - player.y) > player.radius + RUBBLE_FALL.radius) return false;
  const hi = rubbleHeight(previousT, ground), lo = rubbleHeight(r.t, ground);
  return lo - RUBBLE_FALL.radius <= player.z + player.height && hi + RUBBLE_FALL.radius >= player.z;
}