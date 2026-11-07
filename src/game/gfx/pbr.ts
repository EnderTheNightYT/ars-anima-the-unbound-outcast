/**
 * Metallic-roughness PBR material table + reference BRDF math.
 * The GLSL/WGSL shaders implement the same formulas; these TS versions are used by tests
 * and by CPU light culling so both stay consistent.
 */
import { MAT, type FrameLight, type FrameCamera } from './frame';

export interface Material {
  name: string;
  metallic: number;
  roughness: number;
  /** Dielectric F0 reflectance (0.04 typical). */
  reflectance: number;
  /** Strength of the luminance-derived normal map. */
  normalStrength: number;
  /** 0..1, how much the surface participates in SSR / planar reflection. */
  reflectivity: number;
  /** Height-map scale for parallax/cavity AO. */
  height: number;
  /** Diffuse wrap for organic subsurface-like falloff. */
  wrap: number;
  /** Emissive multiplier applied to the emissive buffer. */
  emissive: number;
}

const m = (name: string, metallic: number, roughness: number, reflectance: number, normalStrength: number, reflectivity: number, height: number, wrap = 0, emissive = 1): Material =>
  ({ name, metallic, roughness, reflectance, normalStrength, reflectivity, height, wrap, emissive });

/** Indexed by MAT id. Keep length 16 (shader uniform arrays). */
export const MATERIALS: Material[] = (() => {
  const t: Material[] = Array.from({ length: 16 }, () => m('none', 0, 1, 0.04, 0, 0, 0));
  t[MAT.STONE] = m('piedra', 0, 0.82, 0.04, 1.4, 0, 0.6);
  t[MAT.WOOD] = m('madera', 0, 0.7, 0.04, 1.1, 0, 0.45, 0.1);
  t[MAT.METAL] = m('metal', 0.9, 0.38, 0.04, 0.9, 0.55, 0.3);
  t[MAT.EARTH] = m('tierra', 0, 0.95, 0.03, 1.6, 0, 0.7);
  t[MAT.WATER] = m('agua', 0, 0.06, 0.02, 0.4, 1, 0.05);
  t[MAT.ORGANIC] = m('orgánico', 0, 0.62, 0.035, 0.7, 0, 0.25, 0.35);
  t[MAT.DECOR] = m('decorativo', 0.15, 0.45, 0.05, 0.8, 0.2, 0.3, 0, 1.6);
  t[MAT.BLOOD] = m('sangre', 0, 0.18, 0.028, 0.3, 0.7, 0.05, 0.2);
  t[MAT.POLISHED] = m('metal pulido', 1, 0.12, 0.04, 0.3, 0.95, 0.1);
  return t;
})();

/** Surfaces with roughness above this never receive SSR (matte = no reflection work). */
export const SSR_ROUGHNESS_CUTOFF = 0.65;
export const wantsReflection = (mat: Material, wetness = 0) =>
  Math.max(mat.reflectivity, wetness) > 0.05 && effectiveRoughness(mat.roughness, wetness) < SSR_ROUGHNESS_CUTOFF;
/** Wet surfaces get smoother (puddles, damp stone). */
export const effectiveRoughness = (roughness: number, wetness: number) => roughness * (1 - 0.85 * Math.min(1, Math.max(0, wetness)));

// ---- BRDF (matches shaders) ----
export function distributionGGX(NdotH: number, roughness: number) {
  const a = roughness * roughness, a2 = a * a;
  const d = NdotH * NdotH * (a2 - 1) + 1;
  return a2 / (Math.PI * d * d);
}
/** Smith geometry term with Schlick-GGX k = (r+1)^2/8 (direct lighting). */
export function geometrySmith(NdotV: number, NdotL: number, roughness: number) {
  const r = roughness + 1, k = (r * r) / 8;
  const g = (x: number) => x / (x * (1 - k) + k);
  return g(NdotV) * g(NdotL);
}
export function fresnelSchlick(cosTheta: number, f0: number) {
  return f0 + (1 - f0) * Math.pow(1 - Math.min(1, Math.max(0, cosTheta)), 5);
}
/** Diffuse weight: energy not reflected specularly and not absorbed by metal. */
export const diffuseWeight = (F: number, metallic: number) => (1 - F) * (1 - metallic);

/** Windowed inverse-square falloff (UE4 style): physically 1/d², reaching exactly 0 at radius. */
export function attenuation(dist: number, radius: number) {
  const r = dist / radius, w = Math.min(1, Math.max(0, 1 - r * r * r * r));
  return (w * w) / (dist * dist + 1);
}

/** Pick the lights that matter this frame: in front of the camera (or close), scored by
 *  intensity / distance², capped by budget. Directional lights always pass. */
export function cullLights(lights: FrameLight[], cam: Pick<FrameCamera, 'px' | 'py' | 'dirX' | 'dirY'>, budget: number, maxDist = 18) {
  const scored: { l: FrameLight; s: number }[] = [];
  for (const l of lights) {
    if (l.type === 2) { scored.push({ l, s: Infinity }); continue; }
    const dx = l.x - cam.px, dy = l.y - cam.py, d = Math.hypot(dx, dy);
    if (d - l.radius > maxDist) continue;
    const ahead = dx * cam.dirX + dy * cam.dirY;
    // Behind the camera and not reaching it: invisible contribution.
    if (ahead < -l.radius && d > l.radius) continue;
    const s = (l.intensity * Math.max(l.r, l.g, l.b)) / (d * d + 1) * (l.priority === 0 ? 1e6 : 1);
    scored.push({ l, s });
  }
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, Math.max(0, budget)).map(s => s.l);
}
