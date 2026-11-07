// @ts-nocheck
/**
 * CPU generation of color-grading 3D LUTs and environment maps.
 * Pure functions (no DOM) so they run inside a Worker and in tests.
 */
import type { GradeProfile } from './zones';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Grade one linear-ish display color (0..1) with lift/gamma/gain, contrast, saturation and split toning. */
export function gradeColor(r: number, g: number, b: number, p: GradeProfile): [number, number, number] {
  const ch = [r, g, b].map((v, i) => {
    const lifted = v * (1 - p.lift[i]) + p.lift[i];
    const gained = lifted * p.gain[i];
    return Math.pow(clamp01(gained), 1 / p.gamma[i]);
  });
  const lum = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  const out = ch.map((v, i) => {
    let c = lum + (v - lum) * p.saturation;
    c = (c - 0.5) * p.contrast + 0.5;
    c += p.shadowTint[i] * (1 - lum) * (1 - lum) + p.highlightTint[i] * lum * lum;
    return clamp01(c);
  });
  return out as [number, number, number];
}

/** RGBA8 3D LUT (size³), x=r fastest, then g, then b slices. */
export function buildLut(size: number, p: GradeProfile): Uint8Array {
  const out = new Uint8Array(size * size * size * 4);
  let o = 0;
  for (let b = 0; b < size; b++) for (let g = 0; g < size; g++) for (let r = 0; r < size; r++) {
    const c = gradeColor(r / (size - 1), g / (size - 1), b / (size - 1), p);
    out[o++] = Math.round(c[0] * 255); out[o++] = Math.round(c[1] * 255); out[o++] = Math.round(c[2] * 255); out[o++] = 255;
  }
  return out;
}

/** Equirectangular environment map (RGBA8) built from region palette + light colors.
 *  Sky gradient (ceiling → fog → floor) with soft hotspots where scenic light colors dominate. */
export function buildEnvMap(w: number, h: number, ceiling: number[], fog: number[], floor: number[], lights: number[][]): Uint8Array {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1), up = 1 - 2 * v; // +1 zenith, -1 nadir
    for (let x = 0; x < w; x++) {
      const u = x / w, phi = u * Math.PI * 2;
      let c: number[];
      if (up > 0) { const t = Math.pow(up, 0.6); c = fog.map((f, i) => f * (1 - t) + ceiling[i] * t); }
      else { const t = Math.pow(-up, 0.8); c = fog.map((f, i) => f * (1 - t) + floor[i] * t); }
      lights.forEach((l, k) => {
        const lp = (k / Math.max(1, lights.length)) * Math.PI * 2 + 0.7, d = Math.abs(Math.atan2(Math.sin(phi - lp), Math.cos(phi - lp)));
        const glow = Math.exp(-d * d * 6) * Math.exp(-((up - 0.15) ** 2) * 10) * 0.55;
        for (let i = 0; i < 3; i++) c[i] += l[i] * glow;
      });
      const n = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
      const o = (y * w + x) * 4;
      for (let i = 0; i < 3; i++) out[o + i] = Math.max(0, Math.min(255, Math.round(c[i] + n * 3)));
      out[o + 3] = 255;
    }
  }
  return out;
}
