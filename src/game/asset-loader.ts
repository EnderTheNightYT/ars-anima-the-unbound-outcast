// @ts-nocheck
/**
 * Startup preloading + proximity zone streaming for presentation assets.
 * Never touches game rules: it only fills sprite/texture caches the renderer reads.
 */
import { REGIONS } from './regions';
import { SCENES } from './art';

export type LoadPhase = 'download' | 'decode' | 'validate' | 'prepare' | 'ready';

/** Zones for a floor: active = current region, preload = next/previous, others may be released. */
export function zonePlan(floor: number, total = REGIONS.length) {
  const cur = Math.min(total - 1, Math.max(0, floor - 1));
  const active = [cur];
  const preload = [cur + 1, cur - 1, cur + 2].filter(i => i >= 0 && i < total);
  const keep = new Set([...active, ...preload]);
  const unload = Array.from({ length: total }, (_, i) => i).filter(i => !keep.has(i));
  return { active, preload, unload };
}

/** Weighted progress: each task contributes its weight once it reaches "ready". Partial phases count proportionally. */
const PHASE_SHARE: Record<LoadPhase, number> = { download: 0.4, decode: 0.7, validate: 0.85, prepare: 0.95, ready: 1 };
export class LoadTracker {
  private tasks = new Map<string, { w: number; phase: LoadPhase | null }>();
  status = 'Inicializando...';
  failed: string[] = [];
  add(id: string, w = 1) { if (!this.tasks.has(id)) this.tasks.set(id, { w, phase: null }); }
  set(id: string, phase: LoadPhase) { const t = this.tasks.get(id); if (t) t.phase = phase; }
  get total() { return this.tasks.size; }
  get done() { let n = 0; for (const t of this.tasks.values()) if (t.phase === 'ready') n++; return n; }
  get progress() {
    let sum = 0, got = 0;
    for (const t of this.tasks.values()) { sum += t.w; got += t.phase ? t.w * PHASE_SHARE[t.phase] : 0; }
    return sum ? got / sum : 0;
  }
}

/** Download → decode → validate an image, retrying transient failures. Deduped by URL. */
const imageCache = new Map<string, Promise<HTMLImageElement>>();
export function loadImage(url: string, onPhase?: (p: LoadPhase) => void, retries = 2): Promise<HTMLImageElement> {
  const cached = imageCache.get(url);
  if (cached) return cached.then(i => { onPhase?.('ready'); return i; });
  const run = async (left: number): Promise<HTMLImageElement> => {
    try {
      onPhase?.('download');
      const img = new Image(); img.decoding = 'async'; img.src = url;
      await img.decode();
      onPhase?.('decode');
      if (!img.naturalWidth || !img.naturalHeight) throw new Error(`Textura vacía: ${url}`);
      onPhase?.('validate');
      return img;
    } catch (e) {
      if (left > 0) return run(left - 1);
      console.error('[assets] fallo al cargar', url, e);
      throw e;
    }
  };
  const p = run(retries); imageCache.set(url, p);
  p.catch(() => imageCache.delete(url));
  return p;
}

/** Convert a wall image to the engine's 128x128 RGBA texel buffer. */
export function wallTexels(img: HTMLImageElement) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); if (!x) throw new Error('Sin contexto 2D');
  x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, 128, 128);
  const buf = new Uint32Array(x.getImageData(0, 0, 128, 128).data.buffer.slice(0));
  if (!buf.some(v => v !== 0)) throw new Error('Textura de muro vacía');
  return buf;
}

/** Streams region wall textures by proximity: active first, neighbours next, far zones released. */
export class ZoneStreamer {
  private loading = new Set<string>();
  private lastFloor = -1;
  constructor(private target: Record<string, Uint32Array>) {}
  async ensure(id: string) {
    if (this.target[id] || this.loading.has(id)) return;
    const scene = SCENES[id as keyof typeof SCENES]; if (!scene) return;
    this.loading.add(id);
    try { this.target[id] = wallTexels(await loadImage(scene.wall)); } catch { /* engine falls back to its default wall */ }
    finally { this.loading.delete(id); }
  }
  /** Called each frame; does work only when the floor changes. Loads sequentially to avoid spikes. */
  update(floor: number) {
    if (floor === this.lastFloor) return; this.lastFloor = floor;
    const plan = zonePlan(floor);
    for (const i of plan.unload) delete this.target[REGIONS[i].id];
    const order = [...plan.active, ...plan.preload].map(i => REGIONS[i].id);
    const idle = (cb: () => void) => ('requestIdleCallback' in window ? (window as any).requestIdleCallback(cb, { timeout: 500 }) : requestAnimationFrame(cb));
    order.reduce((p, id, n) => p.then(() => n === 0 ? this.ensure(id) : new Promise<void>(r => idle(() => this.ensure(id).then(r)))), Promise.resolve());
  }
}
