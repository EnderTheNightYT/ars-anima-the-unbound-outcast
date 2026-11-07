import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FloorRankings } from "./FloorRankings";
import { loadMpProfiles, loadMpHistory, useAccount, signInGoogle, signOut, loadGlobalRuns, loadLiveRuns, loadProfiles, getMyDiscord, setMyDiscord, setDiscordHidden, loadComments, addComment, deleteComment, reportComment } from "./cloud";
import { mpStandings, playerStandings, compareWithWorld, floorStats, styleStats, gearStats, filterRuns, NO_FILTER, type RunFilter, type LiveEntry } from "./cloud-save";

type Rows = Awaited<ReturnType<typeof loadGlobalRuns>>;
type Live = Awaited<ReturnType<typeof loadLiveRuns>>;
const TABS = [["top", "TOP MUNDIAL"], ["jugadores", "JUGADORES"], ["vivo", "RUNS EN CURSO"], ["formas", "FORMAS DE JUEGO"], ["equipo", "EQUIPAMIENTO"], ["comparar", "COMPARARME"], ["pisos", "MEDIAS POR PISO"], ["ranking", "RANKING POR PISO"], ["mp", "MULTIJUGADOR"]] as const;
const fmtT = (s: number) => `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, "0")}s`;

export function AccountBar() {
  const user = useAccount();
  const [err, setErr] = useState("");
  const [discord, setDiscord] = useState("");
  const [saved, setSaved] = useState("");
  const [hidden, setHidden] = useState(false);
  useEffect(() => { if (user) getMyDiscord().then((d) => { setDiscord(d.discord); setHidden(d.hidden); }); }, [user]);
  const name = (user?.user_metadata?.["full_name"] as string) || user?.email || "";
  return (
    <div className="menu-panel w-full max-w-5xl mt-4 p-3 flex flex-wrap items-center gap-3 text-left">
      {user ? <>
        {user.user_metadata?.["avatar_url"] && <img src={user.user_metadata["avatar_url"] as string} alt="" className="w-8 h-8 rounded-full" />}
        <div className="flex-1 min-w-40"><div className="font-pixel text-xs text-rarity-2">CUENTA CONECTADA</div><div className="text-sm">{name}</div>
          <div className="text-[11px] text-muted-foreground">Tu progreso, títulos y récords se guardan en la nube; tus runs se publican en la tabla mundial.</div></div>
        <label className="font-pixel text-xs text-muted-foreground min-w-48">DISCORD
          <div className="flex gap-1 mt-1"><Input value={discord} maxLength={40} placeholder="tu_usuario" onChange={(e) => { setDiscord(e.target.value); setSaved(""); }} />
            <Button variant="ghost" className="tab" onClick={async () => setSaved((await setMyDiscord(discord)) ? "Guardado" : "Error")}>VINCULAR</Button></div>
          <div className="flex gap-2 mt-1 items-center">
            <label className="flex items-center gap-1 text-[11px]"><input type="checkbox" checked={hidden} onChange={async (e) => { const v = e.target.checked; if (await setDiscordHidden(v)) { setHidden(v); setSaved(v ? "Oculto en la tabla" : "Visible en la tabla"); } }} />Ocultar en la tabla mundial</label>
            {discord && <button type="button" className="text-[11px] text-destructive underline" onClick={async () => { if (await setMyDiscord("")) { setDiscord(""); setSaved("Discord desvinculado"); } }}>Desvincular</button>}
          </div>
          {saved && <span className="text-[11px] text-rarity-2">{saved}</span>}
        </label>
        <Button variant="ghost" className="tab" onClick={() => void signOut()}>CERRAR SESIÓN</Button>
      </> : <>
        <div className="flex-1 min-w-40"><div className="font-pixel text-xs text-rarity-2">SIN CUENTA</div>
          <div className="text-[11px] text-muted-foreground">Inicia sesión con Google para guardar tu progreso, vincular tu Discord, comentar y competir en la tabla mundial.</div>
          {err && <div className="text-[11px] text-destructive">{err}</div>}</div>
        <Button className="btn-blood" onClick={async () => { setErr(await signInGoogle()); }}>ENTRAR CON GOOGLE</Button>
      </>}
    </div>
  );
}

