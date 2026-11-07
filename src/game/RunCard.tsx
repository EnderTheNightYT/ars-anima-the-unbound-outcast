import { useEffect, useState } from "react";
import { useAccount, worldRank, loadFloorAverages } from "./cloud";
import { subclasses } from "./subclasses";
import { Button } from "@/components/ui/button";
import type { Game } from "./engine";
import { RunChronicle } from "./NarrativeAction";
import { StrategyTips } from "./StrategyTips";
import { cleanStats, topHurt, type StrategyInput } from "./strategy-tips";

/** Ficha de resultados compartible (muerte, nivel completado o victoria). */
export function runSummary(g: Game, kind: "death" | "floor" | "won") {
  const id = g.chronicles.run?.identity;
  const name = id?.name || g.runName || "Il'Inconnu";
  const title = id?.title || "Lo Desconocido";
  const t = Math.round(g.time), time = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
  const head = kind === "won" ? "completó el Libro Perfecto" : kind === "floor" ? `superó el piso ${g.floor} (${g.region.name})` : `cayó en el piso ${g.floor} (${g.region.name})`;
  const sub = subclasses(g.cls.id).find((x) => x.id === g.subclassId)?.name ?? "";
  const gear = [g.melee?.name, g.ranged?.name, g.armor?.name].filter(Boolean).join(" / ");
  const rows: [string, string | number][] = [
    ["Puntaje", g.score.total.toLocaleString("es")], ["Calificación", g.recap?.grade ?? "—"], ["Piso", g.floor], ["Nivel", g.level],
    ["Bajas", g.kills], ["Racha máx.", g.streakMax ?? 0], ["Tiempo", time], ["Fichas", g.gold],
    ["Clase", [g.cls.name, sub].filter(Boolean).join(" · ")], ["Dificultad", g.difficulty?.name ?? g.difficulty?.id ?? "—"], ["Ánima", g.anima ?? 0], ["Resultado", kind === "won" ? "Victoria" : kind === "floor" ? "Piso superado" : "Muerte"],
  ];
  const text = `Ars. Anima. : - "IL'INCONNU." — ${name}, ${title} (${g.cls.name}) ${head} en dificultad ${g.difficulty?.name ?? g.difficulty?.id ?? "normal"}. Puntaje ${g.score.total} · Nivel ${g.level} · ${g.kills} bajas · ${time}${gear ? ` · Equipo: ${gear}` : ""}${kind === "death" && g.deathCause ? ` · Causa: ${g.deathCause}` : ""}`;
  return { name, title, rows, text, gear };
}

/** Datos de la partida individual para compartir y pedir consejos de estrategia a la IA. */
export function soloStrategyInput(g: Game, kind: "death" | "floor" | "won"): StrategyInput {
  const s = runSummary(g, kind), run = g.chronicles.run;
  const nonzero = Object.fromEntries(Object.entries(run?.stats ?? {}).filter(([, v]) => typeof v === "number" && v > 0));
  return {
    mode: "solo", name: s.name.slice(0, 40), className: [g.cls.name, subclasses(g.cls.id).find(x => x.id === g.subclassId)?.name].filter(Boolean).join(" · ").slice(0, 60),
    difficulty: String(g.difficulty?.name ?? g.difficulty?.id ?? "normal").slice(0, 30),
    outcome: (kind === "won" ? "Victoria" : kind === "floor" ? `Piso ${g.floor} superado` : `Muerte en el piso ${g.floor}${g.deathCause ? ` (${g.deathCause})` : ""}`).slice(0, 80),
    floor: Math.max(0, Math.min(99, g.floor | 0)), level: Math.max(0, Math.min(300, g.level | 0)), score: Math.max(0, Math.round(g.score.total)),
    seconds: Math.max(0, Math.round(g.time)), stats: cleanStats({ ...nonzero, kills: g.kills, streakMax: g.streakMax ?? 0, gold: g.gold }),
    hurt: topHurt(g.hurtCounts), gear: [g.melee?.name, g.ranged?.name, g.armor?.name].filter((x): x is string => !!x).map(x => x.slice(0, 100)),
    title: s.title.slice(0, 80),
  };
}

