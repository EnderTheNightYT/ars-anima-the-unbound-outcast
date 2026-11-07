/** Ritmo de la música del primer piso: detección de golpes graves y bonus "al ritmo". Puro, sin DOM. */

export const RHYTHM = {
  /** Margen flexible antes/después de cada golpe (segundos). */
  window: 0.16,
  shotCrit: 1.35, // mini crítico a distancia
  meleeCrit: 1.35, // mini crítico cuerpo a cuerpo
  poundDmg: 1.5, poundRadius: 1.4, // machacar
  kickDmg: 1.6, kickPush: 1.5, // patada
  reflect: 1.6, // parry / bloqueo perfecto
  dash: 1.35, // impulso del dash
  /** Volumen de la música respecto al máximo (efectos siguen audibles). */
  musicVolume: 0.32,
} as const;

/**
 * Detecta golpes graves (bombo, percusión retumbante) en una señal mono.
 * Filtra paso bajo (~150 Hz), mide energía por ventanas de 23 ms y marca
 * subidas fuertes respecto a la media local. Devuelve tiempos en segundos.
 */
export function detectBeats(samples: Float32Array, sampleRate: number, minGap = 0.28): number[] {
  const hop = Math.max(1, Math.round(sampleRate * 0.023));
  const a = 1 - Math.exp((-2 * Math.PI * 150) / sampleRate);
  const energy: number[] = [];
  let lp = 0, acc = 0, n = 0;
  for (let i = 0; i < samples.length; i++) {
    lp += a * ((samples[i] ?? 0) - lp);
    acc += lp * lp; n++;
    if (n === hop) { energy.push(acc / n); acc = 0; n = 0; }
  }
  if (!energy.length) return [];
  const sorted = [...energy].sort((x, y) => x - y);
  const floor = sorted[Math.floor(sorted.length * 0.6)] ?? 0;
  const span = Math.round(1 / 0.023); // ~1 s de contexto
  const beats: number[] = [];
  let sum = 0;
  for (let i = 0; i < Math.min(span, energy.length); i++) sum += energy[i]!;
  let last = -Infinity;
  for (let i = 1; i < energy.length; i++) {
    const lo = i - span, hi = i + span;
    if (hi < energy.length) sum += energy[hi]!;
    if (lo - 1 >= 0) sum -= energy[lo - 1]!;
    const count = Math.min(energy.length, hi + 1) - Math.max(0, lo);
    const mean = sum / Math.max(1, count);
    const e = energy[i]!, prev = energy[i - 1]!;
    const t = (i * hop) / sampleRate;
    if (e > mean * 1.45 && e > floor && e > prev * 1.15 && t - last >= minGap) { beats.push(t); last = t; }
  }
  return beats;
}

/** ¿El instante `t` (s) cae dentro del margen de algún golpe? `beats` ordenado. */
export function onBeat(beats: readonly number[], t: number, window: number = RHYTHM.window): boolean {
  if (!beats.length || !Number.isFinite(t)) return false;
  let lo = 0, hi = beats.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (beats[m]! < t) lo = m + 1; else hi = m; }
  const near = Math.min(Math.abs(beats[lo]! - t), lo > 0 ? Math.abs(beats[lo - 1]! - t) : Infinity);
  return near <= window;
}

/** Música del primer piso: suena al salir del refugio o al cruzarte con un enemigo hostil. */
export function wantsFloorMusic(floor: number, playing: boolean, inRefuge: boolean, hostileNear: boolean) {
  if (floor !== 1) return false;
  return playing || !inRefuge || hostileNear;
}

/** Fundidos de cada pasada de la canción: entrada suave y salida que se apaga de a poco antes de repetir. */
export function musicFades(duration: number) {
  const d = Math.max(0, duration);
  return { fadeIn: Math.min(4, d * 0.1), fadeOut: Math.min(6, d * 0.15) };
}

/** Señal visual del próximo golpe: segundos que faltan, si ya está en el margen y avance 0..1 hacia el golpe. */
export function beatCue(beats: readonly number[], t: number, lead = 1.2, window: number = RHYTHM.window) {
  if (!beats.length || !Number.isFinite(t)) return null;
  let lo = 0, hi = beats.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (beats[m]! < t - window) lo = m + 1; else hi = m; }
  const next = beats[lo];
  if (next === undefined) return null;
  const until = next - t; // negativo = el golpe acaba de pasar pero sigue en margen
  const inWindow = Math.abs(until) <= window;
  const following = beats[lo + 1];
  return { until, inWindow, progress: Math.max(0, Math.min(1, 1 - until / lead)), soon: until <= lead, after: following === undefined ? null : following - t };
}
