/** Presentation-only visibility bounds; never use this to suspend simulation. */
export function visibleBounds(sx: number, depth: number, width: number, height: number, scale: number, screenWidth: number, screenHeight: number, margin = 24) {
  if (!Number.isFinite(sx) || depth < .15) return false;
  const halfWidth = scale * screenHeight / depth * width / Math.max(1, height) / 2;
  return sx + halfWidth >= -margin && sx - halfWidth <= screenWidth + margin;
}

/** Yield to input/paint between short batches instead of monopolizing startup. */
export const yieldToBrowser = () => new Promise<void>(resolve => setTimeout(resolve, 16));
export type SpriteImage = HTMLImageElement | HTMLCanvasElement;