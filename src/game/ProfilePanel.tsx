import { useEffect, useState } from "react";
import { ArrowLeft, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount, signInGoogle, loadMyRuns, watchRuns } from "./cloud";
import { profileSummary } from "./cloud-save";
import { readArmory, inscriptionCounts } from "./armory";
import { readStats, statisticsTotals } from "./statistics";
import { AFFIXES, type AffixId } from "./data";

type Runs = Awaited<ReturnType<typeof loadMyRuns>>;
const fmtT = (s: number) => `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, "0")}s`;
const OUT: Record<string, string> = { death: "Muerte", won: "Victoria", floor: "Piso superado" };

export function ProfilePanel({ onBack }: { onBack?: () => void }) {
  const user = useAccount();
  const [runs, setRuns] = useState<Runs | null>(null);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const load = () => loadMyRuns(user.id).then((r) => alive && setRuns(r)).catch(() => alive && setRuns([]));
    void load(); const stop = watchRuns(() => void load());
    return () => { alive = false; stop(); };
  }, [user]);
  const armory = Object.values(readArmory()).sort((a, b) => b.rarity - a.rarity || b.times - a.times);
  const insc = inscriptionCounts(readArmory());
  const local = statisticsTotals(readStats());
  const s = user && runs ? profileSummary(runs, user.id) : null;
  const name = (user?.user_metadata?.["full_name"] as string) || user?.email || "Jugador local";
  const title = runs?.find((r) => r.title)?.title ?? "";
  const cards = [["Partidas", s?.runs ?? local.played], ["Muertes", s?.deaths ?? "—"], ["Pisos completados", s?.floors ?? "—"], ["Victorias", s?.wins ?? "—"], ["Bajas totales", local.kills], ["Piso máximo", s?.best ?? "—"]] as const;
  return <section className="w-full max-w-5xl text-left font-pixel" aria-label="Mi perfil">
    <div className="flex flex-wrap items-center gap-3 mb-4">
      {onBack && <Button variant="ghost" size="icon" aria-label="Volver al inicio" onClick={onBack}><ArrowLeft /></Button>}
      <h2 className="title-gothic text-2xl text-primary flex items-center gap-2"><User /> MI PERFIL</h2>
    </div>
    <div className="item-row p-4 mb-3 flex-col items-start"><div className="text-lg">{name}</div>{title && <div className="text-xs text-rarity-2">{title}</div>}
      {!user && <div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">Conecta tu cuenta para ver muertes, pisos y victorias.</span><Button size="sm" variant="outline" onClick={() => void signInGoogle()}>Conectar Google</Button></div>}</div>
    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {cards.map(([l, v]) => <div key={l} className="item-row flex-col items-start p-3"><dt className="text-[11px] text-muted-foreground">{l}</dt><dd className="text-xl text-rarity-2 tabular-nums">{typeof v === "number" ? v.toLocaleString("es") : v}</dd></div>)}
    </dl>

    <h3 className="title-gothic text-primary text-lg mt-5 mb-2">MIS PARTIDAS</h3>
    {user && !runs && <p className="text-xs text-muted-foreground">Cargando…</p>}
    {runs?.length === 0 && <p className="text-xs text-muted-foreground">Aún no has publicado partidas.</p>}
    <div className="grid gap-1 max-h-72 overflow-y-auto">{runs?.slice(0, 100).map((r) => <div key={r.id} className="item-row flex-wrap justify-between gap-2 p-2 text-[11px]">
      <span className={r.outcome === "won" ? "text-rarity-2" : r.outcome === "death" ? "text-destructive" : ""}>{OUT[r.outcome] ?? r.outcome} · Piso {r.floor}</span>
      <span>{r.class_name} · {r.kills} bajas · {fmtT(r.seconds)} · {r.score.toLocaleString("es")} pts</span>
      <span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString("es")}</span></div>)}</div>

    <h3 className="title-gothic text-primary text-lg mt-5 mb-2">MIS ARMAS ({armory.length})</h3>
    {!armory.length && <p className="text-xs text-muted-foreground">Las armas que encuentres aparecerán aquí.</p>}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-80 overflow-y-auto">{armory.map((w) => <div key={w.name} className="item-row flex-col items-start p-2">
      <span className={`text-xs rarity-${w.rarity}`}>{w.name}</span>
      <span className="text-[11px] text-muted-foreground">{w.type} · encontrada {w.times}×{w.affixes.length ? ` · ${w.affixes.join(", ")}` : ""}</span></div>)}</div>

    <h3 className="title-gothic text-primary text-lg mt-5 mb-2">MIS INSCRIPCIONES</h3>
    {!Object.keys(insc).length && <p className="text-xs text-muted-foreground">Ninguna inscripción descubierta todavía.</p>}
    <div className="grid gap-1">{Object.entries(insc).sort((a, b) => b[1] - a[1]).map(([id, n]) => <div key={id} className="item-row flex-wrap justify-between gap-2 p-2 text-[11px]">
      <span className="text-rarity-2">{id}</span><span className="flex-1 text-muted-foreground">{AFFIXES[id as AffixId] ?? ""}</span><span>{n} arma{n === 1 ? "" : "s"}</span></div>)}</div>
  </section>;
}
