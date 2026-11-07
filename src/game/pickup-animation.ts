/** Shared, presentation-only pickup gesture; never changes equipment or combat. */
export const PICKUP_DURATION = .9;
export const newPickupAnimation = () => ({ t: 0, sprite: "" });
export type PickupAnimation = ReturnType<typeof newPickupAnimation>;
export function drawPickup(g: { pickupAnimation: PickupAnimation; sprites: Record<string, HTMLImageElement | HTMLCanvasElement>; vx: number; vy: number; time: number }, ctx: CanvasRenderingContext2D, W: number, H: number) {
  const P = g.pickupAnimation, palm = g.sprites.pariahPalm;
  if (P.t <= 0 || !palm) return false;
  const k = 1 - P.t / PICKUP_DURATION, lift = k < .4 ? 0 : Math.min(1, (k - .4) / .3);
  const bob = Math.sin(g.time * 7) * 6 * Math.min(1, Math.hypot(g.vx, g.vy) / 3);
  const x = W * .62 + bob, h = 150 + lift * 10, w = h * palm.width / palm.height;
  ctx.save(); ctx.translate(x, H + 30 - lift * 40); ctx.rotate(-.15);
  ctx.drawImage(palm, -w / 2, -h, w, h); ctx.restore();
  const item = g.sprites[P.sprite];
  if (item && k >= .4) ctx.drawImage(item, x - 23, H - 120 - lift * 40, 34, 34 * item.height / item.width);
  return true;
}