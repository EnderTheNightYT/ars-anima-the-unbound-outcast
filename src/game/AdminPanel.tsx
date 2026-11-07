import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAccount, isAdmin, loadReports, resolveReport } from "./cloud";

/** Panel de moderación: sólo aparece para cuentas con rol de administrador. */
export function AdminPanel() {
  const user = useAccount();
  const [admin, setAdmin] = useState(false);
  const [list, setList] = useState<Awaited<ReturnType<typeof loadReports>> | null>(null);
  const load = () => loadReports().then(setList).catch(() => setList([]));
  useEffect(() => { setAdmin(false); if (user) isAdmin().then((a) => { setAdmin(a); if (a) void load(); }); }, [user]);
  if (!admin) return null;
  return (
    <div className="menu-panel w-full max-w-5xl mt-4 p-3 text-left">
      <div className="title-gothic text-lg text-primary">PANEL DE MODERACIÓN</div>
      <p className="text-[11px] text-muted-foreground">Comentarios reportados por los jugadores.</p>
      {!list && <p className="text-xs text-muted-foreground mt-2">Cargando…</p>}
      {list?.length === 0 && <p className="text-xs text-muted-foreground mt-2">No hay reportes pendientes.</p>}
      <div className="grid gap-1 mt-2 max-h-80 overflow-y-auto">
        {list?.map((r) => {
          const c = r.comments as unknown as { id: string; body: string; author_name: string; target: string } | null;
          return <div key={r.id} className="item-row text-xs flex-wrap">
            <span className="flex-1"><b className="text-rarity-2">{c?.author_name ?? "?"}</b>: {c?.body ?? "(borrado)"}</span>
            <Button variant="ghost" className="tab h-7" onClick={async () => { await resolveReport(r.id, r.comment_id, true); void load(); }}>BORRAR COMENTARIO</Button>
            <Button variant="ghost" className="tab h-7" onClick={async () => { await resolveReport(r.id, r.comment_id, false); void load(); }}>DESCARTAR</Button>
            <span className="w-full text-muted-foreground">Motivo: {r.reason || "sin motivo"} · en {c?.target} · {new Date(r.created_at).toLocaleString()}</span>
          </div>;
        })}
      </div>
    </div>
  );
}