/** Dibuja la ficha como imagen PNG (1080×1080) para descargar o compartir. */
export function drawRunCard(s: ReturnType<typeof runSummary>, kind: "death" | "floor" | "won", cls: string): Promise<Blob | null> {
  const c = document.createElement("canvas"); c.width = 1080; c.height = 1080; const x = c.getContext("2d"); if (!x) return Promise.resolve(null);
  const ink = "#f2e4cc", blood = "#c8102e", gold = "#ffd34a", mute = "#a8988a";
  const bg = x.createLinearGradient(0, 0, 0, 1080); bg.addColorStop(0, "#1a0a10"); bg.addColorStop(1, "#060306"); x.fillStyle = bg; x.fillRect(0, 0, 1080, 1080);
  x.strokeStyle = blood; x.lineWidth = 6; x.strokeRect(30, 30, 1020, 1020); x.strokeStyle = gold; x.lineWidth = 1; x.strokeRect(46, 46, 988, 988);
  x.textAlign = "center"; x.fillStyle = blood; x.font = "bold 56px Georgia, serif"; x.fillText('ARS. ANIMA. : - "IL\'INCONNU."', 540, 140);
  x.fillStyle = mute; x.font = "30px 'Courier New', monospace"; x.fillText(kind === "won" ? "EL LIBRO PERFECTO" : kind === "floor" ? "PISO SUPERADO" : "LA TINTA SE SECA", 540, 195);
  const fit = (t: string, max: number, size: number, font: string) => { let z = size; do { x.font = `${font.replace("SZ", String(z))}`; z -= 2; } while (x.measureText(t).width > max && z > 18); };
  x.fillStyle = gold; fit(s.name, 940, 72, "bold SZpx Georgia, serif"); x.fillText(s.name, 540, 300);
  x.fillStyle = ink; fit(`«${s.title}» · ${cls}`, 940, 38, "italic SZpx Georgia, serif"); x.fillText(`«${s.title}» · ${cls}`, 540, 355);
  x.textAlign = "left"; s.rows.forEach(([k, v], i) => { const col = i % 3, row = Math.floor(i / 3), bx = 80 + col * 310, by = 410 + row * 120;
    x.fillStyle = "rgba(242,228,204,.07)"; x.fillRect(bx, by, 290, 104); x.fillStyle = mute; x.font = "24px 'Courier New', monospace"; x.fillText(String(k).toUpperCase(), bx + 16, by + 34);
    x.fillStyle = ink; fit(String(v), 260, 40, "bold SZpx 'Courier New', monospace"); x.fillText(String(v), bx + 16, by + 82); });
  x.textAlign = "center"; x.fillStyle = mute; x.font = "26px 'Courier New', monospace"; x.fillText("EQUIPO", 540, 920);
  x.fillStyle = ink; fit(s.gear || "—", 960, 30, "SZpx 'Courier New', monospace"); x.fillText(s.gear || "—", 540, 962);
  x.fillStyle = blood; x.font = "22px 'Courier New', monospace"; x.fillText(window.location.host, 540, 1010);
  return new Promise((r) => c.toBlob(r, "image/png"));
}

