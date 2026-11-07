import { REGIONS } from "./regions";
import type { Game } from "./engine";

/** Escalera de pisos: peldaños, tareas del piso y desbloqueos; cada piso enlaza a su wiki. */
export function FloorProgressPanel({ g }: { g: Game }) {
  const best = Math.max(g.floor, g.legacy?.maxFloor ?? 1);
  return <section className="font-pixel space-y-3">
    <h3 className="title-gothic text-xl text-rarity-2">Progreso por piso</h3>
    <ol className="space-y-2">{REGIONS.map((r, i) => {
      const n = i + 1, rec = g.runFloors.find(f => f.floor === n), cur = n === g.floor, done = !!rec || n < g.floor, open = n <= best;
      const tasks: [string, boolean][] = cur ? [
        [`Bajas en el piso: ${g.floorKills}`, g.floorKills >= 3],
        ...(g.contract ? [[`${g.contract.name}: ${g.contract.kills}/${g.contract.goal}`, g.contract.done] as [string, boolean]] : []),
        ["Leer el documento del piso", !!g.exp?.noteRead], ["Conseguir el fragmento de mapa", !!g.exp?.hasMap],
        ...(r.boss ? [[`Vencer a ${r.boss}`, g.bossDead] as [string, boolean]] : []),
        [r.objective, g.regionCollected], ["Cruzar el umbral", false],
      ] : r.boss ? [[`Vencer a ${r.boss}`, done], [r.objective, done]] : [[r.objective, done]];
      return <li key={r.id} className={`rounded border p-2 ${cur ? "border-primary bg-card" : "border-border bg-muted"} ${open ? "" : "opacity-60"}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-rarity-2">Peldaño {n}</span>
          <button type="button" className="wiki-link" onClick={() => g.openWiki(`lore:${r.id}`)}>{r.name}</button>
          <span className="text-xs ml-auto">{done ? `✓ ${rec ? `${rec.grade} · ${rec.score} pts` : "superado"}` : cur ? "EN CURSO" : open ? "alcanzado" : "🔒 bloqueado"}</span>
        </div>
        {open && <ul className="text-xs mt-1 space-y-0.5">{tasks.map(([t, ok]) => <li key={t} className={ok ? "score-up" : "text-muted-foreground"}>{ok ? "✓" : "○"} {t}</li>)}</ul>}
        <p className="text-[11px] text-accent mt-1">Desbloquea: {r.item}{n < REGIONS.length ? ` · acceso a ${REGIONS[n]?.name}` : " · final del Libro"}</p>
        {open && r.boss && <button type="button" className="wiki-link text-[11px]" onClick={() => g.openWiki("world:Portal / Umbral")}>Cómo salir del piso</button>}
      </li>;
    })}</ol>
  </section>;
}
