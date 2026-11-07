/**
 * Simulación autoritativa de una EXPEDICIÓN COMPARTIDA: una sola partida del motor (`Game`) para el mundo
 * y un contexto por jugador que se carga antes de simular su turno. Los enemigos se reparten por cercanía:
 * cada enemigo sólo actúa en el turno de su jugador objetivo. Toda recompensa, daño, robo y evento se
 * decide aquí; los clientes sólo envían entradas y peticiones de acción validadas.
 */
import { meleeReachesBody, sweptProjectileHits } from "../hitbox";
import { LOW_PROFILE, BODY_HEIGHT } from "../world-rules";
import { playerGlow } from "./glow";
import { questSchema } from "../quests";
import { Game, emptyInput, type Input } from "../engine";
import { CLASSES } from "../data";
import { regionEnemies } from "../regions";
import { getDifficulty } from "../difficulty";
import { onBeat } from "../beat";
import BELL_BEATS from "./bell-beats.json";
import { captureCtx, loadCtx, saveOnce, restoreOnce, worldKeys, ENEMY_SKIP, PICKUP_SKIP, PLAYER_KEYS, CLIENT_KEEP } from "./split";
import { toPlain, diffEntities, diffKeys } from "./wire";
import {
  MP, MODES, ROLES, emptyStats, mpMerits, mpTitle, newMidTitles, MID_TITLE_BONUS, mpXpMult, podium, stealAmount, killLoot, duelPenalty, pvpDamage, weaponHit, isBehind, reviveTime,
  CONTRACT_TEXT, CONTRACT_REWARD, timeBonus, type MpStats, type Role, type RuleMode, type ContractKind,
} from "./rules";
import type { NetMark } from "./view";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
export interface ViewBasis { fx: number; fy: number; rx: number; ry: number }
export interface NetInput extends Input { ang: number; pitch: number; vb?: ViewBasis | null }
export type PState = "alive" | "downed" | "dead" | "extracted" | "gone";
export interface FeedItem { n: number; t: number; kind: "event" | "betrayal" | "combat" | "info" | "duel" | "loot" | "contract" | "title"; text: string; to?: string | undefined }
export interface Pending { dmg?: number; heal?: number; src: string; from?: string; absorbed?: boolean; duel?: boolean }
export interface Contract { kind: ContractKind; target?: string | undefined; text: string; done: boolean; progress: number }

export interface SimPlayer {
  id: string; userId: string; name: string; clsId: string; subclassId: string; role: Role; role2: Role | ""; color: string; glowSalt: number;
  ctx: Any; storage: Map<string, string>;
  input: NetInput; latch: Partial<Record<keyof Input, boolean>>; prevInteract: boolean;
  state: PState; downT: number; reviveT: number; lastHitBy: string; lastHitT: number;
  stats: MpStats; pending: Pending[]; sounds: string[]; traitor: number; stealCd: number; connected: boolean;
  contract: Contract | null; extractedAt: number; floorStolen: number; vaultItem?: Any | null; vb: ViewBasis | null;
  /** Última entrada recibida / aplicada (número de secuencia del cliente) para la predicción. */
  ackIn: number; ack: number;
  /** Títulos ganados en plena partida (ids de MID_TITLES). */ titles?: Set<string>; titleName?: string;
  /** Armas que el servidor le dio (botín validado); viajan una vez a su cliente para la wiki y el arsenal. */ finds?: NetFind[];
}
/** Arma encontrada, recortada a lo que necesitan la wiki y el arsenal del cliente. */
export interface NetFind { name: string; rarity: number; affixes: string[]; base: { type: string } }
/** Recorta un arma del motor para enviarla al cliente (sin estadísticas manipulables). */
export function netFind(w: Any): NetFind | null {
  const type = w?.base?.type ?? w?.type; if (!w || typeof w.name !== "string" || typeof type !== "string") return null;
  return { name: w.name.slice(0, 80), rarity: Math.max(0, Math.min(5, Number(w.rarity) || 0)), affixes: Array.isArray(w.affixes) ? (w.affixes as unknown[]).filter((a): a is string => typeof a === "string").slice(0, 6) : [], base: { type: type.slice(0, 40) } };
}
export interface SimOptions { mode: RuleMode; difficulty: string; seed?: number; maxFloors?: number }
export interface Duel { item: Any; joinUntil: number; duelists: string[]; active: boolean; endsAt: number; x: number; y: number }
export interface Vote { id: string; text: string; until: number; yes: Set<string>; no: Set<string> }
export interface FinalRow { id: string; userId: string; name: string; clsId: string; role: Role; role2: Role | ""; score: number; engineScore: number; merits: number; stats: MpStats; title: { name: string; meaning: string }; place: number; gold: number; outcome: PState; items: Any[] }

/** Colores de silueta muy distintos entre sí (tono separado ≥ 45°) y brillantes sobre fondos oscuros. */
export const COLORS = ["#00e5ff", "#39ff14", "#ffea00", "#ff2bd6", "#ff6d00", "#b388ff", "#ff1744", "#ffffff"];
const RPC = new Set(["use", "equip", "sell", "buy", "craft", "smith", "learn", "raiseAttr", "pickSkill", "choose", "activatePact"]);
export const RPC_METHODS = [...RPC];
const ME_KEYS = PLAYER_KEYS.filter(k => !CLIENT_KEEP.has(k));
const SONG = (BELL_BEATS as { duration: number; beats: number[] });

/** localStorage aislado por jugador (el motor guarda progreso local; en el servidor no debe mezclarse). */
export function useStorage(map: Map<string, string>) {
  const ls = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { const s = String(v); if (s.length > 60000) return; if (map.size < 300 || map.has(k)) map.set(k, s); },
    removeItem: (k: string) => { map.delete(k); }, clear: () => map.clear(), key: (i: number) => [...map.keys()][i] ?? null, get length() { return map.size; },
  };
  Object.defineProperty(globalThis, "localStorage", { value: ls, configurable: true, writable: true });
}

let FEED_N = 0;
export class ExpeditionSim {
  game: Game; g: Any; players = new Map<string, SimPlayer>(); order: string[] = [];
  mode: RuleMode; difficulty: string; maxFloors: number;
  phase: "lobby" | "play" | "interlude" | "over" = "lobby"; outcome: "" | "victory" | "defeat" = "";
  clock = 0; tick = 0; floorClock = 0; interT = 0; extractT = -1; seed: number; startedAt = 0;
  feed: FeedItem[] = []; marks: NetMark[] = []; duel: Duel | null = null; vote: Vote | null = null;
  eventT = 80; duelT = 90; evacUntil = 0; teamPot = 0; sealedChest: Any | null = null;
  cur: SimPlayer | null = null; private nextPid = 1; private worldJson = new Map<string, string>(); private worldJsonTick = -1;
  floorResults: { floor: number; rows: { id: string; name: string; score: number; state: PState }[] } | null = null;
  final: FinalRow[] | null = null; songStart = 0;
  private applying = false; private rand: () => number;

