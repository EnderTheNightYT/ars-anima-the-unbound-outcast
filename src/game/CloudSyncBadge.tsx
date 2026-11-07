import { useEffect, useState } from "react";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pushSave, useAccount, useSyncState } from "./cloud";

const ago = (t: number, now: number) => { const s = Math.max(0, Math.round((now - t) / 1000)); return s < 60 ? `hace ${s} s` : s < 3600 ? `hace ${Math.floor(s / 60)} min` : new Date(t).toLocaleString("es"); };

/** Indicador del guardado en la nube: último sincronizado y botón para reintentar. */
export function CloudSyncBadge() {
  const user = useAccount(); const s = useSyncState(); const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(id); }, []);
  if (!user) return <p className="font-pixel text-xs text-muted-foreground flex items-center gap-1"><CloudOff className="size-3" />Nube: sin sesión (guardado sólo en este dispositivo)</p>;
  const label = s.status === "syncing" ? "Sincronizando…" : s.status === "error" ? "Error al sincronizar" : s.last ? `Sincronizado ${ago(s.last, now)}` : "Aún sin sincronizar";
  return <div className="font-pixel text-xs flex items-center gap-2" role="status">
    {s.status === "error" ? <CloudOff className="size-3 text-destructive" /> : <Cloud className="size-3 text-primary" />}
    <span className={s.status === "error" ? "text-destructive" : ""}>{label}</span>
    {s.status === "error" && s.last > 0 && <span className="text-muted-foreground">(último OK {ago(s.last, now)})</span>}
    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" disabled={s.status === "syncing"} onClick={() => void pushSave()}><RefreshCw className="size-3" />{s.status === "error" ? "Reintentar" : "Sincronizar"}</Button>
  </div>;
}
