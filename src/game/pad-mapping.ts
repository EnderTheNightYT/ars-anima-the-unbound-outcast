import { z } from "zod";
import type { PadAction } from "./gamepad";

/** Botones reasignables (Start=9 menú y Select=8 mapa/modificador quedan fijos). */
export const REMAP_BUTTONS = [0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15, 16, 17] as const;
export const PAD_ACTIONS = ["jump", "dash", "interact", "swap", "parry", "block", "alternate", "attack", "slide", "kick", "nova", "bomb", "finisher", "grab", "reload"] as const satisfies readonly PadAction[];
export type MapAction = (typeof PAD_ACTIONS)[number];
export type PadMap = Partial<Record<number, MapAction>>;

export const BUTTON_NAMES: Record<number, string> = {
  0: "A / Cruz", 1: "B / Círculo", 2: "X / Cuadrado", 3: "Y / Triángulo", 4: "LB / L1", 5: "RB / R1", 6: "LT / L2", 7: "RT / R2",
  8: "Select / Share", 9: "Start / Options", 10: "L3", 11: "R3", 12: "Cruceta ↑", 13: "Cruceta ↓", 14: "Cruceta ←", 15: "Cruceta →", 16: "Home / PS", 17: "Panel táctil",
};
export const ACTION_NAMES: Record<MapAction, string> = {
  jump: "Saltar", dash: "Dash", interact: "Usar", swap: "Cambiar arma", parry: "Parry", block: "Guardia", alternate: "Cargar / apuntar",
  attack: "Atacar", slide: "Deslizar / machacar", kick: "Patada", nova: "Nova", bomb: "Bomba", finisher: "Remate", grab: "Escudo humano", reload: "Recargar",
};
/** Combinaciones fijas con Select (modificador) — cada una hace una sola cosa. */
export const SELECT_COMBOS: { button: number; action: string }[] = [
  { button: 1, action: "Habilidad de clase" }, { button: 3, action: "Ver pactos" }, { button: 4, action: "Sigilo" }, { button: 5, action: "Pacto rápido" }, { button: 2, action: "Recargar (Select + X)" },
];

export const DEFAULT_PAD_MAP: PadMap = {
  0: "jump", 1: "dash", 2: "interact", 3: "swap", 4: "parry", 5: "block", 6: "alternate", 7: "attack",
  10: "slide", 11: "kick", 12: "nova", 13: "bomb", 14: "finisher", 15: "grab", 16: "reload",
};

export interface MapConflict { action: string; buttons: number[] }
/** Acciones asignadas a más de un botón y acciones sin botón. */
export function mapConflicts(map: PadMap): { duplicates: MapConflict[]; missing: MapAction[] } {
  const by = new Map<string, number[]>();
  for (const [b, a] of Object.entries(map)) if (a) by.set(a, [...(by.get(a) ?? []), Number(b)]);
  const combos = new Map<string, number[]>();
  for (const c of SELECT_COMBOS) combos.set(c.action, [...(combos.get(c.action) ?? []), c.button]);
  const duplicates = [...by, ...combos].filter(([, bs]) => bs.length > 1).map(([action, buttons]) => ({ action, buttons }));
  return { duplicates, missing: PAD_ACTIONS.filter(a => !by.has(a)) };
}

export const proposalSchema = z.object({
  assignments: z.array(z.object({ button: z.number().int(), action: z.string() })).max(32),
  notes: z.string().max(600),
});
/** Convierte la propuesta en mapa; rechaza botones fijos, duplicados o acciones desconocidas. */
export function validateProposal(raw: z.infer<typeof proposalSchema>): { ok: true; map: PadMap } | { ok: false; error: string } {
  const map: PadMap = {};
  for (const { button, action } of raw.assignments) {
    if (!(REMAP_BUTTONS as readonly number[]).includes(button)) return { ok: false, error: `Botón ${button} no reasignable.` };
    if (!(PAD_ACTIONS as readonly string[]).includes(action)) return { ok: false, error: `Acción desconocida: ${action}.` };
    if (map[button]) return { ok: false, error: `${BUTTON_NAMES[button]} recibió dos acciones.` };
    map[button] = action as MapAction;
  }
  const c = mapConflicts(map);
  if (c.duplicates.length) return { ok: false, error: `Acción duplicada: ${c.duplicates[0]?.action}.` };
  if (c.missing.length) return { ok: false, error: `Faltan acciones: ${c.missing.join(", ")}.` };
  return { ok: true, map };
}

export const padAdviceInput = z.object({
  model: z.string().trim().min(1).max(80),
  preferences: z.string().trim().max(500),
  current: z.record(z.string(), z.string()).optional(),
});

const KEY = "ars_anima_padmap_v1";
let cache: PadMap | null = null;
export function loadPadMap(): PadMap {
  if (cache) return cache;
  try { const raw = localStorage.getItem(KEY); if (raw) { const m = JSON.parse(raw) as PadMap; if (!mapConflicts(m).duplicates.length) return (cache = m); } } catch { /* default */ }
  return (cache = { ...DEFAULT_PAD_MAP });
}
export function savePadMap(map: PadMap | null) {
  cache = map ? { ...map } : { ...DEFAULT_PAD_MAP };
  try { if (map) localStorage.setItem(KEY, JSON.stringify(map)); else localStorage.removeItem(KEY); } catch { /* storage full */ }
}
export const buttonFor = (map: PadMap, action: MapAction) => Number(Object.entries(map).find(([, a]) => a === action)?.[0] ?? -1);
