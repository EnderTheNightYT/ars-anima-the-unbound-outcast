export const MAX_PITCH = 89 * Math.PI / 180;
export const smoothFactor = (rate: number, dt: number) => 1 - Math.exp(-rate * Math.max(0, dt));
export const clampPitch = (pitch: number) => Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch));
export function verticalRay(row: number, height: number, pitch: number) {
  return Math.tan(clampPitch(pitch + Math.atan((height / 2 - row) * .95 / height)));
}
export function projectHeight(z: number, eye: number, depth: number, height: number, pitch: number) {
  const angle = Math.atan2(z - eye, depth) - pitch;
  return height / 2 - Math.tan(clampPitch(angle)) * height / .95;
}
export const shotRange = (range: number) => range * 2;
/** Balanceo de cámara al caminar: lateral muy leve (px de la vista 320x200), sólo presentación. */
export const WALK_SWAY = { sidePx: 1.1, bobPx: 0.7, stepsPerUnit: 2.2, fullSpeed: 3, ease: 6 } as const;
export function stepWalkSway(state: { phase: number; amount: number }, dt: number, speed: number, grounded: boolean) {
  const target = grounded ? Math.min(1, Math.max(0, speed) / WALK_SWAY.fullSpeed) : 0;
  state.amount += (target - state.amount) * smoothFactor(WALK_SWAY.ease, dt);
  state.phase = (state.phase + dt * Math.max(0, speed) * WALK_SWAY.stepsPerUnit) % (Math.PI * 2);
  return { x: Math.sin(state.phase) * WALK_SWAY.sidePx * state.amount, y: Math.abs(Math.cos(state.phase)) * WALK_SWAY.bobPx * state.amount };
}
