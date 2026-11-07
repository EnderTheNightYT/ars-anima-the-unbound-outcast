import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import bookWorld from "@/assets/palimpsest/book-world.png";
import bookOpen from "@/assets/palimpsest/book-open.png";
import { DOCS, DICTIONARY, FAMILY_NAMES, LIBRARY, docById, dictById, type PalimpsestDoc } from "./palimpsest-data";
import { SCORE } from "./score";
import { solveScoreMult, canInvestigate, checkArrange, checkConnect, decipher, grilleReveal, overlayReveal, solveDoc, addHint as takeHint } from "./palimpsest";
import type { Game } from "./engine";

type Tile = { id: number; t: string };

/** Persistent book card shown in the backpack: "Investigar" needs a bench; the journal never does. */
export function PalimpsestBookCard({ g, open }: { g: Game; open: (view: "investigar" | "diario") => void }) {
  if (!g.palim.hasBook) return null;
  const ok = canInvestigate({ hasBook: true, sitting: g.sitting, collapse: !!g.collapse });
  const why = g.collapse ? "El colapso está activo: sobrevive primero." : !g.sitting ? "Siéntate en una banca para investigar." : "";
  return (
    <div className="palim-card">
      <img src={bookWorld} alt="Libro PALIMPSESTOS" className="palim-card-img" width={72} height={72} loading="lazy" />
      <div className="min-w-0 flex-1">
        <div className="title-gothic text-base text-rarity-2">PALIMPSESTOS</div>
        <div className="text-[11px] text-muted-foreground">Objeto persistente · {g.palim.solved.length}/{g.palim.found.length} folios descifrados · {g.palim.found.length}/{DOCS.length} hallados</div>
        {why && <div className="text-[11px] text-destructive mt-0.5">{why}</div>}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="ghost" className="palim-btn" disabled={!ok} onClick={() => open("investigar")}>Investigar</Button>
          <Button variant="ghost" className="palim-btn" onClick={() => open("diario")}>Diario</Button>
        </div>
      </div>
    </div>
  );
}

export function PalimpsestPanel({ g, view, setView, rerender }: { g: Game; view: "investigar" | "diario"; setView: (v: "investigar" | "diario") => void; rerender: () => void }) {
  const can = canInvestigate({ hasBook: g.palim.hasBook, sitting: g.sitting, collapse: !!g.collapse });
  return (
    <div className="palim-panel font-pixel">
      <div className="palim-head">
        <img src={bookOpen} alt="" className="palim-head-img" width={96} height={72} loading="lazy" />
        <div className="min-w-0">
          <h3 className="title-gothic text-xl text-rarity-2">PALIMPSESTOS · THE LOST LANGUAGE</h3>
          <p className="text-xs text-muted-foreground">Descubrir qué significan los fragmentos que el mundo ha intentado borrar.</p>
        </div>
      </div>
      <div className="flex gap-1 my-3">
        <Button variant="ghost" className={`tab ${view === "investigar" ? "tab-active" : ""}`} onClick={() => setView("investigar")}>INVESTIGAR</Button>
        <Button variant="ghost" className={`tab ${view === "diario" ? "tab-active" : ""}`} onClick={() => setView("diario")}>DIARIO</Button>
      </div>
      {view === "investigar" ? (can ? <Research g={g} rerender={rerender} /> : <p className="text-sm text-destructive">{g.collapse ? "El colapso está activo. La investigación puede esperar: llega al portal." : "Necesitas sentarte en una banca para abrir una nueva sesión de investigación. Puedes consultar el diario cuando quieras."}</p>) : <Journal g={g} />}
    </div>
  );
}

function Research({ g, rerender }: { g: Game; rerender: () => void }) {
  const docs = g.palim.found.map(docById).filter((d): d is PalimpsestDoc => !!d);
  const [sel, setSel] = useState<string>(docs.find((d) => !g.palim.solved.includes(d.id))?.id ?? docs[0]?.id ?? "");
  const doc = docById(sel);
  if (!docs.length) return <p className="text-sm text-muted-foreground">El libro está en blanco. Explora para encontrar folios.</p>;
  return (
    <div className="palim-research">
      <div className="palim-doclist" role="list">
        {docs.map((d) => (
          <Button key={d.id} variant="ghost" className={`palim-docbtn ${d.id === sel ? "is-active" : ""}`} onClick={() => setSel(d.id)}>
            <span className="truncate">{g.palim.solved.includes(d.id) ? "✓ " : "◇ "}{d.title}</span>
            <small>{FAMILY_NAMES[d.family]}</small>
          </Button>
        ))}
      </div>
      {doc && <DocWork key={doc.id} g={g} doc={doc} rerender={rerender} />}
    </div>
  );
}

