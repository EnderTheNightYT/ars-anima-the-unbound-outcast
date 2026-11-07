import type { Input } from "./engine";

/** Standard-layout gamepad mapping (Xbox/PlayStation/generic OTG, Android y PC). */
export const PAD_DEADZONE = 0.18;
export type PadAction = keyof Omit<Input, "mx" | "my" | "lookX" | "lookY">;
export const PAD_BUTTONS: Partial<Record<number, PadAction>> = {
  0: "jump", 1: "dash", 2: "interact", 3: "swap",
  4: "parry", 5: "block", 6: "alternate", 7: "attack",
  10: "slide", 11: "kick",
  12: "nova", 13: "bomb", 14: "finisher", 15: "grab", 16: "reload",
};
export const PAD_MENU = 9, PAD_MAP = 8;
export const PAD_LEGEND = [
  "Stick izq · mover (a fondo corre)", "Stick der · mirar", "RT · ataque · LT · cargar/apuntar",
  "A · saltar · B · dash · X · usar · Y · cambiar arma", "RB · guardia · LB · parry · R3 · patada",
  "L3 · deslizar / agacharse quieto / MACHACAR en el aire",
  "Cruceta ↑ nova · ↓ bomba · ← remate · → escudo",
  "Select + X · RECARGAR (combinación libre) · también Home/PS", "Select + LB · sigilo · Select + RB · pacto rápido", "Select + B · habilidad de clase", "Select + Y · ver pactos", "Start · menú · Select · mapa · en menús: cruceta + A",
];
export const dz = (v: number) => (Math.abs(v) < PAD_DEADZONE ? 0 : (v - Math.sign(v) * PAD_DEADZONE) / (1 - PAD_DEADZONE));
/** True when the pad shows deliberate input (used to switch off touch controls). */
export const padActive = (axes: readonly number[], pressed: readonly boolean[]) => axes.some(a => Math.abs(a) > 0.5) || pressed.some(Boolean);

/** Cruceta "hat" en un único eje (drivers DirectInput/HID genéricos en PC y Android): -1 arriba … 1 arriba-izq, reposo ≈ 1.29. */
export function hatAxis(ax: readonly number[]): [number, number] | null {
  if (ax.length < 9) return null;
  const v = ax[ax.length - 1] ?? 0;
  if (v > 1.05) return [0, 0];
  const k = Math.round((v + 1) / (2 / 7));
  if (k < 0 || k > 7 || Math.abs(v - (-1 + k * (2 / 7))) > 0.04) return null;
  const dirs: [number, number][] = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  return dirs[k] ?? null;
}
/** navigator.getGamepads puede lanzar en iframes sin permiso "gamepad". */
export function safePads(): Gamepad[] {
  try { return [...(navigator.getGamepads?.() ?? [])].filter((p): p is Gamepad => !!p && p.connected !== false); } catch { return []; }
}

export interface PadLike { mapping?: string; axes: readonly number[]; buttons: readonly { pressed: boolean; value: number }[] }
export interface PadState { axes: number[]; pressed: boolean[]; lsX: number; lsY: number; rsX: number; rsY: number; dpadX: number; dpadY: number }

/**
 * Lee todos los mandos conectados y los normaliza al diseño estándar.
 * Los mandos sin mapeo "standard" (frecuentes en Android o con drivers genéricos) usan
 * stick derecho en ejes 2/3, gatillos en ejes 4/5 y cruceta en los dos últimos ejes.
 */
export function readPads(pads: readonly PadLike[]): PadState {
  const out: PadState = { axes: [], pressed: Array(18).fill(false), lsX: 0, lsY: 0, rsX: 0, rsY: 0, dpadX: 0, dpadY: 0 };
  const big = (a: number, b: number) => (Math.abs(b) > Math.abs(a) ? b : a);
  for (const p of pads) {
    if (!p || p.buttons.length < 4) continue; // sensores/acelerómetros
    const ax = p.axes, btn = p.buttons.map(b => !!b && (b.pressed || b.value > 0.4));
    const std = p.mapping === "standard";
    const pr: boolean[] = Array(18).fill(false);
    btn.forEach((v, i) => { if (i < 18) pr[i] = v; });
    let dX = 0, dY = 0;
    if (!std) {
      if (btn.length < 8 && ax.length >= 6) { pr[6] = pr[6] || (ax[4] ?? -1) > 0.3; pr[7] = pr[7] || (ax[5] ?? -1) > 0.3; }
      const hat = hatAxis(ax);
      if (hat) { dX = hat[0]; dY = hat[1]; }
      else if (ax.length >= 8) { dX = Math.round(ax[ax.length - 2] ?? 0); dY = Math.round(ax[ax.length - 1] ?? 0); }
    }
    dX = big(dX, (pr[15] ? 1 : 0) - (pr[14] ? 1 : 0)); dY = big(dY, (pr[13] ? 1 : 0) - (pr[12] ? 1 : 0));
    if (!std) { if (dY < 0) pr[12] = true; if (dY > 0) pr[13] = true; if (dX < 0) pr[14] = true; if (dX > 0) pr[15] = true; }
    out.lsX = big(out.lsX, dz(ax[0] ?? 0)); out.lsY = big(out.lsY, dz(ax[1] ?? 0));
    out.rsX = big(out.rsX, dz(ax[2] ?? 0)); out.rsY = big(out.rsY, dz(ax[3] ?? 0));
    out.dpadX = big(out.dpadX, dX); out.dpadY = big(out.dpadY, dY);
    pr.forEach((v, i) => { out.pressed[i] = out.pressed[i] || v; });
  }
  out.axes = [out.lsX, out.lsY, out.rsX, out.rsY];
  return out;
}

/** Vibración por evento/tipo de daño: [duración ms, motor fuerte, motor débil]. */
export const RUMBLE: Partial<Record<string, [number, number, number]>> = {
  rubble: [260, .8, .35], cloud: [300, .4, .65], pound: [220, .9, .5], boss: [500, 1, .6], ricochet: [40, .1, .4], charged: [120, .5, .4],
  hurt: [180, 0.7, 0.4], explosion: [380, 1, 0.8], parry: [90, 0.2, 0.9], block: [70, 0.35, 0.2],
  hit: [45, 0.15, 0.45], kill: [110, 0.45, 0.5], break: [140, 0.6, 0.4], shot: [55, 0.25, 0.55],
  land: [80, 0.5, 0.1], dash: [70, 0.1, 0.5], terror: [500, 0.9, 0.3], level: [260, 0.3, 0.6], portal: [300, 0.4, 0.4], beat: [60, 0.3, 0.7],
};
type Actuator = { playEffect?: (t: string, p: object) => Promise<unknown> };
/** Hace vibrar todos los mandos conectados si el navegador lo permite (Chrome PC/Android). */
export function rumble(kind: string, scale = 1) {
  const r = RUMBLE[kind]; if (!r) return;
  for (const p of safePads()) {
    const a = (p as unknown as { vibrationActuator?: Actuator }).vibrationActuator;
    try { void a?.playEffect?.("dual-rumble", { duration: r[0], strongMagnitude: Math.min(1, r[1] * scale), weakMagnitude: Math.min(1, r[2] * scale) })?.catch(() => {}); } catch { /* sin vibración */ }
  }
}
