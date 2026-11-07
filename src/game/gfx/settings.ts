// @ts-nocheck
/**
 * Graphics presets + persistence. Browser-safe (localStorage guarded).
 * Motion blur is intentionally absent and stripped from any saved data.
 */
export type Preset = 'low' | 'medium' | 'high' | 'ultra' | 'custom' | 'auto';
export type Backend = 'auto' | 'webgl2' | 'webgpu' | 'canvas2d';
export type Level = 0 | 1 | 2 | 3; // off/low | medium | high | ultra

export interface GfxSettings {
  preset: Preset;
  backend: Backend;
  /** Base render scale of the GPU passes relative to the display (0.5..1). */
  renderScale: number;
  dynamicResolution: boolean;
  shadowQuality: Level;
  /** World units; shadows fade beyond this. */
  shadowDistance: number;
  ambientOcclusion: Level; // 0 off/baked, 1 SSAO low, 2 SSAO high, 3 horizon (GTAO-style)
  globalIllumination: Level;
  reflectionQuality: Level; // 0 probes only, 1 planar+probes, 2 SSR, 3 SSR high
  volumetricLighting: Level;
  fogQuality: Level;
  bloom: Level;
  colorGrading: boolean;
  tonemapper: 'aces' | 'agx';
  antiAliasing: 'off' | 'fxaa';
  particleQuality: Level;
  lightQuality: Level;
  textureQuality: Level;
  sharpening: number; // 0..1
  maxFps: 30 | 60 | 120 | 0; // 0 = unlimited (vsync)
  filmGrain: boolean;
  chromaticAberration: boolean;
  depthOfField: boolean;
  lensFlares: boolean;
  exposure: number;
  showStats: boolean;
}

export const PRESETS: Record<Exclude<Preset, 'custom' | 'auto'>, Omit<GfxSettings, 'preset' | 'backend' | 'showStats' | 'maxFps' | 'tonemapper' | 'exposure'>> = {
  low: { renderScale: 0.6, dynamicResolution: true, shadowQuality: 0, shadowDistance: 6, ambientOcclusion: 0, globalIllumination: 0, reflectionQuality: 0, volumetricLighting: 0, fogQuality: 0, bloom: 1, colorGrading: true, antiAliasing: 'off', particleQuality: 0, lightQuality: 0, textureQuality: 0, sharpening: 0.2, filmGrain: false, chromaticAberration: false, depthOfField: false, lensFlares: false },
  medium: { renderScale: 0.75, dynamicResolution: true, shadowQuality: 1, shadowDistance: 9, ambientOcclusion: 1, globalIllumination: 1, reflectionQuality: 1, volumetricLighting: 1, fogQuality: 1, bloom: 2, colorGrading: true, antiAliasing: 'fxaa', particleQuality: 1, lightQuality: 1, textureQuality: 1, sharpening: 0.3, filmGrain: false, chromaticAberration: false, depthOfField: false, lensFlares: false },
  high: { renderScale: 0.9, dynamicResolution: true, shadowQuality: 2, shadowDistance: 13, ambientOcclusion: 2, globalIllumination: 2, reflectionQuality: 2, volumetricLighting: 2, fogQuality: 2, bloom: 2, colorGrading: true, antiAliasing: 'fxaa', particleQuality: 2, lightQuality: 2, textureQuality: 2, sharpening: 0.35, filmGrain: true, chromaticAberration: true, depthOfField: false, lensFlares: true },
  ultra: { renderScale: 1, dynamicResolution: false, shadowQuality: 3, shadowDistance: 18, ambientOcclusion: 3, globalIllumination: 3, reflectionQuality: 3, volumetricLighting: 3, fogQuality: 3, bloom: 3, colorGrading: true, antiAliasing: 'fxaa', particleQuality: 3, lightQuality: 3, textureQuality: 3, sharpening: 0.4, filmGrain: true, chromaticAberration: true, depthOfField: true, lensFlares: true },
};

export const DEFAULTS: GfxSettings = { preset: 'auto', backend: 'auto', ...PRESETS.medium, tonemapper: 'aces', maxFps: 60, exposure: 1, showStats: false };

export function applyPreset(s: GfxSettings, preset: Preset): GfxSettings {
  if (preset === 'custom') return { ...s, preset };
  const base = preset === 'auto' ? PRESETS.medium : PRESETS[preset];
  return { ...s, ...base, preset, dynamicResolution: preset === 'auto' ? true : base.dynamicResolution };
}

