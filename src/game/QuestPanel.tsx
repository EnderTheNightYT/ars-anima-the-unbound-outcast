import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Sparkles, LoaderCircle, ScrollText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateQuest } from '@/lib/quests.functions';
import { playStyles, questLabels, normalizeQuest, type Quest } from './quests';
import type { Game } from './engine';

function proceduralQuest(level: number, style: typeof playStyles[number], floor: number, previous: string[]): Quest {
  const region = [
    ['Port Veilance', 'una carta náutica empapada y las torres sumergidas'],
    ['Cogspire', 'un sello de cobre perdido entre las máquinas del Engranaje Silente'],
    ['The Abyssal Pits', 'un fragmento de memoria atrapado en las grietas'],
    ['Jardín de la Última Rosa', 'el refugio efímero que se deshace con el amanecer'],
    ['Archivatorio de Babel', 'un legajo custodiado por Sombras Silenciosas y Amalgamas de Papel'],
    ["Marea de Aethryon", 'un eco marino que no pertenece a este mundo'],
  ][Math.max(0, Math.min(5, floor - 1))]!;
  const combat = floor === 4 ? 'collect' : 'kill';
  const byStyle: Record<typeof playStyles[number], { kind: Quest['kind']; title: string; story: string }[]> = {
    Combate: [
      { kind: combat, title: 'La tinta reclama sangre', story: `Una señal de la ${region[0]} denuncia actividad de criaturas vinculadas al Juego de los Dados Eternos. Reduce la amenaza y recupera el silencio de la zona.` },
      { kind: combat, title: 'La deuda del Engranaje', story: `Un mensajero de la Orden del Engranaje Silente dejó una petición incompleta en ${region[0]}. La violencia no resolverá el conflicto, pero puede abrir un camino.` },
      { kind: combat, title: 'Ecos que muerden', story: `La Hermandad del Caos habla de presencias alrededor de ${region[0]}. Sobrevive al encuentro y recoge lo que quede.` },
    ],
    Exploración: [
      { kind: 'chest', title: 'La habitación que falta', story: `Un plano imposible señala un escondite en ${region[0]}. Busca el cofre sin confundir sus marcas con las del Archivatorio.` },
      { kind: 'collect', title: 'Cartografía de ceniza', story: `Reúne materiales de ${region[0]} para reconstruir ${region[1]}. El mapa no muestra todos los pasajes.` },
      { kind: 'chest', title: 'Fichas bajo las tablas', story: `Alguien dejó fichas y una nota sobre el Nuevo Azar. Explora las cámaras laterales de ${region[0]} y abre sus cofres.` },
    ],
    Supervivencia: [
      { kind: 'craft', title: 'Un respiro antes del alba', story: `La niebla de ${region[0]} está contaminando las provisiones. Fabrica recursos útiles para resistir el siguiente cambio de clima.` },
      { kind: 'collect', title: 'Agua para los errantes', story: `El refugio cercano necesita materiales para purificar agua y preparar alimento. Reúne suministros sin desperdiciar la Lumbre.` },
      { kind: 'craft', title: 'Remendar el alma', story: `Una viajera dejó herramientas junto a ${region[0]}. Fabrica una venda, una ración o un antídoto antes de continuar.` },
    ],
    Acrobacias: [
      { kind: 'jump', title: 'Por encima del abismo', story: `Las cornisas de ${region[0]} forman una ruta elevada. Encadena saltos, rebotes de pared y caídas controladas para cruzarla.` },
      { kind: 'jump', title: 'La danza de las cornisas', story: `Un recuerdo de otra vida señala una ruta de parkour en ${region[0]}. Completa los saltos sin abandonar el impulso.` },
      { kind: 'jump', title: 'El salto que recuerda', story: `Las plataformas de ${region[0]} parecen cambiar cuando nadie las mira. Usa doble salto y pared para demostrar que el camino existe.` },
    ],
  };
  const pool = byStyle[style];
  const fresh = pool.filter(q => !previous.includes(q.title));
  const choices = fresh.length ? fresh : pool;
  const seed = Math.abs(level * 7 + floor * 11 + previous.length * 13 + Math.floor(Math.random() * 97));
  const picked = choices[seed % choices.length]!;
  const count = picked.kind === 'kill' ? Math.min(6, 2 + Math.floor(level / 12)) : picked.kind === 'jump' ? Math.min(8, 3 + Math.floor(level / 10)) : picked.kind === 'craft' ? 1 : Math.min(3, 1 + Math.floor(level / 20));
  return normalizeQuest({ ...picked, count });
}

