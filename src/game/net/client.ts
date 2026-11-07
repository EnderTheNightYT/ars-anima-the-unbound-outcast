/**
 * Cliente de la EXPEDICIÓN COMPARTIDA: conecta con el servidor de salas, envía entradas y aplica las
 * instantáneas autoritativas sobre la partida local (que sólo dibuja: no simula cuando hay sesión).
 */
import { Client, type Room } from "@colyseus/sdk";
import { CfClient, isCfServer } from "./cf-transport";
import type { Game, Input } from "../engine";
import { getDifficulty } from "../difficulty";
import { clampPitch, smoothFactor } from "../camera";
import { fromPlain, toPlain, applyEntities } from "./wire";
import { CLIENT_KEEP } from "./split";
import { Track, ServerClock, INTERP } from "./interp";
import { Predictor } from "./predict";
import { DustTracker, emitDust, stepParts, HpWatch, stepDmgNums } from "./client-fx";
import { barkLine, hasBarks, type BarkEvent } from "../barks";
import type { RemoteView, NetMark } from "./view";
import type { MpStats, Role, RuleMode } from "./rules";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
export type NetStatus = "idle" | "connecting" | "lobby" | "play" | "reconnecting" | "closed" | "error";
export interface LobbyPlayer { id: string; name: string; clsId: string; subclassId: string; role: Role; role2: Role | ""; color: string; connected: boolean; state: string }
export interface LobbyState { code: string; host: string; phase: string; mode: RuleMode; difficulty: string; floors: number; isPrivate: boolean; ready: string[]; players: LobbyPlayer[]; rules: { name: string; blurb: string } }
export interface PublicRoom { code: string; clients: number; max: number; mode: RuleMode; difficulty: string; host: string; phase: string }
export interface Standing { id: string; name: string; color: string; role: Role; role2: Role | ""; hp: number; hpMax: number; state: string; traitor: number; score: number; connected: boolean; level: number; cls: string; gold: number; revive: number; x: number; y: number }
export interface FinalRow { id: string; name: string; clsId: string; role: Role; role2: Role | ""; score: number; engineScore: number; merits: number; stats: MpStats; title: { name: string; meaning: string }; place: number; gold: number; outcome: string; items: Any[] }
export interface EventState {
  duel: { active: boolean; until: number; joined: boolean; n: number; item?: string } | null;
  vote: { id: string; text: string; left: number; yes: number; no: number; mine: string } | null;
  contract: { kind: string; text: string; done: boolean } | null;
  extract: number; evac: number; pot: number; inter: number; outcome: string;
  fr: { floor: number; rows: { id: string; name: string; score: number; state: string }[] } | null;
  final: FinalRow[] | null; stats: MpStats; merits: { total: number; lines: { key: keyof MpStats; points: number }[] };
}
export interface FeedLine { kind: string; text: string; at: number }
export interface ChatLine { from: string; color: string; text: string; at: number }

const URL_KEY = "ars_anima_mp_url", TOKEN_KEY = "ars_anima_mp_reconnect", NAME_KEY = "ars_anima_mp_name";
const RPC_METHODS = ["use", "equip", "sell", "buy", "craft", "smith", "learn", "raiseAttr", "pickSkill", "choose", "activatePact"] as const;
const BLOCKED = ["stealKeg", "saveRun", "endRun", "continueFloor", "finishFloor", "resumeRun"] as const;
const INPUT_HZ = 30;
/** Servidor de salas publicado en Cloudflare (cloudflare-server/). */
export const DEFAULT_SERVER = "https://ars-anima-rooms.nightbhgs10.workers.dev";

