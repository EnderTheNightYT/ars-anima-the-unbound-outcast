/** Deterministic pixel-art fire → smoke frames; generated only in the browser. */
export const EXPLOSION_DURATION = .8;
let frames: HTMLCanvasElement[] | undefined;
export function explosionFrame(t: number): HTMLCanvasElement {
  if (!frames) {
    frames = Array.from({ length: 10 }, (_, frame) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (!ctx) return canvas;
      const age = frame / 9;
      const radius = 7 + Math.sin(age * Math.PI * .8) * 20;
      for (let y = 0; y < 64; y += 2) for (let x = 0; x < 64; x += 2) {
        const dx = x - 32, dy = y - (38 - age * 12);
        const angle = Math.atan2(dy, dx);
        const edge = radius * (1 + .13 * Math.sin(angle * 7 + frame) + .09 * Math.cos(angle * 11));
        const distance = Math.hypot(dx, dy * 1.05);
        if (distance > edge) continue;
        const noise = (x * 17 + y * 31 + frame * 7) % 13;
        const smoke = frame > 5 || distance > edge * .86;
        ctx.globalAlpha = (1 - age * .85) * (smoke ? .75 : 1);
        ctx.fillStyle = smoke ? (noise < 6 ? '#62575d' : '#39333e') : distance < edge * .35 ? '#fff3b0' : distance < edge * .65 ? '#ffc342' : noise < 7 ? '#f66b20' : '#bf3020';
        ctx.fillRect(x, y, 2, 2);
      }
      return canvas;
    });
  }
  return frames[Math.min(9, Math.max(0, Math.floor(t / EXPLOSION_DURATION * 10)))] ?? frames[0] ?? document.createElement('canvas');
}