function DocWork({ g, doc, rerender }: { g: Game; doc: PalimpsestDoc; rerender: () => void }) {
  const solved = g.palim.solved.includes(doc.id);
  const hintsUsed = g.palim.hints[doc.id] ?? 0;
  const [msg, setMsg] = useState("");
  const [grille, setGrille] = useState(false);
  const [overlay, setOverlay] = useState(false);
  useEffect(() => { g.track("investigated", 1, doc.title, {}, `investigate-${doc.id}`); }, [g, doc.id, doc.title]);
  const finish = () => {
    const r = solveDoc(g.palim, doc.id);
    g.savePalim(r.state);
    setMsg(r.reward ? `Descifrado. ${r.reward.label}${r.reward.kind === "escritura" || r.reward.kind === "reliquia" || r.reward.kind === "tabula" ? " · " + r.reward.desc : ""}` : "Descifrado.");
    if (r.fresh) { g.awardPalimpsest(Math.round(SCORE.palimpsest * solveScoreMult(hintsUsed))); g.onSound?.("level"); g.msg?.(`PALIMPSESTOS: «${doc.title}» descifrado.`); }
    rerender();
  };
  return (
    <div className="palim-work">
      <section className="palim-doc">
        <div className="palim-label">Documento original · {doc.kindLabel}</div>
        <h4 className="title-gothic text-lg text-primary">{doc.title}</h4>
        {doc.lines.map((l, i) => <p key={i} className="palim-line">{doc.family === "acrostico" ? <><b className="palim-initial">{l[0]}</b>{l.slice(1)}</> : l}</p>)}
        {doc.quote && <blockquote className="palim-quote">{doc.quote.text}<cite>— {doc.quote.author}, {doc.quote.work}</cite></blockquote>}
        {doc.grid && doc.mask && (
          <div className="mt-2">
            <div className="palim-grid" style={{ gridTemplateColumns: `repeat(${doc.grid[0]?.length ?? 5}, 1fr)` }}>
              {doc.grid.flatMap((row, r) => [...row].map((ch, c) => { const hole = doc.mask!.some(([mr, mc]) => mr === r && mc === c); return <span key={`${r}-${c}`} className={`palim-cell ${grille ? (hole ? "is-hole" : "is-covered") : ""}`}>{ch}</span>; }))}
            </div>
            <Button variant="ghost" className="palim-btn mt-2" onClick={() => setGrille((v) => !v)}>{grille ? "Retirar rejilla" : "Aplicar rejilla"}</Button>
            {grille && <div className="text-xs text-rarity-2 mt-1">Revelado: {grilleReveal(doc).join(" · ")}</div>}
          </div>
        )}
        {doc.layers && (
          <div className="mt-2 space-y-1">
            <div className="palim-layer">{overlay ? overlayReveal(doc.layers[0], doc.layers[1]) : doc.layers[0]}</div>
            {!overlay && <div className="palim-layer is-b">{doc.layers[1]}</div>}
            <Button variant="ghost" className="palim-btn" onClick={() => setOverlay((v) => !v)}>{overlay ? "Separar capas" : "Superponer capas"}</Button>
          </div>
        )}
        {doc.cipher && doc.key && (
          <div className="mt-2">
            <div className="palim-cipher">{doc.cipher}</div>
            <div className="text-xs text-muted-foreground mt-1">Clave parcial: {Object.entries(doc.key).map(([k, v]) => `${k}=${v}`).join(" · ")}</div>
            <div className="text-xs text-rarity-2">Lectura con la clave: {decipher(doc.cipher, doc.key)}</div>
          </div>
        )}
      </section>
      <section className="palim-solve">
        <div className="palim-label">{doc.pairs ? "Tablero de conexiones" : "Reconstrucción"}</div>
        <p className="text-xs mb-2">{doc.prompt}</p>
        {solved ? <Solved doc={doc} /> : doc.pairs ? <ConnectBoard doc={doc} onSolve={finish} onFail={() => { setMsg("Alguna conexión no se sostiene. Revisa el documento."); g.misreadSummon(); rerender(); }} /> : <Arrange doc={doc} onSolve={finish} onFail={() => { setMsg("La lectura no tiene sentido todavía. Prueba otro orden."); g.misreadSummon(); rerender(); }} />}
        {msg && <p className="palim-msg">{msg}</p>}
        {!solved && (
          <div className="mt-3">
            <Button variant="ghost" className="palim-btn" disabled={hintsUsed >= doc.hints.length} onClick={() => { g.savePalim(takeHint(g.palim, doc.id)); rerender(); }}>Pista ({hintsUsed}/{doc.hints.length})</Button>
            <ol className="palim-hints">{doc.hints.slice(0, hintsUsed).map((h, i) => <li key={i}>{h}</li>)}</ol>
          </div>
        )}
      </section>
    </div>
  );
}

