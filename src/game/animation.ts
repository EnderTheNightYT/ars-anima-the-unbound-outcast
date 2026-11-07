export type Pose = 'idle' | 'walk' | 'attack' | 'hurt' | 'death' | 'open' | 'rest' | 'alert' | 'down';
export const FRAME_COUNT = 12;
const ease = (x: number) => x * x * (3 - 2 * x);
// Pixel-strip rig preserves original silhouettes, canvas foot anchoring and aspect ratio.
// 12 frames per pose: walk with alternating legs and torso sway, attack with wind-up → lunge → recovery.
export function makeFrames(image: HTMLImageElement | HTMLCanvasElement, pose: Pose, floating = false, onlyFrame?: number) {
  return Array.from({ length: onlyFrame === undefined ? FRAME_COUNT : 1 }, (_, index) => {
    const frame = onlyFrame ?? index;
    const pad = 16;
    const canvas = document.createElement('canvas'); canvas.width = image.width + pad * 2; canvas.height = image.height + pad;
    const ctx = canvas.getContext('2d'); if (!ctx) return image;
    ctx.imageSmoothingEnabled = false;
    const f = frame / FRAME_COUNT, phase = f * Math.PI * 2;
    const ox = pad, oy = pad / 2;
    if (pose === 'death') {
      const k = ease(frame / (FRAME_COUNT - 1));
      ctx.globalAlpha = 1 - k * 0.85; ctx.translate(canvas.width / 2, canvas.height - oy); ctx.rotate(k * 1.1);
      const h = image.height * (1 - k * 0.55);
      ctx.drawImage(image, -image.width / 2, -h, image.width * (1 + k * 0.15), h);
      return canvas;
    }
    if (pose === 'down') {
      // Knocked flat: body lies on its side, twitching, then starts pushing up near the end.
      const k = frame / (FRAME_COUNT - 1), lift = k > .75 ? ease((k - .75) / .25) : 0;
      ctx.translate(canvas.width / 2, canvas.height - oy); ctx.rotate((1 - lift * .6) * 1.45 + Math.sin(phase * 3) * .03);
      ctx.drawImage(image, -image.width / 2, -image.height * .9, image.width, image.height * .9);
      return canvas;
    }
    if (pose === 'alert') {
      // Startle: hop up and stretch, then settle into a crouch facing the player.
      const k = ease(frame / (FRAME_COUNT - 1)), hop = Math.sin(k * Math.PI) * 9, stretch = 1 + Math.sin(k * Math.PI) * .12;
      const h = image.height * stretch;
      ctx.drawImage(image, ox - (image.width * (1 / stretch - 1)) / 2, oy + image.height - h - hop, image.width / stretch, h);
      if (k < .6) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = `rgba(255,60,80,${.28 * (1 - k / .6)})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      return canvas;
    }
    if (pose === 'open') {
      const lid = Math.round(image.height * .38), lift = Math.round(ease(frame / (FRAME_COUNT - 1)) * 10);
      ctx.drawImage(image, 0, lid, image.width, image.height - lid, ox, oy + lid, image.width, image.height - lid);
      ctx.drawImage(image, 0, 0, image.width, lid, ox, oy - lift, image.width, lid);
      return canvas;
    }
    // attack timeline: 0-0.55 wind-up (lean back, crouch), 0.55-0.8 lunge (lean in, stretch), 0.8-1 recover
    let lean = 0, squash = 1;
    if (pose === 'attack') {
      if (f < 0.55) { const k = ease(f / 0.55); lean = -6 * k; squash = 1 - 0.08 * k; }
      else if (f < 0.8) { const k = ease((f - 0.55) / 0.25); lean = -6 + 18 * k; squash = 0.92 + 0.14 * k; }
      else { const k = ease((f - 0.8) / 0.2); lean = 12 * (1 - k); squash = 1.06 - 0.06 * k; }
    }
    const h = image.height * squash, top = oy + (image.height - h);
    for (let y = 0; y < image.height; y += 2) {
      const part = y / image.height, lower = part > .6;
      const stride = Math.sin(phase + (part > .78 ? 0 : Math.PI));
      let shift = 0, bounce = 0;
      if (pose === 'walk') { shift = Math.sin(phase + (lower ? part * 7 : 0)) * (lower ? 2.5 : 1.2) + Math.sin(phase * 2) * (1 - part) * 1.5; bounce = Math.abs(Math.sin(phase)) * 2.5; }
      else if (pose === 'attack') shift = lean * (1 - part) * (1 - part);
      else if (pose === 'rest') { shift = Math.sin(phase * .5 + part * 2) * 1.6 * (1 - part); bounce = -Math.round((1 - part) * 3 + Math.sin(phase) * 1.2 * (1 - part)); }
      else if (pose === 'hurt') shift = Math.sin(phase * 2) * 3 * (1 - part) - 3 * (1 - part);
      else { shift = Math.sin(phase + part * 3) * (floating ? 2.2 : 0.7); bounce = floating ? Math.sin(phase) * 3 : Math.sin(phase) * 0.6 * (1 - part); }
      const dy = top + y * squash - Math.round(bounce), dh = Math.max(2, 2 * squash + .5);
      if (pose === 'walk' && lower && !floating) {
        const half = Math.max(1, Math.floor(image.width / 2));
        ctx.drawImage(image, 0, y, half, 2, ox + Math.round(shift + stride * 3), dy, half, dh);
        ctx.drawImage(image, half, y, image.width - half, 2, ox + half + Math.round(shift - stride * 3), dy, image.width - half, dh);
      } else ctx.drawImage(image, 0, y, image.width, 2, ox + Math.round(shift), dy, image.width, dh);
    }
    if (pose === 'attack' && f >= 0.55 && f < 0.8) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = 'rgba(255,240,200,0.18)'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    return canvas;
  });
}
