import { useState } from 'react';
import { CLASSES } from './data';
import { allSkills, chargeText, EFFECT_COMBO, skillPowerText, unlockText } from './class-skills';

/** Pantalla de habilidades activas: daño, recarga, combos, efectos y cómo se desbloquean. */
export function ActiveSkillsWiki({ isOpen, level = 1 }: { isOpen?: ((id: string) => boolean) | undefined; level?: number }) {
  const [onlyOpen, setOnlyOpen] = useState(false);
  const clsName = (id: string) => CLASSES.find((c) => c.id === id)?.name ?? id;
  const list = allSkills().filter(({ skill }) => !onlyOpen || isOpen?.(skill.id));
  return <div className="mt-3 space-y-2">
    <div className="flex flex-wrap items-center gap-2 text-xs"><span className="title-gothic text-primary">HABILIDADES ACTIVAS</span>
      {isOpen && <label className="flex items-center gap-1"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> Solo desbloqueadas en esta partida</label>}
      <span className="text-muted-foreground">Daño calculado a tu nivel {level}.</span></div>
    <div className="grid gap-2 sm:grid-cols-2">{list.map(({ skill: s, classes }) => { const open = isOpen?.(s.id); return <div key={s.id} id={`skill-${s.id}`} className={`rounded border p-2 text-sm ${open ? 'border-primary bg-card' : 'border-border'}`}>
      <div className="flex justify-between gap-2"><span className="text-rarity-2">{s.name}</span>{isOpen && <span className="text-xs">{open ? '✓ desbloqueada' : '🔒 bloqueada'}</span>}</div>
      <p className="text-xs">{s.desc}</p>
      <p className="text-xs"><b>Daño / efecto:</b> {skillPowerText(s, level)}</p>
      <p className="text-xs text-accent">{chargeText(s)}</p>
      <p className="text-xs"><b>Combos:</b> {EFFECT_COMBO[s.effect]}</p>
      <p className="text-xs text-muted-foreground"><b>Desbloqueo:</b> {unlockText(s.id)} · <b>Clases:</b> {classes.map(clsName).join(', ')}</p>
    </div>; })}</div>
    {!list.length && <p className="text-xs text-muted-foreground">Aún no desbloqueaste habilidades extra en esta partida.</p>}
  </div>;
}
