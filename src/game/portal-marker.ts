/** Shared map-only symbol, drawn above terrain and other markers. */
export function portalPalette() {
  const css = getComputedStyle(document.documentElement);
  return { core: css.getPropertyValue('--map-portal-core').trim(), rim: css.getPropertyValue('--map-portal-rim').trim(), ink: css.getPropertyValue('--map-portal-ink').trim() };
}
export function drawPortalMarker(c: CanvasRenderingContext2D, x: number, y: number, radius: number, palette: ReturnType<typeof portalPalette>, pulse = 0) {
  c.save(); c.translate(x, y);
  c.strokeStyle = palette.core; c.globalAlpha = .4; c.lineWidth = 2;
  c.beginPath(); c.arc(0, 0, radius + 3 + pulse, 0, Math.PI * 2); c.stroke();
  c.globalAlpha = 1; c.fillStyle = palette.ink; c.strokeStyle = palette.rim; c.lineWidth = 2;
  c.beginPath(); c.moveTo(0, -radius); c.lineTo(radius, 0); c.lineTo(0, radius); c.lineTo(-radius, 0); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = palette.core; c.beginPath(); c.ellipse(0, 0, radius * .35, radius * .62, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = palette.ink; c.beginPath(); c.ellipse(0, 0, radius * .13, radius * .4, 0, 0, Math.PI * 2); c.fill();
  c.restore();
}