export function serverUrl() {
  const saved = typeof localStorage !== "undefined" ? localStorage.getItem(URL_KEY) : null;
  return (saved || (import.meta.env["VITE_MP_SERVER_URL"] as string | undefined) || DEFAULT_SERVER).trim();
}
/** Enlace de invitación: abre el juego directamente en la sala (y en el servidor si no es el de por defecto). */
export function inviteLink(code: string, origin = location.origin, server = serverUrl()) {
  const q = new URLSearchParams({ sala: code.toUpperCase() });
  if (server && server.replace(/\/$/, "") !== DEFAULT_SERVER) q.set("srv", server);
  return `${origin}/?${q.toString()}`;
}
/** Lee una invitación de la URL: código de 6 caracteres válido y servidor opcional http(s)/ws(s). */
export function readInvite(search: string): { code: string; server: string } | null {
  const q = new URLSearchParams(search); const code = (q.get("sala") ?? "").toUpperCase().trim();
  if (!/^[A-Z0-9]{6}$/.test(code)) return null;
  const srv = (q.get("srv") ?? "").trim();
  return { code, server: /^(https?|wss?):\/\/[^\s]+$/i.test(srv) ? srv : "" };
}
export function setServerUrl(url: string) { localStorage.setItem(URL_KEY, url.trim()); }
export const savedName = () => (typeof localStorage !== "undefined" ? localStorage.getItem(NAME_KEY) ?? "" : "");
const httpBase = (u: string) => u.replace(/^ws/, "http").replace(/\/$/, "");

async function accessToken() {
  try { const { supabase } = await import("@/integrations/supabase/client"); const { data } = await supabase.auth.getSession(); return data.session?.access_token ?? ""; } catch { return ""; }
}

export class NetSession {
  status: NetStatus = "idle"; error = ""; id = ""; code = ""; guest = true; persist = false; saved: boolean | null = null;
  lobby: LobbyState | null = null; ev: EventState | null = null; feed: FeedLine[] = []; chat: ChatLine[] = [];
  /** Últimos cambios de puntuación (para el marcador en vivo). */ scoreFx = new Map<string, { delta: number; at: number }>();
  standings: Standing[] = []; state = "alive"; downT = 0; phase = "lobby"; rtt = 0; panel = false; song = NaN; songAt = 0;
  /** Servidor Cloudflare: menos entradas por segundo (cuota gratuita). */ private cf = false;
  private client: Client | null = null; private room: Room | null = null; private game: Game | null = null;
  private listeners = new Set<() => void>(); private queue: Any[] = []; private sendAcc = 0; private latch: Partial<Record<keyof Input, boolean>> = {};
  private originals = new Map<string, unknown>(); private me = { x: NaN, y: NaN, z: NaN }; private remoteT = new Map<string, Track>();
  private enemyT = new Map<number, Track>(); private ready = false; private pingT = 0; private lastSend = ""; private idleT = 0;
  /** Predicción local del propio jugador y reloj del servidor para interpolar a los demás. */
  private pred = new Predictor(); private clock = new ServerClock(); private seq = 0; private predictable = false; private fastAt = 0;
  /** Corrección media de la predicción (diagnóstico en el marcador). */ predErr = 0;
  private barkText = new Map<string, string>();
  audio: { musicPlaying: boolean; startMusic: (o?: number) => void; stopMusic: () => void; songTime: () => number; musicBuf?: unknown } | null = null;

  get active() { return this.status === "play" || this.status === "reconnecting"; }
  get inRoom() { return !!this.room; }
  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { for (const f of this.listeners) f(); }
  private fail(msg: string) { this.status = "error"; this.error = msg; this.emit(); }

  async listRooms(): Promise<PublicRoom[]> {
    const u = serverUrl(); if (!u) return [];
    const r = await fetch(`${httpBase(u)}/rooms`); if (!r.ok) throw new Error(`El servidor respondió ${r.status}`);
    return await r.json() as PublicRoom[];
  }
  private async connect() {
    const u = serverUrl(); if (!u) throw new Error("No hay servidor multijugador configurado.");
    this.cf = await isCfServer(u);
    this.client = (this.cf ? new CfClient(u) : new Client(u)) as unknown as Client; const t = await accessToken(); if (t) this.client.auth.token = t;
    return this.client;
  }
  async create(opts: { mode: RuleMode; difficulty: string; isPrivate: boolean; name: string; floors?: number }) {
    this.status = "connecting"; this.error = ""; this.emit();
    try { localStorage.setItem(NAME_KEY, opts.name); const c = await this.connect(); this.bind(await c.create("expedition", opts)); }
    catch (e) { this.fail(e instanceof Error ? e.message : String(e)); }
  }
  async join(code: string, name: string, vaultId?: string) {
    this.status = "connecting"; this.error = ""; this.emit();
    try { localStorage.setItem(NAME_KEY, name); const c = await this.connect(); this.bind(await c.joinById(code.trim().toUpperCase(), { name, vaultId })); }
    catch (e) { this.fail(e instanceof Error ? e.message : String(e)); }
  }
  /** Tras recargar la página: volver a la misma sala con el mismo jugador. */
  async resume() {
    const tok = sessionStorage.getItem(TOKEN_KEY); if (!tok) return false;
    this.status = "connecting"; this.emit();
    try { const c = await this.connect(); this.bind(await c.reconnect(tok)); return true; }
    catch { sessionStorage.removeItem(TOKEN_KEY); this.status = "idle"; this.emit(); return false; }
  }
  hasResume() { return typeof sessionStorage !== "undefined" && !!sessionStorage.getItem(TOKEN_KEY); }

