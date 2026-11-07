/**
 * Servidor de salas de Ars Anima (Colyseus 0.18 sobre Bun). Autoritativo: simula la expedición compartida
 * con el mismo motor del juego y envía a cada cliente sólo los cambios que le afectan.
 *
 * Variables de entorno:
 *   PORT                 puerto HTTP/WebSocket (2567 por defecto)
 *   SUPABASE_URL         URL del backend del juego (para verificar la sesión de cada jugador)
 *   SUPABASE_PUBLISHABLE_KEY  clave pública del backend
 *   APP_URL              URL publicada del juego (resultado final y arcón)
 *   MP_SERVER_SECRET     secreto compartido con el juego para guardar resultados
 *   ALLOW_GUESTS         "1" para permitir jugadores sin cuenta (no guardan progreso)
 */
const mem = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, String(v)); }, removeItem: (k: string) => { mem.delete(k); }, clear: () => mem.clear(), key: () => null, length: 0 };

import { defineServer, defineRoom, Room, matchMaker, type Client } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { z } from "zod";
import { ExpeditionSim, ClientCache } from "../../src/game/net/sim";
import { MP, MODES, ROLES, roomCode, validCode, type RuleMode } from "../../src/game/net/rules";

const PORT = Number(process.env.PORT ?? 2567);
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
const APP_URL = (process.env.APP_URL ?? "").replace(/\/$/, "");
const SECRET = process.env.MP_SERVER_SECRET ?? "";
const ALLOW_GUESTS = process.env.ALLOW_GUESTS !== "0";
const SNAP_MS = 1000 / 15;

interface Auth { id: string; name: string; guest: boolean }
async function verifyUser(token: string): Promise<Auth | null> {
  if (!token || !SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const u = await r.json() as { id?: string; email?: string; user_metadata?: Record<string, string> };
    if (!u.id) return null;
    return { id: u.id, name: u.user_metadata?.["full_name"] ?? u.user_metadata?.["name"] ?? u.email?.split("@")[0] ?? "", guest: false };
  } catch { return null; }
}
async function appPost(path: string, body: unknown) {
  if (!APP_URL || !SECRET) return null;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`${APP_URL}${path}`, { method: "POST", headers: { "content-type": "application/json", "x-mp-secret": SECRET }, body: JSON.stringify(body) });
      if (r.ok) return await r.json();
      if (r.status < 500) { console.error("[app]", path, r.status, await r.text()); return null; }
    } catch (e) { console.error("[app]", path, e); }
    await new Promise(r => setTimeout(r, 1500 * (i + 1)));
  }
  return null;
}

const CreateOpts = z.object({ mode: z.enum(["coop", "traicion", "caos"]).default("coop"), difficulty: z.enum(["facil", "normal", "dificil", "pesadilla"]).default("normal"), isPrivate: z.boolean().default(false), name: z.string().max(24).optional(), floors: z.number().int().min(1).max(6).optional() }).passthrough();
const JoinOpts = z.object({ name: z.string().max(24).optional(), vaultId: z.string().uuid().optional() }).passthrough();
const InputMsg = z.object({ mx: z.number(), my: z.number(), ang: z.number(), pitch: z.number(), vb: z.object({ fx: z.number(), fy: z.number(), rx: z.number(), ry: z.number() }).nullable().optional() }).catchall(z.union([z.boolean(), z.number(), z.null(), z.object({}).passthrough()]));
const GiveMsg = z.object({ to: z.string().max(40), gold: z.number().int().positive().max(1e7).optional(), uid: z.number().int().optional() });
const RpcMsg = z.object({ m: z.string().max(24), a: z.array(z.unknown()).max(3) });
const CfgMsg = z.object({ clsId: z.string().max(32).optional(), subclassId: z.string().max(40).optional(), role: z.string().max(16).optional(), role2: z.string().max(16).optional() });
const cleanName = (s: string | undefined) => (s ?? "").replace(/[^\p{L}\p{N} _.\-]/gu, "").trim().slice(0, 24);

class ExpeditionRoom extends Room {
  maxClients = MP.maxPlayers;
  sim!: ExpeditionSim; caches = new Map<string, ClientCache>(); host = ""; ready = new Set<string>(); vault = new Map<string, string>();
  mode: RuleMode = "coop"; difficulty = "normal"; floors: number = MP.floors; matchId = crypto.randomUUID(); recorded = false; startedAt = 0;
  snapAcc = 0; rate = new Map<string, number>(); hostName = "";

