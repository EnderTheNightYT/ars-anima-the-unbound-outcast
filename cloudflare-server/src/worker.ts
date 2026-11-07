/**
 * Servidor de salas de Ars Anima sobre Cloudflare Workers + Durable Objects (SQLite) + WebSockets.
 * Cada sala es una instancia aislada de `GameRoom`, autoritativa: simula la expedición compartida con el
 * mismo motor del juego (src/game/net/sim.ts). `RoomDirectory` guarda la lista de salas públicas.
 *
 * Protocolo (JSON): cliente→servidor `[tipo, datos]`; servidor→cliente `[tipo, datos]`.
 *   GET  /health            → { ok, kind: "cf" }
 *   GET  /rooms             → salas públicas abiertas
 *   POST /create            → { code }   (crea la sala; luego se entra por WebSocket)
 *   GET  /ws/:code?name=&token=&vaultId=&reconnect=   (Upgrade: websocket)
 */
const mem = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage ??= { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, String(v)); }, removeItem: (k: string) => { mem.delete(k); }, clear: () => mem.clear(), key: () => null, length: 0 };

import { DurableObject } from "cloudflare:workers";
import { z } from "zod";
import { ExpeditionSim, ClientCache } from "../../src/game/net/sim";
import { MP, MODES, ROLES, roomCode, validCode, type RuleMode } from "../../src/game/net/rules";

export interface Env {
  GAME_ROOMS: DurableObjectNamespace<GameRoom>;
  ROOM_DIRECTORY: DurableObjectNamespace<RoomDirectory>;
  SUPABASE_URL?: string; SUPABASE_PUBLISHABLE_KEY?: string; APP_URL?: string; MP_SERVER_SECRET?: string; ALLOW_GUESTS?: string;
}

/** Ritmos ajustados al plan gratuito: simulación 20 Hz, instantáneas 10 Hz. */
/** Plan gratuito: 2–4 jugadores por sala. */
const MAX_PLAYERS = Math.min(4, MP.maxPlayers);
const TICK_HZ = 20, SNAP_MS = 100, FAST_EVERY = 1;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" };
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { "content-type": "application/json", ...CORS } });

const CreateOpts = z.object({ mode: z.enum(["coop", "traicion", "caos"]).default("coop"), difficulty: z.enum(["facil", "normal", "dificil", "pesadilla"]).default("normal"), isPrivate: z.boolean().default(false), name: z.string().max(24).optional(), floors: z.number().int().min(1).max(6).optional() }).passthrough();
const InputMsg = z.object({ mx: z.number(), my: z.number(), ang: z.number(), pitch: z.number(), vb: z.object({ fx: z.number(), fy: z.number(), rx: z.number(), ry: z.number() }).nullable().optional() }).catchall(z.union([z.boolean(), z.number(), z.null(), z.object({}).passthrough()]));
const GiveMsg = z.object({ to: z.string().max(40), gold: z.number().int().positive().max(1e7).optional(), uid: z.number().int().optional() });
const RpcMsg = z.object({ m: z.string().max(24), a: z.array(z.unknown()).max(3) });
const CfgMsg = z.object({ clsId: z.string().max(32).optional(), subclassId: z.string().max(40).optional(), role: z.string().max(16).optional(), role2: z.string().max(16).optional() });
/** Registro estructurado (visible en Cloudflare → Workers → Logs / `wrangler tail`). */
function logEvent(event: string, data: Record<string, unknown> = {}, level: "info" | "warn" | "error" = "info") {
  const line = JSON.stringify({ ev: event, at: new Date().toISOString(), ...data });
  if (level === "error") console.error(line); else if (level === "warn") console.warn(line); else console.log(line);
}
const METRICS = ["rooms_created", "joins", "refused", "reconnects", "drops", "leaves", "matches_started", "matches_finished", "rooms_closed", "tick_errors", "results_saved", "results_failed"] as const;
type Metric = (typeof METRICS)[number];
const cleanName = (s: string | null | undefined) => (s ?? "").replace(/[^\p{L}\p{N} _.\-]/gu, "").trim().slice(0, 24);
const randomToken = () => [...crypto.getRandomValues(new Uint8Array(18))].map(b => b.toString(16).padStart(2, "0")).join("");