  private bind(room: Room) {
    this.room = room; this.status = "lobby"; this.code = room.roomId; sessionStorage.setItem(TOKEN_KEY, room.reconnectionToken);
    room.onMessage("hello", (m: Any) => { this.id = m.id; this.code = m.code; this.guest = !!m.guest; this.persist = !!m.persist; this.emit(); });
    room.onMessage("lobby", (m: LobbyState) => { this.lobby = m; this.phase = m.phase; if (m.phase === "lobby" && this.status === "play") this.detach(); this.emit(); });
    room.onMessage("started", () => { this.ready = false; this.status = "play"; this.saved = null; this.emit(); });
    room.onMessage("restarted", () => { this.detach(); this.status = "lobby"; this.ev = null; this.feed = []; this.saved = null; this.emit(); });
    room.onMessage("saved", (m: Any) => { this.saved = !!m?.ok; this.emit(); });
    room.onMessage("err", (m: string) => { this.error = String(m); this.emit(); window.setTimeout(() => { if (this.error === m) { this.error = ""; this.emit(); } }, 4000); });
    room.onMessage("chat", (m: Any) => { this.chat.push({ from: String(m.from ?? ""), color: String(m.color ?? ""), text: String(m.text ?? ""), at: performance.now() }); if (this.chat.length > 40) this.chat.shift(); this.emit(); });
    room.onMessage("p", (m: Any) => { this.fast(m); });
    room.onMessage("pong", (m: Any) => { this.rtt = performance.now() - (m.t as number); });
    room.onMessage("s", (s: Any) => { this.queue.push(s); if (this.status === "lobby") { this.status = "play"; this.emit(); } });
    room.onDrop(() => { this.status = "reconnecting"; this.emit(); });
    room.onReconnect(() => { this.status = this.phase === "lobby" ? "lobby" : "play"; sessionStorage.setItem(TOKEN_KEY, room.reconnectionToken); this.emit(); });
    room.onLeave((code: number) => { const wasPlaying = this.active; this.room = null; sessionStorage.removeItem(TOKEN_KEY); this.detach(); this.status = code === 4000 || code === 1000 ? "idle" : "closed"; if (code !== 4000 && code !== 1000) this.error = wasPlaying ? "Se perdió la conexión con la expedición." : "La sala se cerró."; this.lobby = null; this.ev = null; this.emit(); });
    room.onError((code: number, msg?: string) => { this.error = `${msg ?? "Error"} (${code})`; this.emit(); });
    this.emit();
  }
  send(type: string, msg?: unknown) { this.room?.send(type, msg); }
  async leave() { const r = this.room; this.detach(); if (r) await r.leave(true).catch(() => {}); this.room = null; sessionStorage.removeItem(TOKEN_KEY); this.status = "idle"; this.lobby = null; this.ev = null; this.feed = []; this.emit(); }

  // ───────────────────────── vínculo con la partida local ─────────────────────────
  attach(g: Game) {
    if (this.game === g) return; this.game = g; const G = g as unknown as Any;
    for (const m of [...RPC_METHODS, ...BLOCKED]) this.originals.set(m, G[m]);
    for (const m of RPC_METHODS) G[m] = (...a: unknown[]) => { this.send("rpc", { m, a: toPlain(a) }); };
    for (const m of BLOCKED) G[m] = () => {};
    // Encargos de la IA: el servidor los valida y calcula la recompensa con el nivel real.
    this.originals.set("acceptQuest", G.acceptQuest); G.acceptQuest = (q: unknown) => { this.send("quest", toPlain(q)); };
    G.remotes = []; G.netMarks = []; this.me = { x: NaN, y: NaN, z: NaN }; this.enemyT.clear(); this.remoteT.clear(); this.ready = false; this.pred.reset(NaN, NaN); this.predictable = false;
  }
  detach() {
    const g = this.game; if (!g) return; const G = g as unknown as Any;
    for (const [m, f] of this.originals) G[m] = f; this.originals.clear();
    G.remotes = []; G.netMarks = []; this.game = null; this.ready = false;
    if (g.mode !== "title") { g.mode = "title"; g.recap = null; g.choice = null; }
    this.audio?.stopMusic(); g.musicOn = false; g.onUI();
  }

