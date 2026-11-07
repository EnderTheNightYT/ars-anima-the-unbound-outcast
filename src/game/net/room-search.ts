/** Búsqueda en la lista de salas públicas (browser-safe, probada en room-search.test.ts). */
import { MODES, type RuleMode } from "./rules";

export interface RoomLike { code: string; clients: number; max: number; mode: RuleMode; difficulty: string; host: string; phase: string }
export interface RoomFilter { q: string; mode: RuleMode | "all"; openOnly: boolean }

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Filtra por texto (anfitrión, código, modalidad o dificultad), modalidad y plazas libres; las más llenas primero. */
export function filterRooms<T extends RoomLike>(rooms: readonly T[], f: RoomFilter): T[] {
  const q = norm(f.q);
  return rooms
    .filter(r => f.mode === "all" || r.mode === f.mode)
    .filter(r => !f.openOnly || (r.clients < r.max && (r.phase === "lobby" || r.phase === "waiting" || !r.phase)))
    .filter(r => !q || [r.host, r.code, MODES[r.mode]?.name ?? r.mode, r.difficulty].some(v => norm(String(v)).includes(q)))
    .sort((a, b) => (b.clients < b.max ? 1 : 0) - (a.clients < a.max ? 1 : 0) || b.clients - a.clients || a.code.localeCompare(b.code));
}
