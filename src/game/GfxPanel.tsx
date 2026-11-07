import { useEffect, useState } from 'react';
import { gfxStore, type GfxSettings, type Level, type Preset } from './gfx/settings';
import type { HudStats } from './gfx/hybrid';

const LV = ['Bajo', 'Medio', 'Alto', 'Ultra'];
const LV_OFF = ['No', 'Bajo', 'Alto', 'Ultra'];
const PRESETS: [Preset, string][] = [['low', 'LOW'], ['medium', 'MEDIUM'], ['high', 'HIGH'], ['ultra', 'ULTRA'], ['custom', 'CUSTOM'], ['auto', 'AUTOMATIC']];

/** Graphics menu: every control writes the shared store the renderer reads each frame. */
export function GfxPanel({ stats }: { stats: () => HudStats | null }) {
  const [s, setS] = useState<GfxSettings>(gfxStore.get());
  const [st, setSt] = useState<HudStats | null>(null);
  useEffect(() => gfxStore.subscribe(setS), []);
  useEffect(() => { const id = setInterval(() => setSt(stats()), 500); return () => clearInterval(id); }, [stats]);
  const set = (p: Partial<GfxSettings>) => gfxStore.set(p);
  const lvl = (k: keyof GfxSettings, label: string, names = LV) => (
    <label className="flex items-center justify-between gap-2">{label}
      <select className="bg-background border border-border px-1" value={s[k] as number} onChange={e => set({ [k]: +e.target.value as Level } as Partial<GfxSettings>)}>
        {names.map((n, i) => <option key={n} value={i}>{n}</option>)}
      </select></label>);
  const tog = (k: keyof GfxSettings, label: string) => (
    <label className="flex items-center justify-between gap-2">{label}<input type="checkbox" checked={!!s[k]} onChange={e => set({ [k]: e.target.checked } as Partial<GfxSettings>)} /></label>);
  return (
    <div className="font-pixel space-y-3 text-xs">
      <div className="title-gothic text-lg text-primary">GRÁFICOS</div>
      <div className="flex flex-wrap gap-1">{PRESETS.map(([p, n]) => (
        <button key={p} type="button" className={`border px-2 py-1 ${s.preset === p ? 'border-primary text-primary' : 'border-border'}`} onClick={() => set({ preset: p })}>{n}</button>))}</div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex items-center justify-between gap-2">Motor
          <select className="bg-background border border-border px-1" value={s.backend} onChange={e => set({ backend: e.target.value as GfxSettings['backend'] })}>
            <option value="auto">Automático</option><option value="webgl2">WebGL 2</option><option value="webgpu">WebGPU</option><option value="canvas2d">Clásico (sin efectos)</option>
          </select></label>
        <label className="flex items-center justify-between gap-2">Escala de render {Math.round(s.renderScale * 100)}%
          <input type="range" min={0.5} max={1} step={0.05} value={s.renderScale} onChange={e => set({ renderScale: +e.target.value })} /></label>
        {tog('dynamicResolution', 'Resolución dinámica')}
        {lvl('shadowQuality', 'Sombras', LV_OFF)}
        {lvl('ambientOcclusion', 'Oclusión ambiental', LV_OFF)}
        {lvl('reflectionQuality', 'Reflejos', ['Sondas', 'Planos', 'SSR', 'SSR alto'])}
        {lvl('volumetricLighting', 'Luz volumétrica', LV_OFF)}
        {lvl('fogQuality', 'Niebla')}
        {lvl('bloom', 'Bloom', LV_OFF)}
        <label className="flex items-center justify-between gap-2">Antialiasing
          <select className="bg-background border border-border px-1" value={s.antiAliasing} onChange={e => set({ antiAliasing: e.target.value as GfxSettings['antiAliasing'] })}>
            <option value="off">No</option><option value="fxaa">FXAA (bordes)</option></select></label>
        {lvl('textureQuality', 'Calidad de texturas')}
        {lvl('particleQuality', 'Partículas')}
        {lvl('lightQuality', 'Luces')}
        <label className="flex items-center justify-between gap-2">Nitidez {Math.round(s.sharpening * 100)}%
          <input type="range" min={0} max={1} step={0.05} value={s.sharpening} onChange={e => set({ sharpening: +e.target.value })} /></label>
        <label className="flex items-center justify-between gap-2">FPS máximos
          <select className="bg-background border border-border px-1" value={s.maxFps} onChange={e => set({ maxFps: +e.target.value as GfxSettings['maxFps'] })}>
            <option value={30}>30</option><option value={60}>60</option><option value={120}>120</option><option value={0}>Sin límite</option></select></label>
        <label className="flex items-center justify-between gap-2">Tonemapping
          <select className="bg-background border border-border px-1" value={s.tonemapper} onChange={e => set({ tonemapper: e.target.value as GfxSettings['tonemapper'] })}>
            <option value="aces">ACES Filmic</option><option value="agx">AgX</option></select></label>
        <label className="flex items-center justify-between gap-2">Exposición {s.exposure.toFixed(2)}
          <input type="range" min={0.4} max={2.5} step={0.05} value={s.exposure} onChange={e => set({ exposure: +e.target.value })} /></label>
        {tog('colorGrading', 'Gradación por región')}
        {tog('lensFlares', 'Destellos de lente')}
        {tog('filmGrain', 'Grano de película')}
        {tog('chromaticAberration', 'Aberración cromática')}
        {tog('depthOfField', 'Profundidad de campo')}
        {tog('showStats', 'Mostrar rendimiento')}
      </div>
      {st && <div className="border border-border p-2 text-[11px] text-muted-foreground">
        Motor: {st.backend.toUpperCase()} · {st.fps} FPS · {st.frameMs} ms · llamadas {st.drawCalls} · luces {st.lights} ({st.shadowLights} con sombra) · memoria ≈{st.memoryMB} MB · salida {st.width}×{st.height} · iluminación {st.lightW}×{st.lightH} ({Math.round(st.scale * 100)}%, ajuste {st.drsStep})
        {st.error && <div className="text-destructive">{st.error}</div>}
      </div>}
    </div>
  );
}

export function GfxStats({ stats }: { stats: () => HudStats | null }) {
  const [st, setSt] = useState<HudStats | null>(null); const [on, setOn] = useState(gfxStore.get().showStats);
  useEffect(() => gfxStore.subscribe(s => setOn(s.showStats)), []);
  useEffect(() => { if (!on) return; const id = setInterval(() => setSt(stats()), 500); return () => clearInterval(id); }, [on, stats]);
  if (!on || !st) return null;
  return <div className="gfx-stats font-pixel" aria-label="Rendimiento">{st.backend.toUpperCase()} {st.fps}fps {st.frameMs}ms · dc {st.drawCalls} · L {st.lights} · {st.memoryMB}MB · {st.lightW}×{st.lightH}</div>;
}
