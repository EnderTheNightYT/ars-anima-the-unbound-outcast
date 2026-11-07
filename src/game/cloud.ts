/** Cuenta Google + guardado en la nube + tabla mundial. */
import type { Item } from "./data";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { collectSave, applySave, shouldPull, CLOUD_STAMP_KEY, type GlobalRun } from "./cloud-save";
import { readArchive } from "./chronicles";
import { readPlayer, savePlayerName, RUN_SAVE_KEY, type RunRecord } from "./run-save";
import type { Game } from "./engine";
import { STATS_KEY, readStats, mergeStats, parseStats } from "./statistics";

let currentUser: User | null = null;
const listeners = new Set<(u: User | null) => void>();
let started = false;

const stamp = () => Number(localStorage.getItem(CLOUD_STAMP_KEY) || 0);

/** Estado visible del guardado en la nube (indicador con último sync y reintento). */
export type SyncState = { status: "idle" | "syncing" | "ok" | "error"; last: number };
let syncState: SyncState = { status: "idle", last: 0 };
const syncListeners = new Set<(s: SyncState) => void>();
function setSync(s: Partial<SyncState>) { syncState = { ...syncState, ...s }; syncListeners.forEach((l) => l(syncState)); }
export function useSyncState() {
  const [s, set] = useState<SyncState>(() => ({ ...syncState, last: syncState.last || stampSafe() }));
  useEffect(() => { syncListeners.add(set); return () => { syncListeners.delete(set); }; }, []);
  return s;
}
function stampSafe() { try { return stamp(); } catch { return 0; } }
let pushing: Promise<boolean> | null = null;
export function pushSave(): Promise<boolean> {
  if (!currentUser) return Promise.resolve(false);
  if (pushing) return pushing;
  setSync({ status: "syncing" });
  pushing = pushSaveInner().catch(() => false).then((ok) => { pushing = null; setSync(ok ? { status: "ok", last: Date.now() } : { status: "error" }); return ok; });
  return pushing;
}
async function pushSaveInner() {
  const u = currentUser; if (!u) return false;
  const { data: remote, error: readError } = await supabase.from("cloud_saves").select("data").eq("user_id", u.id).maybeSingle();
  if (readError) return false;
  const remoteStats = remote?.data && typeof remote.data === "object" && !Array.isArray(remote.data) ? remote.data[STATS_KEY] : null;
  localStorage.setItem(STATS_KEY, JSON.stringify(mergeStats(readStats(), parseStats(remoteStats))));
  const now = Date.now();
  const { error } = await supabase.from("cloud_saves").upsert({ user_id: u.id, data: collectSave(localStorage), saved_at: now, updated_at: new Date().toISOString() });
  if (!error) localStorage.setItem(CLOUD_STAMP_KEY, String(now));
  return !error;
}

/** Al iniciar sesión: trae el progreso de la nube si es más nuevo; si no, sube el local. */
async function pullSave(u: User) {
  const localStats = readStats();
  const { data } = await supabase.from("cloud_saves").select("data, saved_at").eq("user_id", u.id).maybeSingle();
  try { beforeSync(); } catch { /* opcional */ }
  const localRun = localStorage.getItem(RUN_SAVE_KEY);
  if (data && shouldPull(stamp(), Number(data.saved_at))) {
    applySave(localStorage, data.data);
    // Cambio de cuenta: si la cuenta nueva no tiene run en curso, la partida actual (vida, inventario, piso, ubicación) pasa con ella.
    const remote = data.data as Record<string, unknown> | null;
    if (localRun && !(remote && typeof remote[RUN_SAVE_KEY] === "string")) localStorage.setItem(RUN_SAVE_KEY, localRun);
    localStorage.setItem(STATS_KEY, JSON.stringify(mergeStats(localStats, readStats())));
    localStorage.setItem(CLOUD_STAMP_KEY, String(data.saved_at));
    await pushSave();
    window.location.reload();
    return;
  }
  if (!readPlayer().name) {
    const { data: p } = await supabase.from("profiles").select("display_name").eq("id", u.id).maybeSingle();
    if (p?.display_name) savePlayerName(p.display_name);
  }
  await pushSave();
}

