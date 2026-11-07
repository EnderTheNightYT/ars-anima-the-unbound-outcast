import { useEffect, useState } from 'react';
import { TrendingUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatisticsPanel } from './StatisticsPanel';
import type { Game } from './engine';

export function LiveProgress({ g }: { g: Game }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const toggle = (e: KeyboardEvent) => { if (e.code !== 'KeyL' || e.repeat || (e.target instanceof HTMLElement && e.target.closest('input,textarea'))) return; document.exitPointerLock?.(); setOpen(v => !v); };
    window.addEventListener('keydown', toggle); return () => window.removeEventListener('keydown', toggle);
  }, []);
  return <>
    <Button variant="outline" className="live-progress-toggle font-pixel" title="Progreso del personaje · L" aria-label="Progreso del personaje" aria-expanded={open} onClick={() => { if (!open) document.exitPointerLock?.(); setOpen(!open); }}><TrendingUp className="size-4" /><span>Nv {g.level} · {Math.floor(g.xp)}/{g.xpNext} XP</span></Button>
    {open && <aside className="live-progress-screen" aria-label="Progreso en partida">
      <header className="flex items-center justify-between gap-3 mb-3"><h2 className="title-gothic text-lg text-rarity-2">{g.cls.name}</h2><Button size="icon" variant="ghost" aria-label="Cerrar progreso" onClick={() => setOpen(false)}><X className="size-5" /></Button></header>
      <StatisticsPanel g={g} />
    </aside>}
  </>;
}