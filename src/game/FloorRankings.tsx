import { useEffect, useState } from "react";
import { loadGlobalRuns, watchRuns } from "./cloud";
import { floorRankings } from "./cloud-save";

const fmtT = (s: number) => `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, "0")}s`;
type Rows = Awaited<ReturnType<typeof loadGlobalRuns>>;

/** Rankings por piso (mejor tiempo, más bajas, más puntos) actualizados en vivo. */
export function FloorRankings() {
  const [rows, setRows] = useState<Rows | null>(null);
  const [err, setErr] = useState(false);
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () => loadGlobalRuns().then((r) => { if (alive) { setRows(r); setErr(false); } }).catch(() => alive && setErr(true));
    void load();
    const stop = watchRuns(() => { setPulse((p) => p + 1); void load(); });
    return () => { alive = false; stop(); };
  }, []);
  if (err) return <p className="text-xs text-destructive mt-2">No se pudieron cargar los rankings.</p>;
  if (!rows) return <p className="text-xs text-muted-foreground mt-2">Cargando…</p>;
  const floors = floorRankings(rows);
  if (!floors.length) return <p className="text-xs text-muted-foreground mt-2">Aún no hay marcas por piso.</p>;
  const col = (title: string, list: Rows, val: (r: Rows[number]) => string) => (
    <div className="min-w-0"><div className="font-pixel text-[11px] text-rarity-2 mb-1">{title}</div>
      {list.length ? <ol className="grid gap-0.5">{list.map((r, i) => <li key={r.id} className="text-[11px] flex justify-between gap-2"><span className="truncate">{i + 1}. {r.player_name}{r.title ? ` · ${r.title}` : ""}</span><span className="tabular-nums">{val(r)}</span></li>)}</ol>
        : <span className="text-[11px] text-muted-foreground">—</span>}</div>);
  return <div className="mt-2 grid gap-3">
    <p className="text-[11px] text-muted-foreground flex items-center gap-2"><span className="inline-block size-2 rounded-full bg-rarity-2 animate-pulse" /> EN VIVO · se actualiza al publicarse cada marca{pulse ? ` · ${pulse} nuevas` : ""}</p>
    {floors.map((f) => <div key={f.floor} className="item-row flex-col items-stretch p-3">
      <div className="title-gothic text-primary mb-2">PISO {f.floor}</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {col("MEJOR TIEMPO", f.time, (r) => fmtT(r.seconds))}
        {col("MÁS BAJAS", f.kills, (r) => String(r.kills))}
        {col("MÁS PUNTOS", f.score, (r) => r.score.toLocaleString("es"))}
      </div></div>)}
  </div>;
}
