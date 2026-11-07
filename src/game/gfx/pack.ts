// @ts-nocheck
/**
 * Pure helpers shared by the GPU renderer and tests (no DOM, no WebGL).
 * - G-buffer packing (merges sprite depth into the geometry buffers)
 * - Camera projection / reconstruction (mirror of the GLSL functions)
 * - Light occlusion culling against the occupancy grid
 * - Render-target pool and a ref-counted LRU resource cache with a memory budget
 */
import { MAT, NRM, type FrameCamera, type FrameLight } from './frame';

/** Merge geometry depth/info with sprite depth: sprites in front become billboard/organic texels. */
export function packGBuffer(gDepth: Float32Array, gInfo: Uint8Array, sDepth: Float32Array, outDepth: Float32Array, outInfo: Uint8Array) {
  const n = gDepth.length;
  for (let i = 0; i < n; i++) {
    const s = sDepth[i], g = gDepth[i], o = i * 4;
    if (s < g) {
      outDepth[i] = s; outInfo[o] = NRM.BILLBOARD; outInfo[o + 1] = MAT.ORGANIC; outInfo[o + 2] = 0; outInfo[o + 3] = 0;
    } else {
      outDepth[i] = Number.isFinite(g) ? g : 1e4;
      outInfo[o] = gInfo[o]; outInfo[o + 1] = gInfo[o + 1]; outInfo[o + 2] = gInfo[o + 2]; outInfo[o + 3] = gInfo[o + 3];
    }
  }
}

const clampPitch = (p: number) => Math.max(-1.553, Math.min(1.553, p));
/** Same formula as camera.verticalRay, expressed with the frame horizon (source rows). */
export const rowRay = (y: number, cam: FrameCamera, H: number) => Math.tan(clampPitch(cam.pitch + Math.atan((H / 2 + cam.horizonOffset - y) * 0.95 / H)));

/** Source pixel + depth → world position. */
export function reconstruct(x: number, y: number, d: number, cam: FrameCamera, W: number, H: number): [number, number, number] {
  const camX = 2 * x / W - 1, rx = cam.dirX + cam.plX * camX, ry = cam.dirY + cam.plY * camX;
  return [cam.px + rx * d, cam.py + ry * d, cam.eye + rowRay(y, cam, H) * d];
}

/** World position → [source x, source y, depth]; null when behind the camera. */
export function project(q: [number, number, number], cam: FrameCamera, W: number, H: number): [number, number, number] | null {
  const rx = q[0] - cam.px, ry = q[1] - cam.py, d = rx * cam.dirX + ry * cam.dirY;
  if (d < 0.01) return null;
  const camX = (rx * cam.plX + ry * cam.plY) / ((cam.plX * cam.plX + cam.plY * cam.plY) * d);
  const rz = (q[2] - cam.eye) / d;
  const y = H / 2 + cam.horizonOffset - Math.tan(Math.atan(rz) - cam.pitch) * H / 0.95;
  return [(camX + 1) * 0.5 * W, y, d];
}

/** Grid line-of-sight (DDA over the 2-channel occupancy grid, heights in 0..255 = 0..2.4 units). */
export function lineOfSight(occ: Uint8Array, map: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
  const dist = Math.hypot(bx - ax, by - ay), steps = Math.max(1, Math.ceil(dist * 3));
  for (let i = 1; i < steps; i++) {
    const t = i / steps, x = ax + (bx - ax) * t, y = ay + (by - ay) * t, z = az + (bz - az) * t;
    const mx = Math.floor(x), my = Math.floor(y);
    if (mx < 0 || my < 0 || mx >= map || my >= map) continue;
    const k = (my * map + mx) * 2, lo = occ[k] / 255 * 2.4, hi = occ[k + 1] / 255 * 2.4;
    if (hi > lo && z >= lo && z <= hi) return false;
  }
  return true;
}

/** Occlusion culling: drop lights the camera cannot see whose radius does not reach the camera. */
export function occlusionCull(lights: FrameLight[], cam: FrameCamera, occ: Uint8Array, map: number) {
  return lights.filter(l => {
    if (l.type === 2 || l.priority === 0) return true;
    const d = Math.hypot(l.x - cam.px, l.y - cam.py);
    if (d < l.radius * 0.6) return true;
    return lineOfSight(occ, map, cam.px, cam.py, cam.eye, l.x, l.y, l.z);
  });
}

