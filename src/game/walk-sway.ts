/**
 * Walking view sway (presentation only): gentle side-to-side rock, tiny tremor, almost
 * imperceptible motion blur and side speed lines. Never touches aim, angle or position.
 */
export const SWAY = { maxX: 3.2, maxY: 2.0, maxRot: 0.7, maxBlur: 0.35, freq: 4.2, minSpeed: 0.6, fullSpeed: 6 };

export interface SwayFx { x: number; y: number; rot: number; blur: number; lines: number }

/**
 * `speed` is horizontal player speed in units/s; returns px offsets, degrees and 0..1 line opacity.
 * `crisp`: a player or enemy is close: no blur and no rotation, so their pixels stay sharp.
 */
export function walkSway(time: number, speed: number, grounded = true, crisp = false): SwayFx {
  if (speed < SWAY.minSpeed) return { x: 0, y: 0, rot: 0, blur: 0, lines: 0 };
  const k = Math.min(1, (speed - SWAY.minSpeed) / (SWAY.fullSpeed - SWAY.minSpeed)) * (grounded ? 1 : 0.4);
  const p = time * SWAY.freq * Math.PI;
  const tremor = Math.sin(time * 37) * 0.15;
  return {
    x: (Math.sin(p) * SWAY.maxX + tremor) * k,
    y: Math.abs(Math.cos(p)) * SWAY.maxY * k,
    rot: crisp ? 0 : Math.sin(p) * SWAY.maxRot * k,
    blur: crisp ? 0 : SWAY.maxBlur * k,
    lines: Math.max(0, k - 0.35) / 0.65,
  };
}