  static async onAuth(token: string) {
    const u = await verifyUser(token);
    if (u) return u;
    if (!ALLOW_GUESTS) throw new Error("Inicia sesión con tu cuenta para jugar en línea.");
    return { id: "", name: "", guest: true } satisfies Auth;
  }

  onCreate(raw: unknown) {
    const o = CreateOpts.parse(raw ?? {});
    let code = roomCode(); for (let i = 0; i < 10 && matchMakerHas(code); i++) code = roomCode();
    this.roomId = code; this.mode = o.mode; this.difficulty = o.difficulty; this.floors = o.floors ?? MP.floors; this.hostName = cleanName(o.name) || "Anfitrión";
    this.sim = new ExpeditionSim({ mode: this.mode, difficulty: this.difficulty, maxFloors: this.floors });
    void this.setPrivate(o.isPrivate); this.updateMeta();
    this.setPatchRate(null);
    this.setSimulationInterval(dt => this.tick(dt), 1000 / MP.tickHz);

    this.onMessage("in", (c: Client, m: unknown) => { if (!this.limit(c, 90)) return; const r = InputMsg.safeParse(m); if (r.success) this.sim.setInput(c.sessionId, r.data as never); });
    this.onMessage("rpc", (c: Client, m: unknown) => { if (!this.limit(c, 20)) return; const r = RpcMsg.safeParse(m); if (r.success) this.sim.rpc(c.sessionId, r.data.m, r.data.a); });
    this.onMessage("cfg", (c: Client, m: unknown) => { const r = CfgMsg.safeParse(m); if (!r.success) return; this.sim.configure(c.sessionId, r.data as never); this.ready.delete(c.sessionId); this.lobby(); });
    this.onMessage("ready", (c: Client, m: unknown) => { if (this.sim.phase !== "lobby") return; if (m === false) this.ready.delete(c.sessionId); else this.ready.add(c.sessionId); this.lobby(); });
    this.onMessage("rules", (c: Client, m: unknown) => { if (c.sessionId !== this.host || this.sim.phase !== "lobby") return; const r = CreateOpts.partial().safeParse(m); if (!r.success) return; if (r.data.mode) this.mode = this.sim.mode = r.data.mode; if (r.data.difficulty) this.difficulty = this.sim.difficulty = r.data.difficulty; if (r.data.isPrivate !== undefined) void this.setPrivate(r.data.isPrivate); if (r.data.floors) this.floors = this.sim.maxFloors = r.data.floors; this.ready.clear(); this.updateMeta(); this.lobby(); });
    this.onMessage("start", (c: Client) => { void this.begin(c); });
    this.onMessage("give", (c: Client, m: unknown) => { if (!this.limit(c, 4)) return; const r = GiveMsg.safeParse(m); if (r.success) this.sim.give(c.sessionId, r.data.to, r.data); });
    this.onMessage("quest", (c: Client, m: unknown) => { if (this.limit(c, 2)) this.sim.acceptQuest(c.sessionId, m); });
    this.onMessage("vote", (c: Client, m: unknown) => { if (typeof m === "boolean") this.sim.castVote(c.sessionId, m); });
    this.onMessage("chat", (c: Client, m: unknown) => { if (!this.limit(c, 3) || typeof m !== "string") return; const p = this.sim.players.get(c.sessionId); const t = m.replace(/[<>]/g, "").trim().slice(0, 140); if (p && t) this.broadcast("chat", { from: p.name, color: p.color, text: t }); });
    this.onMessage("restart", (c: Client) => { if (c.sessionId === this.host && this.sim.phase === "over") this.restart(); });
    this.onMessage("ping", (c: Client, t: unknown) => { c.send("pong", { t, s: this.sim.clock }); });
  }
  private limit(c: Client, perSec: number) {
    const now = Date.now(), k = c.sessionId, w = Math.floor(now / 1000), key = `${k}:${w}`;
    const n = (this.rate.get(key) ?? 0) + 1; this.rate.set(key, n);
    if (this.rate.size > 200) for (const x of this.rate.keys()) if (!x.endsWith(`:${w}`)) this.rate.delete(x);
    return n <= perSec;
  }
  async onJoin(client: Client, raw: unknown, auth: Auth) {
    if (this.sim.phase !== "lobby") throw new Error("La expedición ya ha empezado.");
    const o = JoinOpts.parse(raw ?? {});
    if (auth?.id && [...this.sim.players.values()].some(p => p.userId === auth.id)) throw new Error("Tu cuenta ya está en esta sala.");
    const name = cleanName(o.name) || cleanName(auth?.name) || `Errante ${this.sim.players.size + 1}`;
    const p = this.sim.addPlayer(client.sessionId, auth?.id ?? "", name);
    if (o.vaultId && auth?.id) this.vault.set(client.sessionId, o.vaultId);
    this.caches.set(client.sessionId, new ClientCache());
    if (!this.host) this.host = client.sessionId;
    client.send("hello", { id: client.sessionId, code: this.roomId, color: p.color, guest: !auth?.id, persist: !!(APP_URL && SECRET) });
    this.updateMeta(); this.lobby();
  }
  async onDrop(client: Client) {
    const p = this.sim.players.get(client.sessionId); if (p) { p.connected = false; this.sim.post("info", `${p.name} perdió la conexión: tiene ${MP.reconnectSeconds} s para volver.`); }
    this.lobby();
    await this.allowReconnection(client, MP.reconnectSeconds);
  }
  onReconnect(client: Client) {
    const p = this.sim.players.get(client.sessionId); if (p) { p.connected = true; this.sim.post("info", `${p.name} ha vuelto.`); }
    this.caches.get(client.sessionId)?.full();
    client.send("hello", { id: client.sessionId, code: this.roomId, color: p?.color, guest: !p?.userId, persist: !!(APP_URL && SECRET) });
    this.lobby();
  }
  onLeave(client: Client) {
    this.sim.removePlayer(client.sessionId); this.caches.delete(client.sessionId); this.ready.delete(client.sessionId); this.vault.delete(client.sessionId);
    if (this.host === client.sessionId) this.host = this.clients.find(c => c.sessionId !== client.sessionId)?.sessionId ?? "";
    this.updateMeta(); this.lobby();
    if (this.sim.phase === "play" && ![...this.sim.players.values()].some(p => p.state !== "gone")) this.sim.endMatch("defeat");
  }
  private async begin(c: Client) {
    if (c.sessionId !== this.host || this.sim.phase !== "lobby") return;
    const n = this.sim.players.size;
    if (n < MP.minPlayers) { c.send("err", `Hacen falta al menos ${MP.minPlayers} jugadores.`); return; }
    const notReady = [...this.sim.players.values()].filter(p => p.id !== this.host && !this.ready.has(p.id));
    if (notReady.length) { c.send("err", `Falta que confirmen: ${notReady.map(p => p.name).join(", ")}.`); return; }
    await this.lock();
    for (const [sid, vid] of this.vault) { const p = this.sim.players.get(sid); if (!p?.userId) continue; const r = await appPost("/api/public/mp/vault-claim", { userId: p.userId, vaultId: vid, match: this.matchId }) as { item?: Record<string, unknown> } | null; if (r?.item) p.vaultItem = r.item; }
    this.startedAt = Date.now(); this.sim.start(); this.updateMeta(); this.broadcast("started", { mode: this.mode });
  }
  private restart() {
    const old = this.sim; this.sim = new ExpeditionSim({ mode: this.mode, difficulty: this.difficulty, maxFloors: this.floors });
    for (const p of old.players.values()) { if (p.state === "gone" && !this.clients.some(c => c.sessionId === p.id)) continue; const q = this.sim.addPlayer(p.id, p.userId, p.name); this.sim.configure(p.id, { clsId: p.clsId, subclassId: p.subclassId, role: p.role, role2: p.role2 }); q.color = p.color; this.caches.set(p.id, new ClientCache()); }
    this.ready.clear(); this.vault.clear(); this.matchId = crypto.randomUUID(); this.recorded = false; void this.unlock(); this.updateMeta(); this.broadcast("restarted", {}); this.lobby();
  }
  private tickN = 0; private tickT = 0; private tickCost = 0;
  private lastTick = 0;
  private tick(_reported: number) {
    const t0 = performance.now(); const dtMs = this.lastTick ? Math.min(100, t0 - this.lastTick) : 1000 / MP.tickHz; this.lastTick = t0;
    const dt = dtMs / 1000;
    if (process.env.MP_DEBUG) { this.tickN++; if (t0 - this.tickT > 2000) { console.log(`[tick] ${this.roomId} ${(this.tickN / ((t0 - this.tickT) / 1000)).toFixed(1)}/s dt=${dtMs.toFixed(1)} cost=${(this.tickCost / this.tickN).toFixed(2)}ms`); this.tickN = 0; this.tickT = t0; this.tickCost = 0; } queueMicrotask(() => { this.tickCost += performance.now() - t0; }); }
    try { this.sim.step(dt); } catch (e) { console.error("[tick]", e); }
    if (this.sim.phase === "over" && !this.recorded) this.record();
    // Posiciones a cada tick (30 Hz): movimiento fluido y confirmación rápida de la entrada propia.
    if (this.sim.phase === "play" || this.sim.phase === "interlude") for (const c of this.clients) { const f = this.sim.fastFor(c.sessionId); if (f) c.send("p", f); }
    this.snapAcc += dtMs; if (this.snapAcc < SNAP_MS - 4) return; this.snapAcc = Math.min(SNAP_MS, this.snapAcc - SNAP_MS);
    if (this.sim.phase === "lobby") return;
    for (const c of this.clients) { const cache = this.caches.get(c.sessionId); if (!cache) continue; const s = this.sim.snapshotFor(c.sessionId, cache); if (s) c.send("s", s); }
  }
  private record() {
    this.recorded = true; const rows = this.sim.final ?? [];
    void appPost("/api/public/mp/result", { id: this.matchId, code: this.roomId, mode: this.mode, difficulty: this.difficulty, outcome: this.sim.outcome || "defeat", floors: this.sim.g.floor, startedAt: this.startedAt, rows: rows.map(r => ({ userId: r.userId, name: r.name, clsId: r.clsId, role: r.role, role2: r.role2, place: r.place, score: Math.max(0, Math.round(r.score)), gold: r.gold, outcome: r.outcome, title: r.title, stats: Object.fromEntries(Object.entries(r.stats).map(([k, v]) => [k, Math.max(0, Math.round(v))])), items: r.items.slice(0, 6) })) })
      .then(r => this.broadcast("saved", { ok: !!r }));
  }
  lobby() {
    this.broadcast("lobby", { code: this.roomId, host: this.host, phase: this.sim.phase, mode: this.mode, difficulty: this.difficulty, floors: this.floors, isPrivate: !!this.listing?.private, ready: [...this.ready], players: this.sim.lobbyView(), rules: MODES[this.mode], roles: ROLES });
  }
  private updateMeta() { void this.setMetadata({ mode: this.mode, difficulty: this.difficulty, host: this.hostName, phase: this.sim?.phase ?? "lobby", players: this.sim?.players.size ?? 0 } as never); }
}
const live = new Set<string>();
function matchMakerHas(code: string) { return live.has(code); }