function start() {
  if (started) return; started = true;
  supabase.auth.getUser().then(({ data }) => { currentUser = data.user; listeners.forEach((l) => l(currentUser)); if (data.user) void pullSave(data.user); });
  supabase.auth.onAuthStateChange((event, session) => {
    if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
    const prev = currentUser?.id; currentUser = session?.user ?? null; listeners.forEach((l) => l(currentUser));
    if (event === "SIGNED_IN" && currentUser && prev !== currentUser.id) void pullSave(currentUser);
  });
  window.setInterval(() => void pushSave(), 45000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") void pushSave(); });
}

export function useAccount() {
  const [user, setUser] = useState<User | null>(currentUser);
  useEffect(() => { start(); listeners.add(setUser); setUser(currentUser); return () => { listeners.delete(setUser); }; }, []);
  return user;
}

export async function signInGoogle() {
  const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
  return r.error ? String(r.error.message ?? r.error) : "";
}
let beforeSync: () => void = () => {};
/** El juego registra aquí su guardado para volcar la run actual antes de sincronizar o cambiar de cuenta. */
export function setBeforeSync(fn: () => void) { beforeSync = fn; }
export async function signOut() { try { beforeSync(); } catch { /* opcional */ } await pushSave(); await supabase.auth.signOut(); }

/** Publica la run terminada en la tabla mundial (sólo con sesión). */
export async function publishRun(r: RunRecord, g: Game) {
  const u = currentUser; if (!u) return false;
  const exps = readArchive().expeditions; const title = exps.find((e) => e.id === r.id)?.identity.title ?? [...exps].sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))[0]?.identity.title ?? "";
  const name = (r.name || readPlayer().name || "Anónimo").slice(0, 24);
  const { error } = await supabase.from("runs").insert({
    user_id: u.id, run_key: r.id, player_name: name, title, class_name: r.clsName, subclass: String((g as unknown as { subclassId?: string }).subclassId ?? ""),
    difficulty: r.diff, outcome: r.outcome, cause: r.cause.slice(0, 120), score: Math.round(r.score), floor: r.floor, level: r.level, kills: r.kills, seconds: r.seconds,
    melee: g.melee?.name ?? "", ranged: g.ranged?.name ?? "", armor: g.armor?.name ?? "",
  });
  await supabase.from("profiles").update({ display_name: name, title, updated_at: new Date().toISOString() }).eq("id", u.id);
  void pushSave();
  return !error;
}

/** Publica un piso completado en la tabla mundial (compite por piso además de por run). */
export async function publishFloor(g: Game) {
  const u = currentUser; if (!u || !g.recap) return false;
  const title = g.chronicles.run?.identity.title ?? ""; const name = (g.chronicles.run?.identity.name || g.runName || readPlayer().name || "Anónimo").slice(0, 24);
  const { error } = await supabase.from("runs").insert({ user_id: u.id, run_key: `${g.runId}:f${g.floor}`, player_name: name, title, class_name: g.cls.name,
    subclass: String((g as unknown as { subclassId?: string }).subclassId ?? ""), difficulty: g.difficulty.id, outcome: "floor", cause: `Superó ${g.region.name} (${g.recap.grade})`.slice(0, 120),
    score: Math.round(g.score.total), floor: g.floor, level: g.level, kills: g.kills, seconds: Math.round(g.time),
    melee: g.melee?.name ?? "", ranged: g.ranged?.name ?? "", armor: g.armor?.name ?? "" });
  return !error;
}
/** Puesto mundial de una puntuación entre todas las marcas publicadas. */
/** Medias mundiales por piso (todas las marcas publicadas). */
export async function loadFloorAverages() {
  const { data, error } = await supabase.rpc("floor_averages");
  if (error) throw error;
  return (data ?? []).map((r) => ({ floor: r.floor, runs: Number(r.runs), players: Number(r.players), deaths: Number(r.deaths), avgSeconds: Number(r.avg_seconds), avgKills: Number(r.avg_kills), avgScore: Number(r.avg_score) }));
}
export async function worldRank(score: number) {
  const [{ count: above }, { count: total }] = await Promise.all([
    supabase.from("runs").select("id", { count: "exact", head: true }).gt("score", score),
    supabase.from("runs").select("id", { count: "exact", head: true })]);
  return { rank: (above ?? 0) + 1, total: Math.max(total ?? 0, (above ?? 0) + 1) };
}
export async function loadGlobalRuns() {
  const { data, error } = await supabase.from("runs")
    .select("id, user_id, player_name, title, class_name, subclass, difficulty, outcome, cause, score, floor, level, kills, seconds, melee, ranged, armor, created_at")
    .order("score", { ascending: false }).limit(500);
  if (error) throw error;
  return (data ?? []) as (GlobalRun & { id: string; cause: string; level: number; seconds: number; created_at: string })[];
}

