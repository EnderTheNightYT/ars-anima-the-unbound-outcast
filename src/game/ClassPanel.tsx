import { classPassives, classMods, passiveExamples } from './class-passives';
import type { Game } from './engine';
import { subclasses } from './subclasses';
import { skillOptions, skillFor, chargeText, unlockText } from './class-skills';

export function ClassPanel({ g, rerender }: { g: Game; rerender?: () => void }) {
  const pick = g.skillPick[g.cls.id] ?? 0;
  const list = classPassives(g.cls.id), m = classMods(g.cls.id, g.level);
  const total = [
    ['Daño', `×${m.damage.toFixed(2)}`], ['Cuerpo a cuerpo', `×${m.melee.toFixed(2)}`], ['Distancia', `×${m.ranged.toFixed(2)}`],
    ['Crítico', `+${m.crit}%`], ['Daño crítico', `×${m.critDmg}`], ['Daño recibido', `×${m.taken.toFixed(2)}`],
    ['Velocidad', `×${m.speed.toFixed(2)}`], ['Aguante', `×${m.stamRegen.toFixed(2)}`],
  ];
  return <section className="font-pixel space-y-4">
    {subclasses(g.cls.id).filter(s => s.id === g.subclassId).map(s => <div key={s.id} className="text-sm text-primary">{s.name} · {s.desc}</div>)}
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"><h3 className="title-gothic text-xl text-rarity-2 min-w-0">{g.cls.name}</h3><span className="text-sm text-muted-foreground shrink-0">Nv {g.level} · valoración {g.rating}</span></div>
    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">{total.map(([k, v]) => <div key={k} className="rounded border border-border bg-muted p-2 min-w-0"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="text-rarity-2">{v}</dd></div>)}</dl>
    <div className="space-y-2"><h4 className="title-gothic text-lg text-primary">HABILIDAD ACTIVA (tecla B · Select + B · botón ✦)</h4>
      <button type="button" className="text-xs underline text-accent" onClick={() => { g.openWiki("skills"); rerender?.(); }}>Ver todas las habilidades en la wiki →</button>
      <p className="text-xs text-muted-foreground">Elige una (algunas se desbloquean durante la partida); al cambiar, la recarga empieza de cero. Tu subclase la modifica: ataque = efecto ×1,3; resguardo = recarga 25% antes y buffs +2 s.</p>
      <div className="grid gap-2 sm:grid-cols-3">{skillOptions(g.cls.id).map((_, i) => { const sk = skillFor(g.cls.id, g.subclassId, i)!; const open = g.skillOpen(sk.id); return <button type="button" key={sk.id} disabled={!open} aria-pressed={pick === i && open} onClick={() => { g.pickSkill(i); rerender?.(); }} className={`text-left rounded border p-2 text-sm ${pick === i && open ? 'border-primary bg-card' : 'border-border'} ${open ? '' : 'opacity-60 cursor-not-allowed'}`}>
        <div className="text-rarity-2">{sk.name}{i === 0 ? ' · propia de la clase' : ''}</div><p className="text-xs">{sk.desc}</p><p className="text-xs text-accent">{chargeText(sk)}</p>{!open && <p className="text-xs text-destructive">🔒 {unlockText(sk.id)}</p>}</button>; })}</div></div>
    <ul className="space-y-3">{list.map(p => { const on = g.level >= p.level; return <li key={p.id} className={`rounded border border-border p-3 space-y-2 ${on ? 'bg-card' : 'opacity-75'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2"><span className={on ? 'text-rarity-2' : 'text-muted-foreground'}>{p.name}</span><span className="text-xs text-muted-foreground">{p.kind} · {on ? 'activa' : `se desbloquea en Nv ${p.level}`}</span></div>
      <p className="text-sm">{p.desc}</p>
      <progress className="unlock-progress w-full" aria-label={`Progreso de ${p.name}`} max={p.level} value={Math.min(p.level, g.level)} />
      <div className="text-xs text-muted-foreground">{on ? 'Desbloqueada' : `Faltan ${p.level - g.level} nivel${p.level - g.level === 1 ? '' : 'es'}`}</div>
      <ul className="text-xs text-accent space-y-1">{passiveExamples(p).map(x => <li key={x}>• {x}</li>)}</ul>
    </li>; })}</ul>
  </section>;
}