interface Auth { id: string; name: string }
async function verifyUser(env: Env, token: string): Promise<Auth | null> {
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return null;
  try {
    const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const u = await r.json() as { id?: string; email?: string; user_metadata?: Record<string, string> };
    return u.id ? { id: u.id, name: u.user_metadata?.["full_name"] ?? u.user_metadata?.["name"] ?? u.email?.split("@")[0] ?? "" } : null;
  } catch { return null; }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === "/health" || url.pathname === "/") return json({ ok: true, kind: "cf", name: "ars-anima-rooms" });
    const dir = env.ROOM_DIRECTORY.get(env.ROOM_DIRECTORY.idFromName("global"));
    if (url.pathname === "/rooms" && req.method === "GET") return json(await dir.list());
    if (url.pathname === "/metrics" && req.method === "GET") return json(await dir.metrics());
    if (url.pathname === "/create" && req.method === "POST") {
      const raw = await req.json().catch(() => ({}));
      const o = CreateOpts.safeParse(raw); if (!o.success) return json({ error: "Opciones inválidas." }, 400);
      for (let i = 0; i < 12; i++) {
        const code = roomCode();
        if (!(await dir.reserve(code))) continue;
        const room = env.GAME_ROOMS.get(env.GAME_ROOMS.idFromName(code));
        await room.init(code, o.data);
        logEvent("room_created", { code, mode: o.data.mode, private: o.data.isPrivate });
        return json({ code });
      }
      logEvent("room_code_exhausted", {}, "error");
      return json({ error: "No se pudo generar un código de sala." }, 503);
    }
    const m = url.pathname.match(/^\/ws\/([A-Z0-9]{4,8})$/);
    if (m) {
      if (req.headers.get("Upgrade") !== "websocket") return json({ error: "Se esperaba WebSocket." }, 426);
      const code = m[1]!; if (!validCode(code)) return json({ error: "Código inválido." }, 400);
      return env.GAME_ROOMS.get(env.GAME_ROOMS.idFromName(code)).fetch(req);
    }
    return json({ error: "No encontrado." }, 404);
  },
} satisfies ExportedHandler<Env>;

/* ───────────────────────────── Directorio de salas ───────────────────────────── */
export class RoomDirectory extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, meta TEXT NOT NULL, listed INTEGER NOT NULL, updated INTEGER NOT NULL)");
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS metrics (day TEXT NOT NULL, name TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, name))");
  }
  /** Contadores diarios agregados (las salas los envían en lote, no en cada mensaje). */
  bump(counts: Partial<Record<Metric, number>>) {
    const day = new Date().toISOString().slice(0, 10);
    for (const [k, v] of Object.entries(counts)) if (v && (METRICS as readonly string[]).includes(k)) this.ctx.storage.sql.exec("INSERT INTO metrics (day, name, n) VALUES (?, ?, ?) ON CONFLICT(day, name) DO UPDATE SET n = n + excluded.n", day, k, v);
  }
  metrics() {
    const rows = this.ctx.storage.sql.exec<{ day: string; name: string; n: number }>("SELECT day, name, n FROM metrics WHERE day >= ? ORDER BY day DESC", new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10)).toArray();
    const days: Record<string, Record<string, number>> = {}; for (const r of rows) (days[r.day] ??= {})[r.name] = r.n;
    const open = this.ctx.storage.sql.exec<{ c: number }>("SELECT count(*) AS c FROM rooms WHERE updated > ?", Date.now() - 2 * 3600_000).toArray()[0]?.c ?? 0;
    return { openRooms: open, days };
  }
  reserve(code: string) {
    const now = Date.now();
    this.ctx.storage.sql.exec("DELETE FROM rooms WHERE updated < ?", now - 6 * 3600_000);
    if (this.ctx.storage.sql.exec("SELECT 1 FROM rooms WHERE code = ?", code).toArray().length) return false;
    this.ctx.storage.sql.exec("INSERT INTO rooms (code, meta, listed, updated) VALUES (?, '{}', 0, ?)", code, now);
    return true;
  }
  update(code: string, meta: Record<string, unknown>, listed: boolean) {
    this.ctx.storage.sql.exec("INSERT INTO rooms (code, meta, listed, updated) VALUES (?, ?, ?, ?) ON CONFLICT(code) DO UPDATE SET meta = excluded.meta, listed = excluded.listed, updated = excluded.updated", code, JSON.stringify(meta), listed ? 1 : 0, Date.now());
  }
  remove(code: string) { this.ctx.storage.sql.exec("DELETE FROM rooms WHERE code = ?", code); }
  list() {
    const rows = this.ctx.storage.sql.exec<{ code: string; meta: string }>("SELECT code, meta FROM rooms WHERE listed = 1 AND updated > ? ORDER BY updated DESC LIMIT 50", Date.now() - 2 * 3600_000).toArray();
    return rows.map(r => ({ code: r.code, ...JSON.parse(r.meta) as Record<string, unknown> }));
  }
}