/** Pick the source resolution multiplier for the output canvas (integer so pixels stay square). */
export function outputMultiplier(cssWidth: number, dpr: number, srcW: number, maxMul = 4) {
  return Math.max(2, Math.min(maxMul, Math.round((cssWidth * Math.min(dpr, 2)) / srcW)));
}

/** Bytes per pixel for the formats used by the renderer. */
export const BPP = { rgba8: 4, rgba16f: 8, r32f: 4 } as const;
export type TargetFormat = keyof typeof BPP;

/** Generic render-target pool keyed by size+format; reuses released targets instead of reallocating. */
export class TargetPool<T> {
  private free = new Map<string, T[]>();
  private live = new Map<T, { key: string; bytes: number }>();
  allocations = 0;
  constructor(private create: (w: number, h: number, f: TargetFormat) => T, private destroy: (t: T) => void) {}
  acquire(w: number, h: number, f: TargetFormat): T {
    const key = `${w}x${h}:${f}`, list = this.free.get(key);
    const t = list?.pop() ?? (this.allocations++, this.create(w, h, f));
    this.live.set(t, { key, bytes: w * h * BPP[f] });
    return t;
  }
  release(t: T) {
    const info = this.live.get(t); if (!info) return;
    this.live.delete(t);
    const list = this.free.get(info.key) ?? []; list.push(t); this.free.set(info.key, list);
  }
  /** Destroy idle targets (after a resolution change). */
  trim() { for (const list of this.free.values()) list.forEach(this.destroy); this.free.clear(); }
  dispose() { this.trim(); for (const t of this.live.keys()) this.destroy(t); this.live.clear(); }
  get idleBytes() { let b = 0; for (const [k, list] of this.free) { const [wh, f] = k.split(':'); const [w, h] = wh.split('x').map(Number); b += list.length * w * h * BPP[f as TargetFormat]; } return b; }
  get liveBytes() { let b = 0; for (const v of this.live.values()) b += v.bytes; return b; }
}

/** Ref-counted, budgeted LRU cache. Entries with refs > 0 are never evicted. */
export class ResourceCache<V> {
  private map = new Map<string, { v: V; bytes: number; refs: number; used: number }>();
  private clock = 0;
  constructor(public budgetBytes: number, private dispose: (v: V) => void) {}
  has(k: string) { return this.map.has(k); }
  get(k: string) { const e = this.map.get(k); if (e) e.used = ++this.clock; return e?.v; }
  put(k: string, v: V, bytes: number) {
    const old = this.map.get(k); if (old && old.v !== v) this.dispose(old.v);
    this.map.set(k, { v, bytes, refs: old?.refs ?? 0, used: ++this.clock }); this.evict();
  }
  retain(k: string) { const e = this.map.get(k); if (e) { e.refs++; e.used = ++this.clock; } }
  release(k: string) { const e = this.map.get(k); if (e && e.refs > 0) e.refs--; this.evict(); }
  refs(k: string) { return this.map.get(k)?.refs ?? 0; }
  get bytes() { let b = 0; for (const e of this.map.values()) b += e.bytes; return b; }
  get size() { return this.map.size; }
  /** Evict least-recently-used unreferenced entries until under budget. */
  evict() {
    while (this.bytes > this.budgetBytes) {
      let victim: string | null = null, best = Infinity;
      for (const [k, e] of this.map) if (e.refs === 0 && e.used < best) { best = e.used; victim = k; }
      if (!victim) return;
      this.dispose(this.map.get(victim)!.v); this.map.delete(victim);
    }
  }
  clear() { for (const e of this.map.values()) this.dispose(e.v); this.map.clear(); }
}

/** Adaptive GPU memory budget (MB) from device hints. */
export function memoryBudgetMB(deviceMemoryGB: number | undefined, mobile: boolean) {
  const gb = deviceMemoryGB ?? (mobile ? 3 : 8);
  return Math.round(Math.min(512, Math.max(48, gb * (mobile ? 16 : 32))));
}