export function QuestPanel({ g }: { g: Game }) {
  const [level,setLevel] = useState(g.level);
  const [style,setStyle] = useState<typeof playStyles[number]>('Combate');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [proposal,setProposal] = useState<NonNullable<Game['sideQuest']> | null>(null);
  const [origin,setOrigin] = useState<'GPT-6 Astra (Lovable AI)' | 'misión procedural local' | ''>('');
  const request = useServerFn(generateQuest);
  async function generate() {
    setBusy(true); setError(''); setProposal(null); setOrigin('');
    try {
      const result = await request({ data: { level, style, floor: g.floor, previous: g.questHistory } });
      if (!result.ok) {
        const local = proceduralQuest(level, style, g.floor, g.questHistory);
        setProposal({ ...local, progress:0, complete:false, reward:15+level*3 });
        setOrigin('misión procedural local'); setError(`${result.error} Se generó una misión local para que la demo siga siendo jugable.`);
        return;
      }
      setProposal({ ...result.quest, progress:0, complete:false, reward:15+level*3 });
      setOrigin('GPT-6 Astra (Lovable AI)');
    } catch {
      const local = proceduralQuest(level, style, g.floor, g.questHistory);
      setProposal({ ...local, progress:0, complete:false, reward:15+level*3 });
      setOrigin('misión procedural local'); setError('AI Gateway no disponible. Se generó una misión local coherente con el piso y tu estilo.');
    } finally { setBusy(false); }
  }
  const q = proposal ?? g.sideQuest;
  return <section className="quest-panel">
    <h3 className="title-gothic">Encargos del Azar</h3>
    <p className="text-muted-foreground">{g.region.name} · Elige el nivel y la forma de jugar. El texto de misión se adapta a tu región.</p>
    <label className="quest-level">Tu nivel<input type="number" aria-label="Tu nivel" min={1} max={100} value={level} disabled={busy} onChange={e => setLevel(Math.min(100,Math.max(1,Number(e.target.value)||1)))} /></label>
    <div className="quest-styles" role="group" aria-label="Estilo de juego">{playStyles.map(s => <Button key={s} variant={style===s?'default':'outline'} aria-pressed={style===s} disabled={busy} onClick={()=>setStyle(s)}>{s}</Button>)}</div>
    <Button className="btn-blood" variant="ghost" disabled={busy} onClick={generate}>{busy?<LoaderCircle className="animate-spin" size={16}/>:<Sparkles size={16}/>} {busy?'Consultando al Archivatorio…':'Generar misión'}</Button>
    <p className="text-xs text-muted-foreground">IA opcional: OpenAI GPT-6 Astra por Responses API o Lovable AI Gateway. Sin clave, se activa el generador local.</p>
    {error && <p role="status" className="text-xs text-rarity-2">{error}</p>}
    {q && <article className="quest-proposal"><div className="flex items-center gap-2 text-rarity-2"><ScrollText size={16}/><span>{origin || 'encargo activo'}</span></div><h4 className="font-pixel">{q.title}</h4><p>{q.story}</p><p className="text-secondary">{questLabels[q.kind]} · {q.progress}/{q.count}</p><p>Recompensa: {q.reward} fichas</p>
      {proposal?<Button variant="outline" onClick={()=>{g.acceptQuest(proposal,level);setProposal(null);setOrigin('');}}>Aceptar encargo</Button>:<p>{q.complete?'Encargo cumplido':'Encargo activo'}</p>}
    </article>}
  </section>;
}