export function RunCard({ g, kind }: { g: Game; kind: "death" | "floor" | "won" }) {
  const s = runSummary(g, kind); const [done, setDone] = useState("");
  const user = useAccount(); const [rank, setRank] = useState<{ rank: number; total: number } | null>(null);
  const score = g.score.total;
  const [avg, setAvg] = useState<Awaited<ReturnType<typeof loadFloorAverages>>[number] | null>(null);
  useEffect(() => { let on = true; loadFloorAverages().then((a) => { if (on) setAvg(a.find((x) => x.floor === g.floor) ?? null); }).catch(() => {}); return () => { on = false; }; }, [g.floor]);
  useEffect(() => { let on = true; const t = window.setTimeout(() => { worldRank(score).then(r => { if (on) setRank(r); }).catch(() => {}); }, 1500); return () => { on = false; clearTimeout(t); }; }, [score]);
  const [img, setImg] = useState<File | null>(null);
  const track = (method: string) => window.__lovableEvents?.track?.("project.result_shared", { method, kind, floor: g.floor });
  useEffect(() => { let on = true; const t = window.setTimeout(() => { void drawRunCard(s, kind, g.cls.name).then((b) => { if (on && b) setImg(new File([b], `ars-anima-${kind}-piso${g.floor}.png`, { type: "image/png" })); }); }, 300); return () => { on = false; clearTimeout(t); }; }, [kind, g.floor, g.score.total]); // eslint-disable-line react-hooks/exhaustive-deps
  const download = () => { if (!img) return; const url = URL.createObjectURL(img); const a = document.createElement("a"); a.href = url; a.download = img.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); setDone("Imagen descargada"); track("image_download"); };
  const shareImage = async () => {
    if (!img) return;
    if (navigator.canShare?.({ files: [img] })) { try { await navigator.share({ files: [img], title: "Ars. Anima.", text: s.text }); setDone("¡Imagen compartida!"); track("image_share"); return; } catch (e) { if ((e as DOMException).name === "AbortError") return; } }
    download();
  };
  const share = async () => {
    const url = window.location.origin;
    try { if (navigator.share) { await navigator.share({ title: "Ars. Anima.", text: s.text, url }); setDone("¡Compartido!"); track("text_share"); return; } } catch { /* cancelado */ }
    try { await navigator.clipboard.writeText(`${s.text}\n${url}`); setDone("Copiado al portapapeles"); track("text_copy"); } catch { setDone("No se pudo copiar"); }
  };
  return <div className="w-full max-w-3xl mt-3 rounded border border-primary bg-card p-3 font-pixel">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><div className="min-w-0"><b className="text-rarity-2 text-lg break-words">{s.name}</b> <span className="text-sm">«{s.title}» · {g.cls.name}</span></div>
      <div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" onClick={share}>Compartir resultado</Button>
        <Button size="sm" variant="outline" disabled={!img} onClick={download}>Descargar imagen</Button>
        <Button size="sm" variant="outline" disabled={!img} onClick={() => void shareImage()}>Compartir imagen</Button></div></div>
    <dl className="grid grid-cols-4 gap-2 mt-2 text-sm">{s.rows.map(([k, v]) => <div key={k} className="rounded bg-muted p-1 min-w-0"><dt className="text-[10px] text-muted-foreground">{k}</dt><dd className="text-primary">{v}</dd></div>)}</dl>
    {kind === "death" && g.deathCause && <p className="text-xs mt-2">Causa: <b className="text-destructive">{g.deathCause}</b></p>}
    {s.gear && <p className="text-xs mt-1 text-muted-foreground">Equipo: {s.gear}</p>}
    {avg && <p className="text-xs mt-1">Media mundial en el piso {g.floor} ({avg.runs} partidas): <span className={g.time <= avg.avgSeconds ? "score-up" : "score-down"}>{Math.floor(avg.avgSeconds / 60)}m {String(Math.round(avg.avgSeconds % 60)).padStart(2, "0")}s</span> · <span className={g.kills >= avg.avgKills ? "score-up" : "score-down"}>{avg.avgKills} bajas</span> · <span className={g.score.total >= avg.avgScore ? "score-up" : "score-down"}>{avg.avgScore} pts</span> · {Math.round(avg.deaths / Math.max(1, avg.runs) * 100)}% muere aquí</p>}
    {g.runFloors.length > 0 && <p className="text-xs text-muted-foreground mt-2">Pisos: {g.runFloors.map(f => `${f.floor} ${f.grade}`).join(" · ")}</p>}
    <p className="text-xs mt-2">{rank ? <>Puesto mundial <b className="text-primary">#{rank.rank}</b> de {rank.total} marcas · supera al {Math.round((1 - (rank.rank - 1) / rank.total) * 100)}% de los jugadores</> : "Calculando puesto mundial…"}
      {!user && <span className="text-muted-foreground"> · Inicia sesión con Google en el menú principal para publicar tu marca en la clasificación mundial.</span>}</p>
    <StrategyTips input={soloStrategyInput(g, kind)} />
    <RunChronicle g={g} kind={kind} />
    {done && <p className="text-xs text-accent mt-1" role="status">{done}</p>}
  </div>;
}
