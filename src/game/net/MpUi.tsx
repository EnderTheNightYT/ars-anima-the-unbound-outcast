/** Interfaz de la EXPEDICIÓN COMPARTIDA: entrada, sala, marcador, avisos, intercambio y resultados. */
import { pariahUnlocked } from "../pariah";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Users, Copy, Crown, Wifi, WifiOff, Skull, ShieldCheck, Swords, LogOut, RefreshCw, Coins, Check, MessageSquare, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CLASSES, RARITY } from "../data";
import { DIFFICULTIES } from "../difficulty";
import { subclasses } from "../subclasses";
import { useAccount, signInGoogle } from "../cloud";
import type { Game } from "../engine";
import { MP, MODES, ROLES, STAT_LABEL, type Role, type RuleMode } from "./rules";
import { StrategyTips } from "../StrategyTips";
import { cleanStats } from "../strategy-tips";
import { probeServer, type ServerHealth } from "./cf-transport";
import { filterRooms } from "./room-search";
import { mp, DEFAULT_SERVER, serverUrl, setServerUrl, savedName, inviteLink, readInvite, type PublicRoom, type Standing } from "./client";

export function useMp() {
  return useSyncExternalStore(cb => mp.subscribe(cb), () => mpVersion(), () => 0);
}
let ver = 0; mp.subscribe(() => { ver++; });
const mpVersion = () => ver;

const ROLE_IDS = Object.keys(ROLES) as Role[];
const MODE_IDS = Object.keys(MODES) as RuleMode[];
const STATE_LABEL: Record<string, string> = { alive: "En pie", downed: "Caído", dead: "Sin alma", extracted: "A salvo", gone: "Se fue" };

// ───────────────────────── entrada (pantalla de título) ─────────────────────────
export function MpEntry({ onOpen }: { onOpen: () => void }) {
  return <Button variant="outline" className="mt-2 mp-entry" onClick={onOpen}><Users className="size-4" /> EXPEDICIÓN COMPARTIDA · 2–4 JUGADORES</Button>;
}

