/**
 * Cachés de dibujo del raycaster en primera persona (sin efecto en reglas ni colisiones).
 * El suelo se calcula píxel a píxel: buscar la sala con Array.find y dos senos por píxel costaba
 * varios milisegundos por fotograma en equipos modestos.
 */
export interface RoomRect { x: number; y: number; w: number; h: number }

/** Índice de la primera sala que contiene cada casilla (-1 = ninguna). `null` si alguna sala no está alineada a casillas. */
export function buildRoomTiles(rooms: readonly RoomRect[], size: number): Int16Array | null {
  const out = new Int16Array(size * size).fill(-1);
  for (let i = rooms.length - 1; i >= 0; i--) {
    const r = rooms[i]!;
    if (![r.x, r.y, r.w, r.h].every(Number.isInteger)) return null;
    for (let y = Math.max(0, r.y); y < Math.min(size, r.y + r.h); y++)
      for (let x = Math.max(0, r.x); x < Math.min(size, r.x + r.w); x++) out[y * size + x] = i;
  }
  return out;
}

/** Fórmula original de los charcos decorativos del suelo. */
export const puddleExact = (fx: number, fy: number) => Math.sin(fx * 2.7 + fy * 1.9) + Math.sin(fx * 5.3 - fy * 3.1) > .95;

/** Resolución de la tabla: 16 muestras por casilla (1/16 de casilla, invisible a 320×200). */
export const PUDDLE_RES = 16;
let puddleLut: Uint8Array | null = null, puddleSize = 0;

/** Charco en (fx, fy) leído de una tabla precalculada; fuera del mapa usa la fórmula directa. */
export function puddleAt(fx: number, fy: number, size: number): boolean {
  if (fx < 0 || fy < 0 || fx >= size || fy >= size) return puddleExact(fx, fy);
  if (!puddleLut || puddleSize !== size) {
    const n = size * PUDDLE_RES; puddleLut = new Uint8Array(n * n); puddleSize = size;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) puddleLut[y * n + x] = puddleExact((x + .5) / PUDDLE_RES, (y + .5) / PUDDLE_RES) ? 1 : 0;
  }
  const n = size * PUDDLE_RES;
  return puddleLut[((fy * PUDDLE_RES) | 0) * n + ((fx * PUDDLE_RES) | 0)] === 1;
}