const server = defineServer({
  transport: new WebSocketTransport(),
  rooms: { expedition: defineRoom(ExpeditionRoom) },
  greet: false,
  express: (app) => {
    app.use((req, res, next) => { res.setHeader("Access-Control-Allow-Origin", "*"); res.setHeader("Access-Control-Allow-Headers", "content-type"); if (req.method === "OPTIONS") { res.status(204).end(); return; } next(); });
    app.get("/health", (_req, res) => { res.json({ ok: true, rooms: live.size }); });
    app.get("/rooms", async (_req, res) => {
      const rooms = await matchMaker.query({ name: "expedition", private: false, locked: false });
      res.json(rooms.filter(r => validCode(r.roomId)).map(r => ({ code: r.roomId, clients: r.clients, max: r.maxClients, ...(r.metadata ?? {}) })));
    });
  },
});
const origCreate = ExpeditionRoom.prototype.onCreate;
ExpeditionRoom.prototype.onCreate = function (this: ExpeditionRoom, raw: unknown) { origCreate.call(this, raw); live.add(this.roomId); };
const origDispose = ExpeditionRoom.prototype.onDispose;
ExpeditionRoom.prototype.onDispose = function (this: ExpeditionRoom) { live.delete(this.roomId); return origDispose?.call(this); };

await server.listen(PORT);
console.log(`[ars-anima] servidor de salas en :${PORT} · invitados ${ALLOW_GUESTS ? "sí" : "no"} · guardado ${APP_URL && SECRET ? "activo" : "desactivado (faltan APP_URL/MP_SERVER_SECRET)"}`);