import { appendLiveLog, type LiveEntry } from "./cloud-save";
let liveKey = ""; let liveLog: LiveEntry[] = []; let liveBusy = false;
/** Publica la run en curso (progreso, equipo actual e historial escrito). */
export async function publishLive(g: Game) {
  const u = currentUser; if (!u || liveBusy || !g.runId) return; liveBusy = true;
  try {
    if (liveKey !== g.runId) {
      const { data } = await supabase.from("live_runs").select("run_key, log").eq("user_id", u.id).maybeSingle();
      liveLog = data?.run_key === g.runId && Array.isArray(data.log) ? (data.log as unknown as LiveEntry[]) : []; liveKey = g.runId;
    }
    const snap = { floor: g.floor, region: g.region?.name ?? "", level: g.level, score: Math.round(g.score.total), kills: g.kills, seconds: Math.round(g.time), hp: g.hp, hpMax: g.hpMax,
      melee: g.melee?.name ?? "", ranged: g.ranged?.name ?? "", armor: g.armor?.name ?? "" };
    liveLog = appendLiveLog(liveLog, snap);
    await supabase.from("live_runs").upsert({ user_id: u.id, run_key: g.runId, player_name: (g.runName || readPlayer().name || "Anónimo").slice(0, 24), class_name: g.cls.name, difficulty: g.difficulty.id,
      region: snap.region, floor: snap.floor, level: snap.level, score: snap.score, kills: snap.kills, seconds: snap.seconds, melee: snap.melee, ranged: snap.ranged, armor: snap.armor,
      log: liveLog as unknown as never, updated_at: new Date().toISOString() });
  } finally { liveBusy = false; }
}
export async function clearLive() { const u = currentUser; liveKey = ""; liveLog = []; if (u) await supabase.from("live_runs").delete().eq("user_id", u.id); }
export async function loadLiveRuns() {
  const { data, error } = await supabase.from("live_runs").select("*").order("updated_at", { ascending: false }).limit(50);
  if (error) throw error; return data ?? [];
}

/** Perfiles multijugador (solo partidas guardadas por el servidor de salas). */
export async function loadMpProfiles() {
  const { data, error } = await supabase.from("mp_profiles")
    .select("user_id, name, matches, wins, podiums, victories, best_score, total_score, kills, pvp_kills, revives, healing, betrayals")
    .order("best_score", { ascending: false }).limit(200);
  if (error) throw error; return data ?? [];
}
/** Últimas partidas multijugador de una cuenta. */
export async function loadMpHistory(userId: string) {
  const { data, error } = await supabase.from("mp_results")
    .select("id, place, score, outcome, title, created_at, mp_matches(mode, difficulty, floors, players, outcome)")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
  if (error) throw error; return data ?? [];
}

