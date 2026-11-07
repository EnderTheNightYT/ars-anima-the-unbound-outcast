// @ts-nocheck
/**
 * Per-region atmosphere and color grading profiles (presentation only).
 */
export interface FogProfile { density: number; height: number; falloff: number; color: [number, number, number]; scatter: number; anisotropy: number; noise: number }
export interface GradeProfile { lift: [number, number, number]; gamma: [number, number, number]; gain: [number, number, number]; saturation: number; contrast: number; shadowTint: [number, number, number]; highlightTint: [number, number, number] }
export interface SunProfile { dir: [number, number]; elevation: number; color: [number, number, number]; intensity: number }

export const FOG: Record<string, FogProfile> = {
  port: { density: 0.06, height: 0.9, falloff: 1.3, color: [0.16, 0.26, 0.34], scatter: 0.9, anisotropy: 0.45, noise: 0.6 },
  cogspire: { density: 0.035, height: 1.4, falloff: 0.9, color: [0.32, 0.22, 0.15], scatter: 0.7, anisotropy: 0.55, noise: 0.4 },
  pits: { density: 0.05, height: 0.7, falloff: 1.6, color: [0.2, 0.09, 0.28], scatter: 1.1, anisotropy: 0.3, noise: 0.7 },
  garden: { density: 0.07, height: 0.6, falloff: 1.8, color: [0.2, 0.34, 0.28], scatter: 0.8, anisotropy: 0.6, noise: 0.8 },
  babel: { density: 0.03, height: 1.2, falloff: 1.0, color: [0.22, 0.08, 0.2], scatter: 0.9, anisotropy: 0.65, noise: 0.35 },
  aethryon: { density: 0.05, height: 1.0, falloff: 1.2, color: [0.12, 0.18, 0.36], scatter: 1.0, anisotropy: 0.5, noise: 0.6 },
};
export const SUN: Record<string, SunProfile> = {
  port: { dir: [0.6, 0.8], elevation: 0.55, color: [0.55, 0.7, 0.9], intensity: 0.5 },
  cogspire: { dir: [-0.7, 0.7], elevation: 0.7, color: [1.0, 0.7, 0.45], intensity: 0.45 },
  pits: { dir: [0.2, -1], elevation: 0.9, color: [0.6, 0.35, 0.9], intensity: 0.3 },
  garden: { dir: [0.8, 0.6], elevation: 0.6, color: [0.85, 0.95, 0.75], intensity: 0.6 },
  babel: { dir: [-0.5, -0.85], elevation: 0.75, color: [1.0, 0.75, 0.55], intensity: 0.4 },
  aethryon: { dir: [0.9, -0.4], elevation: 0.5, color: [0.55, 0.65, 1.0], intensity: 0.45 },
};
const g = (lift: number[], gamma: number[], gain: number[], saturation: number, contrast: number, shadowTint: number[], highlightTint: number[]): GradeProfile =>
  ({ lift: lift as GradeProfile['lift'], gamma: gamma as GradeProfile['gamma'], gain: gain as GradeProfile['gain'], saturation, contrast, shadowTint: shadowTint as GradeProfile['shadowTint'], highlightTint: highlightTint as GradeProfile['highlightTint'] });
export const GRADE: Record<string, GradeProfile> = {
  port: g([0.01, 0.02, 0.04], [1, 1, 0.96], [0.95, 1.0, 1.05], 0.9, 1.08, [0.0, 0.05, 0.1], [0.05, 0.03, 0]),
  cogspire: g([0.03, 0.015, 0], [0.97, 1, 1.05], [1.08, 1.0, 0.88], 1.0, 1.12, [0.06, 0.02, 0], [0.08, 0.05, 0]),
  pits: g([0.03, 0, 0.04], [1, 1.04, 0.96], [1.0, 0.92, 1.08], 1.05, 1.15, [0.06, 0, 0.08], [0.02, 0.06, 0.05]),
  garden: g([0.0, 0.02, 0.01], [1, 0.97, 1], [0.98, 1.05, 0.96], 1.05, 1.05, [0, 0.05, 0.03], [0.06, 0.05, 0]),
  babel: g([0.03, 0.0, 0.02], [0.96, 1.02, 1], [1.06, 0.97, 0.95], 0.95, 1.1, [0.07, 0, 0.04], [0.08, 0.05, 0.01]),
  aethryon: g([0.0, 0.01, 0.05], [1.02, 1, 0.96], [0.92, 1.0, 1.1], 0.92, 1.1, [0, 0.03, 0.1], [0.04, 0.05, 0.08]),
};
export const zoneFog = (id: string) => FOG[id] ?? FOG.port;
export const zoneSun = (id: string) => SUN[id] ?? SUN.port;
export const zoneGrade = (id: string) => GRADE[id] ?? GRADE.port;
