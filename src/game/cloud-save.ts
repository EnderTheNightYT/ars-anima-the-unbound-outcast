/** Reglas puras de sincronización del progreso local con la cuenta. Browser-safe, sin red. */
export const SAVE_PREFIX = "ars_anima_";
export const CLOUD_STAMP_KEY = "ars_anima_cloud_stamp";
/** Claves que no viajan: marcas de sincronización y cachés regenerables. */
const SKIP = new Set([CLOUD_STAMP_KEY, "ars_anima_barks_v1"]);

export interface KeyStore { readonly length: number; key(i: number): string | null; getItem(k: string): string | null; setItem(k: string, v: string): void }

export function collectSave(s: KeyStore): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < s.length; i++) { const k = s.key(i); if (k && k.startsWith(SAVE_PREFIX) && !SKIP.has(k)) { const v = s.getItem(k); if (v != null) out[k] = v; } }
  return out;
}
export function applySave(s: KeyStore, data: unknown) {
  if (!data || typeof data !== "object") return 0;
  let n = 0;
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) if (k.startsWith(SAVE_PREFIX) && !SKIP.has(k) && typeof v === "string") { s.setItem(k, v); n++; }
  return n;
}
/** La nube gana sólo si es más reciente que lo último sincronizado en este dispositivo. */
export function shouldPull(localStamp: number, remoteStamp: number | null | undefined) { return remoteStamp != null && remoteStamp > localStamp; }

export interface GlobalRun { user_id: string; player_name: string; title: string; class_name: string; subclass: string; difficulty: string; outcome: string; score: number; floor: number; kills: number; melee: string; ranged: string; armor: string }
/** Mejor marca por jugador, más runs y victorias. */
export function playerStandings(rows: GlobalRun[]) {
  const m = new Map<string, { user_id: string; name: string; title: string; best: number; runs: number; wins: number; floor: number }>();
  for (const r of rows) {
    const p = m.get(r.user_id) ?? { user_id: r.user_id, name: r.player_name, title: r.title, best: -Infinity, runs: 0, wins: 0, floor: 0 };
    if (r.outcome !== "floor") p.runs++; if (r.outcome === "won") p.wins++; p.floor = Math.max(p.floor, r.outcome === "won" ? 7 : r.floor);
    if (r.score > p.best) { p.best = r.score; p.name = r.player_name; p.title = r.title; }
    m.set(r.user_id, p);
  }
  return [...m.values()].sort((a, b) => b.best - a.best || b.floor - a.floor);
}
export interface MpProfileRow { user_id: string; name: string; matches: number; wins: number; podiums: number; victories: number; best_score: number; total_score: number; kills: number; pvp_kills: number; revives: number; healing: number; betrayals: number }
/** Ranking multijugador: mejor puntuación, luego más primeros puestos y, a igualdad, quien lo logró en menos partidas. */
export function mpStandings<T extends MpProfileRow>(rows: T[]) {
  return rows.filter(r => r.matches > 0).slice().sort((a, b) => b.best_score - a.best_score || b.wins - a.wins || a.matches - b.matches);
}
/** Tu mejor marca frente al mundo: puesto, percentil y distancia al líder y a la mediana. */
export function compareWithWorld(rows: GlobalRun[], me: string) {
  const st = playerStandings(rows); const i = st.findIndex(p => p.user_id === me); if (i < 0) return null;
  const mine = rows.filter(r => r.user_id === me);
  const stat = (f: (r: GlobalRun) => number) => { const all = st.map(p => Math.max(...rows.filter(r => r.user_id === p.user_id).map(f))).sort((a, b) => b - a); const v = Math.max(...mine.map(f));
    return { mine: v, top: all[0] ?? v, median: all[Math.floor(all.length / 2)] ?? v, rank: all.filter(x => x > v).length + 1 }; };
  return { rank: i + 1, players: st.length, percentile: Math.round((1 - i / st.length) * 100), leader: st[0]!,
    score: stat(r => r.score), kills: stat(r => r.kills), floor: stat(r => r.outcome === "won" ? 7 : r.floor) };
}
/** Por piso: partidas que llegaron, muertes, media de tiempo y bajas (global o de un jugador). */
export function floorStats(rows: (GlobalRun & { seconds: number })[], user?: string) {
  const out = new Map<number, { floor: number; runs: number; deaths: number; cleared: number; secs: number; kills: number; score: number; players: Set<string> }>();
  for (const r of rows) { if (user && r.user_id !== user) continue; const f = r.outcome === "won" ? 6 : r.floor;
    const s = out.get(f) ?? { floor: f, runs: 0, deaths: 0, cleared: 0, secs: 0, kills: 0, score: 0, players: new Set<string>() };
    s.runs++; if (r.outcome === "death") s.deaths++; else s.cleared++; s.secs += r.seconds; s.kills += r.kills; s.score += r.score; s.players.add(r.user_id); out.set(f, s); }
  return [...out.values()].sort((a, b) => a.floor - b.floor).map(({ players, ...s }) => ({ ...s, players: players.size, avgScore: Math.round(s.score / s.runs), avgSecs: Math.round(s.secs / s.runs), avgKills: +(s.kills / s.runs).toFixed(1), deathRate: Math.round(s.deaths / s.runs * 100) }));
}
/** Conteo y promedio por forma de juego (clase · subclase · dificultad). */
export function styleStats(rows: GlobalRun[]) {
  const m = new Map<string, { style: string; runs: number; total: number; best: number; wins: number }>();
  for (const r of rows) {
    const style = [r.class_name, r.subclass, r.difficulty].filter(Boolean).join(" · ");
    const s = m.get(style) ?? { style, runs: 0, total: 0, best: -Infinity, wins: 0 };
    s.runs++; s.total += r.score; s.best = Math.max(s.best, r.score); if (r.outcome === "won") s.wins++; m.set(style, s);
  }
  return [...m.values()].map((s) => ({ ...s, avg: Math.round(s.total / s.runs) })).sort((a, b) => b.runs - a.runs || b.avg - a.avg);
}
/** Equipamiento más usado por ranura. */
export function gearStats(rows: GlobalRun[], slot: "melee" | "ranged" | "armor") {
  const m = new Map<string, { name: string; runs: number; best: number }>();
  for (const r of rows) { const n = r[slot]; if (!n) continue; const g = m.get(n) ?? { name: n, runs: 0, best: -Infinity }; g.runs++; g.best = Math.max(g.best, r.score); m.set(n, g); }
  return [...m.values()].sort((a, b) => b.runs - a.runs || b.best - a.best).slice(0, 10);
}

