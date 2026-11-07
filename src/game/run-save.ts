/** Guardado de la run en curso, perfil del jugador e historial local de runs. Browser-safe. */

export const RUN_SAVE_KEY = "ars_anima_run_save_v1";
export const HISTORY_KEY = "ars_anima_run_history_v1";
export const PLAYER_KEY = "ars_anima_player_v1";

/** Campos del Game que sobreviven al volver al menú (el piso se regenera al reanudar). */
export const RUN_FIELDS = [
  "floor", "level", "xp", "pariah", "xpNext", "sp", "gold", "anima", "grado", "mt", "cycles", "resonance", "mastery", "mtAwardedRun", "adapt",
  "hp", "hpMax", "stam", "stamMax", "mh", "mhMax", "lumbre", "lumbreMax", "food", "thirst", "ammo", "bombs", "keys",
  "wounds", "burn", "poison", "bleed", "pacts", "epiph", "bag", "mats", "cons", "kills", "levelPerks", "time",
  "streakMax", "attrs", "attrPoints", "classRewards", "melee", "ranged", "armor", "slot", "questHistory", "journal",
  "xpLog", "fatigue", "pactCooldowns", "merchantTalks", "palimMemento", "dashes", "dodgeMsgs", "subclassId", "floorSeed", "bossFight",
] as const;

export interface FloorRecord {
  floor: number; region: string; score: number; grade: string; seconds: number; kills: number;
  checks: number; checksTotal: number; highlights: string[];
}
export interface RunSave {
  v: 1; savedAt: number; name: string; cls: string; clsName: string; diff: string;
  skills: string[]; score: unknown; fields: Record<string, unknown>; floors: FloorRecord[]; uidFloor: number;
}
export interface RunRecord {
  id: string; name: string; clsName: string; diff: string; score: number; floor: number; region: string; level: number;
  kills: number; seconds: number; outcome: "death" | "won"; cause: string; floors: FloorRecord[]; endedAt: number;
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const ls = (s?: Store) => s ?? localStorage;

export function readRunSave(s?: Store): RunSave | null {
  try { const v = JSON.parse(ls(s).getItem(RUN_SAVE_KEY) || "null"); return v && v.v === 1 && typeof v.cls === "string" ? v : null; } catch { return null; }
}
export function writeRunSave(save: RunSave, s?: Store) { try { ls(s).setItem(RUN_SAVE_KEY, JSON.stringify(save)); } catch { /* opcional */ } }
export function clearRunSave(s?: Store) { try { ls(s).removeItem(RUN_SAVE_KEY); } catch { /* opcional */ } }

export function readHistory(s?: Store): RunRecord[] {
  try { const v = JSON.parse(ls(s).getItem(HISTORY_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function pushHistory(r: RunRecord, s?: Store) {
  const h = [r, ...readHistory(s).filter((x) => x.id !== r.id)];
  try { ls(s).setItem(HISTORY_KEY, JSON.stringify(h)); } catch { /* opcional */ }
  return h;
}

/** Mejor run: mayor puntuación; en empate, la que llegó más lejos. */
export function bestRun(h: RunRecord[]) { return [...h].sort((a, b) => b.score - a.score || b.floor - a.floor)[0] ?? null; }
/** Run que llegó más lejos (ganar cuenta como piso 7). */
export function furthestRun(h: RunRecord[]) { const d = (r: RunRecord) => (r.outcome === "won" ? 7 : r.floor); return [...h].sort((a, b) => d(b) - d(a) || b.score - a.score)[0] ?? null; }

export interface PlayerProfile { id: string; name: string }
export function cleanName(n: string) { return n; }
export function readPlayer(s?: Store): PlayerProfile {
  try { const v = JSON.parse(ls(s).getItem(PLAYER_KEY) || "null"); if (v?.id) return { id: String(v.id), name: cleanName(String(v.name ?? "")) }; } catch { /* nuevo */ }
  const p = { id: (globalThis.crypto?.randomUUID?.() ?? `p${Date.now()}${Math.random().toString(36).slice(2)}`), name: "" };
  try { ls(s).setItem(PLAYER_KEY, JSON.stringify(p)); } catch { /* opcional */ }
  return p;
}
export function savePlayerName(name: string, s?: Store) { const p = readPlayer(s); p.name = cleanName(name); try { ls(s).setItem(PLAYER_KEY, JSON.stringify(p)); } catch { /* opcional */ } return p; }