  constructor(opts: SimOptions) {
    this.mode = opts.mode; this.difficulty = opts.difficulty; this.maxFloors = opts.maxFloors ?? MP.floors;
    this.seed = (opts.seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0 || 1;
    let a = this.seed ^ 0x9e3779b9; this.rand = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    useStorage(new Map());
    this.game = new Game(); this.g = this.game as unknown as Any;
    const g = this.g;
    g.onUI = () => {}; g.onRunEnd = () => {}; g.onFloorEnd = () => {}; g.onSave = () => {}; g.onFind = () => {}; g.onMusic = () => {};
    g.saveRun = () => {}; g.endRun = () => {};
    g.beatCheck = () => g.floor === 1 && onBeat(SONG.beats, this.songTime());
    g.onSound = (s: string) => { const p = this.cur; if (!p) return; if (p.sounds.length < 40) p.sounds.push(s);
      if (s === "loot") p.stats.valuables += 1; else if (s === "lootRare") p.stats.valuables += 2; else if (s === "lootEpic") p.stats.valuables += 4;
      else if (s === "pickup" || s === "coin" || s === "resource") p.stats.resources += 1; };
    this.installHooks();
  }

  /** Posición dentro de la canción del piso 1 (s), común a todos los jugadores. */
  songTime() { return ((this.clock - this.songStart) % SONG.duration + SONG.duration) % SONG.duration; }

  // ───────────────────────── jugadores ─────────────────────────
  addPlayer(id: string, userId: string, name: string) {
    const p: SimPlayer = { id, userId, name: name.slice(0, 24) || "Desconocido", clsId: CLASSES[0]!.id, subclassId: "", role: "dano", role2: "", color: "#ffffff", glowSalt: Math.random(),
      ctx: {}, storage: new Map(), input: { ...emptyInput(), ang: 0, pitch: 0 }, latch: {}, prevInteract: false,
      state: "alive", downT: 0, reviveT: 0, lastHitBy: "", lastHitT: -99, stats: emptyStats(), pending: [], sounds: [], traitor: 0, stealCd: 0,
      connected: true, contract: null, extractedAt: 0, floorStolen: 0, vaultItem: null, vb: null, ackIn: 0, ack: 0 };
    this.players.set(id, p); this.order.push(id); p.color = this.pickColor(p); return p;
  }
  removePlayer(id: string) { const p = this.players.get(id); if (!p) return; if (this.phase === "lobby") { this.players.delete(id); this.order = this.order.filter(x => x !== id); return; } p.state = "gone"; p.connected = false; this.post("info", `${p.name} abandonó la expedición.`); }
  configure(id: string, cfg: { clsId?: string; subclassId?: string; role?: Role; role2?: Role | "" }) {
    const p = this.players.get(id); if (!p || this.phase !== "lobby") return;
    if (cfg.clsId && CLASSES.some(c => c.id === cfg.clsId)) p.clsId = cfg.clsId;
    if (typeof cfg.subclassId === "string") p.subclassId = cfg.subclassId.slice(0, 40);
    if (cfg.role && cfg.role in ROLES) p.role = cfg.role;
    if (cfg.role2 === "" || (cfg.role2 && cfg.role2 in ROLES)) p.role2 = cfg.role2 === p.role ? "" : cfg.role2;
    p.color = this.pickColor(p);
  }
  private makeCtx(p: SimPlayer) {
    useStorage(p.storage);
    const t = new Game(); const tg = t as unknown as Any; tg.onUI = () => {}; tg.onSound = () => {}; tg.onMusic = () => {};
    const cls = CLASSES.find(c => c.id === p.clsId) ?? CLASSES[0]!;
    t.start(cls, this.difficulty, false, p.subclassId); tg.runName = p.name;
    p.ctx = captureCtx(t, {});
    if (p.vaultItem) { (p.ctx["bag"] as Any[]).push(p.vaultItem); }
    p.ctx["mode"] = "play";
  }

  // ───────────────────────── inicio y pisos ─────────────────────────
  start() {
    if (this.phase !== "lobby") return;
    const g = this.g; useStorage(new Map());
    const host = this.players.get(this.order[0] ?? "");
    g.start(CLASSES.find(c => c.id === host?.clsId) ?? CLASSES[0]!, this.difficulty);
    for (const p of this.players.values()) this.makeCtx(p);
    this.phase = "play"; this.startedAt = this.clock; this.songStart = this.clock;
    this.buildFloor(1);
    this.post("info", `Expedición ${MODES[this.mode].name.toUpperCase()} iniciada con ${this.players.size} jugadores.`);
  }
  private buildFloor(n: number) {
    const g = this.g, primary = this.alivePlayers()[0] ?? [...this.players.values()][0];
    if (!primary) return;
    this.cur = primary; useStorage(primary.storage); loadCtx(g, primary.ctx);
    g.floor = n; g.floorSeed = (this.seed + n * 7919) >>> 0 || 1; g.genFloor(true);
    const sx = g.px as number, sy = g.py as number, sa = g.ang as number; captureCtx(g, primary.ctx); this.cur = null;
    let pid = 1; for (const pk of g.pickups as Any[]) pk.netId = pid++; this.nextPid = pid;
    let i = 0;
    for (const p of this.players.values()) {
      if (p.state === "gone") continue;
      const c = p.ctx; const off = this.spawnOffset(sx, sy, i++);
      c["px"] = off.x; c["py"] = off.y; c["pz"] = g.floorHeight(off.x, off.y); c["ang"] = sa; c["safeX"] = off.x; c["safeY"] = off.y; c["vx"] = c["vy"] = c["vz"] = 0;
      if (p !== primary) (c["score"] as Any)?.newFloor?.();
      if (p.state === "dead" || p.state === "downed" || (c["hp"] as number) <= 0) c["hp"] = Math.max(1, Math.round((c["hpMax"] as number) * .5));
      p.state = "alive"; p.downT = p.reviveT = 0; c["mode"] = "play"; c["recap"] = null; c["choice"] = null; p.extractedAt = 0; p.floorStolen = 0; p.pending = [];
    }
    this.floorClock = 0; this.extractT = -1; this.marks = []; this.duel = null; this.vote = null; this.sealedChest = null;
    this.eventT = 70 + this.rand() * 40; this.duelT = 60 + this.rand() * 90; this.evacUntil = 0;
    this.teamPot = 40 * n * Math.max(2, this.players.size);
    if (MODES[this.mode].sabotage) this.placeSabotage();
    if (MODES[this.mode].contracts) this.assignContracts();
    this.worldJsonTick = -1;
  }
  private spawnOffset(x: number, y: number, i: number) {
    const g = this.g; if (i === 0) return { x, y };
    for (let r = .7; r < 3; r += .35) for (let k = 0; k < 8; k++) { const a = (i * 1.7 + k * Math.PI / 4), nx = x + Math.cos(a) * r, ny = y + Math.sin(a) * r; if (!g.solid(nx, ny) && !g.solid(nx + .2, ny) && !g.solid(nx - .2, ny) && !g.solid(nx, ny + .2) && !g.solid(nx, ny - .2)) return { x: nx, y: ny }; }
    return { x, y };
  }
  /** Celda libre lejos de (x,y) para palancas, altar o evacuación. */
  private freeCell(minDist: number, from = { x: this.g.px as number, y: this.g.py as number }) {
    const g = this.g;
    for (let tries = 0; tries < 400; tries++) {
      const room = (g.rooms as Any[])[Math.floor(this.rand() * g.rooms.length)]; if (!room) break;
      const x = room.x + 1 + this.rand() * Math.max(1, room.w - 2), y = room.y + 1 + this.rand() * Math.max(1, room.h - 2);
      if (g.solid(x, y) || Math.hypot(x - from.x, y - from.y) < minDist) continue;
      if (g.restRoom && x >= g.restRoom.x && x < g.restRoom.x + g.restRoom.w && y >= g.restRoom.y && y < g.restRoom.y + g.restRoom.h) continue;
      return { x, y };
    }
    return null;
  }
  private placeSabotage() {
    const spawn = this.spawnPoint();
    for (let i = 0; i < 2; i++) { const c = this.freeCell(8, spawn); if (c) this.marks.push({ id: `lever${i}`, kind: "lever", x: c.x, y: c.y, label: "PALANCA · trampa para todos", color: "#ff7a4a" }); }
    const a = this.freeCell(10, spawn); if (a) this.marks.push({ id: "greed", kind: "greed", x: a.x, y: a.y, label: `ALTAR DE LA CODICIA · ${this.teamPot} fichas del grupo`, color: "#ffd34a" });
    const chests = (this.g.pickups as Any[]).filter(p => p.kind === "chest" && !p.used && Math.hypot(p.x - spawn.x, p.y - spawn.y) > 6);
    const ch = chests[Math.floor(this.rand() * chests.length)];
    if (ch) { this.sealedChest = ch; this.marks.push({ id: "sealed", kind: "ambushChest", x: ch.x, y: ch.y, label: "COFRE SELLADO · botín para uno, emboscada para todos", color: "#ff4a8a" }); }
  }
  private assignContracts() {
    const ids = this.alivePlayers().map(p => p.id);
    for (const p of this.alivePlayers()) {
      const kinds: ContractKind[] = ["firstOut", "steal", "lever", "greed"]; if (ids.length > 1) kinds.push("kill", "kill");
      const kind = kinds[Math.floor(this.rand() * kinds.length)]!;
      const others = ids.filter(x => x !== p.id), target = kind === "kill" ? others[Math.floor(this.rand() * others.length)] : undefined;
      const tName = target ? this.players.get(target)?.name ?? "" : "";
      const contract: Contract = { kind, target, text: CONTRACT_TEXT[kind].replace("{target}", tName), done: false, progress: 0 }; p.contract = contract;
      this.post("contract", `CONTRATO SECRETO: ${contract.text} (+${CONTRACT_REWARD.gold} fichas)`, p.id);
    }
  }
  private completeContract(p: SimPlayer, kind: ContractKind, target?: string) {
    const c = p.contract; if (!c || c.done || c.kind !== kind || (c.target && c.target !== target)) return;
    c.done = true; p.stats.contracts++; p.ctx["gold"] = (p.ctx["gold"] as number) + CONTRACT_REWARD.gold;
    this.post("contract", `Contrato cumplido: +${CONTRACT_REWARD.gold} fichas.`, p.id);
  }
  spawnPoint() { const p = this.alivePlayers()[0]; return p ? { x: p.ctx["px"] as number, y: p.ctx["py"] as number } : { x: this.g.px as number, y: this.g.py as number }; }
  alivePlayers() { return [...this.players.values()].filter(p => p.state === "alive"); }
  post(kind: FeedItem["kind"], text: string, to?: string) { this.feed.push({ n: ++FEED_N, t: this.clock, kind, text, to }); if (this.feed.length > 200) this.feed.splice(0, this.feed.length - 200); }

  // ───────────────────────── ganchos del motor ─────────────────────────
  private installHooks() {
    const g = this.g;
    const damageEnemy = g.damageEnemy.bind(g), hurtPlayer = g.hurtPlayer.bind(g), use = g.use.bind(g), track = g.track.bind(g);
    g.damageEnemy = (e: Any, dmg: number, brk: number, hit?: Any) => {
      const p = this.cur; if (!p) return damageEnemy(e, dmg, brk, hit);
      if (p.role === "dano" || p.role2 === "dano") dmg = Math.round(dmg * 1.1);
      const hp0 = e.hp, dead0 = e.dead, st0 = e.stagger ?? 0;
      const r = damageEnemy(e, dmg, brk, hit);
      p.stats.damage += Math.max(0, Math.min(hp0, hp0 - Math.max(0, e.hp)));
      if (st0 <= 0 && (e.stagger ?? 0) > 0) { p.stats.controls++; if (p.role === "control" || p.role2 === "control") e.stun = Math.max(e.stun ?? 0, .6); }
      if (!dead0 && e.dead) { p.stats.kills++; if (e.kind === "librero" || e.miniBoss) p.stats.objectives++; }
      return r;
    };
    g.hurtPlayer = (dmg: number, src: string, crit = false, from?: Any) => {
      const p = this.cur; if (!p || this.applying) return hurtPlayer(dmg, src, crit, from);
      const tank = this.alivePlayers().find(q => q !== p && (q.role === "tanque" || q.role2 === "tanque") && Math.hypot((q.ctx["px"] as number) - g.px, (q.ctx["py"] as number) - g.py) < MP.tankRange);
      if (tank && dmg > 1) { const share = Math.round(dmg * MP.tankShare); dmg -= share; tank.pending.push({ dmg: share, src: `proteger a ${p.name}`, absorbed: true }); }
      const hp0 = g.hp, guard = g.blocking || g.parryT > 0;
      const r = hurtPlayer(dmg, src, crit, from); const lost = Math.max(0, hp0 - g.hp);
      p.stats.taken += lost; if (guard) p.stats.absorbed += Math.max(0, dmg - lost);
      return r;
    };
    g.use = (id: string) => {
      const p = this.cur, hp0 = g.hp; const r = use(id); if (!p) return r;
      const gain = Math.max(0, g.hp - hp0); p.stats.healing += Math.round(gain * .3);
      if (gain > 0 && (p.role === "soporte" || p.role2 === "soporte")) for (const q of this.alivePlayers()) {
        if (q === p || Math.hypot((q.ctx["px"] as number) - g.px, (q.ctx["py"] as number) - g.py) > MP.supportRange) continue;
        const heal = Math.round(gain * MP.supportHealShare); q.pending.push({ heal, src: p.name }); p.stats.healing += heal;
      }
      return r;
    };
    g.onFind = (w: Any) => {
      const p = this.cur; const f = netFind(w); if (!p || !f) return;
      (p.finds ??= []).push(f); if (p.finds.length > 20) p.finds.shift();
      if (f.rarity >= 3) this.post("loot", `${p.name} obtuvo ${f.name}.`);
    };
    const gainXp = g.gainXp.bind(g);
    g.gainXp = (n: number, ...rest: unknown[]) => {
      const p = this.cur; const lv = [...this.players.values()].filter(q => q.state !== "gone").map(q => q === p ? (g.level as number) : ((q.ctx["level"] as number) ?? 1));
      return gainXp(p ? Math.round(n * mpXpMult(g.level as number, lv)) : n, ...rest);
    };
    g.track = (kind: string, amount = 1, ...rest: unknown[]) => {
      const p = this.cur;
      if (p) { if (kind === "secrets") p.stats.secrets += amount; else if (["puzzles", "bosses", "maps", "documents", "mechanisms"].includes(kind)) p.stats.objectives += amount; else if (kind === "chests") p.stats.resources += amount; }
      return track(kind, amount, ...rest);
    };
  }

  // ───────────────────────── entradas ─────────────────────────
  setInput(id: string, inp: Partial<NetInput>) {
    const p = this.players.get(id); if (!p) return;
    const n = p.input as unknown as Any;
    for (const k of Object.keys(emptyInput()) as (keyof Input)[]) {
      const v = (inp as Any)[k];
      if (typeof v === "boolean") { n[k] = v; if (v) p.latch[k] = true; }
      else if (typeof v === "number" && Number.isFinite(v)) n[k] = Math.max(-1.5, Math.min(1.5, v));
    }
    if (typeof inp.ang === "number" && Number.isFinite(inp.ang)) p.input.ang = Math.atan2(Math.sin(inp.ang), Math.cos(inp.ang));
    if (typeof inp.pitch === "number" && Number.isFinite(inp.pitch)) p.input.pitch = Math.max(-1.2, Math.min(1.2, inp.pitch));
    const q = (inp as Any).q; if (typeof q === "number" && Number.isInteger(q) && q > p.ackIn) p.ackIn = q;
    const vb = inp.vb; if (vb === null) p.vb = null;
    else if (vb && [vb.fx, vb.fy, vb.rx, vb.ry].every(v => typeof v === "number" && Number.isFinite(v))) { const fl = Math.hypot(vb.fx, vb.fy) || 1, rl = Math.hypot(vb.rx, vb.ry) || 1; p.vb = { fx: vb.fx / fl, fy: vb.fy / fl, rx: vb.rx / rl, ry: vb.ry / rl }; }
  }
  /** Intercambio: dar fichas o un objeto de la mochila a un jugador cercano. */
  give(id: string, to: string, what: { gold?: number; uid?: number }) {
    const p = this.players.get(id), q = this.players.get(to);
    if (!p || !q || p === q || this.phase !== "play" || p.state !== "alive" || q.state !== "alive") return false;
    if (Math.hypot((p.ctx["px"] as number) - (q.ctx["px"] as number), (p.ctx["py"] as number) - (q.ctx["py"] as number)) > 3) return false;
    if (typeof what.gold === "number" && Number.isInteger(what.gold) && what.gold > 0) {
      const n = Math.min(Math.floor(p.ctx["gold"] as number), what.gold); if (n <= 0) return false;
      p.ctx["gold"] = (p.ctx["gold"] as number) - n; q.ctx["gold"] = (q.ctx["gold"] as number) + n;
      this.post("loot", `${p.name} entregó ${n} fichas a ${q.name}.`); return true;
    }
    if (typeof what.uid === "number") {
      const bag = p.ctx["bag"] as Any[]; const i = bag.findIndex(it => it.uid === what.uid); if (i < 0) return false;
      const qb = q.ctx["bag"] as Any[]; if (qb.length >= 40) return false;
      const [it] = bag.splice(i, 1); qb.push(it); this.post("loot", `${p.name} entregó ${it.name} a ${q.name}.`); return true;
    }
    return false;
  }
  /** Acción de menú (usar, equipar, comprar, elegir…): se ejecuta en el contexto del jugador si está permitida. */
  rpc(id: string, method: string, args: unknown[]) {
    const p = this.players.get(id); if (!p || this.phase !== "play" || !RPC.has(method) || !Array.isArray(args) || args.length > 3) return false;
    if (p.state !== "alive") return false;
    const a = args; if (a.some(x => x !== undefined && typeof x !== "number" && typeof x !== "string")) return false;
    if (method === "choose" && (p.ctx["mode"] !== "choice" || typeof a[0] !== "number")) return false;
    const g = this.g; this.cur = p; useStorage(p.storage); loadCtx(g, p.ctx);
    try { (g[method] as (...x: unknown[]) => unknown)(...a); } catch (e) { console.error("[rpc]", method, e); }
    captureCtx(g, p.ctx); this.cur = null; return true;
  }
  /** Encargo del mercader generado por IA: el servidor valida la forma y fija la recompensa por el nivel real. */
  acceptQuest(id: string, raw: unknown) {
    const p = this.players.get(id); if (!p || this.phase !== "play" || p.state !== "alive") return false;
    const r = questSchema.safeParse(raw); if (!r.success) return false;
    const g = this.g; this.cur = p; useStorage(p.storage); loadCtx(g, p.ctx);
    try { g.acceptQuest(r.data, Math.max(1, Math.floor(Number(p.ctx["level"]) || 1))); } catch (e) { console.error("[quest]", e); }
    captureCtx(g, p.ctx); this.cur = null; return true;
  }
  castVote(id: string, yes: boolean) { const v = this.vote, p = this.players.get(id); if (!v || !p || p.state === "gone") return; v.yes.delete(id); v.no.delete(id); (yes ? v.yes : v.no).add(id); }

  // ───────────────────────── tick ─────────────────────────
  step(dt: number) {
    this.clock += dt; this.tick++;
    if (this.phase === "interlude") { this.interT -= dt; if (this.interT <= 0) this.nextFloor(); return; }
    if (this.phase !== "play") return;
    const g = this.g; this.floorClock += dt;
    const alive = this.alivePlayers();
    // Reparto de enemigos: el más cercano, con histéresis para que no oscilen.
    for (const e of g.enemies as Any[]) {
      if (e.dead) continue;
      let best: SimPlayer | null = null, bd = Infinity; const cur = e.netOwner ? this.players.get(e.netOwner) : null;
      for (const p of alive) { const d = Math.hypot((p.ctx["px"] as number) - e.x, (p.ctx["py"] as number) - e.y); if (d < bd) { bd = d; best = p; } }
      if (cur && cur.state === "alive" && best && best !== cur) { const dc = Math.hypot((cur.ctx["px"] as number) - e.x, (cur.ctx["py"] as number) - e.y); if (dc < bd + 1.5) best = cur; }
      e.netOwner = best?.id ?? "";
    }
    const turn = alive.length ? this.tick % alive.length : 0;
    const order = [...alive.slice(turn), ...alive.slice(0, turn)];
    let projs = g.projs as Any[]; let first = true;
    const aliveIds = new Set(order.map(p => p.id));
    for (const pr of projs) if (!aliveIds.has(pr.netOwner)) pr.netOwner = order[0]?.id ?? "";
    for (const p of order) {
      p.ack = p.ackIn;
      this.cur = p; useStorage(p.storage); loadCtx(g, p.ctx);
      for (const e of g.enemies as Any[]) e.netSkip = !!e.netOwner && e.netOwner !== p.id;
      const mine: Any[] = [], others: Any[] = []; for (const pr of projs) (pr.netOwner === p.id ? mine : others).push(pr); g.projs = mine;
      const once = first ? null : saveOnce(g); first = false;
      this.applyPending(p);
      const inp = this.prepInput(p, dt);
      const swing0 = g.swingT as number, sealed0 = this.sealedChest?.used;
      try { g.update(dt, inp); } catch (err) { console.error("[sim]", err); }
      if (once) restoreOnce(g, once);
      for (const pr of g.projs as Any[]) pr.netOwner ??= p.id;
      for (const e of g.enemies as Any[]) if (e.netOwner === undefined) e.netOwner = p.id;
      this.pvpProjectiles(p, g.projs);
      if ((g.swingT as number) > 0 && swing0 <= 0 && g.slot === 0) this.pvpMelee(p);
      if (this.sealedChest && !sealed0 && this.sealedChest.used) this.openSealed(p);
      projs = [...others, ...(g.projs as Any[])];
      captureCtx(g, p.ctx); this.postStep(p);
    }
    g.projs = projs; for (const e of g.enemies as Any[]) e.netSkip = false;
    for (const pk of g.pickups as Any[]) if (!pk.netId) pk.netId = this.nextPid++;
    this.cur = null;
    for (const p of this.players.values()) {
      p.stealCd = Math.max(0, p.stealCd - dt); p.latch = {};
      if (p.state === "alive" || p.state === "downed") p.stats.seconds += dt;
      if (p.state === "downed") { p.downT -= dt; if (p.downT <= 0) { p.state = "dead"; this.post("combat", `${p.name} se desvanece: volverá en el próximo piso.`); } }
    }
    if (this.tick % 10 === 0) this.checkTitles();
    this.tickEvents(dt);
    this.checkFloorEnd(dt);
  }
  /** Color aleatorio que ningún otro jugador de la sala tiene. */
  /** Color por clase, subclase, nombre y roles con algo de azar, separado del de los demás. */
  pickColor(p: SimPlayer) { const others = [...this.players.values()].filter(q => q !== p && q.state !== "gone").map(q => q.color); return playerGlow({ clsId: p.clsId, subclassId: p.subclassId, name: p.name, role: p.role, role2: p.role2, salt: p.glowSalt }, others); }
  /** Aviso general + sonido + bono cuando alguien gana un título por sus acciones. */
  checkTitles() {
    for (const p of this.players.values()) {
      const owned = p.titles ??= new Set();
      for (const t of newMidTitles(p.stats, owned)) {
        owned.add(t.id); p.stats.titles++; p.titleName = t.name;
        this.post("title", `${p.name} obtuvo el título «${t.name}» (${t.meaning}) · +${MID_TITLE_BONUS} puntos`);
        for (const q of this.players.values()) if (q.sounds.length < 40) q.sounds.push("level");
      }
    }
  }
  private prepInput(p: SimPlayer, dt: number): Input {
    const g = this.g, inp: Any = { ...p.input };
    for (const k of Object.keys(p.latch)) inp[k] = true;
    g.ang = p.input.ang; g.pitch = p.input.pitch; g.lookPendingX = g.lookPendingY = 0; inp.lookX = inp.lookY = 0;
    g.viewBasis = p.vb; if (g.camera) g.camera.mode = p.vb ? "shoulder" : "fp";
    const px = g.px as number, py = g.py as number, held = !!p.input.interact, edge = !!inp.interact && !p.prevInteract;
    p.prevInteract = !!inp.interact;
    // 1) Levantar a un aliado caído (mantener E).
    const down = [...this.players.values()].find(q => q.state === "downed" && Math.hypot((q.ctx["px"] as number) - px, (q.ctx["py"] as number) - py) < MP.reviveRange);
    if (down && (held || inp.interact)) {
      down.reviveT += dt; inp.interact = false;
      if (down.reviveT >= reviveTime(p.role, p.role2)) {
        down.state = "alive"; down.reviveT = 0; down.ctx["hp"] = Math.max(1, Math.round((down.ctx["hpMax"] as number) * MP.reviveHp)); down.ctx["mode"] = "play";
        p.stats.revives++; this.post("event", `${p.name} levantó a ${down.name}.`);
      }
      return inp as Input;
    }
    if (!edge) return inp as Input;
    // 2) Marcas del servidor (palanca, altar, duelo, evacuación).
    const mark = this.marks.find(m => !m.used && Math.hypot(m.x - px, m.y - py) < 1.4 && m.kind !== "ambushChest");
    if (mark) { inp.interact = false; this.useMark(p, mark); return inp as Input; }
    // 3) Robo por la espalda.
    if (MODES[this.mode].steal && p.stealCd <= 0) {
      const victim = this.alivePlayers().find(q => q !== p && Math.hypot((q.ctx["px"] as number) - px, (q.ctx["py"] as number) - py) < MP.stealRange && isBehind(px, py, q.ctx["px"] as number, q.ctx["py"] as number, q.ctx["ang"] as number) && !q.ctx["blocking"] && !this.inRefuge(q));
      if (victim && !g.focusPickup?.()) {
        const n = stealAmount(victim.ctx["gold"] as number);
        if (n > 0) {
          inp.interact = false; p.stealCd = MP.stealCd; victim.ctx["gold"] = (victim.ctx["gold"] as number) - n; g.gold = (g.gold as number) + n;
          p.stats.stolen += n; p.stats.betrayals++; p.traitor++; p.floorStolen += n;
          this.post("betrayal", `${p.name} le robó ${n} fichas a ${victim.name} por la espalda.`);
          if (p.floorStolen >= 30) this.completeContract(p, "steal");
        }
      }
    }
    return inp as Input;
  }
  private applyPending(p: SimPlayer) {
    if (!p.pending.length) return;
    const g = this.g, list = p.pending; p.pending = [];
    for (const it of list) {
      if (it.heal) { g.hp = Math.min(g.hpMax, g.hp + it.heal); g.float(`+${it.heal} · ${it.src}`, "#7affc1"); continue; }
      if (!it.dmg) continue;
      let dmg = it.dmg;
      if (it.duel) dmg = Math.min(dmg, Math.max(0, g.hp - 1));
      if (it.absorbed) { p.stats.absorbed += dmg; dmg = Math.round(dmg * .6); }
      if (dmg <= 0) continue;
      const src = it.from ? `${it.src} (jugador)` : it.src;
      const from = it.from ? this.players.get(it.from) : null;
      this.applying = true; try { g.hurtPlayer(dmg, src, false, from ? { x: from.ctx["px"], y: from.ctx["py"] } : undefined); } finally { this.applying = false; }
      if (it.from) { p.lastHitBy = it.from; p.lastHitT = this.clock; }
      if (it.duel && this.duel?.active && g.hp <= g.hpMax * MP.duelLoseHp) this.duelOut(p, "cae en el duelo");
    }
  }
  /** El refugio es un santuario: nadie puede herir ni robar a quien está dentro. */
  inRefuge(p: SimPlayer) {
    const r = this.g.restRoom as { x: number; y: number; w: number; h: number } | null; if (!r) return false;
    const x = p.ctx["px"] as number, y = p.ctx["py"] as number; return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  }
  private canHurt(a: SimPlayer, b: SimPlayer) {
    const d = this.duel; const duel = !!d?.active && d.duelists.includes(a.id) && d.duelists.includes(b.id);
    return { ok: duel || (MODES[this.mode].pvp && !this.inRefuge(b)), duel };
  }
  private pvpMelee(p: SimPlayer) {
    const g = this.g, w = g.melee as Any; const reach = (w?.base?.range ?? 1.6) + .3;
    for (const q of this.alivePlayers()) {
      if (q === p) continue; const { ok, duel } = this.canHurt(p, q); if (!ok) continue;
      const dx = (q.ctx["px"] as number) - g.px, dy = (q.ctx["py"] as number) - g.py, d = Math.hypot(dx, dy);
      if (Math.abs((q.ctx["pz"] as number) - g.pz) > .9) continue;
      const off = Math.atan2(Math.sin(Math.atan2(dy, dx) - g.ang), Math.cos(Math.atan2(dy, dx) - g.ang));
      if (!meleeReachesBody({ dist: d, attackerRadius: .16, reach: reach - .3, angleOff: off, halfArc: .55, low: !!q.ctx["crouching"] || ((q.ctx["slideT"] as number) ?? 0) > 0 })) continue;
      const dmg = pvpDamage(weaponHit(w?.base?.dice, w?.dmgMult ?? 1, g.level), this.mode, duel, g.level as number, (q.ctx["level"] as number) ?? 1) * (g.attackAlternate ? 1.5 : 1);
      if (dmg > 0) { q.pending.push({ dmg: Math.round(dmg), src: p.name, from: p.id, duel }); this.post("combat", `${p.name} golpea a ${q.name}${duel ? " (duelo)" : ""}.`); }
    }
  }
  private pvpProjectiles(p: SimPlayer, projs: Any[]) {
    for (const pr of projs) {
      if (!pr.friendly || pr.life <= 0 || pr.netOwner !== p.id) continue;
      for (const q of this.alivePlayers()) {
        if (q === p) continue; const { ok, duel } = this.canHurt(p, q); if (!ok) continue;
        const low = !!q.ctx["crouching"] || ((q.ctx["slideT"] as number) ?? 0) > 0, step = 1 / 20;
        if (!sweptProjectileHits(low, q.ctx["pz"] as number, low ? LOW_PROFILE.height : BODY_HEIGHT, pr.x - (pr.dx ?? 0) * step, pr.y - (pr.dy ?? 0) * step, pr.z - (pr.dz ?? 0) * step, pr.x, pr.y, pr.z, q.ctx["px"] as number, q.ctx["py"] as number, Math.min(.08, (pr.size ?? .1) * .4))) continue;
        const dmg = pvpDamage(Math.max(1, Math.round(pr.dmg ?? 4)), this.mode, duel, (p.ctx["level"] as number) ?? (this.g.level as number), (q.ctx["level"] as number) ?? 1);
        if (dmg > 0) q.pending.push({ dmg, src: p.name, from: p.id, duel });
        if (!pr.pierce) pr.life = 0; break;
      }
    }
  }
  private postStep(p: SimPlayer) {
    const c = p.ctx, mode = c["mode"] as string;
    if (mode === "dead" || (c["hp"] as number) <= 0) {
      if (this.duel?.active && this.duel.duelists.includes(p.id)) this.duelOut(p, "cae en el duelo");
      p.state = "downed"; p.downT = MP.downSeconds; p.reviveT = 0; c["mode"] = "play"; c["hp"] = 0; p.stats.downs++;
      const killer = p.lastHitBy && this.clock - p.lastHitT < 4 ? this.players.get(p.lastHitBy) : null;
      if (killer && killer !== p) {
        killer.stats.pvpKills++; if (this.mode === "traicion") { killer.stats.betrayals++; killer.traitor++; }
        this.completeContract(killer, "kill", p.id);
        if (this.mode === "caos") {
          const loot = killLoot(c["gold"] as number); c["gold"] = (c["gold"] as number) - loot; killer.ctx["gold"] = (killer.ctx["gold"] as number) + loot; killer.stats.stolen += loot;
          const bag = c["bag"] as Any[]; const item = bag.length ? bag.splice(Math.floor(this.rand() * bag.length), 1)[0] : null;
          if (item) (killer.ctx["bag"] as Any[]).push(item);
          this.post("betrayal", `${killer.name} abatió a ${p.name} y le arrebató ${loot} fichas${item ? ` y ${item.name}` : ""}.`);
        } else this.post("betrayal", `${killer.name} derribó a ${p.name}.`);
      } else this.post("combat", `${p.name} ha caído. Mantén E junto a su cuerpo para levantarlo (${MP.downSeconds} s).`);
      return;
    }
    if (mode === "erased" || mode === "recap" || mode === "won") {
      if (mode === "erased") { const g = this.g; this.cur = p; loadCtx(g, c); try { g.finishFloor(); } catch { /* recuento opcional */ } captureCtx(g, c); this.cur = null; }
      p.state = "extracted"; p.extractedAt = this.floorClock;
      const firstOut = ![...this.players.values()].some(q => q !== p && q.state === "extracted");
      if (firstOut) { p.stats.firstOut++; this.completeContract(p, "firstOut"); this.extractT = 0; }
      const left = this.alivePlayers().length;
      this.post("info", `${p.name} cruzó el portal${firstOut ? " el primero" : ""}. ${left ? `Quedan ${left} dentro: el portal se cierra en ${MP.extractWait} s.` : ""}`);
    }
  }

  // ───────────────────────── marcas y eventos ─────────────────────────
  private useMark(p: SimPlayer, m: NetMark) {
    const g = this.g;
    if (m.kind === "lever") {
      m.used = true; p.stats.betrayals++; p.stats.events++; p.traitor++; const reward = 40 * g.floor; g.gold += reward;
      for (const q of this.alivePlayers()) if (q !== p && Math.hypot((q.ctx["px"] as number) - m.x, (q.ctx["py"] as number) - m.y) < MP.leverRange) q.pending.push({ dmg: Math.round(MP.leverDamage * Math.sqrt(g.floor)), src: "trampa de palanca" });
      this.post("betrayal", `${p.name} accionó una palanca: las trampas despiertan junto al grupo (+${reward} fichas para él).`);
      this.completeContract(p, "lever"); return;
    }
    if (m.kind === "greed") {
      m.used = true; const take = Math.round(this.teamPot * .6); this.teamPot = 0; g.gold += take; p.stats.betrayals++; p.stats.events++; p.traitor++;
      this.post("betrayal", `${p.name} vació el altar de la codicia: +${take} fichas. El fondo común se ha perdido.`);
      this.completeContract(p, "greed"); return;
    }
    if (m.kind === "duel" && this.duel && !this.duel.active && this.clock <= this.duel.joinUntil) {
      if (!this.duel.duelists.includes(p.id)) { this.duel.duelists.push(p.id); this.post("duel", `${p.name} reclama el arma legendaria (${this.duel.duelists.length} aspirantes).`); }
      return;
    }
    if (m.kind === "evac" && this.clock < this.evacUntil) {
      m.used = false; p.ctx["mode"] = "recap"; p.stats.events++; this.postStep(p); return;
    }
  }
  private openSealed(p: SimPlayer) {
    const g = this.g; const mark = this.marks.find(m => m.id === "sealed"); if (mark) mark.used = true;
    const bonus = 50 * g.floor; g.gold += bonus; p.stats.events++; p.stats.betrayals++; p.traitor++;
    const item = g.makeWeapon(undefined, 3); (g.bag as Any[]).push(item); p.stats.valuables += 3;
    const kinds = regionEnemies(g.floor) as string[];
    for (const q of this.alivePlayers()) { if (q === p) continue; for (let i = 0; i < 2; i++) { const a = this.rand() * 6.28; const x = (q.ctx["px"] as number) + Math.cos(a) * 3, y = (q.ctx["py"] as number) + Math.sin(a) * 3; if (!g.solid(x, y)) { g.spawn(kinds[Math.floor(this.rand() * kinds.length)], x, y); const e = (g.enemies as Any[]).at(-1); if (e) { e.aware = true; e.netOwner = q.id; } } } }
    this.sealedChest = null;
    this.post("betrayal", `${p.name} abrió el cofre sellado: se lleva ${item.name} y ${bonus} fichas… y una emboscada cae sobre los demás.`);
  }
  private tickEvents(dt: number) {
    const g = this.g;
    if (this.teamPot > 0) { const greed = this.marks.find(m => m.id === "greed"); if (greed && !greed.used) greed.label = `ALTAR DE LA CODICIA · ${this.teamPot} fichas del grupo`; }
    // Duelo por el arma legendaria en el punto de partida.
    this.duelT -= dt;
    if (!this.duel && this.duelT <= 0 && this.alivePlayers().length >= 2) {
      const s = this.spawnPoint(); const item = g.makeWeapon(undefined, 4); item.name = `${item.name} · LEGENDARIA`;
      this.duel = { item, joinUntil: this.clock + MP.duelJoin, duelists: [], active: false, endsAt: 0, x: s.x, y: s.y };
      this.marks.push({ id: "duel", kind: "duel", x: s.x, y: s.y, label: `${item.name} · E para retar`, color: "#ffef5a" });
      this.post("duel", `¡Un arma legendaria aparece donde empezasteis! Pulsa E junto a ella en ${MP.duelJoin} s para disputarla en duelo.`);
      this.duelT = 9999;
    }
    const d = this.duel;
    if (d && !d.active && this.clock > d.joinUntil) {
      const mk = this.marks.find(m => m.id === "duel");
      const ds = d.duelists.filter(id => this.players.get(id)?.state === "alive");
      if (ds.length >= 2) { d.active = true; d.duelists = ds; d.endsAt = this.clock + 60; if (mk) mk.label = "DUELO EN CURSO"; this.post("duel", `Duelo: ${ds.map(id => this.players.get(id)?.name).join(" vs ")}. El último en pie se queda el arma; los vencidos pierden fichas.`); }
      else { if (ds.length === 1) this.duelWin(this.players.get(ds[0]!)!); else this.post("duel", "Nadie reclamó el arma legendaria: la tinta la devora."); this.duel = null; if (mk) mk.used = true; }
    } else if (d?.active) {
      const ds = d.duelists.filter(id => this.players.get(id)?.state === "alive");
      if (ds.length <= 1 || this.clock > d.endsAt) {
        const best = ds.map(id => this.players.get(id)!).sort((a, b) => (b.ctx["hp"] as number) / (b.ctx["hpMax"] as number) - (a.ctx["hp"] as number) / (a.ctx["hpMax"] as number))[0];
        for (const id of d.duelists) { const q = this.players.get(id); if (q && q !== best) this.duelOut(q, "pierde el duelo", true); }
        if (best) this.duelWin(best); this.duel = null; const mk = this.marks.find(m => m.id === "duel"); if (mk) mk.used = true;
      }
    }
    // Eventos dinámicos.
    this.eventT -= dt;
    if (this.eventT <= 0 && this.alivePlayers().length) { this.eventT = 70 + this.rand() * 50; this.randomEvent(); }
    if (this.vote && this.clock > this.vote.until) this.closeVote();
    if (this.evacUntil && this.clock > this.evacUntil) { this.evacUntil = 0; const mk = this.marks.find(m => m.kind === "evac"); if (mk) mk.used = true; this.post("event", "La extracción de emergencia se ha cerrado."); }
  }
  private duelOut(p: SimPlayer, why: string, final = false) {
    const d = this.duel; if (!d) return; if (!final) d.duelists = d.duelists.filter(x => x !== p.id);
    const pen = duelPenalty(p.ctx["gold"] as number); p.ctx["gold"] = (p.ctx["gold"] as number) - pen;
    if ((p.ctx["hp"] as number) <= 0 && p.state === "alive") p.ctx["hp"] = 1;
    this.post("duel", `${p.name} ${why} y pierde ${pen} fichas.`);
  }
  private duelWin(p: SimPlayer) {
    const d = this.duel; if (!d) return; (p.ctx["bag"] as Any[]).push(d.item); p.stats.events++; p.stats.valuables += 4;
    this.post("duel", `${p.name} se queda ${d.item.name}.`);
  }
  private randomEvent() {
    const g = this.g, alive = this.alivePlayers(); const kinds = regionEnemies(g.floor) as string[];
    const roll = Math.floor(this.rand() * 5);
    if (roll === 0) { const q = alive[Math.floor(this.rand() * alive.length)]!; let n = 0; for (let i = 0; i < 4; i++) { const a = this.rand() * 6.28, x = (q.ctx["px"] as number) + Math.cos(a) * 3.5, y = (q.ctx["py"] as number) + Math.sin(a) * 3.5; if (!g.solid(x, y)) { g.spawn(kinds[Math.floor(this.rand() * kinds.length)], x, y); const e = (g.enemies as Any[]).at(-1); if (e) { e.aware = true; e.netOwner = q.id; n++; } } } this.post("event", `EMBOSCADA: ${n} criaturas rodean a ${q.name}.`); return; }
    if (roll === 1) { const c = this.freeCell(4, this.spawnPoint()); if (c) { g.spawn(kinds[Math.floor(this.rand() * kinds.length)], c.x, c.y, "Furia"); const e = (g.enemies as Any[]).at(-1); if (e) { e.miniBoss = true; e.hp = e.hpMax = Math.round(e.hpMax * 2.2); } this.post("event", "JEFE ERRANTE: un élite con el doble de vida ronda el piso. Derrotarlo cuenta como objetivo."); } return; }
    if (roll === 2) { let n = 0; for (const pk of g.pickups as Any[]) if (!pk.used && (pk.kind === "ammo" || pk.kind === "food" || pk.kind === "water") && this.rand() < .5) { pk.used = true; n++; } this.post("event", `ESCASEZ: la tinta seca ${n} provisiones del piso. Compartir o acaparar.`); return; }
    if (roll === 3 && alive.length >= 2) { this.vote = { id: `v${this.tick}`, text: "¿Romper el sello del santuario? Todos ganan fichas, pero despiertan criaturas.", until: this.clock + 20, yes: new Set(), no: new Set() }; this.post("event", `DECISIÓN DEL GRUPO: ${this.vote.text} (20 s para votar)`); return; }
    const c = this.freeCell(12, this.spawnPoint());
    if (c) { this.evacUntil = this.clock + 40; this.marks = this.marks.filter(m => m.kind !== "evac"); this.marks.push({ id: `evac${this.tick}`, kind: "evac", x: c.x, y: c.y, label: "EXTRACCIÓN DE EMERGENCIA · E para salir", color: "#7ad8ff" }); this.post("event", "EXTRACCIÓN DE EMERGENCIA: una salida se abre 40 s. Quien la use sale ya… y deja a los demás."); }
  }
  private closeVote() {
    const v = this.vote; if (!v) return; this.vote = null;
    const yes = v.yes.size > v.no.size; const g = this.g;
    if (!yes) { this.post("event", `El grupo decidió no romper el sello (${v.yes.size} sí / ${v.no.size} no).`); return; }
    for (const p of this.alivePlayers()) { p.ctx["gold"] = (p.ctx["gold"] as number) + 25 * g.floor; p.stats.events++; }
    const kinds = regionEnemies(g.floor) as string[]; const s = this.spawnPoint();
    for (let i = 0; i < 4; i++) { const c = this.freeCell(3, s); if (c) { g.spawn(kinds[Math.floor(this.rand() * kinds.length)], c.x, c.y); const e = (g.enemies as Any[]).at(-1); if (e) e.aware = true; } }
    this.post("event", `Sello roto (${v.yes.size} sí / ${v.no.size} no): +${25 * g.floor} fichas para cada uno y cuatro criaturas despiertan.`);
  }

  // ───────────────────────── fin de piso y partida ─────────────────────────
  private checkFloorEnd(dt: number) {
    const all = [...this.players.values()].filter(p => p.state !== "gone");
    const alive = all.filter(p => p.state === "alive"), extracted = all.filter(p => p.state === "extracted"), downed = all.filter(p => p.state === "downed");
    if (this.extractT >= 0) this.extractT += dt;
    if (!alive.length && !downed.length) { if (extracted.length) this.endFloor(); else this.endMatch("defeat"); return; }
    if (!alive.length && downed.length && !extracted.length) return; // los caídos aún pueden ser levantados… por nadie: esperan a su temporizador
    if (extracted.length && (!alive.length || this.extractT > MP.extractWait)) this.endFloor();
  }
  scoreOf(p: SimPlayer) {
    const eng = Math.round(((p.ctx["score"] as Any)?.total ?? 0) as number);
    const m = mpMerits(p.stats, p.role, p.role2).total;
    return { engine: eng, merits: m, total: eng + m };
  }
  private endFloor() {
    const g = this.g, all = [...this.players.values()].filter(p => p.state !== "gone");
    const out = all.filter(p => p.state === "extracted");
    for (const p of all) {
      if (p.state === "extracted") { p.ctx["score"]?.add?.("portal", timeBonus(p.extractedAt, true)); continue; }
      const pen = Math.floor((p.ctx["gold"] as number) * MP.abandonPenalty); p.ctx["gold"] = (p.ctx["gold"] as number) - pen;
      this.post("info", `${p.name} quedó atrás al cerrarse el portal y pierde ${pen} fichas.`);
      for (const q of out) if (this.mode !== "coop" && p.state === "downed") { q.stats.betrayals++; }
    }
    if (this.teamPot > 0 && out.length) { const share = Math.floor(this.teamPot / out.length); for (const p of out) p.ctx["gold"] = (p.ctx["gold"] as number) + share; this.post("loot", `El fondo común (${this.teamPot}) se reparte: +${share} fichas para cada uno que salió.`); this.teamPot = 0; }
    this.floorResults = { floor: g.floor, rows: podium(all.map(p => ({ id: p.id, name: p.name, score: this.scoreOf(p).total, stats: p.stats, state: p.state }))).map(r => ({ id: r.id, name: r.name, score: r.score, state: r.state })) };
    if (g.floor >= this.maxFloors) { this.endMatch("victory"); return; }
    this.phase = "interlude"; this.interT = MP.interlude;
    this.post("info", `Piso ${g.floor} superado. El siguiente piso se abre en ${MP.interlude} s.`);
  }
  private nextFloor() {
    const g = this.g; const n = (g.floor as number) + 1;
    for (const p of this.players.values()) { if (p.state === "gone") continue; this.cur = p; useStorage(p.storage); loadCtx(g, p.ctx); const b = (g.recap as Any)?.bonus ?? 0; try { g.gainXp(50); } catch { /* xp opcional */ } if (b > 0) g.gold += b; g.recap = null; captureCtx(g, p.ctx); }
    this.cur = null; this.phase = "play"; this.buildFloor(n);
  }
  endMatch(outcome: "victory" | "defeat") {
    if (this.phase === "over") return;
    this.phase = "over"; this.outcome = outcome;
    const all = [...this.players.values()];
    const group = all.map(p => p.stats);
    const rows = podium(all.map(p => ({ id: p.id, name: p.name, score: this.scoreOf(p).total, stats: p.stats, p })));
    this.final = rows.map((r, i) => {
      const s = this.scoreOf(r.p); const bag = (r.p.ctx["bag"] as Any[]) ?? [];
      return { id: r.id, userId: r.p.userId, name: r.name, clsId: r.p.clsId, role: r.p.role, role2: r.p.role2, score: s.total, engineScore: s.engine, merits: s.merits, stats: r.p.stats, title: mpTitle(r.p.stats, group), place: i + 1, gold: Math.max(0, Math.floor(r.p.ctx["gold"] as number)), outcome: r.p.state, items: bag.filter(it => (it.rarity ?? 0) >= 3).map(it => toPlain(it) as Any) };
    });
    this.post("info", outcome === "victory" ? "¡La expedición completó el Libro!" : "La expedición ha caído entera.");
  }

  // ───────────────────────── instantáneas ─────────────────────────
  lobbyView() {
    return [...this.players.values()].map(p => ({ id: p.id, name: p.name, clsId: p.clsId, subclassId: p.subclassId, role: p.role, role2: p.role2, color: p.color, connected: p.connected, state: p.state }));
  }
  private worldJsonNow() {
    if (this.worldJsonTick === this.tick) return this.worldJson;
    this.worldJsonTick = this.tick; const g = this.g; const m = new Map<string, string>();
    for (const k of worldKeys(g)) { const v = toPlain(g[k], 0, true); if (v !== undefined) m.set(k, JSON.stringify(v)); }
    this.worldJson = m; return m;
  }
  /**
   * Paquete rápido (cada tick): posiciones de todos y la propia con la última entrada aplicada.
   * Pequeño a propósito; el resto del estado viaja en `snapshotFor` a menor frecuencia.
   */
  fastFor(id: string) {
    const p = this.players.get(id); if (!p || this.phase === "lobby") return null;
    const r2 = (v: unknown) => Math.round((Number(v) || 0) * 100) / 100;
    const c = p.ctx;
    return {
      t: Math.round(this.clock * 1000) / 1000, a: p.ack,
      me: [r2(c["px"]), r2(c["py"]), r2(c["pz"]), r2(c["vx"]), r2(c["vy"]), p.state === "alive" && c["mode"] === "play" && !(Number(c["dashT"]) > 0) && !(Number(c["slideT"]) > 0) && !(Number(c["stampede"]) > 0) && !c["sitting"] ? 1 : 0],
      pl: [...this.players.values()].filter(q => q.id !== id && q.state !== "gone").map(q => [q.id, r2(q.ctx["px"]), r2(q.ctx["py"]), r2(q.ctx["pz"]), Math.round((Number(q.ctx["ang"]) || 0) * 1000) / 1000, r2(q.ctx["vx"]), r2(q.ctx["vy"])]),
    };
  }
  /** Instantánea con cambios desde lo último enviado a este cliente. */
  snapshotFor(id: string, cache: ClientCache) {
    const p = this.players.get(id); if (!p) return null;
    const g = this.g, px = p.ctx["px"] as number, py = p.ctx["py"] as number;
    const out: Any = { t: this.clock, ph: this.phase, fl: g.floor, st: p.state, dn: Math.max(0, p.downT), song: this.songTime() };
    if (cache.floor !== g.floor || cache.seed !== g.floorSeed) { cache.reset(); cache.floor = g.floor; cache.seed = g.floorSeed; out.floor = { n: g.floor, seed: g.floorSeed, diff: this.difficulty, region: g.region?.id }; }
    const me = diffKeys(cache.me, p.ctx, ME_KEYS); if (me) out.me = me;
    const sc = JSON.stringify((p.ctx["score"] as Any)?.dump?.() ?? null); if (sc !== cache.score) { cache.score = sc; out.sc = JSON.parse(sc); }
    const wj = this.worldJsonNow(); const w: Any = {}; let wn = 0;
    for (const [k, j] of wj) if (cache.world.get(k) !== j) { cache.world.set(k, j); w[k] = JSON.parse(j); wn++; }
    if (wn) out.w = w;
    const map = g.map as Uint8Array;
    if (!cache.map) { cache.map = Uint8Array.from(map); out.map = Array.from(map); }
    else { const ch: number[] = []; for (let i = 0; i < map.length; i++) if (map[i] !== cache.map[i]) { ch.push(i, map[i]!); cache.map[i] = map[i]!; } if (ch.length) out.mapd = ch; }
    const en = diffEntities(cache.en, g.enemies as Any[], e => e["id"] as number, ENEMY_SKIP, e => Math.hypot((e["x"] as number) - px, (e["y"] as number) - py) < 24);
    if (en) out.en = en;
    const pk = diffEntities(cache.pk, g.pickups as Any[], e => e["netId"] as number, PICKUP_SKIP);
    if (pk) out.pk = pk;
    out.pr = (g.projs as Any[]).filter(pr => Math.hypot(pr.x - px, pr.y - py) < 22).slice(0, 80).map(pr => [+pr.x.toFixed(2), +pr.y.toFixed(2), +pr.z.toFixed(2), pr.sprite ?? "", pr.size ?? .1, pr.friendly ? 1 : 0, pr.color ?? "#fff", +(pr.dx ?? 0).toFixed(2), +(pr.dy ?? 0).toFixed(2)]);
    out.pl = [...this.players.values()].filter(q => q.state !== "gone" || q.id === id).map(q => { const c = q.ctx; const s = this.scoreOf(q); return [q.id, q.name, q.color, q.role, +(c["px"] as number ?? 0).toFixed(2), +(c["py"] as number ?? 0).toFixed(2), +(c["pz"] as number ?? 0).toFixed(2), +(c["ang"] as number ?? 0).toFixed(3), +(c["pitch"] as number ?? 0).toFixed(2), +(c["vx"] as number ?? 0).toFixed(2), +(c["vy"] as number ?? 0).toFixed(2), c["slot"] ?? 0, +(c["dashT"] as number ?? 0).toFixed(2), c["crouching"] ? 1 : 0, +(c["slideT"] as number ?? 0).toFixed(2), +(c["swingT"] as number ?? 0).toFixed(2), c["attackAlternate"] ? 1 : 0, c["aiming"] ? 1 : 0, c["pounding"] ? 1 : 0, Math.max(0, Math.round(c["hp"] as number ?? 0)), Math.round(c["hpMax"] as number ?? 1), q.state, q.traitor, s.total, q.connected ? 1 : 0, c["level"] ?? 1, q.clsId, Math.floor(c["gold"] as number ?? 0), q.role2, q.state === "downed" ? +(q.reviveT / reviveTime("dano")).toFixed(2) : 0, q.titleName ?? ""]; });
    if (p.sounds.length) out.snd = p.sounds.splice(0);
    if (p.finds?.length) out.fd = p.finds.splice(0);
    const feed = this.feed.filter(f => f.n > cache.feedN && (!f.to || f.to === id)); if (feed.length) { cache.feedN = feed.at(-1)!.n; out.feed = feed.map(f => [f.kind, f.text]); }
    const mk = JSON.stringify(this.marks.filter(m => !m.used && (m.kind !== "ambushChest" || MODES[this.mode].sabotage)).map(m => ({ ...m, label: m.kind === "lever" && p.role !== "exploracion" && p.role2 !== "exploracion" && Math.hypot(m.x - px, m.y - py) > 6 ? "" : m.label })));
    if (mk !== cache.marks) { cache.marks = mk; out.mk = JSON.parse(mk); }
    const ev = JSON.stringify({ duel: this.duel ? { active: this.duel.active, until: Math.max(0, this.duel.joinUntil - this.clock), joined: this.duel.duelists.includes(id), n: this.duel.duelists.length, item: this.duel.item?.name } : null, vote: this.vote ? { id: this.vote.id, text: this.vote.text, left: Math.max(0, this.vote.until - this.clock), yes: this.vote.yes.size, no: this.vote.no.size, mine: this.vote.yes.has(id) ? "yes" : this.vote.no.has(id) ? "no" : "" } : null, contract: p.contract, extract: this.extractT >= 0 ? Math.max(0, MP.extractWait - this.extractT) : -1, evac: this.evacUntil ? Math.max(0, this.evacUntil - this.clock) : 0, pot: this.teamPot, fr: this.phase === "interlude" ? this.floorResults : null, inter: this.phase === "interlude" ? this.interT : 0, final: this.final, outcome: this.outcome, stats: Object.fromEntries(Object.entries(p.stats).map(([k, v]) => [k, Math.round(v)])), merits: mpMerits(p.stats, p.role, p.role2) });
    if (ev !== cache.ev) { cache.ev = ev; out.ev = JSON.parse(ev); }
    return out;
  }
}

export class ClientCache {
  me = new Map<string, string>(); world = new Map<string, string>(); en = new Map<number, Map<string, string>>(); pk = new Map<number, Map<string, string>>();
  map: Uint8Array | null = null; score = ""; feedN = 0; marks = ""; ev = ""; floor = -1; seed = -1;
  reset() { this.me.clear(); this.world.clear(); this.en.clear(); this.pk.clear(); this.map = null; this.score = ""; this.marks = ""; this.ev = ""; }
  /** Reconexión: todo se reenvía completo. */
  full() { const f = this.feedN; this.reset(); this.floor = -1; this.seed = -1; this.feedN = f; }
}
export { getDifficulty };