/** Hilo de comentarios de cualquier marca, jugador, forma de juego, equipo o run en curso. */
export function Comments({ target }: { target: string }) {
  const user = useAccount();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Awaited<ReturnType<typeof loadComments>> | null>(null);
  const [text, setText] = useState("");
  const [reported, setReported] = useState<Set<string>>(new Set());
  const load = () => loadComments(target).then(setList).catch(() => setList([]));
  useEffect(() => { if (open && !list) void load(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="w-full">
      <button type="button" className="text-[11px] text-rarity-2 underline" onClick={() => setOpen(!open)}>{open ? "Ocultar comentarios" : `Comentarios${list ? ` (${list.length})` : ""}`}</button>
      {open && <div className="mt-1 grid gap-1 pl-2 border-l border-border">
        {!list && <span className="text-[11px] text-muted-foreground">Cargando…</span>}
        {list?.length === 0 && <span className="text-[11px] text-muted-foreground">Sin comentarios todavía.</span>}
        {list?.map((c) => <div key={c.id} className="text-[11px]"><b className="text-rarity-2">{c.author_name}</b> <span className="text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</span> {c.body}
          {c.user_id === user?.id && <button type="button" className="ml-2 text-destructive" onClick={async () => { await deleteComment(c.id); void load(); }}>borrar</button>}
          {user && c.user_id !== user.id && (reported.has(c.id) ? <span className="ml-2 text-muted-foreground">reportado</span>
            : <button type="button" className="ml-2 text-muted-foreground underline" onClick={async () => { const why = window.prompt("¿Por qué es abusivo este comentario?"); if (why === null) return; if (await reportComment(c.id, why)) setReported(new Set([...reported, c.id])); }}>reportar</button>)}</div>)}
        {user ? <form className="flex gap-1" onSubmit={async (e) => { e.preventDefault(); if (await addComment(target, text)) { setText(""); void load(); } }}>
          <Input value={text} maxLength={500} placeholder="Escribe un comentario" onChange={(e) => setText(e.target.value)} className="h-7 text-xs" />
          <Button type="submit" variant="ghost" className="tab h-7">ENVIAR</Button></form>
          : <span className="text-[11px] text-muted-foreground">Inicia sesión con Google para comentar.</span>}
      </div>}
    </div>
  );
}

export function WorldBoard() {
  const user = useAccount();
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("top");
  const [rows, setRows] = useState<Rows | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [disc, setDisc] = useState<Record<string, { discord: string }>>({});
  const [err, setErr] = useState("");
  const [f, setF] = useState<RunFilter>(NO_FILTER);
  useEffect(() => {
    Promise.all([loadGlobalRuns(), loadLiveRuns()]).then(async ([r, l]) => { setRows(r); setLive(l); setDisc(await loadProfiles([...new Set([...r.map((x) => x.user_id), ...l.map((x) => x.user_id)])])); })
      .catch(() => setErr("No se pudo cargar la tabla mundial."));
  }, []);
  const me = user?.id;
  const all = rows ?? [];
  const opts = (k: "class_name" | "subclass" | "difficulty") => [...new Set(all.map((r) => r[k]).filter(Boolean))].sort();
  const shown = filterRuns(all, f);
  const dc = (id: string) => (disc[id]?.discord ? ` · Discord: ${disc[id].discord}` : "");
  const empty = tab === "comparar" || tab === "pisos" || tab === "ranking" || tab === "mp" ? false : tab === "vivo" ? live?.length === 0 : shown.length === 0;
  return (
    <div className="menu-panel w-full max-w-5xl mt-4 p-3 text-left">
      <div className="title-gothic text-lg text-primary">CRÓNICA MUNDIAL</div>
      <div className="flex flex-wrap gap-1 mt-1">{TABS.map(([id, label]) => <Button key={id} variant="ghost" className={`tab ${tab === id ? "tab-active" : ""}`} onClick={() => setTab(id)}>{label}</Button>)}</div>
      {tab !== "vivo" && tab !== "mp" && <div className="flex flex-wrap gap-1 mt-2 items-center">
        <FSel label="Clase" value={f.cls} options={opts("class_name")} onChange={(cls) => setF({ ...f, cls })} />
        <FSel label="Subclase" value={f.sub} options={opts("subclass")} onChange={(sub) => setF({ ...f, sub })} />
        <FSel label="Dificultad" value={f.diff} options={opts("difficulty")} onChange={(diff) => setF({ ...f, diff })} />
        <Input value={f.gear} placeholder="Equipamiento (ej. hacha)" onChange={(e) => setF({ ...f, gear: e.target.value })} className="h-8 w-48 text-xs" />
        <select aria-label="Ordenar" className="h-8 rounded border border-border bg-background text-xs px-1" value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value as RunFilter["sort"] })}>
          {([["score", "Puntuación"], ["kills", "Bajas"], ["floor", "Más lejos"], ["level", "Nivel personaje"], ["seconds", "Más rápido"], ["recent", "Más recientes"]] as const).map(([v, l]) => <option key={v} value={v}>Ordenar: {l}</option>)}
        </select>
        {f !== NO_FILTER && <Button variant="ghost" className="tab h-8" onClick={() => setF(NO_FILTER)}>LIMPIAR</Button>}
        <span className="text-[11px] text-muted-foreground">{shown.length} de {all.length} runs</span>
      </div>}
      {err && <p className="text-xs text-destructive mt-2">{err}</p>}
      {!rows && !err && <p className="text-xs text-muted-foreground mt-2">Cargando…</p>}
      {rows && empty && <p className="text-xs text-muted-foreground mt-2">{tab === "vivo" ? "Nadie tiene una run en curso publicada ahora mismo." : all.length ? "Ninguna run coincide con los filtros." : "Aún nadie ha publicado una run. ¡Sé el primero!"}</p>}
      {rows && !empty && <div className="grid gap-1 mt-2 max-h-[28rem] overflow-y-auto">
        {tab === "top" && shown.slice(0, 100).map((r, i) => (
          <div key={r.id} className={`item-row text-xs flex-wrap ${r.user_id === me ? "choice-active" : ""}`}>
            <span className="w-8 text-rarity-2">#{i + 1}</span>
            <span className="flex-1">{r.player_name}{r.title ? ` «${r.title}»` : ""}{r.user_id === me ? " (tú)" : ""} · {r.class_name}{r.subclass ? ` / ${r.subclass}` : ""} · {r.difficulty}</span><b>{r.score}</b>
            <span className="w-full text-muted-foreground">{r.outcome === "won" ? "Completó el juego" : r.outcome === "floor" ? `🏁 ${r.cause} · piso ${r.floor}` : `Cayó en el nivel ${r.floor} · ${r.cause}`} · nivel {r.level} · {r.kills} bajas · {[r.melee, r.ranged, r.armor].filter(Boolean).join(" / ")}{dc(r.user_id)}</span>
            <Comments target={`run:${r.id}`} />
          </div>))}
        {tab === "jugadores" && playerStandings(shown).map((p, i) => (
          <div key={p.user_id} className={`item-row text-xs flex-wrap ${p.user_id === me ? "choice-active" : ""}`}>
            <span className="w-8 text-rarity-2">#{i + 1}</span><span className="flex-1">{p.name}{p.title ? ` «${p.title}»` : ""}{p.user_id === me ? " (tú)" : ""}</span><b>{p.best}</b>
            <span className="w-full text-muted-foreground">{p.runs} runs · {p.wins} victorias · más lejos: {p.floor >= 7 ? "final" : `nivel ${p.floor}`}{dc(p.user_id)}</span>
            <Comments target={`player:${p.user_id}`} />
          </div>))}
        {tab === "comparar" && (() => { const c = me ? compareWithWorld(shown, me) : null;
          if (!me) return <p className="text-xs text-muted-foreground">Inicia sesión con Google para comparar tus estadísticas con el mundo.</p>;
          if (!c) return <p className="text-xs text-muted-foreground">Aún no tienes marcas publicadas con estos filtros. Completa un piso o termina una run.</p>;
          const rowsC: [string, typeof c.score][] = [["Puntuación", c.score], ["Bajas", c.kills], ["Piso más lejano", c.floor]];
          return <div className="text-xs space-y-2">
            <p className="font-pixel">Puesto <b className="text-primary">#{c.rank}</b> de {c.players} jugadores · top {Math.max(1, 100 - c.percentile + 1)}% · líder: {c.leader.name}{c.leader.title ? ` «${c.leader.title}»` : ""} ({c.leader.best})</p>
            {rowsC.map(([k, v]) => <div key={k} className="item-row flex-wrap"><span className="flex-1">{k}</span><b>{v.mine}</b><span className="w-full text-muted-foreground">#{v.rank} · líder {v.top} ({v.mine >= v.top ? "¡eres el récord!" : `te faltan ${v.top - v.mine}`}) · mediana {v.median} ({v.mine >= v.median ? "por encima" : "por debajo"})</span></div>)}
          </div>; })()}
        {tab === "ranking" && <FloorRankings />}
        {tab === "mp" && <MpBoard me={me} />}
        {tab === "pisos" && (() => { const w = floorStats(shown), mine = me ? floorStats(shown, me) : [];
          if (!w.length) return <p className="text-xs text-muted-foreground">Aún no hay marcas por piso.</p>;
          return <div className="overflow-x-auto"><table className="w-full text-xs font-pixel"><thead><tr className="text-rarity-2 text-left"><th>Piso</th><th>Partidas</th><th>Muertes</th><th>Superado</th><th>Jugadores</th><th>Tiempo medio</th><th>Bajas medias</th><th>Puntaje medio</th>{me && <th>Tú (tiempo · bajas · puntaje · muertes)</th>}</tr></thead>
            <tbody>{w.map(s => { const m = mine.find(x => x.floor === s.floor); return <tr key={s.floor} className="border-t border-border">
              <td>{s.floor}</td><td>{s.runs}</td><td>{s.deaths} ({s.deathRate}%)</td><td>{s.cleared}</td><td>{s.players}</td><td>{fmtT(s.avgSecs)}</td><td>{s.avgKills}</td><td>{s.avgScore}</td>
              {me && <td>{m ? <><span className={m.avgSecs <= s.avgSecs ? "score-up" : "score-down"}>{fmtT(m.avgSecs)}</span> · <span className={m.avgKills >= s.avgKills ? "score-up" : "score-down"}>{m.avgKills}</span> · <span className={m.avgScore >= s.avgScore ? "score-up" : "score-down"}>{m.avgScore}</span> · {m.deaths}</> : "—"}</td>}</tr>; })}</tbody></table>
            <p className="text-[11px] text-muted-foreground mt-1">Verde = mejor que la media mundial. Respeta los filtros de clase, dificultad y equipo.</p></div>; })()}
        {tab === "vivo" && live?.map((l) => (
          <details key={l.user_id} className={`item-row block text-xs ${l.user_id === me ? "choice-active" : ""}`}>
            <summary className="cursor-pointer">{l.player_name}{l.user_id === me ? " (tú)" : ""} · {l.class_name} · {l.difficulty} · nivel {l.floor} ({l.region}) · personaje nv {l.level} · <b>{l.score} pts</b></summary>
            <p className="text-muted-foreground mt-1">Equipo actual: {[l.melee, l.ranged, l.armor].filter(Boolean).join(" / ") || "ninguno"} · {l.kills} bajas · {fmtT(l.seconds)}{dc(l.user_id)}</p>
            <div className="font-pixel text-[11px] text-rarity-2 mt-1">HISTORIAL DE LA RUN</div>
            <ol className="grid gap-0.5 mt-1">{(l.log as unknown as LiveEntry[]).map((e, i) => <li key={i} className="text-[11px]"><span className="text-muted-foreground">{new Date(e.at).toLocaleTimeString()}</span> {e.text}</li>)}</ol>
            <Comments target={`live:${l.user_id}:${l.run_key}`} />
          </details>))}
        {tab === "formas" && styleStats(shown).map((s) => (
          <div key={s.style} className="item-row text-xs flex-wrap"><span className="flex-1">{s.style}</span><b>{s.runs} runs</b>
            <span className="w-full text-muted-foreground">promedio {s.avg} pts · récord {s.best} · {s.wins} victorias</span>
            <Comments target={`style:${s.style}`} /></div>))}
        {tab === "equipo" && (["melee", "ranged", "armor"] as const).map((slot) => (
          <div key={slot} className="mb-2"><div className="font-pixel text-xs text-rarity-2">{slot === "melee" ? "CUERPO A CUERPO" : slot === "ranged" ? "A DISTANCIA" : "ARMADURA"}</div>
            {gearStats(shown, slot).map((g) => <div key={g.name} className="item-row text-xs flex-wrap"><span className="flex-1">{g.name}</span><span>{g.runs} runs · récord {g.best}</span><Comments target={`gear:${slot}:${g.name}`} /></div>)}</div>))}
      </div>}
    </div>
  );
}

const MODE_NAME: Record<string, string> = { coop: "Cooperativa", traicion: "Traicionera", caos: "Caótica" };
/** Ranking y tus últimas partidas online; los datos los escribe solo el servidor de salas al terminar cada partida. */
export function MpBoard({ me }: { me: string | undefined }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof loadMpProfiles>> | null>(null);
  const [hist, setHist] = useState<Awaited<ReturnType<typeof loadMpHistory>>>([]);
  const [err, setErr] = useState("");
  useEffect(() => { loadMpProfiles().then(setRows).catch(() => setErr("No se pudo cargar el ranking multijugador.")); }, []);
  useEffect(() => { if (me) loadMpHistory(me).then(setHist).catch(() => setHist([])); }, [me]);
  if (err) return <p className="text-xs text-destructive">{err}</p>;
  if (!rows) return <p className="text-xs text-muted-foreground">Cargando…</p>;
  const st = mpStandings(rows);
  return <div className="grid gap-1">
    <p className="text-[11px] text-muted-foreground">Cada partida online terminada con la sesión iniciada se guarda en tu cuenta y suma aquí. Los invitados juegan, pero no puntúan.</p>
    {!st.length && <p className="text-xs text-muted-foreground">Aún no hay partidas multijugador guardadas. ¡Inicia sesión y juega la primera!</p>}
    {st.slice(0, 100).map((p, i) => (
      <div key={p.user_id} className={`item-row text-xs flex-wrap ${p.user_id === me ? "choice-active" : ""}`}>
        <span className="w-8 text-rarity-2">#{i + 1}</span><span className="flex-1">{p.name}{p.user_id === me ? " (tú)" : ""}</span><b>{p.best_score}</b>
        <span className="w-full text-muted-foreground">{p.matches} partidas · {p.wins} primeros puestos · {p.podiums} podios · {p.victories} expediciones superadas · {p.kills} bajas · {p.pvp_kills} jugadores derrotados · {p.revives} reanimaciones · {p.healing} curación · {p.betrayals} traiciones · total {p.total_score}</span>
        <Comments target={`mp:${p.user_id}`} />
      </div>))}
    {me && hist.length > 0 && <>
      <div className="font-pixel text-xs text-rarity-2 mt-2">TUS ÚLTIMAS PARTIDAS ONLINE</div>
      {hist.map((h) => { const m = h.mp_matches as { mode: string; difficulty: string; floors: number; players: number; outcome: string } | null;
        return <div key={h.id} className="item-row text-xs flex-wrap"><span className="w-8 text-rarity-2">{h.place}.º</span>
          <span className="flex-1">{m ? `${MODE_NAME[m.mode] ?? m.mode} · ${m.players} jugadores · piso ${m.floors} · ${m.difficulty}` : "Partida"}{h.title ? ` · «${h.title}»` : ""}</span><b>{h.score}</b>
          <span className="w-full text-muted-foreground">{new Date(h.created_at).toLocaleString()} · {m?.outcome === "victory" ? "expedición superada" : "expedición perdida"}</span></div>; })}
    </>}
  </div>;
}

function FSel({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return <select aria-label={label} className="h-8 rounded border border-border bg-background text-xs px-1" value={value} onChange={(e) => onChange(e.target.value)}>
    <option value="">{label}: todas</option>{options.map((o) => <option key={o} value={o}>{o}</option>)}</select>;
}
