import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Gauge, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generatePerfTips } from "@/lib/perf-tips.functions";
import { gfxStore } from "./gfx/settings";
import { perf, deviceInfo, perfShareText, HITCH_MS, FREEZE_MS, type PerfInput } from "./perf-monitor";
import type { StrategyAdvice } from "./strategy-tips";
import type { Game } from "./engine";
import { mp } from "./net/client";

const PANEL_KEY = "ars_anima_perf_panel";
export const perfPanelOn = () => { try { return localStorage.getItem(PANEL_KEY) === "1"; } catch { return false; } };
const listeners = new Set<(v: boolean) => void>();
export function setPerfPanel(v: boolean) { try { localStorage.setItem(PANEL_KEY, v ? "1" : "0"); } catch { /* */ } listeners.forEach(f => f(v)); }
function usePerfPanel() { const [on, setOn] = useState(false); useEffect(() => { setOn(perfPanelOn()); listeners.add(setOn); return () => { listeners.delete(setOn); }; }, []); return on; }

/** Panel opcional durante la partida: FPS, tiempo de fotograma, gráfica y tirones. */
export function PerfOverlay() {
  const on = usePerfPanel(); const cv = useRef<HTMLCanvasElement>(null); const [txt, setTxt] = useState({ fps: 0, ms: 0, hitches: 0, last: "" });
  useEffect(() => {
    if (!on) return;
    const id = window.setInterval(() => {
      const h = perf.hitches.at(-1);
      setTxt({ fps: perf.fps, ms: perf.frameMs, hitches: perf.hitches.length, last: h ? `${h.ms} ms · ${h.at}s` : "" });
      const c = cv.current?.getContext("2d"); if (!c || !cv.current) return;
      const W = cv.current.width, H = cv.current.height, f = perf.frames, css = getComputedStyle(cv.current);
      c.clearRect(0, 0, W, H);
      const y = (ms: number) => H - Math.min(H, ms / 66 * H);
      c.strokeStyle = css.getPropertyValue("--perf-grid") || "gray"; c.globalAlpha = .5; c.beginPath(); c.moveTo(0, y(16.7)); c.lineTo(W, y(16.7)); c.moveTo(0, y(33.3)); c.lineTo(W, y(33.3)); c.stroke(); c.globalAlpha = 1;
      const bw = W / Math.max(1, f.length);
      f.forEach((ms, i) => { c.fillStyle = ms >= FREEZE_MS ? css.getPropertyValue("--perf-bad") : ms >= HITCH_MS ? css.getPropertyValue("--perf-mid") : css.getPropertyValue("--perf-good"); c.fillRect(i * bw, y(ms), Math.max(1, bw - .3), H - y(ms)); });
    }, 250);
    return () => clearInterval(id);
  }, [on]);
  if (!on) return null;
  const q = txt.fps >= 50 ? "good" : txt.fps >= 30 ? "mid" : "bad";
  return <div className="perf-overlay font-pixel" aria-label="Rendimiento en vivo">
    <div className="flex justify-between gap-2"><span className={`perf-${q}`}>{txt.fps} FPS</span><span>{txt.ms} ms</span></div>
    <canvas ref={cv} width={120} height={28} className="perf-graph" />
    <div className="flex justify-between gap-2"><span>Tirones {txt.hitches}</span>{mp.active && <span>{Math.round(mp.rtt)} ms red</span>}</div>
    {txt.last && <div className="text-muted-foreground">Último: {txt.last}</div>}
  </div>;
}

function buildInput(g: Game): PerfInput {
  const s = gfxStore.get();
  return {
    summary: perf.summary(),
    hitches: perf.hitches.slice(-40),
    device: deviceInfo(),
    net: { online: mp.active, ping: Math.round(mp.rtt), reconnecting: mp.status === "reconnecting" },
    settings: { preset: s.preset, backend: s.backend, camera: g.camera.mode, maxFps: s.maxFps, renderScale: s.renderScale },
  };
}

/** Compartir métricas y pedir recomendaciones de optimización por IA (menú Ajustes). */
export function PerfAdvisor({ g }: { g: Game }) {
  const on = usePerfPanel(); const ask = useServerFn(generatePerfTips);
  const [advice, setAdvice] = useState<StrategyAdvice | null>(null);
  const [state, setState] = useState<"idle" | "busy">("idle"), [msg, setMsg] = useState(""), [err, setErr] = useState("");
  const s = perf.summary();
  const request = async () => {
    setState("busy"); setErr("");
    try { const r = await ask({ data: buildInput(g) }); if (r.ok) { setAdvice(r.advice); window.__lovableEvents?.track?.("project.perf_tips", {}); } else setErr(r.error); }
    catch (e) { setErr(e instanceof Error ? e.message : "La IA no está disponible."); }
    setState("idle");
  };
  const share = async () => {
    const text = perfShareText(buildInput(g), advice);
    try { if (navigator.share) { await navigator.share({ title: "Ars. Anima. · rendimiento", text }); setMsg("Métricas compartidas"); return; } } catch (e) { if ((e as DOMException)?.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(text); setMsg("Métricas copiadas al portapapeles"); } catch { setMsg("No se pudo copiar"); }
  };
  return <div className="mp-box p-3 mt-4 text-left text-xs" aria-live="polite">
    <div className="title-gothic text-lg text-primary">RENDIMIENTO</div>
    <label className="flex items-center justify-between gap-2 mt-1 font-pixel">Panel de FPS y tiempo de fotograma en partida<input type="checkbox" checked={on} onChange={e => setPerfPanel(e.target.checked)} /></label>
    <p className="mt-2 text-muted-foreground">{s.seconds} s medidos · FPS medio {s.avgFps} · mínimo {s.minFps} · p95 {s.p95Ms} ms · tirones {s.hitches} ({s.freezes} graves){mp.active ? ` · ping ${Math.round(mp.rtt)} ms` : ""}</p>
    <p className="text-[11px] text-muted-foreground">Se envían sólo métricas, cuándo hubo tirones y capacidades del equipo (sistema, núcleos, memoria, GPU, navegador); nada personal.</p>
    <div className="flex flex-wrap gap-2 mt-2">
      <Button size="sm" variant="outline" disabled={state === "busy" || s.seconds < 5} onClick={() => void request()}><Gauge className="size-4" />{state === "busy" ? "Analizando tu equipo…" : advice ? "Otras recomendaciones (IA)" : "Recomendaciones de optimización (IA)"}</Button>
      <Button size="sm" variant="outline" onClick={() => void share()}><Share2 className="size-4" />Compartir métricas</Button>
    </div>
    {s.seconds < 5 && <p className="mt-1 text-muted-foreground">Juega unos segundos para tener datos.</p>}
    {advice && <div className="strategy-advice mt-2 p-2"><p className="title-gothic text-primary">{advice.headline}</p>
      <ol className="mt-1 grid gap-1 list-decimal pl-5">{advice.tips.map((t, i) => <li key={i}><b className="text-rarity-2">{t.title}.</b> {t.detail}</li>)}</ol></div>}
    {err && <p role="status" className="text-destructive mt-1">{err}</p>}
    {msg && <p role="status" className="text-accent mt-1">{msg}</p>}
  </div>;
}
