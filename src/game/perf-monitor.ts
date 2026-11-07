/**
 * Medidor de rendimiento real del bucle de juego (navegador, sin dependencias).
 * Guarda FPS por segundo, tiempos de fotograma recientes y los "tirones" (fotogramas lentos) con su
 * contexto de juego, para el panel opcional y para pedir recomendaciones de optimización a la IA.
 */
import { z } from "zod";

/** Un fotograma por encima de esto cuenta como tirón visible. */
export const HITCH_MS = 50;
/** Tirones más graves: el juego parece colgado. */
export const FREEZE_MS = 250;

export interface HitchCtx { mode: string; camera: string; enemies: number; floor: number; online: boolean; ping: number; quality: string }
export interface Hitch extends HitchCtx { at: number; ms: number }

export class PerfMonitor {
  /** Últimos tiempos de fotograma (ms) para la gráfica. */
  readonly frames: number[] = [];
  /** FPS medidos cada segundo (últimos 5 minutos). */
  readonly fpsHistory: number[] = [];
  readonly hitches: Hitch[] = [];
  totalFrames = 0; totalTime = 0; freezes = 0;
  private secT = 0; private secN = 0; private start = 0;
  constructor(private cap = 120, private hitchCap = 40) {}

  /** Registra un fotograma. `now` en ms (performance.now()). Devuelve true si fue un tirón. */
  sample(ms: number, now: number, ctx: () => HitchCtx): boolean {
    if (!Number.isFinite(ms) || ms <= 0) return false;
    // Pestaña oculta o pausa larga: no es un tirón del juego.
    if (ms > 5000) return false;
    if (!this.start) this.start = now;
    this.frames.push(ms); if (this.frames.length > this.cap) this.frames.shift();
    this.totalFrames++; this.totalTime += ms;
    this.secT += ms; this.secN++;
    if (this.secT >= 1000) { this.fpsHistory.push(Math.round(this.secN * 1000 / this.secT)); if (this.fpsHistory.length > 300) this.fpsHistory.shift(); this.secT = 0; this.secN = 0; }
    if (ms < HITCH_MS) return false;
    if (ms >= FREEZE_MS) this.freezes++;
    this.hitches.push({ at: Math.round((now - this.start) / 100) / 10, ms: Math.round(ms), ...ctx() });
    if (this.hitches.length > this.hitchCap) this.hitches.shift();
    return true;
  }

  /** FPS actual (media de los últimos ~30 fotogramas). */
  get fps() { const f = this.frames.slice(-30); const s = f.reduce((a, b) => a + b, 0); return f.length && s ? Math.round(f.length * 1000 / s) : 0; }
  get frameMs() { const f = this.frames.slice(-30); return f.length ? +(f.reduce((a, b) => a + b, 0) / f.length).toFixed(1) : 0; }

  summary() {
    const sorted = [...this.frames].sort((a, b) => a - b), pct = (p: number) => sorted.length ? +(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0).toFixed(1) : 0;
    const h = this.fpsHistory;
    return {
      seconds: Math.round(this.totalTime / 1000),
      avgFps: this.totalTime ? Math.round(this.totalFrames * 1000 / this.totalTime) : 0,
      minFps: h.length ? Math.min(...h) : this.fps,
      p50Ms: pct(.5), p95Ms: pct(.95), p99Ms: pct(.99),
      hitches: this.hitches.length, freezes: this.freezes,
    };
  }
}

