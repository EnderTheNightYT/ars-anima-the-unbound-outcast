/** Datos de presentación de otros jugadores y marcas del servidor (sólo dibujo, sin reglas). */
export interface RemoteView {
  id: string; name: string; color: string; role: string;
  x: number; y: number; z: number; ang: number; pitch: number; vx: number; vy: number;
  slot: number; dashT: number; crouching: boolean; slideT: number; swingT: number; heavy: boolean; aiming: boolean; pounding: boolean;
  hp: number; hpMax: number; state: "alive" | "downed" | "dead" | "extracted" | "gone"; traitor: number;
  /** Nivel, clase y último título ganado en partida (para la etiqueta sobre la cabeza). */ level?: number; cls?: string; title?: string;
  canvas?: HTMLCanvasElement | null;
}
/** Marcas interactivas del servidor: palancas, altar de la codicia, duelo, evacuación. */
export interface NetMark { id: string; kind: "lever" | "greed" | "duel" | "evac" | "ambushChest"; x: number; y: number; label: string; color: string; used?: boolean }

export const MARK_SPRITE: Record<NetMark["kind"], string> = { lever: "rune", greed: "rune", duel: "rune", evac: "rune", ambushChest: "rune" };
