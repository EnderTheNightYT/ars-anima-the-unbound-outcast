// @ts-nocheck
/**
 * Performance monitor + adaptive quality controller (Dynamic Resolution Scaling).
 * Pure logic: the renderer feeds measured frame times; this decides quality steps.
 */
import type { GfxSettings, Level } from './settings';

export interface FrameStats {
  fps: number; frameMs: number; cpuMs: number; gpuMs: number | null; postMs: number | null;
  drawCalls: number; lights: number; triangles: number; width: number; height: number;
  gpuMemoryMB: number; backend: string; scale: number; drsStep: number;
}

/** Effective quality after DRS reductions. */
export interface Effective {
  renderScale: number; shadowQuality: Level; shadowDistance: number; aoSamples: number;
  volumetricScale: number; ssrSteps: number; particles: number; lightBudget: number;
}

export const AO_SAMPLES = [0, 6, 12, 16];
export const SSR_STEPS = [0, 0, 16, 28];
export const VOL_SCALE = [0, 0.25, 0.35, 0.5];
export const LIGHT_BUDGET = [4, 8, 14, 22];
export const PARTICLES = [0.35, 0.6, 0.85, 1];

export function baseEffective(s: GfxSettings): Effective {
  return {
    renderScale: s.renderScale, shadowQuality: s.shadowQuality, shadowDistance: s.shadowDistance,
    aoSamples: AO_SAMPLES[s.ambientOcclusion], volumetricScale: VOL_SCALE[s.volumetricLighting],
    ssrSteps: SSR_STEPS[s.reflectionQuality], particles: PARTICLES[s.particleQuality], lightBudget: LIGHT_BUDGET[s.lightQuality],
  };
}

/** Reduction ladder in the required order. Each entry degrades one aspect by one notch. */
export const LADDER = ['renderScale', 'shadowQuality', 'shadowDistance', 'aoSamples', 'volumetricScale', 'ssrSteps', 'particles', 'lightBudget'] as const;
export type LadderKey = (typeof LADDER)[number];

/** Apply `step` degradations, cycling through the ladder (render scale first). */
export function degrade(base: Effective, step: number, fullLadder: boolean): Effective {
  const e = { ...base };
  for (let i = 0; i < step; i++) {
    const key: LadderKey = fullLadder ? LADDER[i % LADDER.length] : 'renderScale';
    switch (key) {
      case 'renderScale': e.renderScale = Math.max(0.5, +(e.renderScale - 0.1).toFixed(2)); break;
      case 'shadowQuality': e.shadowQuality = Math.max(0, e.shadowQuality - 1) as Level; break;
      case 'shadowDistance': e.shadowDistance = Math.max(4, e.shadowDistance * 0.75); break;
      case 'aoSamples': e.aoSamples = Math.max(0, Math.floor(e.aoSamples * 0.6)); break;
      case 'volumetricScale': e.volumetricScale = e.volumetricScale > 0.25 ? 0.25 : e.volumetricScale; break;
      case 'ssrSteps': e.ssrSteps = Math.max(0, Math.floor(e.ssrSteps * 0.5)); break;
      case 'particles': e.particles = Math.max(0.25, e.particles * 0.7); break;
      case 'lightBudget': e.lightBudget = Math.max(3, e.lightBudget - 3); break;
    }
  }
  return e;
}

/**
 * Frame-time controller with exponential averaging and hysteresis.
 * Steps down after sustained overload, steps up only after a longer period of headroom.
 */
export class DrsController {
  step = 0;
  avgMs = 16.7;
  private over = 0;
  private under = 0;
  constructor(public maxStep = 16, public downAfter = 0.6, public upAfter = 2.5) {}
  /** Target frame time: 60 fps when the device sustains it, else stabilize at 30. */
  targetMs(maxFps: number) {
    const fps = maxFps === 0 ? 60 : Math.min(60, maxFps);
    return 1000 / fps;
  }
  update(frameMs: number, dt: number, maxFps: number) {
    if (!Number.isFinite(frameMs) || frameMs <= 0) return this.step;
    this.avgMs += (Math.min(frameMs, 200) - this.avgMs) * Math.min(1, dt * 4);
    let target = this.targetMs(maxFps);
    // If even max reductions cannot reach 60, fall back to a stable 30 fps target.
    if (this.step >= this.maxStep && this.avgMs > target * 1.15) target = 1000 / 30;
    if (this.avgMs > target * 1.12) { this.over += dt; this.under = 0; }
    else if (this.avgMs < target * 0.8) { this.under += dt; this.over = 0; }
    else { this.over = Math.max(0, this.over - dt); this.under = Math.max(0, this.under - dt); }
    if (this.over > this.downAfter && this.step < this.maxStep) { this.step++; this.over = 0; }
    if (this.under > this.upAfter && this.step > 0) { this.step--; this.under = 0; }
    return this.step;
  }
}

/** Rolling FPS / frame-time meter. */
export class FrameMeter {
  private samples: number[] = [];
  push(ms: number) { this.samples.push(ms); if (this.samples.length > 60) this.samples.shift(); }
  get avg() { return this.samples.length ? this.samples.reduce((a, b) => a + b, 0) / this.samples.length : 0; }
  get fps() { const a = this.avg; return a > 0 ? 1000 / a : 0; }
}
