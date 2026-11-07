import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { readPads, safePads } from "./gamepad";
import { ACTION_NAMES, BUTTON_NAMES, REMAP_BUTTONS, SELECT_COMBOS, loadPadMap, mapConflicts, savePadMap, type PadMap } from "./pad-mapping";
import { suggestPadMap } from "@/lib/pad-advice.functions";

const MODELS = ["Xbox Series / One", "PlayStation 5 (DualSense)", "PlayStation 4 (DualShock 4)", "Nintendo Switch Pro", "8BitDo", "Genérico Android (OTG/Bluetooth)"];

/** Prueba del mando en tiempo real + asistente IA de asignación sin conflictos. */
export function PadTester() {
  const [map, setMap] = useState<PadMap>(() => loadPadMap());
  const [pressed, setPressed] = useState<boolean[]>([]);
  const [padName, setPadName] = useState("");
  const [model, setModel] = useState(MODELS[0]);
  const [prefs, setPrefs] = useState("");
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<{ map: PadMap; notes: string } | null>(null);
  const [error, setError] = useState("");
  const suggest = useServerFn(suggestPadMap);

  useEffect(() => {
    let raf = 0, last = "";
    const tick = () => {
      const pads = safePads(); const st = readPads(pads);
      const key = st.pressed.map(Number).join("");
      if (key !== last) { last = key; setPressed(st.pressed); }
      setPadName(n => (n === (pads[0]?.id ?? "") ? n : pads[0]?.id ?? ""));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const shown = proposal?.map ?? map;
  const { duplicates, missing } = mapConflicts(shown);
  const dupButtons = new Set(duplicates.flatMap(d => d.buttons));
  const row = (b: number, label: string, dup: boolean) => (
    <div key={b + label} className={`item-row ${pressed[b] ? "tab-active" : ""}`} style={dup ? { outline: "2px solid hsl(var(--destructive))" } : undefined}>
      <span className="w-32">{BUTTON_NAMES[b]}</span><span className="flex-1">{label}</span>
      {pressed[b] && <span className="text-rarity-2">● PULSADO</span>}{dup && <span className="text-destructive"> DUPLICADO</span>}
    </div>
  );

  const ask = async () => {
    setBusy(true); setError(""); setProposal(null);
    try {
      const current = Object.fromEntries(Object.entries(map).map(([b, a]) => [b, a ?? ""]));
      const r = await suggest({ data: { model, preferences: prefs, current } });
      if (r.ok) setProposal({ map: r.map, notes: r.notes }); else setError(r.error);
    } catch { setError("No se pudo contactar con la IA."); } finally { setBusy(false); }
  };

  return (
    <div className="font-pixel space-y-3">
      <h3 className="title-gothic text-xl text-rarity-2">PRUEBA DEL MANDO</h3>
      <p className="text-muted-foreground">{padName ? `Conectado: ${padName}` : "Conecta un mando y pulsa cualquier botón."}</p>
      {proposal && <p className="text-rarity-2">Vista previa de la propuesta IA (aún no aplicada).</p>}
      <div className="space-y-1">
        {REMAP_BUTTONS.map(b => row(b, shown[b] ? ACTION_NAMES[shown[b]!] : "— libre —", dupButtons.has(b)))}
        {row(8, "Mapa · modificador (fijo)", false)}{row(9, "Menú (fijo)", false)}
      </div>
      <h4 className="title-gothic">Combinaciones con Select</h4>
      <div className="space-y-1">{SELECT_COMBOS.map(c => row(c.button, `Select + ${BUTTON_NAMES[c.button]} · ${c.action}`, duplicates.some(d => d.action === c.action)))}</div>
      {duplicates.length > 0 ? <p className="text-destructive">Asignaciones duplicadas: {duplicates.map(d => `${ACTION_NAMES[d.action as keyof typeof ACTION_NAMES] ?? d.action} (${d.buttons.map(b => BUTTON_NAMES[b]).join(" + ")})`).join(", ")}</p>
        : <p className="text-rarity-2">Sin asignaciones duplicadas.</p>}
      {missing.length > 0 && <p className="text-destructive">Sin botón: {missing.map(a => ACTION_NAMES[a]).join(", ")}</p>}

      <h4 className="title-gothic">Asistente de asignación (IA)</h4>
      <label className="block">Modelo de mando
        <input list="pad-models" value={model} onChange={e => setModel(e.target.value)} maxLength={80} className="block w-full bg-background border border-border px-2 py-1" />
        <datalist id="pad-models">{MODELS.map(m => <option key={m} value={m} />)}</datalist>
      </label>
      <label className="block">Preferencias de control
        <textarea value={prefs} onChange={e => setPrefs(e.target.value)} maxLength={500} rows={3} placeholder="Ej.: saltar con RB, recargar en la cruceta, no tengo botón Home…" className="block w-full bg-background border border-border px-2 py-1" />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button onClick={ask} disabled={busy}>{busy ? "Pensando…" : "Proponer asignación (IA)"}</Button>
        {proposal && <Button onClick={() => { savePadMap(proposal.map); setMap(proposal.map); setProposal(null); }}>Aplicar propuesta</Button>}
        {proposal && <Button variant="ghost" onClick={() => setProposal(null)}>Descartar</Button>}
        <Button variant="ghost" onClick={() => { savePadMap(null); setMap(loadPadMap()); setProposal(null); }}>Restaurar por defecto</Button>
      </div>
      {proposal?.notes && <p className="text-muted-foreground">{proposal.notes}</p>}
      {error && <p className="text-destructive">{error}</p>}
    </div>
  );
}
