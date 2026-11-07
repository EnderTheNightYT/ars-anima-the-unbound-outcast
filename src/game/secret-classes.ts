/** Clases secretas: definición, condición de desbloqueo y progreso persistente entre partidas. Browser-safe. */
import { CLASSES, type ClassDef } from "./data";
const byId = (id: string) => CLASSES.find((c) => c.id === id)!;

export interface SecretMeta { tyrants: number; maxFloor: number; bosses: number; puzzles: number }
export const SECRET_META_KEY = "ars_anima_secret_meta";
export interface SecretClass { def: ClassDef; need: keyof SecretMeta; n: number; hint: string }

export const SECRET_CLASSES: SecretClass[] = [
  { need: "tyrants", n: 1, hint: "Derrota a un Tirano (enemigo que ganó una pelea entre enemigos).", def: byId("cuervo") },
  { need: "puzzles", n: 3, hint: "Resuelve 3 palimpsestos del libro antiguo.", def: byId("archivista") },
  { need: "maxFloor", n: 4, hint: "Llega al piso 4 en cualquier partida.", def: byId("campanero") },
];
export const isSecretClass = (id: string) => SECRET_CLASSES.some((s) => s.def.id === id);
export function readSecretMeta(): SecretMeta {
  try { return { tyrants: 0, maxFloor: 1, bosses: 0, puzzles: 0, ...JSON.parse(localStorage.getItem(SECRET_META_KEY) ?? "{}") }; } catch { return { tyrants: 0, maxFloor: 1, bosses: 0, puzzles: 0 }; }
}
export function writeSecretMeta(m: SecretMeta) { try { localStorage.setItem(SECRET_META_KEY, JSON.stringify(m)); } catch { /* sin almacenamiento */ } }
export function secretUnlocked(id: string, m: SecretMeta) { const s = SECRET_CLASSES.find((x) => x.def.id === id); return !s || m[s.need] >= s.n; }
/** Suma progreso; devuelve las clases recién desbloqueadas. */
export function bumpSecret(m: SecretMeta, k: keyof SecretMeta, value: number, mode: "add" | "max" = "add") {
  const before = SECRET_CLASSES.filter((s) => secretUnlocked(s.def.id, m)).map((s) => s.def.id);
  m[k] = mode === "max" ? Math.max(m[k], value) : m[k] + value;
  return SECRET_CLASSES.filter((s) => secretUnlocked(s.def.id, m) && !before.includes(s.def.id));
}
