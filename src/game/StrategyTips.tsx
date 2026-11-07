import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Lightbulb, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateStrategyTips } from "@/lib/strategy-tips.functions";
import { strategyShareText, type StrategyAdvice, type StrategyInput } from "./strategy-tips";

/** Compartir estadísticas de la partida y pedir consejos de estrategia personalizados por IA. */
export function StrategyTips({ input, compact = false }: { input: StrategyInput; compact?: boolean }) {
  const ask = useServerFn(generateStrategyTips);
  const [advice, setAdvice] = useState<StrategyAdvice | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [error, setError] = useState(""), [done, setDone] = useState("");
  const request = async () => {
    setState("busy"); setError("");
    try {
      const r = await ask({ data: input });
      if (r.ok) { setAdvice(r.advice); setState("idle"); window.__lovableEvents?.track?.("project.strategy_tips", { mode: input.mode }); }
      else { setError(r.error); setState("error"); }
    } catch (e) { setError(e instanceof Error ? e.message : "La IA no está disponible."); setState("error"); }
  };
  const share = async () => {
    const text = strategyShareText(input, advice), url = window.location.origin;
    try { if (navigator.share) { await navigator.share({ title: "Ars. Anima.", text, url }); setDone("¡Estadísticas compartidas!"); return; } } catch (e) { if ((e as DOMException)?.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(`${text}\n${url}`); setDone("Estadísticas copiadas al portapapeles"); } catch { setDone("No se pudo copiar"); }
    window.__lovableEvents?.track?.("project.result_shared", { method: "stats_text", mode: input.mode });
  };
  return <div className={`strategy-box ${compact ? "mt-2" : "mt-3"} text-left`} aria-live="polite">
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={state === "busy"} onClick={() => void request()}><Lightbulb className="size-4" />{state === "busy" ? "El estratega lee tu partida…" : advice ? "Otros consejos (IA)" : "Consejos de estrategia (IA)"}</Button>
      <Button size="sm" variant="outline" onClick={() => void share()}><Share2 className="size-4" />{advice ? "Compartir estadísticas y consejos" : "Compartir estadísticas"}</Button>
    </div>
    {advice && <div className="strategy-advice mt-2 p-2">
      <p className="title-gothic text-primary">{advice.headline}</p>
      <ol className="mt-1 grid gap-1 text-xs list-decimal pl-5">{advice.tips.map((t, i) => <li key={i}><b className="text-rarity-2">{t.title}.</b> {t.detail}</li>)}</ol>
    </div>}
    {error && <p role="status" className="text-destructive text-xs mt-1">{error}</p>}
    {done && <p role="status" className="text-accent text-xs mt-1">{done}</p>}
  </div>;
}