function Solved({ doc }: { doc: PalimpsestDoc }) {
  return (
    <div className="palim-result">
      <div className="palim-label">Resultado</div>
      <p className="text-sm">{doc.result}</p>
      <p className="text-xs text-muted-foreground mt-1">{doc.deduction}</p>
      <p className="text-xs text-rarity-2 mt-1">{doc.reward.label}</p>
    </div>
  );
}

function Arrange({ doc, onSolve, onFail }: { doc: PalimpsestDoc; onSolve: () => void; onFail: () => void }) {
  const pool = useMemo<Tile[]>(() => (doc.tiles ?? []).map((t, id) => ({ id, t })), [doc]);
  const [placed, setPlaced] = useState<Tile[]>([]);
  const free = pool.filter((p) => !placed.some((q) => q.id === p.id));
  const [drag, setDrag] = useState<number | null>(null);
  const move = (from: number, to: number) => setPlaced((ps) => { const n = [...ps]; const [x] = n.splice(from, 1); if (x) n.splice(to, 0, x); return n; });
  return (
    <div>
      <div className="palim-label">Fragmentos</div>
      <div className="palim-tiles">
        {free.map((t) => <button key={t.id} type="button" className="palim-tile" onClick={() => setPlaced((p) => [...p, t])}>{t.t}</button>)}
        {!free.length && <span className="text-xs text-muted-foreground">Todos los fragmentos colocados.</span>}
      </div>
      <div className="palim-label mt-2">Reconstrucción (toca para devolver · arrastra para reordenar)</div>
      <div className="palim-slots">
        {placed.map((t, i) => (
          <button key={t.id} type="button" draggable className="palim-tile is-placed"
            onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag !== null && drag !== i) move(drag, i); setDrag(null); }}
            onClick={() => setPlaced((p) => p.filter((q) => q.id !== t.id))}
            onKeyDown={(e) => { if (e.key === "ArrowLeft" && i > 0) { e.preventDefault(); move(i, i - 1); } if (e.key === "ArrowRight" && i < placed.length - 1) { e.preventDefault(); move(i, i + 1); } }}>{t.t}</button>
        ))}
        {!placed.length && <span className="text-xs text-muted-foreground">Vacío</span>}
      </div>
      <div className="mt-2 flex gap-2">
        <Button variant="ghost" className="palim-btn" onClick={() => setPlaced([])}>Limpiar</Button>
        <Button className="btn-blood palim-confirm" onClick={() => (checkArrange(doc, placed.map((p) => p.t)) ? onSolve() : onFail())}>Confirmar</Button>
      </div>
    </div>
  );
}

