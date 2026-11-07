import { useEffect, useRef } from "react";
import { beatCue } from "./beat";
import type { RetroAudio } from "./audio";
import type { Game } from './engine';

/**
 * Indicador pequeño del próximo grave: un aro que se cierra sobre el centro,
 * una barra que se llena y la cuenta en s.ms. Brilla dorado en el instante justo.
 */
export function BeatCue({ audio, game }: { audio: React.RefObject<RetroAudio | null>; game?:Game }) {
  const root = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const num = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const a = audio.current, el = root.current;
      if (!el) return;
      const point=game?.worldReticle;
      el.style.left=point?`${point.x*100}%`:'50%';el.style.top=point?`calc(${point.y*100}% + 18px)`:'calc(50% + 18px)';
      const c = a && !a.muted && a.musicPlaying ? beatCue(a.beats, a.songTime()) : null;
      if (!c || !c.soon) { el.dataset["state"] = "idle"; return; }
      el.dataset["state"] = c.inWindow ? "now" : c.until < 0.45 ? "close" : "far";
      if (ring.current) ring.current.style.transform = `scale(${(1 + 1.6 * (1 - c.progress)).toFixed(3)})`;
      if (fill.current) fill.current.style.transform = `scaleX(${c.progress.toFixed(3)})`;
      if (num.current) num.current.textContent = c.inWindow ? "¡YA!" : formatBeat(c.until);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [audio]);
  return (
    <div ref={root} className="beat-cue" data-state="idle" aria-hidden>
      <div className="beat-cue-target"><div ref={ring} className="beat-cue-ring" /><span className="beat-cue-dot">♪</span></div>
      <div className="beat-cue-bar"><div ref={fill} className="beat-cue-fill" /></div>
      <span ref={num} className="beat-cue-num" />
    </div>
  );
}

/** Cuenta del próximo grave en segundos y milisegundos: "0 s 453 ms". */
export function formatBeat(until: number) { const ms = Math.round(Math.max(0, until) * 1000); return `${Math.floor(ms / 1000)} s ${String(ms % 1000).padStart(3, "0")} ms`; }