export async function loadProfiles(ids: string[]) {
  if (!ids.length) return {} as Record<string, { discord: string }>;
  // Los Discord ocultos nunca salen de la base de datos (función pública filtrada en el servidor).
  const { data } = await supabase.rpc("public_discords", { _ids: ids.slice(0, 300) });
  return Object.fromEntries((data ?? []).map((p) => [p.id, { discord: p.discord ?? "" }]));
}
export async function getMyDiscord() { const u = currentUser; if (!u) return { discord: "", hidden: false }; const { data } = await supabase.rpc("my_discord"); const row = data?.[0]; return { discord: row?.discord ?? "", hidden: row?.discord_hidden ?? false }; }
export async function setDiscordHidden(hidden: boolean) { const u = currentUser; if (!u) return false; const { error } = await supabase.from("profiles").update({ discord_hidden: hidden }).eq("id", u.id); return !error; }
export async function setMyDiscord(v: string) { const u = currentUser; if (!u) return false; const { error } = await supabase.from("profiles").update({ discord: v.trim().slice(0, 40) }).eq("id", u.id); return !error; }

export async function loadComments(target: string) {
  const { data, error } = await supabase.from("comments").select("id, user_id, author_name, body, created_at").eq("target", target).order("created_at", { ascending: false }).limit(100);
  if (error) throw error; return data ?? [];
}
export async function addComment(target: string, body: string) {
  const u = currentUser; if (!u) return false;
  const text = body.trim().slice(0, 500); if (!text) return false;
  const { error } = await supabase.from("comments").insert({ target: target.slice(0, 200), user_id: u.id, author_name: (readPlayer().name || (u.user_metadata?.["full_name"] as string) || "Anónimo").slice(0, 24), body: text });
  return !error;
}
export async function deleteComment(id: string) { await supabase.from("comments").delete().eq("id", id); }

const foundThisSession = new Set<string>();
/** Registra un arma encontrada en la wiki mundial (una vez por nombre y sesión). */
export async function recordFind(w: Item) {
  if (!currentUser || !w.base || foundThisSession.has(w.name)) return; foundThisSession.add(w.name);
  await supabase.rpc("record_weapon_find", { _name: w.name.slice(0, 80), _type: w.base.type, _ranged: w.base.ranged, _rarity: w.rarity, _dmg: w.dmgMult ?? 1, _crit: w.crit ?? 0, _acc: w.acc ?? 0, _affixes: w.affixes ?? [], _finder: readPlayer().name || "Anónimo" });
}
export async function loadFinds() {
  const { data, error } = await supabase.from("weapon_finds").select("*").order("rarity", { ascending: false }).order("times_found", { ascending: false }).limit(1000);
  if (error) throw error; return data ?? [];
}

export async function reportComment(commentId: string, reason: string) {
  const u = currentUser; if (!u) return false;
  const { error } = await supabase.from("comment_reports").insert({ comment_id: commentId, reporter_id: u.id, reason: reason.trim().slice(0, 300) });
  return !error || error.code === "23505";
}
export async function isAdmin() { const u = currentUser; if (!u) return false; const { data } = await supabase.rpc("has_role", { _user_id: u.id, _role: "admin" }); return !!data; }
export async function loadReports() {
  const { data, error } = await supabase.from("comment_reports").select("id, reason, status, created_at, comment_id, comments(id, body, author_name, target, user_id)").eq("status", "pending").order("created_at", { ascending: false }).limit(200);
  if (error) throw error; return data ?? [];
}
export async function resolveReport(reportId: string, commentId: string, remove: boolean) {
  if (remove) { await supabase.from("comment_reports").update({ status: "removed" }).eq("comment_id", commentId); await supabase.from("comments").delete().eq("id", commentId); }
  else await supabase.from("comment_reports").update({ status: "dismissed" }).eq("id", reportId);
}

/** Marcas de un jugador (perfil). */
export async function loadMyRuns(userId: string) {
  const { data, error } = await supabase.from("runs").select("id, user_id, player_name, title, class_name, outcome, floor, kills, score, seconds, melee, ranged, created_at")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(1000);
  if (error) throw error; return data ?? [];
}
/** Avisa en tiempo real de cada marca nueva publicada. Devuelve la función para dejar de escuchar. */
export function watchRuns(onInsert: () => void) {
  const ch = supabase.channel(`runs-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "runs" }, () => onInsert()).subscribe();
  return () => { void supabase.removeChannel(ch); };
}
