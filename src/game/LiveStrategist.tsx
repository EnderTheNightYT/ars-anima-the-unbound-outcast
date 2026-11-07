import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Lightbulb, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateLiveStrategy } from "@/lib/strategy-tips.functions";
import type { StrategyAdvice } from "./strategy-tips";
import { liveShareText, liveStrategyFromGame } from "./live-strategy";
import type { Game } from "./engine";

/** Pestaña ESTRATEGA: comparte clase, estado y encuentro actuales y pide una estrategia a la IA. */
export function LiveStrategist({ g }: { g: Game }) {
  const ask = useServerFn(generateLiveStrategy);
  const [note, setNote] = useState("");
  const [plan, setPlan] = useState<StrategyAdvice | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [done, setDone] = useState("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const input = useMemo(() => liveStrategyFromGame(g as never, note), [g, note, g.hp, g.enemies.length]);
  const request = async () => {
    setBusy(true); setError("");
    try {
      const r = await ask({ data: input });
      if (r.ok) setPlan(r.advice); else setError(r.error);
    } catch (e) { setError(e instanceof Error ? e.message : "La IA no está disponible."); }
    setBusy(false);
  };
  const share = async () => {
    const text = liveShareText(input, plan);
    try { if (navigator.share) { await navigator.share({ title: "Ars. Anima.", text }); setDone("¡Compartido!"); return; } } catch (e) { if ((e as DOMException)?.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(text); setDone("Copiado al portapapeles"); } catch { setDone("No se pudo copiar"); }
  };
  const c = input.condition;
  return <div className="font-pixel space-y-3" aria-live="polite">
    <h3 className="title-gothic text-xl text-rarity-2">ESTRATEGA</h3>
    <div className="item-row flex-col items-start">
      <div><b>{input.className}</b> · nivel {input.level} · piso {input.floor} ({input.region}) · {input.weapon}</div>
      <div className="text-muted-foreground">Vida {c.hpPct}% · Aguante {c.staminaPct}% · Lumbre {c.lumbre} · Hambre {c.food} · Sed {c.thirst}{c.statuses.length ? ` · ${c.statuses.join(", ")}` : ""}{c.wounds.length ? ` · heridas: ${c.wounds.join(", ")}` : ""}</div>
      <div>{input.encounter.length ? input.encounter.map(e => `${e.count}× ${e.kind}${e.tag ? ` (${e.tag})` : ""} a ${e.nearest}`).join(" · ") : "No hay enemigos cerca."}</div>
    </div>
    <textarea className="w-full bg-background border border-border p-2 text-sm" maxLength={200} rows={2} placeholder="Opcional: describe la situación (p. ej. «me rodean en un pasillo»)" value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => e.stopPropagation()} />
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void request()}><Lightbulb className="size-4" />{busy ? "El estratega observa…" : plan ? "Otra estrategia (IA)" : "Pedir estrategia (IA)"}</Button>
      <Button size="sm" variant="outline" onClick={() => void share()}><Share2 className="size-4" />Compartir situación</Button>
    </div>
    {plan && <div className="strategy-advice p-2"><p className="title-gothic text-primary">{plan.headline}</p><ol className="mt-1 grid gap-1 text-xs list-decimal pl-5">{plan.tips.map((t, i) => <li key={i}><b className="text-rarity-2">{t.title}.</b> {t.detail}</li>)}</ol></div>}
    {error && <p role="status" className="text-destructive text-xs">{error}</p>}
    {done && <p role="status" className="text-accent text-xs">{done}</p>}
  </div>;
}
