/** Shared projectile/body sweep rules, independent of rendering. */
export const RICOCHET = { bounces: 2, restitution: .75, damageKeep: .8, maxLife: 4 } as const;
export function segmentContact(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, x: number, y: number, z: number, radius: number, halfHeight: number) {
  const dx = x1 - x0, dy = y1 - y0, length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / length)) : 0;
  return Math.hypot(x0 + dx * t - x, y0 + dy * t - y) <= radius && Math.abs(z0 + (z1 - z0) * t - z) <= halfHeight ? t : null;
}