/* ───────────────────────────── Sala autoritativa ───────────────────────────── */
interface Seat { sid: string; token: string; userId: string; name: string; clsId: string; subclassId: string; role: string; role2: string; color: string; vaultId: string; droppedAt: number }
interface Saved { code: string; mode: RuleMode; difficulty: string; floors: number; isPrivate: boolean; hostName: string; host: string; phase: string; ready: string[]; seats: Seat[]; matchId: string }

export class GameRoom extends DurableObject<Env> {
  private s: Saved | null = null;
  private sim: ExpeditionSim | null = null;
  private caches = new Map<string, ClientCache>();
  private rate = new Map<string, number>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTick = 0; private snapAcc = 0; private tickN = 0; private recorded = false; private startedAt = 0;
  private pending: Partial<Record<Metric, number>> = {}; private flushT: ReturnType<typeof setTimeout> | null = null;
  private count(m: Metric, data: Record<string, unknown> = {}, level: "info" | "warn" | "error" = "info") {
    this.pending[m] = (this.pending[m] ?? 0) + 1; logEvent(m, { room: this.s?.code, ...data }, level);
    if (!this.flushT) this.flushT = setTimeout(() => { const c = this.pending; this.pending = {}; this.flushT = null; void this.dir().bump(c).catch(() => {}); }, 2000);
  }

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS room (k TEXT PRIMARY KEY, v TEXT NOT NULL)");
    ctx.blockConcurrencyWhile(async () => {
      const row = ctx.storage.sql.exec<{ v: string }>("SELECT v FROM room WHERE k = 'state'").toArray()[0];
      if (!row) return;
      this.s = JSON.parse(row.v) as Saved;
      // Tras hibernar en el lobby: reconstruir el simulador desde lo guardado. Una partida en curso no
      // sobrevive a un desalojo de memoria; se cierra limpiamente.
      if (this.s.phase !== "lobby") { this.s.phase = "closed"; for (const ws of ctx.getWebSockets()) ws.close(4005, "La expedición se interrumpió."); return; }
      this.sim = this.newSim();
      for (const seat of this.s.seats) this.seatToSim(seat);
    });
  }

  private newSim() { const s = this.s!; return new ExpeditionSim({ mode: s.mode, difficulty: s.difficulty, maxFloors: s.floors }); }
  private seatToSim(seat: Seat) {
    const p = this.sim!.addPlayer(seat.sid, seat.userId, seat.name);
    if (seat.clsId) this.sim!.configure(seat.sid, { clsId: seat.clsId, subclassId: seat.subclassId, role: seat.role as never, role2: seat.role2 as never });
    if (seat.color) p.color = seat.color; else seat.color = p.color;
    p.connected = seat.droppedAt === 0;
    this.caches.set(seat.sid, new ClientCache());
  }
  private persist() { if (this.s) this.ctx.storage.sql.exec("INSERT OR REPLACE INTO room (k, v) VALUES ('state', ?)", JSON.stringify(this.s)); }
  private dir() { return this.env.ROOM_DIRECTORY.get(this.env.ROOM_DIRECTORY.idFromName("global")); }
  private meta() {
    const s = this.s!; const listed = !s.isPrivate && s.phase === "lobby" && s.seats.length < MAX_PLAYERS;
    void this.dir().update(s.code, { clients: s.seats.length, max: MAX_PLAYERS, mode: s.mode, difficulty: s.difficulty, host: s.hostName, phase: s.phase }, listed).catch(() => {});
  }

  async init(code: string, o: z.infer<typeof CreateOpts>) {
    if (this.s) return;
    this.s = { code, mode: o.mode, difficulty: o.difficulty, floors: o.floors ?? MP.floors, isPrivate: o.isPrivate, hostName: cleanName(o.name) || "Anfitrión", host: "", phase: "lobby", ready: [], seats: [], matchId: crypto.randomUUID() };
    this.sim = this.newSim(); this.persist(); this.meta();
    await this.ctx.storage.setAlarm(Date.now() + 10 * 60_000); // sala vacía: se cierra sola
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const pair = new WebSocketPair(); const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server);
    const refuse = (msg: string, code = 4003) => { this.count("refused", { reason: msg }, "warn"); server.send(JSON.stringify(["__error", msg])); server.close(code, msg.slice(0, 100)); return new Response(null, { status: 101, webSocket: client }); };
    const s = this.s; if (!s || !this.sim || s.phase === "closed") return refuse("La sala no existe o ya se cerró.");

    const reconnect = url.searchParams.get("reconnect") ?? "";
    if (reconnect) {
      const seat = s.seats.find(x => x.token === reconnect);
      if (!seat) return refuse("Ya no tienes sitio en esta sala.");
      for (const ws of this.ctx.getWebSockets(seat.sid)) if (ws !== server) ws.close(4006, "Sesión reemplazada.");
      server.serializeAttachment({ sid: seat.sid });
      seat.droppedAt = 0; this.persist();
      const p = this.sim.players.get(seat.sid); if (p) { p.connected = true; this.sim.post("info", `${p.name} ha vuelto.`); }
      this.caches.get(seat.sid)?.full();
      this.count("reconnects", { sid: seat.sid, phase: s.phase });
      this.sendTo(server, "__joined", { sid: seat.sid, token: seat.token, code: s.code });
      this.sendTo(server, "hello", { id: seat.sid, code: s.code, color: seat.color, guest: !seat.userId, persist: this.canPersist() });
      if (s.phase === "play") this.sendTo(server, "started", { mode: s.mode });
      this.lobby();
      return new Response(null, { status: 101, webSocket: client });
    }

    if (s.phase !== "lobby") return refuse("La expedición ya ha empezado.");
    if (s.seats.length >= MAX_PLAYERS) return refuse("La sala está llena.");
    const auth = await verifyUser(this.env, url.searchParams.get("token") ?? "");
    if (!auth && this.env.ALLOW_GUESTS === "0") return refuse("Inicia sesión con tu cuenta para jugar en línea.");
    if (auth && s.seats.some(x => x.userId === auth.id)) return refuse("Tu cuenta ya está en esta sala.");
    const name = cleanName(url.searchParams.get("name")) || cleanName(auth?.name) || `Errante ${s.seats.length + 1}`;
    const vault = url.searchParams.get("vaultId") ?? "";
    const seat: Seat = { sid: randomToken().slice(0, 12), token: randomToken(), userId: auth?.id ?? "", name, clsId: "", subclassId: "", role: "", role2: "", color: "", vaultId: auth && /^[0-9a-f-]{36}$/i.test(vault) ? vault : "", droppedAt: 0 };
    s.seats.push(seat); this.seatToSim(seat);
    if (!s.host) s.host = seat.sid;
    server.serializeAttachment({ sid: seat.sid });
    this.persist(); this.meta();
    await this.ctx.storage.deleteAlarm();
    this.count("joins", { sid: seat.sid, guest: !seat.userId, players: s.seats.length });
    this.sendTo(server, "__joined", { sid: seat.sid, token: seat.token, code: s.code });
    this.sendTo(server, "hello", { id: seat.sid, code: s.code, color: seat.color, guest: !seat.userId, persist: this.canPersist() });
    this.lobby();
    return new Response(null, { status: 101, webSocket: client });
  }

  private canPersist() { return !!(this.env.APP_URL && this.env.MP_SERVER_SECRET); }
  private sidOf(ws: WebSocket) { return (ws.deserializeAttachment() as { sid?: string } | null)?.sid ?? ""; }
  private sendTo(ws: WebSocket, type: string, data: unknown) { try { ws.send(JSON.stringify([type, data])); } catch { /* socket cerrado */ } }
  private broadcast(type: string, data: unknown) { const m = JSON.stringify([type, data]); for (const ws of this.ctx.getWebSockets()) { try { ws.send(m); } catch { /* */ } } }
  private sockets() { const out: { ws: WebSocket; sid: string }[] = []; for (const ws of this.ctx.getWebSockets()) { const sid = this.sidOf(ws); if (sid) out.push({ ws, sid }); } return out; }
  private limit(sid: string, perSec: number) {
    const w = Math.floor(Date.now() / 1000), key = `${sid}:${w}`; const n = (this.rate.get(key) ?? 0) + 1; this.rate.set(key, n);
    if (this.rate.size > 200) for (const x of this.rate.keys()) if (!x.endsWith(`:${w}`)) this.rate.delete(x);
    return n <= perSec;
  }
  private seat(sid: string) { return this.s?.seats.find(x => x.sid === sid); }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const sid = this.sidOf(ws); const s = this.s, sim = this.sim; if (!sid || !s || !sim) return;
    if (typeof raw !== "string" || raw.length > 16000) return;
    let msg: unknown; try { msg = JSON.parse(raw); } catch { return; }
    if (!Array.isArray(msg) || typeof msg[0] !== "string") return;
    const [type, m] = msg as [string, unknown];
    if (!this.limit(sid, 120)) return;
    switch (type) {
      case "in": { if (!this.limit(`${sid}:in`, 40)) return; const r = InputMsg.safeParse(m); if (r.success) sim.setInput(sid, r.data as never); return; }
      case "rpc": { if (!this.limit(`${sid}:rpc`, 20)) return; const r = RpcMsg.safeParse(m); if (r.success) sim.rpc(sid, r.data.m, r.data.a); return; }
      case "cfg": {
        if (s.phase !== "lobby") return; const r = CfgMsg.safeParse(m); if (!r.success) return;
        sim.configure(sid, r.data as never); const p = sim.players.get(sid), seat = this.seat(sid);
        if (p && seat) { seat.clsId = p.clsId; seat.subclassId = p.subclassId; seat.role = p.role; seat.role2 = p.role2; }
        s.ready = s.ready.filter(x => x !== sid); this.persist(); this.lobby(); return;
      }
      case "ready": { if (s.phase !== "lobby") return; s.ready = s.ready.filter(x => x !== sid); if (m !== false) s.ready.push(sid); this.persist(); this.lobby(); return; }
      case "rules": {
        if (sid !== s.host || s.phase !== "lobby") return; const r = CreateOpts.partial().safeParse(m); if (!r.success) return;
        if (r.data.mode) s.mode = sim.mode = r.data.mode; if (r.data.difficulty) s.difficulty = sim.difficulty = r.data.difficulty;
        if (r.data.isPrivate !== undefined) s.isPrivate = r.data.isPrivate; if (r.data.floors) s.floors = sim.maxFloors = r.data.floors;
        s.ready = []; this.persist(); this.meta(); this.lobby(); return;
      }
      case "start": await this.begin(ws, sid); return;
      case "give": { if (!this.limit(`${sid}:give`, 4)) return; const r = GiveMsg.safeParse(m); if (r.success) sim.give(sid, r.data.to, r.data); return; }
      case "quest": if (this.limit(`${sid}:q`, 2)) sim.acceptQuest(sid, m); return;
      case "vote": if (typeof m === "boolean") sim.castVote(sid, m); return;
      case "chat": {
        if (!this.limit(`${sid}:chat`, 3) || typeof m !== "string") return; const p = sim.players.get(sid); const t = m.replace(/[<>]/g, "").trim().slice(0, 140);
        if (p && t) this.broadcast("chat", { from: p.name, color: p.color, text: t }); return;
      }
      case "restart": if (sid === s.host && sim.phase === "over") this.restart(); return;
      case "ping": this.sendTo(ws, "pong", { t: m, s: sim.clock }); return;
      case "leave": this.leaveSeat(sid); ws.close(4000, "bye"); return;
    }
  }

  async webSocketClose(ws: WebSocket, code: number) {
    try { ws.close(code === 1005 || code === 1006 ? 1000 : code, "cerrado"); } catch { /* ya cerrado */ }
    const sid = this.sidOf(ws); if (!sid || code === 4000) return;
    if (this.ctx.getWebSockets().some(o => o !== ws && this.sidOf(o) === sid)) return; // ya reconectó
    const seat = this.seat(sid); const sim = this.sim; if (!seat || !sim) return;
    seat.droppedAt = Date.now(); this.persist(); this.count("drops", { sid, code, phase: this.s?.phase }, "warn");
    const p = sim.players.get(sid); if (p) { p.connected = false; sim.post("info", `${p.name} perdió la conexión: tiene ${MP.reconnectSeconds} s para volver.`); }
    this.lobby();
    if (!this.timer) await this.ctx.storage.setAlarm(Date.now() + MP.reconnectSeconds * 1000 + 500);
  }
  async webSocketError(ws: WebSocket) { await this.webSocketClose(ws, 1006); }

  /** Alarmas: expulsar a quien no volvió a tiempo y cerrar salas vacías (sin bucles que impidan hibernar). */
  async alarm() {
    this.sweepDropped();
    const s = this.s; if (!s) return;
    if (!s.seats.length && !this.ctx.getWebSockets().length) { this.close(); return; }
    if (s.seats.some(x => x.droppedAt)) await this.ctx.storage.setAlarm(Date.now() + 5000);
  }
  private sweepDropped() {
    const s = this.s; if (!s) return; const lim = Date.now() - MP.reconnectSeconds * 1000;
    for (const seat of [...s.seats]) if (seat.droppedAt && seat.droppedAt < lim) this.leaveSeat(seat.sid);
  }
  private leaveSeat(sid: string) {
    const s = this.s, sim = this.sim; if (!s || !sim) return;
    sim.removePlayer(sid); this.caches.delete(sid); this.count("leaves", { sid });
    s.seats = s.seats.filter(x => x.sid !== sid); s.ready = s.ready.filter(x => x !== sid);
    if (s.host === sid) s.host = s.seats.find(x => !x.droppedAt)?.sid ?? s.seats[0]?.sid ?? "";
    this.persist(); this.meta(); this.lobby();
    if (sim.phase === "play" && ![...sim.players.values()].some(p => p.state !== "gone")) sim.endMatch("defeat");
    if (!s.seats.length) void this.ctx.storage.setAlarm(Date.now() + 30_000);
  }
  private close() {
    const s = this.s; if (!s) return;
    this.stopLoop(); s.phase = "closed"; this.persist(); this.count("rooms_closed");
    void this.dir().remove(s.code).catch(() => {});
    for (const ws of this.ctx.getWebSockets()) ws.close(4001, "La sala se cerró.");
  }

  private async appPost(path: string, body: unknown) {
    const { APP_URL, MP_SERVER_SECRET } = this.env; if (!APP_URL || !MP_SERVER_SECRET) return null;
    for (let i = 0; i < 3; i++) {
      try {
        const r = await fetch(`${APP_URL.replace(/\/$/, "")}${path}`, { method: "POST", headers: { "content-type": "application/json", "x-mp-secret": MP_SERVER_SECRET }, body: JSON.stringify(body) });
        if (r.ok) return await r.json(); if (r.status < 500) return null;
      } catch { /* reintento */ }
      await new Promise(r => setTimeout(r, 1500 * (i + 1)));
    }
    return null;
  }

  private async begin(ws: WebSocket, sid: string) {
    const s = this.s, sim = this.sim; if (!s || !sim || sid !== s.host || s.phase !== "lobby") return;
    if (s.seats.length < MP.minPlayers) { this.sendTo(ws, "err", `Hacen falta al menos ${MP.minPlayers} jugadores.`); return; }
    const notReady = s.seats.filter(x => x.sid !== s.host && !s.ready.includes(x.sid));
    if (notReady.length) { this.sendTo(ws, "err", `Falta que confirmen: ${notReady.map(x => x.name).join(", ")}.`); return; }
    s.phase = "starting"; this.persist(); this.meta();
    for (const seat of s.seats) {
      const p = sim.players.get(seat.sid); if (!p?.userId || !seat.vaultId) continue;
      const r = await this.appPost("/api/public/mp/vault-claim", { userId: p.userId, vaultId: seat.vaultId, match: s.matchId }) as { item?: Record<string, unknown> } | null;
      if (r?.item) p.vaultItem = r.item;
    }
    this.startedAt = Date.now(); this.recorded = false; sim.start(); s.phase = "play"; this.persist(); this.meta();
    await this.ctx.storage.deleteAlarm();
    this.count("matches_started", { players: s.seats.length, mode: s.mode });
    this.broadcast("started", { mode: s.mode });
    this.startLoop();
  }
  private restart() {
    const s = this.s!, old = this.sim!; this.stopLoop();
    s.seats = s.seats.filter(seat => old.players.get(seat.sid)?.state !== "gone" || this.ctx.getWebSockets(seat.sid).length);
    this.sim = this.newSim(); this.caches.clear();
    for (const seat of s.seats) this.seatToSim(seat);
    s.ready = []; s.phase = "lobby"; s.matchId = crypto.randomUUID(); this.recorded = false; this.persist(); this.meta();
    this.broadcast("restarted", {}); this.lobby();
  }
  private record() {
    this.recorded = true; const s = this.s!, sim = this.sim!; const rows = sim.final ?? [];
    s.phase = "completed"; this.persist(); this.meta(); this.count("matches_finished", { outcome: sim.outcome, seconds: Math.round((Date.now() - this.startedAt) / 1000) });
    void this.appPost("/api/public/mp/result", { id: s.matchId, code: s.code, mode: s.mode, difficulty: s.difficulty, outcome: sim.outcome || "defeat", floors: sim.g.floor, startedAt: this.startedAt, rows: rows.map(r => ({ userId: r.userId, name: r.name, clsId: r.clsId, role: r.role, role2: r.role2, place: r.place, score: Math.max(0, Math.round(r.score)), gold: r.gold, outcome: r.outcome, title: r.title, stats: Object.fromEntries(Object.entries(r.stats).map(([k, v]) => [k, Math.max(0, Math.round(v as number))])), items: r.items.slice(0, 6) })) })
      .then(r => { this.count(r ? "results_saved" : "results_failed", {}, r ? "info" : "warn"); this.broadcast("saved", { ok: !!r }); });
  }
  private lobby() {
    const s = this.s, sim = this.sim; if (!s || !sim) return;
    const players = sim.lobbyView().map(p => ({ ...p, connected: !this.seat(p.id)?.droppedAt }));
    this.broadcast("lobby", { code: s.code, host: s.host, phase: sim.phase, mode: s.mode, difficulty: s.difficulty, floors: s.floors, isPrivate: s.isPrivate, ready: s.ready, players, rules: MODES[s.mode], roles: ROLES });
  }

  /** Bucle de simulación: sólo mientras hay partida (en el lobby la sala puede hibernar). */
  private startLoop() { if (this.timer) return; this.lastTick = 0; this.timer = setInterval(() => this.tick(), 1000 / TICK_HZ); }
  private stopLoop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
  private tick() {
    const sim = this.sim; if (!sim) return;
    const t0 = Date.now(); const dtMs = this.lastTick ? Math.min(150, t0 - this.lastTick) : 1000 / TICK_HZ; this.lastTick = t0;
    try { sim.step(dtMs / 1000); } catch (e) { if (this.tickN % 100 === 0) this.count("tick_errors", { error: String(e).slice(0, 200) }, "error"); }
    if (++this.tickN % (TICK_HZ * 2) === 0) this.sweepDropped();
    if (sim.phase === "over" && !this.recorded) this.record();
    const socks = this.sockets();
    if ((sim.phase === "play" || sim.phase === "interlude") && this.tickN % FAST_EVERY === 0) for (const { ws, sid } of socks) { const f = sim.fastFor(sid); if (f) this.sendTo(ws, "p", f); }
    this.snapAcc += dtMs; if (this.snapAcc < SNAP_MS - 4) return; this.snapAcc = Math.min(SNAP_MS, this.snapAcc - SNAP_MS);
    if (sim.phase === "lobby") return;
    for (const { ws, sid } of socks) { const cache = this.caches.get(sid); if (!cache) continue; const snap = sim.snapshotFor(sid, cache); if (snap) this.sendTo(ws, "s", snap); }
    if (!socks.length && sim.phase === "over") { this.stopLoop(); void this.ctx.storage.setAlarm(Date.now() + 30_000); }
  }
}
