/** Perspectiva de cámara elegida en el menú (persistida en localStorage `ars_anima_camera`). */
export type CameraMode = "fp" | "shoulder" | "front" | "top" | "iso";
export interface CameraSettings { mode: CameraMode; distance: number }
export const CAMERA_LABEL: Record<CameraMode, string> = {
  fp: "Primera persona (original)", shoulder: "Tercera persona · hombro", front: "Tercera persona · de frente", top: "Vista desde arriba", iso: "Isométrica",
};
export const CAMERA_HINT: Record<CameraMode, string> = {
  fp: "Ves por los ojos de El Desconocido.", shoulder: "La cámara va detrás de tu hombro derecho.", front: "La cámara te mira de frente.",
  top: "Escenario 3D desde arriba.", iso: "Escenario 3D en diagonal.",
};
export const CAMERA_DIST = { min: 2.5, max: 9, def: 5 } as const;
const KEY = "ars_anima_camera";
export const clampDist = (d: number) => Math.max(CAMERA_DIST.min, Math.min(CAMERA_DIST.max, Number.isFinite(d) ? d : CAMERA_DIST.def));
export function loadCamera(): CameraSettings {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<CameraSettings> | null; if (v && v.mode && v.mode in CAMERA_LABEL) return { mode: v.mode, distance: clampDist(Number(v.distance)) }; } catch { /* sin guardado */ }
  return { mode: "shoulder", distance: CAMERA_DIST.def };
}
export function saveCamera(s: CameraSettings) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* sin almacenamiento */ } }
/** Píxeles por casilla en las vistas cenital/isométrica según la lejanía. */
export const topZoom = (distance: number) => Math.max(8, Math.round(30 - (clampDist(distance) - 1) * 3.5));