function ConnectBoard({ doc, onSolve, onFail }: { doc: PalimpsestDoc; onSolve: () => void; onFail: () => void }) {
  const lefts = doc.pairs!.map((p) => p[0]);
  const rights = useMemo(() => { const r = doc.pairs!.map((p) => p[1]); return [...r.slice(2), ...r.slice(0, 2)].reverse(); }, [doc]);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [pickL, setPickL] = useState<string | null>(null);
  const color = (l: string) => `var(--palim-link-${lefts.indexOf(l) % 5})`;
  const rowH = 44;
  return (
    <div>
      <div className="palim-board" style={{ height: lefts.length * rowH }}>
        <svg className="palim-lines" viewBox={`0 0 100 ${lefts.length * rowH}`} preserveAspectRatio="none" aria-hidden>
          {Object.entries(links).map(([l, r]) => { const y1 = lefts.indexOf(l) * rowH + rowH / 2, y2 = rights.indexOf(r) * rowH + rowH / 2; return <line key={l} x1="0" y1={y1} x2="100" y2={y2} stroke={color(l)} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />; })}
        </svg>
        <div className="palim-col">{lefts.map((l) => <button key={l} type="button" className={`palim-node ${pickL === l ? "is-picked" : ""} ${links[l] ? "is-linked" : ""}`} style={links[l] ? { borderColor: color(l) } : undefined} onClick={() => setPickL(pickL === l ? null : l)}>{l}</button>)}</div>
        <div className="palim-col is-right">{rights.map((r) => { const owner = Object.keys(links).find((l) => links[l] === r); return <button key={r} type="button" className={`palim-node ${owner ? "is-linked" : ""}`} style={owner ? { borderColor: color(owner) } : undefined} onClick={() => { if (!pickL) { if (owner) setLinks((ls) => { const n = { ...ls }; delete n[owner]; return n; }); return; } setLinks((ls) => { const n = { ...ls }; for (const k of Object.keys(n)) if (n[k] === r) delete n[k]; n[pickL] = r; return n; }); setPickL(null); }}>{r}</button>; })}</div>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">Elige un fragmento a la izquierda y luego su pareja a la derecha. Toca una pareja enlazada para soltarla.</p>
      <div className="mt-2 flex gap-2">
        <Button variant="ghost" className="palim-btn" onClick={() => setLinks({})}>Limpiar</Button>
        <Button className="btn-blood palim-confirm" onClick={() => (checkConnect(doc, links) ? onSolve() : onFail())}>Confirmar</Button>
      </div>
    </div>
  );
}

function Journal({ g }: { g: Game }) {
  const [sec, setSec] = useState<"fragmentos" | "lenguas" | "conexiones" | "recuerdos">("fragmentos");
  const p = g.palim;
  const found = p.found.map(docById).filter((d): d is PalimpsestDoc => !!d);
  const solved = p.solved.map(docById).filter((d): d is PalimpsestDoc => !!d);
  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-3">{(["fragmentos", "lenguas", "conexiones", "recuerdos"] as const).map((s) => <Button key={s} variant="ghost" className={`tab ${sec === s ? "tab-active" : ""}`} onClick={() => setSec(s)}>{s.toUpperCase()}</Button>)}</div>
      {sec === "fragmentos" && (found.length ? found.map((d) => <div key={d.id} className="palim-entry"><b className="text-primary">{d.title}</b> <small className="text-muted-foreground">· {d.kindLabel} · {LIBRARY[d.theme]}</small>{d.lines.map((l, i) => <p key={i} className="text-xs">{l}</p>)}{d.quote && <p className="text-xs text-rarity-2">«{d.quote.text}» — {d.quote.author}, {d.quote.work}</p>}</div>) : <Empty />)}
      {sec === "lenguas" && (p.dict.length ? p.dict.map(dictById).filter(Boolean).map((e) => <div key={e!.id} className="palim-entry"><b className="text-rarity-2">{e!.word}</b> <small>· {e!.lang}</small>{e!.ambiguous && <small className="text-destructive"> · significado incierto</small>}<p className="text-xs">«{e!.translation}»{e!.etym ? ` · ${e!.etym}` : ""}</p><p className="text-xs text-muted-foreground">{e!.lore}</p><p className="text-[11px]">Aparece en: {DOCS.filter((d) => d.dict.includes(e!.id)).map((d) => d.title).join(" · ")}</p><p className="text-[11px] text-muted-foreground">Relacionadas: {e!.related.map((r) => (p.dict.includes(r) ? dictById(r)?.word : "???")).join(" · ")}</p></div>) : <Empty text={`Diccionario vacío · ${DICTIONARY.length} entradas por descubrir.`} />)}
      {sec === "conexiones" && (solved.length ? solved.map((d) => <div key={d.id} className="palim-entry"><b className="text-primary">{FAMILY_NAMES[d.family]} · {d.title}</b><p className="text-xs">{d.deduction}</p><p className="text-xs text-rarity-2">{d.reward.label}</p></div>) : <Empty />)}
      {sec === "recuerdos" && (p.memories.length ? p.memories.map(docById).filter(Boolean).map((d) => <div key={d!.id} className="palim-entry"><b className="text-rarity-2">{d!.memory?.title ?? d!.reward.label}</b><p className="text-xs">{d!.memory?.text ?? d!.result}</p></div>) : <Empty />)}
    </div>
  );
}
const Empty = ({ text = "Nada todavía." }: { text?: string }) => <p className="text-sm text-muted-foreground">{text}</p>;
