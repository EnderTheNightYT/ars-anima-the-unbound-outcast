import { classPassives, nextPassive, passiveReward } from './class-passives';
import { canUseWeapon, weaponLevel } from './weapon-access';
import { forbiddenZoneLevel } from './class-passives';
import type { Game } from './engine';
import { RatingBar } from './XpPanel';
import type { Item } from './data';
import { ATTRS } from './data';

export function ProgressPanel({ g }: { g: Game }) {
  const weapons = [g.melee, g.ranged, ...g.bag].filter((it): it is Item => !!it && it.kind === 'weapon');
  const usable = weapons.filter(w => canUseWeapon(w, g.level));
  const locked = weapons.filter(w => !canUseWeapon(w, g.level)).sort((a, b) => weaponLevel(a) - weaponLevel(b));
  const next = nextPassive(g.cls.id, g.level), zone = forbiddenZoneLevel(g.floor);
  const missing = Math.max(0, g.xpNext - g.xp);
  const goals = [
    next && `Nv ${next.level}: ${next.name}${passiveReward(next) ? ` + recompensa (${passiveReward(next)})` : ''}`,
    locked[0] && `Nv ${weaponLevel(locked[0])}: podrás usar ${locked[0].name}`,
    g.level < zone && g.forbiddenDoor >= 0 && `Nv ${zone}: se abre la Zona Prohibida`,
  ].filter(Boolean) as string[];
  return <section className="font-pixel space-y-4">
    <h3 className="title-gothic text-xl text-rarity-2">Progreso</h3>
    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
      {[['Nivel', g.level], ['Puntuación', Math.floor(g.score.total).toLocaleString('es')], ['Puntos de habilidad', g.sp], ['Puntos de atributo', g.attrPoints]].map(([k, v]) =>
        <div key={String(k)} className="rounded border border-border bg-muted p-2 min-w-0"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="text-lg text-rarity-2">{v}</dd></div>)}
    </dl>
    <div className="border-y border-border py-3 space-y-2">
      <h4 className="text-rarity-2">Objetivo: llegar al nivel {g.level + 1}</h4>
      <progress className="unlock-progress w-full" aria-label="Experiencia" max={g.xpNext} value={g.xp} />
      <p className="text-sm">Gana <span className="text-rarity-2">{Math.ceil(missing).toLocaleString('es')} XP</span> más ({Math.floor(g.xp)}/{g.xpNext}). Derrota enemigos, abre cofres y completa encargos del mercader.</p>
      <RatingBar g={g} />
      {goals.length > 0 && <ul className="text-xs text-accent space-y-1">{goals.map(x => <li key={x}>• {x}</li>)}</ul>}
    </div>
    <div><h4 className="text-rarity-2 mb-2">Estadísticas del personaje</h4>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">{[
        ['Vida', `${Math.ceil(g.hp)}/${g.hpMax}`], ['Aguante', `${Math.ceil(g.stam)}/${g.stamMax}`],
        ['Lumbre', `${Math.ceil(g.lumbre)}/${g.lumbreMax}`], ['Salud mental', `${Math.ceil(g.mh)}/${g.mhMax}`],
        ['Defensa', g.def], ['Break', `${g.breakValue.toFixed(1)}/${g.breakMax}`], ['Bajas', g.kills], ['Fichas', g.gold], ['Piso', g.floor], ['Valoración', g.rating],
      ].map(([k,v]) => <div key={k} className="flex justify-between gap-2"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>)}</dl>
      <dl className="grid grid-cols-4 gap-2 mt-3">{ATTRS.map(a => <div key={a} className="stat-box"><dt className="text-xs text-muted-foreground">{a}</dt><dd>{g.attrs[a] ?? (g.cls.raw as Record<string, number>)[a] ?? 60}</dd></div>)}</dl>
    </div>
    <div><h4 className="text-rarity-2 mb-2">Habilidades de {g.cls.name}</h4>
      <ul className="grid gap-2 sm:grid-cols-3">{classPassives(g.cls.id).map(p => { const on = g.level >= p.level, r = passiveReward(p); return <li key={p.id} className={`rounded border border-border p-2 text-sm ${on ? 'bg-muted' : 'opacity-70'}`}>
        <div className={on ? 'text-rarity-2' : 'text-muted-foreground'}>{on ? '✓ ' : ''}{p.name}</div>
        <div className="text-xs text-muted-foreground">{on ? 'Desbloqueada' : `Nv ${p.level}`}{r ? ` · recompensa: ${r}` : ''}</div>
      </li>; })}</ul>
      {g.classRewards.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Recompensas recibidas: {g.classRewards.join(' · ')}</p>}
    </div>
    <div><h4 className="text-rarity-2 mb-2">Armas desbloqueadas ({usable.length})</h4>
      <ul className="text-sm space-y-1">{usable.map(w => <li key={w.uid} className="break-words">✓ {w.name}</li>)}</ul>
      {locked.length > 0 && <><h4 className="text-muted-foreground mt-3 mb-1 text-sm">Bloqueadas</h4><ul className="text-sm space-y-1 text-muted-foreground">{locked.map(w => <li key={w.uid} className="break-words">{w.name} · Nv {weaponLevel(w)}</li>)}</ul></>}
    </div>
  </section>;
}