const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const lvl = (v: unknown, d: Level): Level => (typeof v === 'number' && [0, 1, 2, 3].includes(v) ? (v as Level) : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const pick = <T extends string>(v: unknown, opts: readonly T[], d: T): T => (opts.includes(v as T) ? (v as T) : d);

/** Validate untrusted saved data; unknown keys (including any legacy motion blur) are dropped. */
export function sanitize(raw: unknown): GfxSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>, d = DEFAULTS;
  return {
    preset: pick(r.preset, ['low', 'medium', 'high', 'ultra', 'custom', 'auto'] as const, d.preset),
    backend: pick(r.backend, ['auto', 'webgl2', 'webgpu', 'canvas2d'] as const, d.backend),
    renderScale: clamp(r.renderScale, 0.5, 1, d.renderScale),
    dynamicResolution: bool(r.dynamicResolution, d.dynamicResolution),
    shadowQuality: lvl(r.shadowQuality, d.shadowQuality),
    shadowDistance: clamp(r.shadowDistance, 3, 24, d.shadowDistance),
    ambientOcclusion: lvl(r.ambientOcclusion, d.ambientOcclusion),
    globalIllumination: lvl(r.globalIllumination, d.globalIllumination),
    reflectionQuality: lvl(r.reflectionQuality, d.reflectionQuality),
    volumetricLighting: lvl(r.volumetricLighting, d.volumetricLighting),
    fogQuality: lvl(r.fogQuality, d.fogQuality),
    bloom: lvl(r.bloom, d.bloom),
    colorGrading: bool(r.colorGrading, d.colorGrading),
    tonemapper: pick(r.tonemapper, ['aces', 'agx'] as const, d.tonemapper),
    antiAliasing: pick(r.antiAliasing, ['off', 'fxaa'] as const, d.antiAliasing),
    particleQuality: lvl(r.particleQuality, d.particleQuality),
    lightQuality: lvl(r.lightQuality, d.lightQuality),
    textureQuality: lvl(r.textureQuality, d.textureQuality),
    sharpening: clamp(r.sharpening, 0, 1, d.sharpening),
    maxFps: ([30, 60, 120, 0] as const).includes(r.maxFps as 30) ? (r.maxFps as GfxSettings['maxFps']) : d.maxFps,
    filmGrain: bool(r.filmGrain, d.filmGrain),
    chromaticAberration: bool(r.chromaticAberration, d.chromaticAberration),
    depthOfField: bool(r.depthOfField, d.depthOfField),
    lensFlares: bool(r.lensFlares, d.lensFlares),
    exposure: clamp(r.exposure, 0.4, 2.5, d.exposure),
    showStats: bool(r.showStats, d.showStats),
  };
}

/** Android/iOS o pantalla táctil sin ratón: arranca en calidad baja para mantener la fluidez. */
export function isMobileDevice() {
  try { return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || !!window.matchMedia?.('(pointer: coarse)').matches; } catch { return false; }
}
export const GFX_KEY = 'ars_anima_gfx';
export function loadSettings(): GfxSettings {
  try { const raw = localStorage.getItem(GFX_KEY); return raw ? sanitize(JSON.parse(raw)) : isMobileDevice() ? applyPreset({ ...DEFAULTS }, 'low') : { ...DEFAULTS }; } catch { return { ...DEFAULTS }; }
}
export function saveSettings(s: GfxSettings) {
  try { localStorage.setItem(GFX_KEY, JSON.stringify(sanitize(s))); return true; } catch { return false; }
}

/** Tiny observable store shared by the settings panel and the renderer. */
type Listener = (s: GfxSettings) => void;
let current: GfxSettings | null = null;
const listeners = new Set<Listener>();
export const gfxStore = {
  get(): GfxSettings { return (current ??= loadSettings()); },
  set(patch: Partial<GfxSettings>) {
    const prev = gfxStore.get();
    const touchesQuality = Object.keys(patch).some(k => !['preset', 'backend', 'showStats', 'maxFps', 'exposure', 'tonemapper'].includes(k));
    let next = sanitize({ ...prev, ...patch });
    if (patch.preset && patch.preset !== prev.preset) next = applyPreset(next, patch.preset);
    else if (touchesQuality && !patch.preset && prev.preset !== 'custom') next.preset = 'custom';
    current = next; saveSettings(next); listeners.forEach(l => l(next));
  },
  subscribe(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; },
  /** Test hook. */
  reset() { current = null; listeners.clear(); },
};