  /** Un fotograma con sesión: mira local, aplicar instantáneas, suavizar posiciones y enviar la entrada. */
  frame(g: Game, dt: number, inp: Input) {
    if (this.game !== g) this.attach(g);
    const G = g as unknown as Any;
    G.lookPendingX += inp.lookX; G.lookPendingY += inp.lookY;
    const ease = smoothFactor(40, dt), lx = G.lookPendingX * ease, ly = G.lookPendingY * ease;
    g.ang = Math.atan2(Math.sin(g.ang + lx), Math.cos(g.ang + lx)); g.pitch = clampPitch(g.pitch + ly);
    G.lookPendingX -= lx; G.lookPendingY -= ly;
    let changed = false;
    while (this.queue.length) { this.apply(g, this.queue.shift()!); changed = true; }
    if (!this.ready) return changed;
    g.time += dt;
    for (const pk of g.pickups as Any[]) pk.bob = (pk.bob ?? 0) + dt;
    const k = smoothFactor(14, dt);
    // Propio jugador: predicción inmediata con la velocidad real del motor; el servidor la corrige.
    if (Number.isFinite(this.me.x)) {
      const predicting = this.predictable && g.mode === "play" && this.pred.ready && performance.now() - this.fastAt < 500;
      if (predicting) {
        const vb = g.camera.mode !== "fp" ? (G.viewBasis as { fx: number; fy: number; rx: number; ry: number } | null) : null, cos = Math.cos(g.ang), sin = Math.sin(g.ang);
        const fx = vb ? vb.fx * inp.my + vb.rx * inp.mx : cos * inp.my - sin * inp.mx, fy = vb ? vb.fy * inp.my + vb.ry * inp.mx : sin * inp.my + cos * inp.mx;
        let speed = 3.6; try { speed = g.moveSpeed(inp); } catch { /* estado parcial: velocidad base */ }
        const grounded = g.pz <= g.floorHeight(this.pred.x, this.pred.y) + .05, z = g.pz + .38;
        this.pred.step(dt, { fx, fy, speed: Number.isFinite(speed) ? speed : 3.6, grounded }, (x, y) => g.solid(x, y, z));
        const v = this.pred.view(); g.px = v.x; g.py = v.y; g.vx = this.pred.vx; g.vy = this.pred.vy;
      } else {
        const d = Math.hypot(this.me.x - g.px, this.me.y - g.py); if (d > 3) { g.px = this.me.x; g.py = this.me.y; } else { g.px += (this.me.x - g.px) * k; g.py += (this.me.y - g.py) * k; }
        this.pred.reset(g.px, g.py, g.vx, g.vy);
      }
      g.pz += (this.me.z - g.pz) * k;
    }
    // Compañeros y enemigos: interpolados un instante en el pasado entre muestras del servidor.
    const rt = this.clock.now(performance.now() / 1000) - INTERP.delay;
    if (Number.isFinite(rt)) {
      for (const e of g.enemies as Any[]) { const p = this.enemyT.get(e.id)?.at(rt); if (p) { e.x = p.x; e.y = p.y; e.z = p.z; } }
      for (const r of G.remotes as RemoteView[]) { const p = this.remoteT.get(r.id)?.at(rt); if (p) { r.x = p.x; r.y = p.y; r.z = p.z; } }
    }
    // Polvo/piedritas al correr, saltar, aterrizar, frenar y deslizar (sólo visual, propio y compañeros).
    try {
      const dustQ = /Android|iPhone|iPad/i.test(navigator.userAgent) ? .45 : .7, keep = new Set<string>(["me"]);
      const fh = (x: number, y: number) => { try { return g.floorHeight(x, y); } catch { return 0; } }, gk = (x: number, y: number) => { try { return G.groundKind(x, y) as number; } catch { return 2; } };
      if (g.mode === "play") emitDust(G.parts, this.dust.observe("me", g.px, g.py, g.pz, fh(g.px, g.py), dt), g.px, g.py, g.pz, gk(g.px, g.py), dustQ);
      for (const r of G.remotes as RemoteView[]) { if (r.state === "gone" || r.state === "dead") continue; keep.add(r.id); emitDust(G.parts, this.dust.observe(r.id, r.x, r.y, r.z, fh(r.x, r.y), dt), r.x, r.y, r.z, gk(r.x, r.y), dustQ * .8); }
      this.dust.forget(keep);
      G.parts = stepParts(G.parts ?? [], dt, G.partCap ?? 300);
      G.dmgNums = stepDmgNums(G.dmgNums ?? [], dt);
    } catch { /* efectos opcionales */ }
    // entrada: se acumulan pulsaciones breves hasta el siguiente envío
    const I = inp as unknown as Any;
    let press = false;
    for (const key of Object.keys(I)) if (I[key] === true) { if (!(this.latch as Any)[key]) press = true; (this.latch as Any)[key] = true; }
    this.sendAcc += dt; this.idleT += dt;
    // Una pulsación nueva (disparo, salto, parry…) sale ya, sin esperar al siguiente envío regular.
    if (this.sendAcc >= 1 / (this.cf ? 15 : INPUT_HZ) || (press && this.sendAcc >= 1 / 40)) {
      this.sendAcc = 0;
      const out: Any = { mx: +inp.mx.toFixed(3), my: +inp.my.toFixed(3), ang: +g.ang.toFixed(3), pitch: +g.pitch.toFixed(3), vb: g.camera.mode !== "fp" && G.viewBasis ? G.viewBasis : null };
      for (const key of Object.keys(I)) if (typeof I[key] === "boolean") out[key] = !!(I[key] || (this.latch as Any)[key]);
      this.latch = {};
      const sig = JSON.stringify(out);
      // Quieto y sin cambios: un latido cada 0,5 s basta (menos tráfico y menos cola en el servidor).
      const still = !out.mx && !out.my && !Object.keys(out).some(k => out[k] === true);
      if (!still || sig !== this.lastSend || this.idleT >= .5) {
        this.idleT = 0; this.lastSend = sig; out.q = ++this.seq;
        // Cada envío lleva su número: el servidor confirma cuál aplicó y la predicción se corrige desde ahí.
        this.pred.mark(this.seq); this.send("in", out);
      }
    }
    this.pingT -= dt; if (this.pingT <= 0) { this.pingT = 2; this.send("ping", performance.now()); }
    this.syncMusic(g);
    return changed;
  }
  private syncMusic(g: Game) {
    const a = this.audio; if (!a || !Number.isFinite(this.song)) return;
    const want = g.floor === 1 && this.phase === "play";
    if (!want) { if (a.musicPlaying) a.stopMusic(); g.musicOn = false; return; }
    const target = this.song + (performance.now() - this.songAt) / 1000 + this.rtt / 2000;
    if (!a.musicPlaying) { a.startMusic(target); g.musicOn = a.musicPlaying; return; }
    const cur = a.songTime(); if (Number.isFinite(cur) && Math.abs(cur - target) > .35 && Math.abs(cur - target) < 190) { a.stopMusic(); a.startMusic(target); }
  }
  /** Paquete rápido del servidor: posiciones a cada tick y confirmación de la entrada propia. */
  private fast(m: Any) {
    if (!m || !Number.isFinite(m.t)) return;
    const local = performance.now() / 1000; this.clock.observe(m.t, local); this.fastAt = performance.now();
    if (Array.isArray(m.me)) {
      const [x, y, z, vx, vy, ok] = m.me as number[];
      this.me = { x: x!, y: y!, z: z! }; this.predictable = ok === 1;
      if (this.ready && this.predictable) { const e = this.pred.reconcile(m.a as number, x!, y!); this.predErr += (e - this.predErr) * .1; }
      else if (!this.predictable) { this.pred.reset(NaN, NaN); }
      void vx; void vy;
    }
    if (Array.isArray(m.pl)) for (const r of m.pl as Any[]) {
      const [id, x, y, z, ang, vx, vy] = r; let t = this.remoteT.get(id); if (!t) { t = new Track(); this.remoteT.set(id, t); } t.push(m.t, x, y, z);
      const v = (this.game as unknown as Any)?.remotes?.find((q: RemoteView) => q.id === id); if (v) { v.ang = ang; v.vx = vx; v.vy = vy; }
    }
  }
  /** Último título ganado en partida por cualquier jugador (aviso general). */ titleFx: { text: string; at: number } | null = null;
  private dust = new DustTracker(); private hpWatch = new HpWatch();
  private pushFeed(kind: string, text: string) { if (kind === "title") this.titleFx = { text, at: performance.now() }; this.feed.push({ kind, text, at: performance.now() }); if (this.feed.length > 60) this.feed.splice(0, this.feed.length - 60); }

