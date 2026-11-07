import { useState } from "react";
import { BarChart3, CloudUpload, ArrowLeft, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readStats, statisticsTotals, bossRecords } from "./statistics";
import { readRunSave } from './run-save';
import { ProgressPanel } from './ProgressPanel';
import type { Game } from './engine';
import { pushSave, useAccount, signInGoogle } from "./cloud";

export function StatisticsPanel({ onBack, g }: { onBack?: () => void; g?: Game }) {
  const user = useAccount();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const totals = statisticsTotals(readStats());
  const records = bossRecords(readStats()), saved = readRunSave();
  const rows = [["Partidas jugadas", totals.played], ["Enemigos derrotados", totals.kills], ["Combos encadenados", totals.combos], ["Armas encontradas", totals.weapons]] as const;
  const sync = async () => {
    setBusy(true); setStatus("");
    try { setStatus(await pushSave() ? "Estadísticas guardadas en la nube." : "No se pudo guardar. Tus estadísticas siguen en este dispositivo."); }
    catch { setStatus("Sin conexión. Tus estadísticas siguen en este dispositivo."); }
    finally { setBusy(false); }
  };
  return <section className="w-full max-w-5xl text-left font-pixel" aria-label="Estadísticas personales">
    <div className="flex flex-wrap items-center gap-3 mb-4">
      {onBack && <Button variant="ghost" size="icon" aria-label="Volver al inicio" title="Volver al inicio" onClick={onBack}><ArrowLeft /></Button>}
      <h2 className="title-gothic text-2xl text-primary flex items-center gap-2"><BarChart3 /> ESTADÍSTICAS</h2>
    </div>
    {g && g.mode !== 'title' ? <ProgressPanel g={g} /> : saved && <div className="border-y border-border py-3 mb-4"><h3 className="text-rarity-2">{saved.name} · {saved.clsName}</h3><p>Piso {String(saved.fields['floor'])} · {saved.diff} · Nivel {String(saved.fields['level'])} · XP {String(saved.fields['xp'])}/{String(saved.fields['xpNext'])}</p><p>Vida {String(saved.fields['hp'])}/{String(saved.fields['hpMax'])} · Puntos de habilidad {String(saved.fields['sp'])} · Puntos de atributo {String(saved.fields['attrPoints'])}</p><dl className="flex flex-wrap gap-3">{Object.entries((saved.fields['attrs'] ?? {}) as Record<string, number>).map(([k,v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></div>}
    <div className="border-y border-border py-3 my-4"><h3 className="title-gothic text-lg text-rarity-2">Récord del combate del jefe</h3>{records.length ? <><p>Jefes derrotados: {records.length}</p><ul>{records.slice(0, 8).map((r,i) => <li key={i}>Piso {r.floor} · {r.difficulty} · {r.seconds.toFixed(2)} s · Daño recibido {Math.round(r.damage)} · {r.score} puntos</li>)}</ul></> : <p className="text-muted-foreground">Aún no hay un jefe derrotado registrado.</p>}</div>
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {rows.map(([label, value]) => <div key={label} className="item-row flex-wrap justify-between gap-3 p-4"><dt className="text-sm">{label}</dt><dd className="text-2xl text-rarity-2 tabular-nums">{value.toLocaleString("es")}</dd></div>)}
    </dl>
    <p className="text-xs text-muted-foreground mt-4">Partidas iniciadas, incluidas las que siguen en curso. Un combo cuenta al conectar un golpe normal después del primero; un ataque a varios enemigos cuenta una sola vez. Los hallazgos excluyen el equipo inicial.</p>
    <p className="text-xs text-muted-foreground mt-2">Las partidas y bajas anteriores se conservan. Los combos y hallazgos se registran desde esta actualización.</p>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      {g && g.mode !== 'title' && <Button variant="outline" disabled={busy} onClick={async () => { setBusy(true); try { setStatus(await g.onDialogue()); } finally { setBusy(false); } }}><MessageCircle className="size-4" />Actualizar diálogos IA</Button>}
      {user ? <Button variant="outline" disabled={busy} onClick={() => void sync()}><CloudUpload className="size-4 mr-2" />{busy ? "Guardando…" : "Guardar en la nube"}</Button> : <Button variant="outline" onClick={() => void signInGoogle().then(e => { if (e) setStatus(e); })}>Conectar Google</Button>}
      <span className="text-xs text-muted-foreground">{user ? "Cuenta conectada · guardado automático" : "Guardado local · conecta tu cuenta para guardar en la nube"}</span>
    </div>
    {status && <p role="status" className="text-sm mt-3">{status}</p>}
  </section>;
}