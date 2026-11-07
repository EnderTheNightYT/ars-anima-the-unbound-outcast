/**
 * Raycaster → GPU frame contract. Browser-safe, no DOM.
 * The engine fills these buffers while it raycasts; the GPU renderer only reads them.
 * Nothing here may feed back into simulation.
 */

/** Material IDs written into the G-buffer (byte 1). Must match MATERIALS in pbr.ts and the shaders. */
export const MAT = {
  NONE: 0,
  STONE: 1,
  WOOD: 2,
  METAL: 3,
  EARTH: 4,
  WATER: 5,
  ORGANIC: 6,
  DECOR: 7,
  BLOOD: 8,
  POLISHED: 9,
} as const;
export type MaterialId = (typeof MAT)[keyof typeof MAT];

/** Normal codes written into the G-buffer (byte 0). Axis-aligned raycaster faces + billboard impostors. */
export const NRM = { PX: 0, NX: 1, PY: 2, NY: 3, UP: 4, DOWN: 5, BILLBOARD: 6, SKY: 7 } as const;

export type LightType = 0 | 1 | 2; // point | spot | directional
export interface FrameLight {
  x: number; y: number; z: number;
  /** Linear color, 0..1 per channel. */
  r: number; g: number; b: number;
  intensity: number;
  radius: number;
  type: LightType;
  /** Spot direction (xy) and cosine of the cone half-angle. */
  dx?: number; dy?: number; cone?: number;
  shadow: boolean;
  /** Fire-like sources drive heat distortion. */
  heat?: boolean;
  /** Physical source size used by PCSS penumbra estimation. */
  size?: number;
  /** Lower = more important to keep under light budgets (player lantern, explosions). */
  priority?: number;
}

export interface FrameCamera {
  px: number; py: number; eye: number;
  dirX: number; dirY: number; plX: number; plY: number;
  pitch: number;
  /** horizon - H/2 in source rows (shake/slide offset). */
  horizonOffset: number;
  fogDist: number;
  fog: [number, number, number];
  region: string;
  time: number;
  /** Presentation signals for dynamic post FX. */
  shake: number; hurt: number; crit: number; hpRatio: number; darkness: number; aiming: number;
}

/** Linearize an sRGB byte (0..255) to 0..1. */
export const srgbToLinear = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
