import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Feather } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateCombatNarrative } from '@/lib/combat-narrative.functions';
import type { Game } from './engine';
export function NarrativeAction({g}: {g: Game}) {
  const generate = useServerFn(generateCombatNarrative);
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  return <><Button variant="outline" disabled={busy} onClick={async () => {
    const run = g.chronicles.run; if (!run) return;
    setBusy(true); setError('');
    try { const r = await generate({ data: { name: run.identity.name, className: run.identity.className, title: run.identity.title, difficulty: run.difficulty, equipment: [g.melee?.name,g.ranged?.name,g.armor?.name].filter((s): s is string => !!s), stats: run.stats, deeds: run.deeds.slice(-12).map(d => d.label) } });
      if (r.ok) { run.resultText = r.narrative; g.chronicles.persist(); g.saveRun(); g.onUI(); } else setError(r.error);
    } catch(e) { setError(e instanceof Error ? e.message : 'La IA no está disponible.'); } finally { setBusy(false); }
  }}><Feather className="size-4" />{busy ? 'Escribiendo…' : 'Escribir crónica IA'}</Button>{error && <p role="status" className="text-destructive text-sm max-w-xl">{error}</p>}</>;
}
/** Narración breve del nivel junto a la puntuación: se pide una sola vez por recuento. */
export function FloorNarrative({g}: {g: Game}) {
  const generate = useServerFn(generateCombatNarrative);
  const r = g.recap, run = g.chronicles.run;
  const [text,setText] = useState(r?.narrative ?? ''), [state,setState] = useState<'idle'|'busy'|'error'>('idle');
  useEffect(() => {
    if (!r || !run || r.narrative) return; let alive = true; setState('busy');
    generate({ data: { name: run.identity.name, className: run.identity.className, title: run.identity.title, difficulty: run.difficulty, equipment: [g.melee?.name,g.ranged?.name,g.armor?.name].filter((s): s is string => !!s).map(s => s.slice(0,100)), stats: run.stats, deeds: run.deeds.slice(-12).map(d => d.label.slice(0,120)), floor: r.floor, grade: r.grade, score: r.floorScore } })
      .then(res => { if (!alive) return; if (res.ok) { r.narrative = res.narrative; setText(res.narrative); setState('idle'); } else setState('error'); })
      .catch(() => alive && setState('error'));
    return () => { alive = false; };
  }, [r]);
  if (!r) return null;
  return <div className="w-full max-w-2xl mt-3 border border-border/60 bg-card/60 p-3 text-left">
    <p className="font-pixel text-xs text-muted-foreground flex items-center gap-1"><Feather className="size-3" />CRÓNICA DEL NIVEL · {r.title}</p>
    <p className="font-pixel text-sm mt-1 whitespace-pre-wrap">{text || (state === 'busy' ? 'El cronista escribe…' : state === 'error' ? 'El cronista guarda silencio esta vez.' : '')}</p>
  </div>;
}

/** Crónica personalizada de la partida entera (acciones, estadísticas, título y puntuación), pedida al tocar el botón. */
export function RunChronicle({g, kind}: {g: Game; kind: 'death'|'floor'|'won'}) {
  const generate = useServerFn(generateCombatNarrative);
  const run = g.chronicles.run;
  const [text,setText] = useState(''), [state,setState] = useState<'idle'|'busy'|'error'>('idle'), [error,setError] = useState('');
  if (!run) return null;
  const ask = async () => {
    setState('busy'); setError('');
    const actions: Record<string, number> = { bajas: g.kills, rachaMax: g.streakMax ?? 0, nivel: g.level, fichas: g.gold, segundos: Math.round(g.time), pisosSuperados: g.runFloors.length };
    try { const r = await generate({ data: { personal: true, outcome: kind === 'won' ? 'victoria' : kind === 'floor' ? 'piso superado' : `muerte${g.deathCause ? ': ' + String(g.deathCause).slice(0, 28) : ''}`, actions, name: run.identity.name.slice(0,80), className: run.identity.className.slice(0,80), title: run.identity.title.slice(0,80), difficulty: String(run.difficulty).slice(0,30), equipment: [g.melee?.name,g.ranged?.name,g.armor?.name].filter((s): s is string => !!s).map(s => s.slice(0,100)), stats: run.stats, deeds: run.deeds.slice(-12).map(d => d.label.slice(0,120)), floor: g.floor, grade: g.recap?.grade?.slice(0,2), score: g.score.total } });
      if (r.ok) { setText(r.narrative); setState('idle'); } else { setError(r.error); setState('error'); }
    } catch { setError('El cronista no está disponible ahora. Inténtalo de nuevo.'); setState('error'); }
  };
  return <div className="mt-2 border border-border/60 bg-card/60 p-2">
    <Button size="sm" variant="outline" disabled={state === 'busy'} onClick={() => void ask()}><Feather className="size-4" />{state === 'busy' ? 'El cronista escribe…' : text ? 'Reescribir mi crónica' : 'Crónica personalizada (IA)'}</Button>
    {text && <p className="text-sm mt-2 whitespace-pre-wrap">{text}</p>}
    {error && <p role="status" className="text-destructive text-xs mt-1">{error}</p>}
  </div>;
}