  private apply(g: Game, s: Any) {
    const G = g as unknown as Any;
    const enemyById = (id: number) => (G.enemies as Any[]).find(e => e.id === id);
    const revive = (v: unknown) => fromPlain(v, enemyById);
    this.phase = s.ph; this.state = s.st; this.downT = s.dn ?? 0;
    if (Number.isFinite(s.song)) { this.song = s.song; this.songAt = performance.now(); }
    const applyMe = () => {
      if (!s.me) return;
      for (const k of Object.keys(s.me)) {
        if (CLIENT_KEEP.has(k)) continue;
        if (k === "px") { this.me.x = s.me[k]; continue; } if (k === "py") { this.me.y = s.me[k]; continue; } if (k === "pz") { this.me.z = s.me[k]; continue; }
        G[k] = revive(s.me[k]);
      }
    };
    if (s.floor) {
      applyMe();
      G.floor = s.floor.n; G.floorSeed = s.floor.seed; G.difficulty = getDifficulty(s.floor.diff);
      // La geometría se reconstruye con la misma semilla; el legado local no debe contar pisos compartidos.
      const legacy = JSON.stringify(G.legacy ?? null), saveLegacy = G.saveLegacy; G.saveLegacy = () => {};
      try { g.genFloor(true); } catch (e) { console.error("[net] genFloor", e); } finally { G.saveLegacy = saveLegacy; G.legacy = JSON.parse(legacy) ?? G.legacy; }
      G.enemies = []; G.pickups = []; G.projs = []; G.parts = []; this.enemyT.clear(); this.remoteT.clear(); this.me = { x: NaN, y: NaN, z: NaN }; this.pred.reset(NaN, NaN); this.dust.clear(); this.hpWatch.clear();
    }
    if (s.map) G.map = Uint8Array.from(s.map as number[]);
    if (s.mapd) { const m = G.map as Uint8Array; const d = s.mapd as number[]; for (let i = 0; i < d.length; i += 2) m[d[i]!] = d[i + 1]!; }
    if (s.w) for (const k of Object.keys(s.w)) G[k] = revive(s.w[k]);
    if (s.en) {
      // Volver a la última posición del servidor antes de aplicar cambios (lo dibujado es interpolado).
      for (const e of G.enemies as Any[]) { const last = this.enemyT.get(e.id)?.samples.at(-1); if (last) { e.x = last.x; e.y = last.y; e.z = last.z; } }
      G.enemies = applyEntities(G.enemies as Any[], "id", s.en, revive);
      try { G.dmgNums = this.hpWatch.diff(G.enemies as Any[], G.dmgNums ?? []); } catch { /* sólo visual */ }
      if (s.en.del?.length) for (const id of s.en.del as number[]) this.enemyT.delete(id);
    }
    if (Number.isFinite(s.t)) {
      this.clock.observe(s.t, performance.now() / 1000);
      for (const e of G.enemies as Any[]) { let t = this.enemyT.get(e.id); if (!t) { t = new Track(); this.enemyT.set(e.id, t); } t.push(s.t, e.x, e.y, e.z ?? 0); }
    }
    if (s.pk) G.pickups = applyEntities(G.pickups as Any[], "netId", s.pk, revive);
    if (s.me) {
      applyMe();
      // Frases de enemigos: el servidor decide cuándo hablan; el texto sale del repertorio de IA de este jugador.
      if (Array.isArray(s.me.barks)) for (const b of G.barks as { e?: { id?: number; kind?: string }; ev?: BarkEvent; text: string }[]) {
        const kind = b.e?.kind; if (!kind || !b.ev || !hasBarks(kind)) continue;
        const key = `${b.e?.id}:${b.ev}:${b.text}`; let t = this.barkText.get(key); if (!t) { t = barkLine(kind, b.ev); this.barkText.set(key, t); if (this.barkText.size > 200) this.barkText.delete(this.barkText.keys().next().value!); }
        b.text = t;
      }
      if (!this.ready && Number.isFinite(this.me.x)) { g.px = this.me.x; g.py = this.me.y; g.pz = Number.isFinite(this.me.z) ? this.me.z : 0; if (typeof s.me.ang === "number") g.ang = s.me.ang; }
      if (s.me.mode === "choice" && g.choice) g.mode = "choice";
      else if (typeof s.me.mode === "string" && s.me.mode !== "choice" && g.mode === "choice") g.mode = "play";
    }
    if (s.sc) g.score.load(s.sc);
    if (s.pr) G.projs = (s.pr as Any[]).map(p => ({ x: p[0], y: p[1], z: p[2], sprite: p[3] || undefined, size: p[4], friendly: !!p[5], color: p[6], dx: p[7] ?? 0, dy: p[8] ?? 0, dz: 0, life: 1, dmg: 0, hit: [] }));
    if (s.pl) {
      const rows = s.pl as Any[]; const old = new Map((G.remotes as RemoteView[]).map(r => [r.id, r]));
      const remotes: RemoteView[] = []; const st: Standing[] = [];
      for (const r of rows) {
        const [id, name, color, role, x, y, z, ang, pitch, vx, vy, slot, dashT, crouching, slideT, swingT, heavy, aiming, pounding, hp, hpMax, state, traitor, score, connected, level, cls, gold, role2, revive, title] = r;
        st.push({ id, name, color, role, role2, hp, hpMax, state, traitor, score, connected: !!connected, level, cls, gold, revive, x, y });
        if (id === this.id) continue;
        const v = old.get(id) ?? { id, name, color, role, x, y, z, ang, pitch, vx, vy, slot, dashT, crouching: false, slideT, swingT, heavy: false, aiming: false, pounding: false, hp, hpMax, state, traitor, canvas: null } as RemoteView;
        Object.assign(v, { level, cls, title: title ?? "", name, color, role, pitch, slot, dashT, crouching: !!crouching, slideT, swingT, heavy: !!heavy, aiming: !!aiming, pounding: !!pounding, hp, hpMax, state, traitor });
        if (!this.remoteT.has(id) || performance.now() - this.fastAt > 400) { Object.assign(v, { ang, vx, vy }); let t = this.remoteT.get(id); if (!t) { t = new Track(); this.remoteT.set(id, t); } t.push(s.t, x, y, z); }
        remotes.push(v);
      }
      const before = new Map(this.standings.map(x => [x.id, x.score]));
      for (const x of st) { const b = before.get(x.id); if (b !== undefined && x.score !== b) this.scoreFx.set(x.id, { delta: x.score - b + (this.scoreFx.get(x.id) && performance.now() - this.scoreFx.get(x.id)!.at < 1200 ? this.scoreFx.get(x.id)!.delta : 0), at: performance.now() }); }
      G.remotes = remotes; this.standings = st.sort((a, b) => b.score - a.score);
    }
    if (s.snd) for (const k of s.snd as string[]) g.onSound(k as never);
    // Botín decidido por el servidor: la wiki y el arsenal lo registran igual que en solitario.
    if (s.fd) for (const w of s.fd as Parameters<typeof g.onFind>[0][]) { try { g.onFind(w); } catch { /* wiki opcional */ } }
    if (s.feed) for (const [kind, text] of s.feed as [string, string][]) this.pushFeed(kind, text);
    if (s.mk) G.netMarks = s.mk as NetMark[];
    if (s.ev) this.ev = s.ev as EventState;
    if (!this.ready && Number.isFinite(this.me.x) && G.melee) { this.ready = true; g.mode = "play"; g.onUI(); }
    if (this.ready && g.mode === "title") g.mode = "play";
    this.emit();
  }
}

export const mp = new NetSession();
if (typeof window !== "undefined" && import.meta.env.DEV) (window as unknown as { __mp: NetSession }).__mp = mp;
