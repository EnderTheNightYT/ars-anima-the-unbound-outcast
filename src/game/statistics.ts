/** Personal counters, merged by run identity without duplicating resumed runs. */
export const STATS_KEY = "ars_anima_statistics_v1";
export interface BossRecord { floor: number; difficulty: string; seconds: number; damage: number; score: number }
export interface RunStats { kills: number; combos: number; finds: Record<string, string>; bosses?: Record<string, BossRecord> }
export interface Statistics { v: 1; baseline: { runs: number; kills: number }; runs: Record<string, RunStats> }
type Store = Pick<Storage, "getItem" | "setItem">;
const count = (n: unknown) => typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
export function parseStats(raw: unknown): Statistics {
  const empty: Statistics = { v: 1, baseline: { runs: 0, kills: 0 }, runs: {} };
  try {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!data || data.v !== 1) return empty;
    empty.baseline = { runs: count(data.baseline?.runs), kills: count(data.baseline?.kills) };
    for (const [id, value] of Object.entries(data.runs ?? {})) {
      const r = value as Partial<RunStats>;
      if (!r || typeof r !== "object") continue;
      empty.runs[id] = { kills: count(r.kills), combos: count(r.combos), finds: Object.fromEntries(Object.entries(r.finds ?? {}).filter(([, name]) => typeof name === "string")) as Record<string, string> };
      if (r.bosses && typeof r.bosses === 'object') empty.runs[id].bosses = Object.fromEntries(Object.entries(r.bosses).filter(([, b]) => b && Number.isFinite(b.seconds) && b.seconds >= 0 && Number.isFinite(b.damage) && typeof b.difficulty === 'string'));
    }
  } catch { /* damaged save */ }
  return empty;
}
export function readStats(store: Store = localStorage): Statistics {
  const raw = store.getItem(STATS_KEY);
  if (raw) return parseStats(raw);
  const stats = parseStats(null);
  try { const legacy = JSON.parse(store.getItem("ars_anima_legacy") || "{}"); stats.baseline = { runs: count(legacy.runs), kills: count(legacy.kills) }; } catch { /* new player */ }
  store.setItem(STATS_KEY, JSON.stringify(stats));
  return stats;
}
export function mergeStats(a: Statistics, b: Statistics): Statistics {
  const out = parseStats(a);
  out.baseline = { runs: Math.max(a.baseline.runs, b.baseline.runs), kills: Math.max(a.baseline.kills, b.baseline.kills) };
  for (const [id, r] of Object.entries(b.runs)) {
    const prev = out.runs[id];
    out.runs[id] = { kills: Math.max(prev?.kills ?? 0, r.kills), combos: Math.max(prev?.combos ?? 0, r.combos), finds: { ...prev?.finds, ...r.finds } };
    if (prev?.bosses || r.bosses) out.runs[id].bosses = { ...prev?.bosses, ...r.bosses };
  }
  return out;
}
export function recordStat(runId: string, event: "start" | "kill" | "combo" | "find", weapon?: { uid: number; name: string }, store: Store = localStorage) {
  if (!runId) return;
  const stats = readStats(store);
  const r = stats.runs[runId] ?? { kills: 0, combos: 0, finds: {} };
  if (event === "kill") r.kills++;
  if (event === "combo") r.combos++;
  if (event === "find" && weapon) r.finds[String(weapon.uid)] = weapon.name;
  stats.runs[runId] = r;
  store.setItem(STATS_KEY, JSON.stringify(stats));
}
export function statisticsTotals(stats: Statistics) {
  const rows = Object.values(stats.runs);
  return { played: stats.baseline.runs + rows.length, kills: stats.baseline.kills + rows.reduce((n, r) => n + r.kills, 0), combos: rows.reduce((n, r) => n + r.combos, 0), weapons: rows.reduce((n, r) => n + Object.keys(r.finds).length, 0) };
}
export function recordBoss(runId: string, record: BossRecord, store: Store = localStorage) {
  if (!runId) return;
  const stats = readStats(store), r = stats.runs[runId] ?? { kills: 0, combos: 0, finds: {} };
  r.bosses = { ...r.bosses, [String(record.floor)]: record }; stats.runs[runId] = r;
  store.setItem(STATS_KEY, JSON.stringify(stats));
}
export function bossRecords(stats: Statistics) {
  return Object.values(stats.runs).flatMap(r => Object.values(r.bosses ?? {})).sort((a,b) => a.seconds - b.seconds);
}