const str = (n: number) => z.string().max(n);
export const perfInput = z.object({
  summary: z.object({ seconds: z.number().int().min(0).max(1e6), avgFps: z.number().min(0).max(1000), minFps: z.number().min(0).max(1000), p50Ms: z.number().min(0).max(1e4), p95Ms: z.number().min(0).max(1e4), p99Ms: z.number().min(0).max(1e4), hitches: z.number().int().min(0).max(1e5), freezes: z.number().int().min(0).max(1e5) }),
  hitches: z.array(z.object({ at: z.number().min(0).max(1e6), ms: z.number().min(0).max(1e5), mode: str(20), camera: str(20), enemies: z.number().int().min(0).max(999), floor: z.number().int().min(0).max(99), online: z.boolean(), ping: z.number().min(0).max(1e5), quality: str(40) })).max(40),
  device: z.object({ platform: str(60), mobile: z.boolean(), cores: z.number().int().min(0).max(512), memoryGB: z.number().min(0).max(1024), dpr: z.number().min(0).max(10), screen: str(30), gpu: str(160), browser: str(80) }),
  net: z.object({ online: z.boolean(), ping: z.number().min(0).max(1e5), reconnecting: z.boolean() }),
  settings: z.object({ preset: str(20), backend: str(20), camera: str(20), maxFps: z.number().min(0).max(1000), renderScale: z.number().min(0).max(4) }),
});
export type PerfInput = z.infer<typeof perfInput>;

/** Datos del dispositivo sin identificadores personales (sólo capacidades). */
export function deviceInfo(): PerfInput["device"] {
  const nav = navigator as Navigator & { deviceMemory?: number; userAgentData?: { platform?: string; mobile?: boolean; brands?: { brand: string; version: string }[] } };
  let gpu = "desconocida";
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    if (gl && ext) gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)); else if (gl) gpu = String(gl.getParameter(gl.RENDERER));
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch { /* sin WebGL */ }
  const ua = nav.userAgent;
  const browser = nav.userAgentData?.brands?.filter(b => !/not/i.test(b.brand)).map(b => `${b.brand} ${b.version}`).join(", ") || (ua.match(/(Firefox|Edg|Chrome|Safari)\/[\d.]+/)?.[0] ?? "navegador");
  return {
    platform: (nav.userAgentData?.platform || (/Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Mac/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : "otro")).slice(0, 60),
    mobile: nav.userAgentData?.mobile ?? /Android|iPhone|iPad|Mobile/i.test(ua),
    cores: Math.min(512, nav.hardwareConcurrency || 0), memoryGB: Math.min(1024, nav.deviceMemory || 0), dpr: Math.min(10, +(window.devicePixelRatio || 1).toFixed(2)),
    screen: `${screen.width}x${screen.height}`.slice(0, 30), gpu: gpu.slice(0, 160), browser: browser.slice(0, 80),
  };
}

/** Texto para compartir las métricas (portapapeles o compartir del sistema). */
export function perfShareText(p: PerfInput, tips?: { headline: string; tips: { title: string }[] } | null) {
  const s = p.summary, d = p.device;
  const lines = [
    `Ars. Anima. · Rendimiento (${s.seconds} s jugados)`,
    `FPS medio ${s.avgFps} · mínimo ${s.minFps} · fotograma p95 ${s.p95Ms} ms · tirones ${s.hitches} (${s.freezes} graves)`,
    p.net.online ? `Ping ${Math.round(p.net.ping)} ms${p.net.reconnecting ? " · reconectando" : ""}` : "Un jugador",
    `${d.platform}${d.mobile ? " (móvil)" : ""} · ${d.cores} núcleos · ${d.memoryGB || "?"} GB · GPU ${d.gpu} · ${d.browser}`,
    `Gráficos ${p.settings.preset} · cámara ${p.settings.camera}`,
  ];
  const worst = [...p.hitches].sort((a, b) => b.ms - a.ms).slice(0, 3);
  if (worst.length) lines.push("Peores tirones: " + worst.map(h => `${h.ms} ms a los ${h.at}s (${h.enemies} enemigos, ${h.camera})`).join("; "));
  if (tips) lines.push(`IA: ${tips.headline}`, ...tips.tips.map(t => `• ${t.title}`));
  return lines.join("\n");
}

/** Instancia compartida: el bucle de GameView la alimenta, el panel y el asesor la leen. */
export const perf = new PerfMonitor();
