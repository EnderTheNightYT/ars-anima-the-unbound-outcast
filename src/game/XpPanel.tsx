import { XP_SOURCES, xpForLevel, DAMAGE_XP, type XpSource } from './xp';
import { RATING_SPAN } from './balance';
import type { Game } from './engine';

export function RatingBar({ g }: { g: Game }) {
  const min = Math.max(1, g.level - 2), max = g.level + RATING_SPAN, diff = g.rating - g.level;
  return <div className="space-y-1">
    <div className="flex justify-between text-xs text-muted-foreground"><span>Valoración {g.rating}</span><span>{diff > 0 ? `+${diff} sobre tu nivel` : diff < 0 ? `${diff} bajo tu nivel` : 'igual a tu nivel'}</span></div>
    <progress className="unlock-progress w-full" aria-label="Valoración" max={max - min} value={g.rating - min} />
    <div className="flex justify-between text-[10px] text-muted-foreground"><span>{min}</span><span>Nv {g.level}</span><span>{max}</span></div>
  </div>;
}

export function XpPanel({ g }: { g: Game }) {
  const total = Object.values(g.xpLog).reduce((a, b) => a + (b ?? 0), 0);
  const ids = Object.keys(XP_SOURCES) as XpSource[];
  return <section className="font-pixel space-y-4">
    <h3 className="title-gothic text-xl text-rarity-2">Experiencia</h3>
    <div className="rounded border border-primary bg-card p-3 space-y-2">
      <div className="flex justify-between text-sm"><span>Nivel {g.level} → {g.level + 1}</span><span className="text-rarity-2">{Math.floor(g.xp)}/{g.xpNext} XP</span></div>
      <progress className="unlock-progress w-full" aria-label="Experiencia" max={g.xpNext} value={g.xp} />
      <p className="text-xs text-muted-foreground">Al subir: vida completa, +1 punto de habilidad, +1 de atributo, recompensas de clase y cada 3 niveles un pacto. Próximos niveles: {[1, 2, 3].map(i => `Nv ${g.level + i + 1}: ${xpForLevel(g.level + i)} XP`).join(' · ')}</p>
      <RatingBar g={g} />
      <p className="text-xs text-muted-foreground">La valoración sube si derrotas enemigos recibiendo poco daño y baja si te hieren mucho. Ajusta encargos, recompensas y la Zona Prohibida.</p>
    </div>
    <div><h4 className="text-rarity-2 mb-2">Cómo ganar XP en esta partida · {total} XP</h4>
      <ul className="space-y-2">{ids.map(id => <li key={id} className="rounded border border-border bg-muted p-2 min-w-0">
        <div className="flex flex-wrap justify-between gap-2 text-sm"><span>{XP_SOURCES[id].label}</span><span className="text-rarity-2">{g.xpLog[id] ?? 0} XP</span></div>
        <p className="text-xs text-muted-foreground break-words">{XP_SOURCES[id].how}{id === 'danio' ? ` Este piso: ${Math.floor(g.floorDamageXp)}/${DAMAGE_XP.capPerFloor}.` : ''}</p>
      </li>)}</ul>
    </div>
  </section>;
}