export function MpConnect({ onBack }: { onBack: () => void }) {
  useMp(); const user = useAccount();
  const [url, setUrl] = useState(""); const [name, setName] = useState(""); const [code, setCode] = useState("");
  const [mode, setMode] = useState<RuleMode>("traicion"); const [diff, setDiff] = useState("normal"); const [priv, setPriv] = useState(false); const [floors, setFloors] = useState<number>(MP.floors);
  const [rooms, setRooms] = useState<PublicRoom[] | null>(null); const [roomErr, setRoomErr] = useState("");
  const [invited, setInvited] = useState("");
  const [q, setQ] = useState(""); const [modeF, setModeF] = useState<RuleMode | "all">("all"); const [openOnly, setOpenOnly] = useState(true);
  const joinInvite = async () => { const n = name.trim() || "Errante"; setName(n); await mp.join(invited, n); if (mp.inRoom) history.replaceState(null, "", location.pathname); };
  const [health, setHealth] = useState<ServerHealth>({ state: "checking", msg: "Comprobando el servidor…" });
  const check = async (u = serverUrl()) => { setHealth({ state: "checking", msg: "Comprobando el servidor…" }); const h = await probeServer(u); setHealth(h); return h; };
  useEffect(() => { setUrl(serverUrl()); setName(savedName() || ((user?.user_metadata?.["full_name"] as string) ?? "").slice(0, 24)); const inv = readInvite(location.search); if (inv) { if (inv.server && inv.server !== serverUrl()) { setServerUrl(inv.server); setUrl(inv.server); } setCode(inv.code); setInvited(inv.code); } }, [user]);
  const refresh = async () => { setRoomErr(""); try { setRooms(await mp.listRooms()); } catch (e) { setRooms([]); setRoomErr(e instanceof Error ? e.message : String(e)); } };
  useEffect(() => { void check().then(h => { if (h.state === "ok") void refresh(); else setRooms([]); }); const id = window.setInterval(() => void check(), 30000); return () => window.clearInterval(id); }, []);
  const busy = mp.status === "connecting"; const hasUrl = !!url.trim();
  const saveUrl = () => { setServerUrl(url); void check(url).then(h => { if (h.state === "ok") void refresh(); }); };
  const online = health.state === "ok";
  useEffect(() => { if (!online) return; const id = window.setInterval(() => void refresh(), 15000); return () => window.clearInterval(id); }, [online]);
  const shown = rooms ? filterRooms(rooms, { q, mode: modeF, openOnly }) : null;
  return (
    <div className="menu-panel mp-connect w-full max-w-4xl p-4 text-left">
      <div className="flex items-center justify-between gap-2"><h2 className="title-gothic text-2xl text-primary">EXPEDICIÓN COMPARTIDA</h2><Button variant="ghost" onClick={onBack}>VOLVER</Button></div>
      <p className="text-xs text-muted-foreground mt-1">De 2 a 4 jugadores recorren los mismos pisos: los enemigos, el botín y los eventos son comunes; la puntuación, las fichas y el título son de cada uno.</p>
      {!user && <div className="mp-note mt-3 font-pixel text-xs">Sin cuenta puedes jugar como invitado, pero tus resultados y objetos no se guardarán. <Button variant="link" className="h-auto p-0 text-rarity-2" onClick={() => void signInGoogle()}>Entrar con Google</Button></div>}
      <label className="block mt-3 font-pixel text-xs text-muted-foreground">SERVIDOR DE SALAS
        <div className="flex gap-2 mt-1"><Input value={url} placeholder="wss://tu-servidor.example.com" onChange={e => setUrl(e.target.value)} /><Button variant="outline" onClick={saveUrl} disabled={!hasUrl}>GUARDAR</Button></div>
      </label>
      <div className="mp-note mt-2 flex items-start gap-2 font-pixel text-xs" role="status" aria-live="polite">
        {online ? <Wifi className="size-4 shrink-0 text-rarity-2" /> : <WifiOff className={`size-4 shrink-0 ${health.state === "checking" ? "text-muted-foreground" : "text-destructive"}`} />}
        <span className={online ? "text-rarity-2" : health.state === "checking" ? "text-muted-foreground" : "text-destructive"}>{health.msg}</span>
        <Button size="sm" variant="ghost" className="ml-auto h-6 px-2" onClick={() => void check()}>REINTENTAR</Button>
      </div>
      {!online && health.state !== "checking" && url.trim().replace(/\/$/, "") === DEFAULT_SERVER && <p className="text-[11px] text-rarity-2 mt-1">El servidor de salas gratuito todavía no está publicado en esta dirección de Cloudflare. Si ya lo publicaste con otra dirección, pégala arriba y pulsa GUARDAR.</p>}
      {!online && health.state !== "checking" && <p className="text-[11px] text-muted-foreground mt-1">El modo individual sigue disponible: vuelve al menú y pulsa COMENZAR RUN.</p>}
      <label className="block mt-3 font-pixel text-xs text-muted-foreground">TU NOMBRE EN LA EXPEDICIÓN
        <Input className="mt-1" value={name} maxLength={24} onChange={e => setName(e.target.value)} placeholder="Errante" /></label>
      {invited && <div className="mp-invite mt-3 p-3 border-2 border-primary flex flex-wrap items-center gap-3" role="region" aria-label="Invitación">
        <div className="flex-1 min-w-48"><div className="font-pixel text-xs text-muted-foreground">TE HAN INVITADO A LA SALA</div><div className="title-gothic text-3xl text-primary tracking-widest">{invited}</div>
          {!online && <div className="text-[11px] text-muted-foreground">{health.state === "checking" ? "Comprobando el servidor…" : "El servidor no responde; reintenta en unos segundos."}</div>}</div>
        <Button className="btn-blood" disabled={busy || !online} onClick={() => void joinInvite()}>{busy ? "UNIÉNDOSE…" : "UNIRSE A LA SALA"}</Button>
      </div>}
      {mp.error && <p className="mt-2 text-sm text-destructive" role="alert">{mp.error}</p>}
      {mp.hasResume() && <Button className="btn-blood mt-3" disabled={busy || !online} onClick={() => void mp.resume()}>VOLVER A MI EXPEDICIÓN</Button>}
      <div className="grid gap-4 md:grid-cols-2 mt-4">
        <section className="mp-box p-3">
          <h3 className="title-gothic text-lg text-rarity-2">CREAR SALA</h3>
          <div className="font-pixel text-[11px] text-muted-foreground mt-2">MODALIDAD</div>
          <div className="grid gap-2 mt-1">{MODE_IDS.map(m => <Button key={m} variant="ghost" aria-pressed={mode === m} onClick={() => setMode(m)} className={`choice-card text-left h-auto ${mode === m ? "choice-active" : ""}`}><div><div className="title-gothic text-primary">{MODES[m].name}</div><div className="text-[11px] text-muted-foreground whitespace-normal">{MODES[m].blurb}</div></div></Button>)}</div>
          <div className="font-pixel text-[11px] text-muted-foreground mt-3">DIFICULTAD</div>
          <div className="flex flex-wrap gap-2 mt-1">{DIFFICULTIES.map(d => <Button key={d.id} variant="ghost" aria-pressed={diff === d.id} onClick={() => setDiff(d.id)} className={`choice-card text-xs ${diff === d.id ? "choice-active" : ""}`}>{d.name}</Button>)}</div>
          <div className="font-pixel text-[11px] text-muted-foreground mt-3">PISOS</div>
          <div className="flex flex-wrap gap-2 mt-1">{[1, 2, 3, 6].map(n => <Button key={n} variant="ghost" aria-pressed={floors === n} onClick={() => setFloors(n)} className={`choice-card text-xs ${floors === n ? "choice-active" : ""}`}>{n}</Button>)}</div>
          <div className="flex gap-2 mt-3">{[false, true].map(p => <Button key={String(p)} variant="ghost" aria-pressed={priv === p} onClick={() => setPriv(p)} className={`choice-card text-xs ${priv === p ? "choice-active" : ""}`}>{p ? "PRIVADA · sólo con código" : "PÚBLICA · aparece en la lista"}</Button>)}</div>
          <Button className="btn-blood mt-4 w-full" disabled={busy || !online || !name.trim()} onClick={() => void mp.create({ mode, difficulty: diff, isPrivate: priv, name: name.trim(), floors })}>{busy ? "CONECTANDO…" : "CREAR"}</Button>
        </section>
        <section className="mp-box p-3">
          <h3 className="title-gothic text-lg text-rarity-2">UNIRSE</h3>
          <div className="flex gap-2 mt-2"><Input value={code} maxLength={6} placeholder="CÓDIGO" className="font-pixel tracking-widest uppercase" onChange={e => setCode(e.target.value.toUpperCase())} /><Button variant="outline" disabled={busy || !online || code.length !== 6 || !name.trim()} onClick={() => void mp.join(code, name.trim())}>ENTRAR</Button></div>
          <div className="flex items-center justify-between mt-4"><span className="font-pixel text-[11px] text-muted-foreground">SALAS PÚBLICAS</span><Button size="icon" variant="ghost" aria-label="Actualizar salas" disabled={!hasUrl} onClick={() => void refresh()}><RefreshCw className="size-4" /></Button></div>
          <Input className="mt-1" value={q} maxLength={24} placeholder="Buscar anfitrión, código o modalidad" aria-label="Buscar salas" onChange={e => setQ(e.target.value)} />
          <div className="flex flex-wrap gap-1 mt-1">{(["all", ...MODE_IDS] as const).map(m => <Button key={m} size="sm" variant="ghost" aria-pressed={modeF === m} onClick={() => setModeF(m)} className={`choice-card h-7 text-[11px] ${modeF === m ? "choice-active" : ""}`}>{m === "all" ? "Todas" : MODES[m].name}</Button>)}
            <Button size="sm" variant="ghost" aria-pressed={openOnly} onClick={() => setOpenOnly(v => !v)} className={`choice-card h-7 text-[11px] ${openOnly ? "choice-active" : ""}`}>Con sitio libre</Button></div>
          {roomErr && <p className="text-xs text-destructive">No se pudo leer la lista: {roomErr}</p>}
          <div className="grid gap-2 mt-1 max-h-72 overflow-y-auto">
            {shown?.length ? shown.map(r => <Button key={r.code} variant="ghost" className="choice-card h-auto text-left justify-between" disabled={busy || !name.trim() || r.clients >= r.max} onClick={() => void mp.join(r.code, name.trim())}><span><span className="title-gothic text-primary">{r.host}</span> <span className="font-pixel text-[11px] tracking-widest text-muted-foreground">{r.code}</span> <span className="text-[11px] text-muted-foreground">· {MODES[r.mode]?.name ?? r.mode} · {r.difficulty}</span></span><span className="font-pixel text-xs">{r.clients}/{r.max}</span></Button>)
              : <p className="text-xs text-muted-foreground">{rooms ? (rooms.length ? "Ninguna sala coincide con la búsqueda." : "No hay salas públicas abiertas.") : hasUrl ? "Buscando…" : "Configura el servidor para ver salas."}</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

// ───────────────────────── sala de espera ─────────────────────────
export function MpLobby() {
  useMp(); const L = mp.lobby; const [copied, setCopied] = useState(false);
  if (!L) return <div className="overlay"><p className="font-pixel">Entrando en la sala…</p></div>;
  const me = L.players.find(p => p.id === mp.id); const host = L.host === mp.id; const ready = L.ready.includes(mp.id);
  const cls = CLASSES.find(c => c.id === me?.clsId) ?? CLASSES[0]!;
  const cfg = (c: Record<string, string>) => mp.send("cfg", c);
  const invite = async () => { const link = inviteLink(L.code);
    if (navigator.share && matchMedia("(pointer: coarse)").matches) { try { await navigator.share({ title: "Ars Anima · Expedición compartida", text: `Únete a mi sala ${L.code}`, url: link }); return; } catch { /* cancelado: se copia */ } }
    try { await navigator.clipboard.writeText(link); } catch { window.prompt("Copia el enlace de invitación:", link); }
    setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const allReady = L.players.every(p => p.id === L.host || L.ready.includes(p.id));
  return (
    <div className="overlay overflow-y-auto justify-start pt-8">
      <div className="menu-panel w-full max-w-5xl p-4 text-left mp-lobby">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="font-pixel text-xs text-muted-foreground">SALA {L.isPrivate ? "PRIVADA" : "PÚBLICA"}</div><div className="title-gothic text-4xl text-primary tracking-widest">{L.code}</div></div>
          <div className="flex gap-2"><Button variant="outline" onClick={() => void invite()}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "ENLACE COPIADO" : "COPIAR INVITACIÓN"}</Button><Button variant="ghost" onClick={() => void mp.leave()}><LogOut className="size-4" /> SALIR</Button></div>
        </div>
        <div className="mp-rules mt-3 p-3"><span className="title-gothic text-rarity-2">{MODES[L.mode].name.toUpperCase()}</span> · {DIFFICULTIES.find(d => d.id === L.difficulty)?.name} · {L.floors} {L.floors === 1 ? "piso" : "pisos"}<p className="text-xs text-muted-foreground mt-1">{MODES[L.mode].blurb}</p>
          <ul className="text-[11px] mt-2 grid gap-0.5 sm:grid-cols-2">
            <li>Fuego amigo: {MODES[L.mode].friendlyFire ? `${Math.round(MODES[L.mode].friendlyFire * 100)} %` : "no"}</li><li>Robos por la espalda: {MODES[L.mode].steal ? "sí (E detrás de alguien)" : "no"}</li>
            <li>Palancas, altar y cofre sellado: {MODES[L.mode].sabotage ? "sí" : "no"}</li><li>Contratos secretos: {MODES[L.mode].contracts ? "sí" : "no"}</li>
            <li>Caído: {MP.downSeconds} s para que te levanten (E mantenido)</li><li>Duelo por un arma legendaria: siempre</li>
          </ul>
          {host && <div className="flex flex-wrap gap-2 mt-2">{MODE_IDS.map(m => <Button key={m} size="sm" variant="ghost" aria-pressed={L.mode === m} className={`choice-card text-xs ${L.mode === m ? "choice-active" : ""}`} onClick={() => mp.send("rules", { mode: m })}>{MODES[m].name}</Button>)}
            {DIFFICULTIES.map(d => <Button key={d.id} size="sm" variant="ghost" aria-pressed={L.difficulty === d.id} className={`choice-card text-xs ${L.difficulty === d.id ? "choice-active" : ""}`} onClick={() => mp.send("rules", { difficulty: d.id })}>{d.name}</Button>)}
            <Button size="sm" variant="ghost" className="choice-card text-xs" onClick={() => mp.send("rules", { isPrivate: !L.isPrivate })}>{L.isPrivate ? "Hacer pública" : "Hacer privada"}</Button></div>}
        </div>
        <h3 className="title-gothic text-lg text-rarity-2 mt-4">JUGADORES · {L.players.length}/{MP.maxPlayers}</h3>
        <div className="grid gap-2 mt-2 sm:grid-cols-2">
          {L.players.map(p => <div key={p.id} className="mp-player-row p-2 flex items-center gap-2">
            <span className="mp-dot" style={{ background: p.color }} />
            <div className="flex-1 min-w-0"><div className="truncate">{p.name} {p.id === L.host && <Crown className="inline size-3 text-rarity-2" aria-label="Anfitrión" />}{p.id === mp.id && <span className="text-[10px] text-muted-foreground"> (tú)</span>}</div>
              <div className="text-[11px] text-muted-foreground">{CLASSES.find(c => c.id === p.clsId)?.name} · {ROLES[p.role].name}{p.role2 ? ` + ${ROLES[p.role2].name}` : ""}</div></div>
            {p.connected ? <Wifi className="size-4 text-rarity-1" aria-label="Conectado" /> : <WifiOff className="size-4 text-destructive" aria-label="Sin conexión" />}
            <span className={`font-pixel text-[11px] ${p.id === L.host || L.ready.includes(p.id) ? "text-rarity-2" : "text-muted-foreground"}`}>{p.id === L.host ? "ANFITRIÓN" : L.ready.includes(p.id) ? "LISTO" : "ESPERANDO"}</span>
          </div>)}
        </div>
        <h3 className="title-gothic text-lg text-rarity-2 mt-4">TU PERSONAJE</h3>
        <div className="class-grid mt-2">{CLASSES.filter(c => c.id !== "pariah" || pariahUnlocked()).map(c => <Button key={c.id} variant="ghost" aria-pressed={me?.clsId === c.id} className={`choice-card text-left h-auto ${me?.clsId === c.id ? "choice-active" : ""}`} onClick={() => cfg({ clsId: c.id, subclassId: subclasses(c.id)[0]?.id ?? "" })}><div><div className="title-gothic class-name text-primary">{c.name}</div><div className="text-[10px] font-pixel">{c.melee} + {c.ranged}</div></div></Button>)}</div>
        <div className="flex flex-wrap gap-2 mt-2">{subclasses(cls.id).map(s => <Button key={s.id} variant="ghost" aria-pressed={me?.subclassId === s.id} className={`choice-card text-xs ${me?.subclassId === s.id ? "choice-active" : ""}`} onClick={() => cfg({ subclassId: s.id })}>{s.name}</Button>)}</div>
        <div className="font-pixel text-[11px] text-muted-foreground mt-3">ESPECIALIZACIÓN PRINCIPAL (×1.6 puntos en su categoría)</div>
        <div className="grid gap-2 mt-1 sm:grid-cols-5">{ROLE_IDS.map(r => <Button key={r} variant="ghost" aria-pressed={me?.role === r} className={`choice-card text-left h-auto ${me?.role === r ? "choice-active" : ""}`} onClick={() => cfg({ role: r, role2: me?.role2 === r ? "" : me?.role2 ?? "" })}><div><div className="title-gothic text-primary">{ROLES[r].name}</div><div className="text-[10px] text-muted-foreground whitespace-normal">{ROLES[r].blurb}</div></div></Button>)}</div>
        <div className="font-pixel text-[11px] text-muted-foreground mt-3">ESPECIALIZACIÓN SECUNDARIA (híbrida, ×1.25)</div>
        <div className="flex flex-wrap gap-2 mt-1"><Button variant="ghost" aria-pressed={!me?.role2} className={`choice-card text-xs ${!me?.role2 ? "choice-active" : ""}`} onClick={() => cfg({ role2: "" })}>Ninguna</Button>{ROLE_IDS.filter(r => r !== me?.role).map(r => <Button key={r} variant="ghost" aria-pressed={me?.role2 === r} className={`choice-card text-xs ${me?.role2 === r ? "choice-active" : ""}`} onClick={() => cfg({ role2: r })}>{ROLES[r].name}</Button>)}</div>
        {mp.error && <p className="mt-3 text-sm text-destructive" role="alert">{mp.error}</p>}
        {mp.guest && <p className="mt-2 text-[11px] text-rarity-2">Juegas como invitado: tus resultados no se guardarán.</p>}
        <div className="flex flex-wrap gap-3 mt-4 items-center">
          {host ? <Button className="btn-blood" disabled={L.players.length < MP.minPlayers || !allReady} onClick={() => mp.send("start")}><Swords className="size-4" /> INICIAR EXPEDICIÓN</Button>
            : <Button className="btn-blood" onClick={() => mp.send("ready", !ready)}>{ready ? "YA NO ESTOY LISTO" : "ESTOY LISTO"}</Button>}
          <span className="text-xs text-muted-foreground">{L.players.length < MP.minPlayers ? `Hace falta al menos ${MP.minPlayers} jugadores. Comparte el código ${L.code}.` : !allReady ? "Esperando a que todos confirmen." : host ? "Todos listos." : "Esperando al anfitrión."}</span>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── HUD en partida ─────────────────────────
/** Marco de un miembro de la expedición: vida, estado, puntos en vivo y hacia dónde está. */
function PartyFrame({ s, g, me, now }: { s: Standing; g: Game; me: boolean; now: number }) {
  const pct = Math.max(0, Math.min(100, s.hp / Math.max(1, s.hpMax) * 100));
  const fx = mp.scoreFx.get(s.id); const pop = fx && now - fx.at < 1600 ? fx : null;
  const dx = s.x - g.px, dy = s.y - g.py, dist = Math.hypot(dx, dy);
  // Flecha relativa a la mira: 0° = delante.
  const rel = (Math.atan2(dy, dx) - g.ang) * 180 / Math.PI + 90;
  return <div className={`mp-frame ${me ? "is-me" : ""} is-${s.state} ${pct < 30 && s.state === "alive" ? "is-low" : ""}`} style={{ ["--mp-color" as string]: s.color }}>
    <div className="mp-frame-top"><span className="mp-dot" style={{ background: s.color }} /><span className="mp-name">{s.name}{me ? " · TÚ" : ""}</span>
      <span className="mp-frame-score font-pixel">{s.score}{pop && <span key={pop.at} className={`mp-score-pop ${pop.delta < 0 ? "is-neg" : ""}`}>{pop.delta > 0 ? "+" : ""}{pop.delta}</span>}</span></div>
    <div className="mp-frame-hp" role="meter" aria-label={`Vida de ${s.name}`} aria-valuenow={Math.round(s.hp)} aria-valuemin={0} aria-valuemax={s.hpMax}><div style={{ width: `${pct}%` }} /><span className="font-pixel">{Math.max(0, Math.round(s.hp))}/{s.hpMax}</span></div>
    {s.state === "downed" && <div className="mp-frame-revive"><div style={{ width: `${Math.round(s.revive * 100)}%` }} /></div>}
    <div className="mp-frame-sub"><span>Nv {s.level} · {ROLES[s.role]?.name}</span><span>{s.state !== "alive" ? STATE_LABEL[s.state] ?? s.state : !s.connected ? "sin conexión" : me ? `${s.gold} fichas` : <><Navigation className="mp-frame-arrow" style={{ transform: `rotate(${rel}deg)` }} />{dist.toFixed(0)} m</>}</span></div>
  </div>;
}

export function MpHud({ g }: { g: Game }) {
  useMp(); const ev = mp.ev; const [now, setNow] = useState(0);
  useEffect(() => { const t = window.setInterval(() => setNow(performance.now()), 250); return () => clearInterval(t); }, []);
  const party = [...mp.standings].sort((a, b) => (a.id === mp.id ? -1 : b.id === mp.id ? 1 : 0));
  const feed = mp.feed.filter(f => now - f.at < 14000 || f === mp.feed.at(-1)).slice(-6);
  const meRow = mp.standings.find(s => s.id === mp.id);
  const near = g.mode === "play" && mp.state === "alive" ? mp.standings.find(s => s.id !== mp.id && s.state === "downed" && Math.hypot(s.x - g.px, s.y - g.py) < MP.reviveRange + .4) : undefined;
  return <>
    <NetChip />
    <aside className="mp-party" aria-label="Vida de la expedición">{party.map(s => <PartyFrame key={s.id} s={s} g={g} me={s.id === mp.id} now={now} />)}</aside>
    <aside className="mp-board" aria-label="Marcador de la expedición">
      <div className="mp-board-head font-pixel"><span>SALA {mp.code} · PUNTOS EN VIVO</span><span className={mp.rtt > 180 ? "text-destructive" : ""}>{mp.status === "reconnecting" ? "RECONECTANDO…" : `${Math.round(mp.rtt)} ms`}</span></div>
      {mp.standings.map((s, i) => <div key={s.id} className={`mp-board-row ${s.id === mp.id ? "is-me" : ""} ${s.state !== "alive" ? "is-out" : ""}`}>
        <span className="mp-rank">{i + 1}</span><span className="mp-dot" style={{ background: s.color }} />
        <span className="mp-name">{s.name}{s.traitor > 0 && <span className="mp-traitor" title="Traiciones"> ✕{s.traitor}</span>}</span>
        <span className="mp-score">{s.score}{(() => { const fx = mp.scoreFx.get(s.id); return fx && now - fx.at < 1600 ? <span key={fx.at} className={`mp-score-pop ${fx.delta < 0 ? "is-neg" : ""}`}>{fx.delta > 0 ? "+" : ""}{fx.delta}</span> : null; })()}</span>
        <div className="mp-hp"><div style={{ width: `${Math.max(0, Math.min(100, s.hp / Math.max(1, s.hpMax) * 100))}%` }} /></div>
        <span className="mp-sub">{ROLES[s.role]?.name} · {STATE_LABEL[s.state] ?? s.state}{!s.connected ? " · sin conexión" : ""}</span>
      </div>)}
      <div className="mp-board-foot font-pixel">0 · Expedición  6 · Dar fichas  Intro · Chat</div>
    </aside>
    <div className="mp-feed" aria-live="polite">{feed.map((f, i) => <div key={i} className={`mp-feed-line is-${f.kind}`}>{f.text}</div>)}</div>
    {mp.titleFx && now - mp.titleFx.at < 5000 && <div key={mp.titleFx.at} className="mp-title-fx" role="status"><span className="font-pixel">★ TÍTULO ADQUIRIDO ★</span><strong className="title-gothic">{mp.titleFx.text}</strong></div>}
    <div className="mp-banners">
      {ev?.contract && !ev.contract.done && <div className="mp-banner is-contract">CONTRATO SECRETO · {ev.contract.text}</div>}
      {ev && ev.extract >= 0 && mp.state === "alive" && <div className="mp-banner is-urgent">EL PORTAL SE CIERRA EN {Math.ceil(ev.extract)} s</div>}
      {ev && ev.evac > 0 && <div className="mp-banner">EXTRACCIÓN DE EMERGENCIA ABIERTA · {Math.ceil(ev.evac)} s</div>}
      {ev?.duel && !ev.duel.active && <div className="mp-banner is-duel">{ev.duel.item} · {ev.duel.joined ? "ESTÁS INSCRITO" : "E junto al arma para retar"} · {Math.ceil(ev.duel.until)} s · {ev.duel.n} aspirantes</div>}
      {ev?.duel?.active && <div className="mp-banner is-duel">DUELO EN CURSO{ev.duel.joined ? " · ¡pelea!" : ""}</div>}
      {ev?.vote && <div className="mp-banner is-vote">{ev.vote.text} · {Math.ceil(ev.vote.left)} s · Sí {ev.vote.yes} / No {ev.vote.no}
        <span className="flex gap-2 justify-center mt-1"><Button size="sm" variant="outline" aria-pressed={ev.vote.mine === "yes"} onClick={() => mp.send("vote", true)}>8 · SÍ</Button><Button size="sm" variant="outline" aria-pressed={ev.vote.mine === "no"} onClick={() => mp.send("vote", false)}>9 · NO</Button></span></div>}
      {near && <div className="mp-banner">Mantén E para levantar a {near.name} ({Math.round(near.revive * 100)} %)</div>}
    </div>
    {mp.state === "downed" && <div className="mp-state-veil is-downed"><Skull className="size-10" /><div className="title-gothic text-3xl">HAS CAÍDO</div><div className="font-pixel">Un aliado puede levantarte manteniendo E · {Math.ceil(mp.downT)} s</div></div>}
    {mp.state === "dead" && <div className="mp-state-veil"><div className="title-gothic text-3xl">SIN ALMA</div><div className="font-pixel">Vuelves en el siguiente piso si alguien cruza el portal.</div></div>}
    {mp.state === "extracted" && mp.phase === "play" && <div className="mp-state-veil is-safe"><ShieldCheck className="size-10" /><div className="title-gothic text-3xl">A SALVO</div><div className="font-pixel">Esperando a los demás{ev && ev.extract >= 0 ? ` · el portal se cierra en ${Math.ceil(ev.extract)} s` : ""}.</div></div>}
    {mp.phase === "interlude" && ev?.fr && <div className="overlay"><h2 className="title-gothic text-3xl text-rarity-2">PISO {ev.fr.floor} SUPERADO</h2><ol className="mp-podium mt-4">{ev.fr.rows.map((r, i) => <li key={r.id} className={r.id === mp.id ? "is-me" : ""}><span className="mp-rank">{i + 1}</span><span className="flex-1">{r.name}</span><span className="text-[11px] text-muted-foreground">{STATE_LABEL[r.state]}</span><span className="font-pixel">{r.score}</span></li>)}</ol><p className="font-pixel mt-4">El siguiente piso se abre en {Math.ceil(ev.inter)} s · {meRow ? `tienes ${meRow.gold} fichas` : ""}</p></div>}
    {mp.phase === "over" && ev?.final && <MpResults />}
    <MpChat now={now} />
  </>;
}

/** Chat en pantalla: últimos mensajes siempre visibles un rato; Intro o el botón para escribir. */
function MpChat({ now }: { now: number }) {
  const [open, setOpen] = useState(false); const [text, setText] = useState("");
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input,textarea")) return;
      if (e.code === "Enter" && !open) { e.preventDefault(); document.exitPointerLock?.(); setOpen(true); }
      if (e.code === "Digit8") mp.send("vote", true); if (e.code === "Digit9") mp.send("vote", false);
      if (e.code === "Digit6") { const g = (window as unknown as { __game?: Game }).__game; const me = g ? mp.standings.find(s => s.id !== mp.id && s.state === "alive" && Math.hypot(s.x - g.px, s.y - g.py) < 3) : null; if (me) mp.send("give", { to: me.id, gold: 10 }); }
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [open]);
  const lines = open ? mp.chat.slice(-12) : mp.chat.filter(c => now - c.at < 30000).slice(-6);
  return <div className={`mp-chatbox ${open ? "is-open" : ""}`}>
    {lines.length > 0 && <ul className="mp-chatlog" aria-live="polite" aria-label="Chat de la expedición">{lines.map((c, i) => <li key={`${c.at}-${i}`} style={{ opacity: open ? 1 : Math.max(.35, 1 - (now - c.at) / 30000) }}><b style={{ color: c.color }}>{c.from}</b> {c.text}</li>)}</ul>}
    {open ? <form onSubmit={e => { e.preventDefault(); if (text.trim()) mp.send("chat", text.trim()); setText(""); setOpen(false); }}><Input autoFocus value={text} maxLength={140} placeholder="Mensaje para la expedición… (Esc para cerrar)" onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Escape") setOpen(false); }} /></form>
      : <button type="button" className="mp-chat-btn font-pixel" onClick={() => { document.exitPointerLock?.(); setOpen(true); }}><MessageSquare className="size-3" /> CHAT · Intro</button>}
  </div>;
}

/** Panel 0: marcador detallado con méritos e intercambio. */
export function MpPanel({ g, onClose }: { g: Game; onClose: () => void }) {
  useMp(); const ev = mp.ev; const [amount, setAmount] = useState(10);
  const others = mp.standings.filter(s => s.id !== mp.id);
  const near = (id: string) => { const s = mp.standings.find(x => x.id === id); return !!s && s.state === "alive" && Math.hypot(s.x - g.px, s.y - g.py) < 3; };
  return (
    <div className="overlay overflow-y-auto justify-start pt-8">
      <div className="menu-panel w-full max-w-4xl p-4 text-left">
        <div className="flex items-center justify-between"><h2 className="title-gothic text-2xl text-primary">EXPEDICIÓN · SALA {mp.code}</h2><Button variant="ghost" onClick={onClose}>CERRAR · 0</Button></div>
        {ev && <div className="grid gap-4 md:grid-cols-2 mt-3">
          <section className="mp-box p-3"><h3 className="title-gothic text-rarity-2">TUS MÉRITOS · {ev.merits.total}</h3>
            <ul className="text-xs mt-2 grid gap-0.5">{ev.merits.lines.map(l => <li key={l.key} className="flex justify-between"><span>{STAT_LABEL[l.key]}</span><span className={l.points < 0 ? "text-destructive" : "text-rarity-2"}>{l.points > 0 ? "+" : ""}{l.points}</span></li>)}</ul>
            {ev.contract && <p className="text-xs mt-3">Contrato: {ev.contract.text} {ev.contract.done ? "· CUMPLIDO" : ""}</p>}
            {ev.pot > 0 && <p className="text-xs mt-1">Fondo común del piso: {ev.pot} fichas (se reparte entre quienes salgan si nadie vacía el altar).</p>}
          </section>
          <section className="mp-box p-3"><h3 className="title-gothic text-rarity-2">INTERCAMBIO</h3>
            <p className="text-[11px] text-muted-foreground">Sólo con aliados a menos de 3 pasos. Tienes {g.gold} fichas.</p>
            <div className="flex gap-2 mt-2 items-center"><Coins className="size-4" /><Input type="number" min={1} max={9999} value={amount} className="w-24" onChange={e => setAmount(Math.max(1, Math.floor(Number(e.target.value) || 1)))} /></div>
            <div className="grid gap-1 mt-2">{others.map(o => <div key={o.id} className="flex items-center gap-2 text-sm"><span className="mp-dot" style={{ background: o.color }} /><span className="flex-1">{o.name}</span><Button size="sm" variant="outline" disabled={!near(o.id) || g.gold < 1} onClick={() => mp.send("give", { to: o.id, gold: Math.min(amount, Math.floor(g.gold)) })}>Dar fichas</Button></div>)}</div>
            <div className="font-pixel text-[11px] text-muted-foreground mt-3">DAR UN OBJETO DE LA MOCHILA</div>
            <div className="grid gap-1 mt-1 max-h-48 overflow-y-auto">{g.bag.slice(0, 30).map(it => <div key={it.uid} className="flex items-center gap-2 text-xs"><span className={`flex-1 text-rarity-${it.rarity}`}>{it.name} <span className="text-muted-foreground">({RARITY[it.rarity]})</span></span>{others.filter(o => near(o.id)).map(o => <Button key={o.id} size="sm" variant="ghost" onClick={() => mp.send("give", { to: o.id, uid: it.uid })}>→ {o.name}</Button>)}</div>)}</div>
          </section>
        </div>}
        <h3 className="title-gothic text-rarity-2 mt-4">MARCADOR</h3>
        <div className="grid gap-2 mt-2 md:grid-cols-2">{mp.standings.map((s, i) => <PlayerCard key={s.id} s={s} rank={i + 1} />)}</div>
        <div className="flex gap-2 mt-4"><Button variant="ghost" onClick={() => void mp.leave()}><LogOut className="size-4" /> ABANDONAR LA EXPEDICIÓN</Button></div>
      </div>
    </div>
  );
}

function MpResults() {
  useMp(); const ev = mp.ev!; const rows = ev.final ?? []; const host = mp.lobby?.host === mp.id;
  const top = rows.slice(0, 3);
  return (
    <div className="overlay overflow-y-auto justify-start pt-8">
      <h2 className="title-gothic text-4xl text-primary drop-glow">{ev.outcome === "victory" ? "EL LIBRO SE CIERRA" : "LA EXPEDICIÓN CAE"}</h2>
      <div className="mp-top3 mt-5">{top.map(r => <div key={r.id} className={`mp-top3-card place-${r.place} ${r.id === mp.id ? "is-me" : ""}`}><div className="mp-place font-pixel">{r.place === 1 ? "PRIMER PUESTO" : r.place === 2 ? "SEGUNDO PUESTO" : "TERCER PUESTO"}</div><div className="title-gothic text-2xl text-primary">{r.name}</div><div className="font-pixel text-xl">{r.score}</div><div className="text-rarity-2 title-gothic">{r.title.name}</div><div className="text-[11px] text-muted-foreground">{r.title.meaning}</div></div>)}</div>
      <div className="menu-panel w-full max-w-5xl p-3 mt-5 overflow-x-auto">
        <table className="mp-table text-xs w-full"><thead><tr><th>#</th><th>Jugador</th><th>Puntos</th><th>{STAT_LABEL.kills}</th><th>{STAT_LABEL.damage}</th><th>{STAT_LABEL.healing}</th><th>{STAT_LABEL.revives}</th><th>{STAT_LABEL.absorbed}</th><th>Objetos</th><th>{STAT_LABEL.pvpKills}</th><th>{STAT_LABEL.betrayals}</th><th>Tiempo</th><th>Título</th></tr></thead>
          <tbody>{rows.map(r => <tr key={r.id} className={r.id === mp.id ? "is-me" : ""}><td>{r.place}</td><td>{r.name}<div className="text-[10px] text-muted-foreground">{ROLES[r.role]?.name} · {STATE_LABEL[r.outcome] ?? r.outcome}</div></td><td className="font-pixel">{r.score}</td><td>{Math.round(r.stats.kills)}</td><td>{Math.round(r.stats.damage)}</td><td>{Math.round(r.stats.healing)}</td><td>{Math.round(r.stats.revives)}</td><td>{Math.round(r.stats.absorbed)}</td><td>{Math.round(r.stats.valuables)}</td><td>{Math.round(r.stats.pvpKills)}</td><td>{Math.round(r.stats.betrayals)}</td><td>{Math.floor(r.stats.seconds / 60)}:{String(Math.floor(r.stats.seconds % 60)).padStart(2, "0")}</td><td className="text-rarity-2">{r.title.name}</td></tr>)}</tbody></table>
      </div>
      {(() => { const me = rows.find(r => r.id === mp.id); if (!me) return null;
        return <div className="menu-panel w-full max-w-5xl p-3 mt-3"><div className="font-pixel text-xs text-muted-foreground">TU PARTIDA · #{me.place} de {rows.length} · {me.title.name}</div>
          <StrategyTips compact input={{ mode: "multi", name: me.name.slice(0, 40), className: (CLASSES.find(c => c.id === me.clsId)?.name ?? me.clsId).slice(0, 60), role: [ROLES[me.role]?.name, me.role2 ? ROLES[me.role2]?.name : ""].filter(Boolean).join(" / ").slice(0, 40),
            ruleMode: MODES[mp.lobby?.mode ?? "coop"]?.name, difficulty: String(mp.lobby?.difficulty ?? "normal").slice(0, 30), outcome: `${ev.outcome === "victory" ? "Victoria del grupo" : "Expedición caída"} · ${STATE_LABEL[me.outcome] ?? me.outcome}`.slice(0, 80),
            floor: Math.max(0, Math.min(99, mp.lobby?.floors ?? 1)), level: Math.max(0, Math.min(300, mp.standings.find(s => s.id === me.id)?.level ?? 1)), score: Math.max(0, Math.round(me.score)), place: me.place, players: rows.length,
            seconds: Math.max(0, Math.round(me.stats.seconds)), stats: cleanStats({ ...me.stats, gold: me.gold }), hurt: [], gear: [], title: me.title.name.slice(0, 80) }} /></div>; })()}
      <p className="font-pixel text-xs mt-3">{mp.guest ? "Jugaste como invitado: el resultado no se guarda en tu cuenta." : mp.saved === null ? (mp.persist ? "Guardando resultados…" : "El servidor no tiene el guardado activado.") : mp.saved ? "Resultados guardados en tu cuenta. Los objetos raros pasan a tu arcón." : "No se pudieron guardar los resultados."}</p>
      <div className="flex gap-3 mt-4">{host && <Button className="btn-blood" onClick={() => mp.send("restart")}>NUEVA EXPEDICIÓN CON ESTE GRUPO</Button>}<Button variant="outline" onClick={() => void mp.leave()}>VOLVER AL TÍTULO</Button></div>
    </div>
  );
}

/** Ping en vivo y estado de reconexión, siempre visible durante la partida. */
export function NetChip() {
  useMp(); const rec = mp.status === "reconnecting"; const ms = Math.round(mp.rtt);
  const q = rec ? "bad" : ms > 180 ? "bad" : ms > 90 ? "mid" : "good";
  const bars = rec ? 0 : q === "good" ? 3 : q === "mid" ? 2 : 1;
  return <div className={`mp-netchip is-${q} font-pixel`} role="status" aria-label={rec ? "Reconectando" : `Ping ${ms} ms`}>
    {rec ? <WifiOff className="size-3" /> : <Wifi className="size-3" />}
    <span className="mp-netbars" aria-hidden>{[1, 2, 3].map(b => <i key={b} className={b <= bars ? "on" : ""} />)}</span>
    <span>{rec ? "RECONECTANDO…" : `${ms} ms`}</span>
  </div>;
}

/** Ficha de jugador en el menú de expedición: clase, nivel, vida, puntos y estado. */
function PlayerCard({ s, rank }: { s: Standing; rank: number }) {
  const cls = CLASSES.find(c => c.id === s.cls)?.name ?? s.cls;
  const pct = Math.max(0, Math.min(100, s.hp / Math.max(1, s.hpMax) * 100));
  return <div className={`mp-box p-2 text-xs ${s.id === mp.id ? "is-me" : ""}`}>
    <div className="flex items-center gap-2"><span className="mp-rank">{rank}</span><span className="mp-dot" style={{ background: s.color }} />
      <span className="flex-1 text-sm">{s.name}{s.id === mp.id ? " (tú)" : ""}</span><span className="font-pixel text-rarity-2">{s.score} pts</span></div>
    <div className="mt-1 text-muted-foreground">{cls} · Nv {s.level} · {ROLES[s.role]?.name}{s.role2 ? ` + ${ROLES[s.role2]?.name}` : ""}</div>
    <div className="mp-hp mt-1"><div style={{ width: `${pct}%` }} /></div>
    <div className="mt-1 flex justify-between"><span>Vida {Math.max(0, Math.round(s.hp))}/{Math.round(s.hpMax)}</span><span>{s.gold} fichas</span><span>{STATE_LABEL[s.state] ?? s.state}{!s.connected ? " · sin conexión" : ""}{s.traitor > 0 ? ` · ✕${s.traitor}` : ""}</span></div>
  </div>;
}
