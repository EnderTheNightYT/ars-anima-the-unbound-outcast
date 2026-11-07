import type { WeaponBase } from './data';

export const AIM_SECONDS = 1;
export function meleeMode(base: WeaponBase, alternate: boolean) {
  const heavy = ['MARTILLO', 'MANDOBLE', 'GUADAÑA', 'HACHA'].includes(base.type);
  const straight = ['LANZA', 'DAGA', 'BASTON'].includes(base.type);
  return {
    shape: base.type === 'MARTILLO' ? 'circle' : straight ? 'thrust' : 'slash',
    range: base.range * (alternate ? 1.35 : 1),
    width: base.type === 'DAGA' ? .28 : .38,
    cone: alternate ? 1.3 : .85,
    targets: straight ? (alternate && base.type === 'LANZA' ? 3 : 1) : base.type === 'MARTILLO' ? 8 : alternate ? 5 : 3,
    charge: base.rate * (heavy ? 1.6 : 1.2),
    cooldown: base.rate * (alternate ? 1.8 : 1),
    damage: alternate ? 2 : 1,
  };
}
export function meleeContains(base: WeaponBase, alternate: boolean, dx: number, dy: number, angle: number) {
  const m = meleeMode(base, alternate), dist = Math.hypot(dx, dy);
  if (dist > m.range) return false;
  if (m.shape === 'circle') return true;
  const forward = dx * Math.cos(angle) + dy * Math.sin(angle);
  if (m.shape === 'thrust') return forward > 0 && Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle)) <= m.width;
  return Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - angle), Math.cos(Math.atan2(dy, dx) - angle))) < m.cone;
}
export function aimedReady(aiming: boolean, seconds: number) { return aiming && seconds >= AIM_SECONDS; }
export function rewardRarity(source: 'key' | 'miniBoss' | 'boss', floor: number) {
  return source === 'boss' ? 4 : Math.min(4, (source === 'key' ? 2 : 3) + Math.floor(Math.max(0, floor - 1) / 3));
}