export interface LiveSnap { floor: number; region: string; level: number; score: number; kills: number; seconds: number; hp: number; hpMax: number; melee: string; ranged: string; armor: string }
export interface LiveEntry { at: number; text: string; floor: number; level: number; gear: string }
/** Historial escrito de la run: añade una línea sólo si cambió el nivel, el piso o el equipo. */
export function appendLiveLog(log: LiveEntry[], s: LiveSnap, at = Date.now()): LiveEntry[] {
  const gear = [s.melee, s.ranged, s.armor].filter(Boolean).join(" / ");
  const last = log[log.length - 1];
  if (last && last.floor === s.floor && last.level === s.level && last.gear === gear) return log;
  const why = !last ? "Comienza la run" : last.floor !== s.floor ? `Desciende al nivel ${s.floor}` : last.level !== s.level ? `Sube a nivel de personaje ${s.level}` : "Cambia de equipo";
  const text = `${why} · ${s.region} · ${s.score} pts · ${s.kills} bajas · vida ${Math.round(s.hp)}/${Math.round(s.hpMax)} · equipo: ${gear || "ninguno"}`;
  return [...log, { at, text, floor: s.floor, level: s.level, gear }].slice(-200);
}

export interface RunFilter { cls: string; sub: string; diff: string; gear: string; sort: "score" | "kills" | "floor" | "level" | "seconds" | "recent" }
export const NO_FILTER: RunFilter = { cls: "", sub: "", diff: "", gear: "", sort: "score" };
/** Filtra por clase, subclase, dificultad y texto de equipamiento; ordena por la métrica elegida. */
export function filterRuns<T extends GlobalRun & { level: number; seconds: number; created_at: string }>(rows: T[], f: RunFilter): T[] {
  const g = f.gear.trim().toLowerCase();
  const out = rows.filter((r) => (!f.cls || r.class_name === f.cls) && (!f.sub || r.subclass === f.sub) && (!f.diff || r.difficulty === f.diff)
    && (!g || [r.melee, r.ranged, r.armor].some((x) => x.toLowerCase().includes(g))));
  const key = (r: T) => f.sort === "recent" ? Date.parse(r.created_at) : f.sort === "floor" ? (r.outcome === "won" ? 7 : r.floor) : f.sort === "seconds" ? -r.seconds : r[f.sort];
  return out.sort((a, b) => key(b) - key(a) || b.score - a.score);
}

export interface RankRow { user_id: string; player_name: string; title: string; outcome: string; floor: number; kills: number; score: number; seconds: number }
/** Por piso: mejor tiempo (solo pisos superados), más bajas y más puntos. Top N por categoría. */
export function floorRankings<T extends RankRow>(rows: T[], n = 5) {
  const floors = new Map<number, T[]>();
  for (const r of rows) { const f = r.floor; if (f < 1) continue; (floors.get(f) ?? floors.set(f, []).get(f)!).push(r); }
  return [...floors.entries()].sort((a, b) => a[0] - b[0]).map(([floor, list]) => ({
    floor,
    time: list.filter((r) => (r.outcome === "floor" || r.outcome === "won") && r.seconds > 0).sort((a, b) => a.seconds - b.seconds).slice(0, n),
    kills: [...list].sort((a, b) => b.kills - a.kills).slice(0, n),
    score: [...list].sort((a, b) => b.score - a.score).slice(0, n),
  }));
}
/** Resumen personal: partidas (runs terminadas), muertes, pisos completados, victorias. */
export function profileSummary(rows: { user_id: string; outcome: string; floor: number }[], user: string) {
  const mine = rows.filter((r) => r.user_id === user);
  return { runs: mine.filter((r) => r.outcome !== "floor").length, deaths: mine.filter((r) => r.outcome === "death").length,
    floors: mine.filter((r) => r.outcome === "floor").length, wins: mine.filter((r) => r.outcome === "won").length,
    best: mine.reduce((m, r) => Math.max(m, r.floor), 0) };
}
