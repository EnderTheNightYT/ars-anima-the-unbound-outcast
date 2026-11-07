// @ts-nocheck
/**
 * Hybrid renderer front-end: capability detection + fallback (WebGPU → WebGL2 → Canvas2D),
 * adaptive quality (DrsController), FPS cap, stats and graphics-context loss recovery.
 * The 2D raycaster always renders first; this only reads its output and G-buffer.
 */
import { WebGL2Renderer, type FrameInput, type RenderStats } from './webgl2';
import { WebGPURenderer } from './webgpu';
import { DrsController, FrameMeter, baseEffective, degrade, type Effective } from './drs';
import { gfxStore, type GfxSettings } from './settings';
import { outputMultiplier } from './pack';

export type ActiveBackend = 'webgl2' | 'webgpu' | 'canvas2d';
export interface Caps { webgl2: boolean; webgpu: boolean }

/** Pure backend choice (tested). Auto prefers the full WebGL2 pipeline; WebGPU only on request. */
export function chooseBackend(pref: GfxSettings['backend'], caps: Caps): ActiveBackend {
  if (pref === 'canvas2d') return 'canvas2d';
  if (pref === 'webgpu' && caps.webgpu) return 'webgpu';
  return caps.webgl2 ? 'webgl2' : 'canvas2d';
}
/** Frame gating for the Maximum FPS option (0 = uncapped). */
export function shouldRender(sinceLastMs: number, maxFps: number) { return maxFps === 0 || sinceLastMs >= 1000 / maxFps - 1.5; }

export interface HudStats extends RenderStats { backend: ActiveBackend; fps: number; frameMs: number; scale: number; drsStep: number; error?: string }

export class HybridRenderer {
  backend: ActiveBackend = 'canvas2d';
  private gl: WebGL2Renderer | null = null; private gpu: WebGPURenderer | null = null;
  private drs = new DrsController(); private meter = new FrameMeter();
  private settings: GfxSettings = gfxStore.get(); private unsub: () => void;
  private lastT = 0; private lost = false; private disposed = false; private building = 0;
  effective: Effective = baseEffective(this.settings);
  error = '';
  onChange: () => void = () => {};

  private canvas: HTMLCanvasElement;
  /** The renderer owns its canvas inside `host` (React only owns the empty host element). */
  constructor(private host: HTMLElement, private mobile: boolean) {
    this.canvas = this.makeCanvas(); host.appendChild(this.canvas);
    this.unsub = gfxStore.subscribe(s => { const rebuild = s.backend !== this.settings.backend; this.settings = s; this.drs.step = 0; if (rebuild) this.rebuild(); });
    this.rebuild();
  }
  private lostH = (e: Event) => { e.preventDefault(); this.lost = true; this.gl?.onLost(); this.onChange(); };
  private restoredH = () => { try { this.gl?.onRestored(); this.lost = false; } catch (err) { this.fail(err); } this.onChange(); };
  private fail(err: unknown) { console.warn('[gfx] fallback to Canvas2D:', err); this.error = String((err as Error)?.message ?? err).slice(0, 160); this.gl?.dispose(); this.gl = null; this.gpu = null; this.backend = 'canvas2d'; this.onChange(); }

  /** A canvas can only ever hold one context type, so switching backend swaps the element. */
  private freshCanvas() {
    const c = this.canvas, n = this.makeCanvas();
    c.removeEventListener('webglcontextlost', this.lostH); c.removeEventListener('webglcontextrestored', this.restoredH);
    c.replaceWith(n); this.canvas = n;
  }
  private makeCanvas() {
    const n = document.createElement('canvas'); n.className = 'game-canvas gpu-canvas'; n.setAttribute('aria-hidden', 'true');
    n.addEventListener('webglcontextlost', this.lostH, false); n.addEventListener('webglcontextrestored', this.restoredH, false);
    return n;
  }
  private async rebuild() {
    const id = ++this.building; this.error = '';
    if (this.gl || this.gpu) { this.gl?.dispose(); this.gpu?.dispose(); this.gl = null; this.gpu = null; this.freshCanvas(); }
    const caps: Caps = { webgl2: typeof WebGL2RenderingContext !== 'undefined', webgpu: !!(navigator as Navigator & { gpu?: unknown }).gpu };
    let want = chooseBackend(this.settings.backend, caps);
    if (want === 'webgpu') {
      const r = await WebGPURenderer.create(this.canvas, () => { this.gpu = null; this.rebuild(); }).catch(() => null);
      if (id !== this.building || this.disposed) { r?.dispose(); return; }
      if (r) { this.gpu = r; this.backend = 'webgpu'; this.onChange(); return; }
      this.error = 'WebGPU no disponible: usando WebGL2'; want = caps.webgl2 ? 'webgl2' : 'canvas2d';
    }
    if (want === 'webgl2') { try { this.gl = new WebGL2Renderer(this.canvas, this.mobile); this.backend = 'webgl2'; } catch (err) { this.fail(err); return; } }
    else this.backend = 'canvas2d';
    this.onChange();
  }
  get element() { return this.canvas; }
  get active() { return this.backend !== 'canvas2d' && !this.lost; }

  /** Called after the 2D raycaster rendered. Returns false when nothing was drawn (2D shows through). */
  frame(f: FrameInput, now: number): boolean {
    const r = this.gpu ?? this.gl; if (!r || this.lost) return false;
    const s = this.settings, dt = this.lastT ? (now - this.lastT) / 1000 : 0.016;
    if (!shouldRender(now - this.lastT, s.maxFps)) return true;
    if (this.lastT) this.meter.push(now - this.lastT);
    this.lastT = now;
    if (s.dynamicResolution || s.preset === 'auto') this.drs.update(this.meter.avg, Math.min(0.1, dt), s.maxFps); else this.drs.step = 0;
    this.effective = degrade(baseEffective(s), this.drs.step, s.preset === 'auto');
    const css = this.canvas.clientWidth || 960, mul = outputMultiplier(css, devicePixelRatio || 1, f.W, this.mobile ? 3 : 4);
    try { r.render(f, s, this.effective, mul); } catch (err) { this.fail(err); return false; }
    return true;
  }
  stats(): HudStats {
    const r = this.gpu ?? this.gl;
    const base = r?.stats ?? { drawCalls: 0, lights: 0, shadowLights: 0, memoryMB: 0, width: 0, height: 0, lightW: 0, lightH: 0 };
    return { ...base, backend: this.backend, fps: Math.round(this.meter.fps), frameMs: +this.meter.avg.toFixed(1), scale: this.effective.renderScale, drsStep: this.drs.step, error: this.error || undefined };
  }
  dispose() { this.disposed = true; this.unsub(); this.gl?.dispose(); this.gpu?.dispose(); this.canvas.remove(); }
}
