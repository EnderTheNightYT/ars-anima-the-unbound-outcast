import { useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { LoaderCircle, Sparkles, Shield, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { generateEncounters } from '@/lib/encounters.functions';
import { difficulties, encounterInput, enemyName, synergyPairs, type EncounterInput, type EncounterProposal } from './encounters';
import { REGIONS } from './regions';
import { AFFIXES } from './data';
import type { Game } from './engine';

function currentEquipment(g: Game) {
  return [`${g.cls.name} · Nivel ${g.level}`, ...[g.melee, g.ranged, g.armor].filter(it => it != null).map(it =>
    `${it.name}${it.base ? ` (${it.base.type}, Break ${it.base.breakB}, daño ×${it.dmgMult ?? 1})` : ` (DEF ${it.def ?? 0})`}${it.affixes?.length ? ': ' + it.affixes.map(a => AFFIXES[a]).join(', ') : ''}`), `Bombas ${g.bombs} · Munición ${g.ammo} · DEF ${g.def}`].join('\n');
}
export function EncounterPanel({ g }: { g: Game }) {
  const [equipment, setEquipment] = useState(() => currentEquipment(g));
  const [level, setLevel] = useState(g.level);
  const [difficulty, setDifficulty] = useState<EncounterInput['difficulty']>('Normal');
  const [region, setRegion] = useState<EncounterInput['region']>(g.region.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [proposal, setProposal] = useState<EncounterProposal | null>(null);
  const [context, setContext] = useState('');
  const inFlight = useRef(false);
  const request = useServerFn(generateEncounters);
  async function generate() {
    if (inFlight.current) return;
    const parsed = encounterInput.safeParse({ equipment, level, difficulty, region });
    if (!parsed.success) { setError('Indica tu equipo y un nivel entre 1 y 100.'); return; }
    inFlight.current = true; setBusy(true); setError('');
    try {
      const result = await request({ data: parsed.data });
      if (!result.ok) { setError(result.error); return; }
      setProposal(result.proposal); setContext(`${difficulty} · Nivel ${level}`);
    } catch { setError('No se pudo conectar con la IA. La solicitud ha terminado.'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <section className="mx-auto max-w-3xl space-y-5 font-pixel text-sm">
    <header className="flex flex-wrap items-center justify-between gap-2"><h3 className="title-gothic text-2xl text-primary">ENCUENTROS DEL NUEVO AZAR</h3><span className="flex items-center gap-2 text-rarity-2"><Sparkles size={16}/>Lovable AI</span></header>
    <div className="space-y-2"><div className="flex items-center justify-between gap-2"><label htmlFor="encounter-equipment">Tu equipo</label><Button size="sm" variant="ghost" disabled={busy} onClick={() => { setEquipment(currentEquipment(g)); setLevel(g.level); }}><RefreshCw size={14}/>Usar equipo actual</Button></div>
      <Textarea id="encounter-equipment" className="min-h-32" maxLength={1200} value={equipment} disabled={busy} onChange={e => setEquipment(e.target.value)}/></div>
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="space-y-2">Nivel<Input aria-label="Nivel para el encuentro" type="number" min={1} max={100} value={level} disabled={busy} onChange={e => setLevel(Number(e.target.value))}/></label>
      <div className="space-y-2"><label id="encounter-difficulty">Dificultad deseada</label><Select value={difficulty} disabled={busy} onValueChange={v => setDifficulty(v as EncounterInput['difficulty'])}><SelectTrigger aria-labelledby="encounter-difficulty"><SelectValue/></SelectTrigger><SelectContent>{difficulties.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><label id="encounter-region">Región</label><Select value={region} disabled={busy} onValueChange={v => setRegion(v as EncounterInput['region'])}><SelectTrigger aria-labelledby="encounter-region"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Todas las regiones</SelectItem>{REGIONS.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select></div>
    </div>
    <Button className="btn-blood" disabled={busy || equipment.trim().length < 3} onClick={generate}>{busy ? <LoaderCircle className="animate-spin"/> : <Sparkles/>}{busy ? 'Proponiendo encuentros…' : 'Proponer encuentros'}</Button>
    <div aria-live="polite">{error && <p role="alert" className="text-destructive break-words">{error}</p>}</div>
    {proposal && <div className="space-y-5"><div className="flex flex-wrap justify-between gap-2 border-b border-border pb-2 text-rarity-2"><span>Propuestas · {context}</span><span>Sin modificar la partida</span></div>{proposal.encounters.map(e => <article key={e.region} className="space-y-3 border-b border-border pb-5 break-words">
      <div className="text-muted-foreground">{REGIONS.find(r => r.id === e.region)?.name}</div><h4 className="title-gothic text-xl text-primary">{e.title}</h4>
      <ul className="space-y-1">{e.enemies.map(enemy => <li key={enemy.kind} className="flex items-center gap-2"><Shield size={14} className="shrink-0 text-rarity-2"/>{enemy.count} × {enemyName(enemy.kind)}</li>)}</ul>
      {e.region === 'garden' && <p className="text-rarity-1">Refugio · Sin enemigos</p>}
      {e.synergy.length > 0 && <div><h5 className="text-rarity-2">Sinergias</h5>{e.synergy.map(id => <p key={id}>{synergyPairs.find(s => s.pair.join('+') === id)?.effect}</p>)}</div>}
      <div><h5 className="text-rarity-2">Frente a tu equipo</h5><p>{e.equipmentFit}</p></div><div><h5 className="text-rarity-2">Cómo romper la formación</h5><p>{e.tactics}</p></div>
    </article>)}</div>}
  </section>;
}