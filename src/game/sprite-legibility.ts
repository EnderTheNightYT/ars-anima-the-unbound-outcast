/**
 * Legibilidad de figuras (jugador, compañeros y enemigos) en todas las cámaras.
 * Sólo presentación: contorno de silueta en dos capas, píxeles con más contraste,
 * niebla limitada sobre actores y un tamaño algo mayor en cámaras externas.
 * Nunca cambia colisiones, alcance ni daño.
 */
export const LEGIBILITY = {
  /** Alto de la imagen fuente / este divisor = grosor del contorno exterior (px fuente). */
  rimDiv: 46,
  rimMin: 2,
  rimMax: 5,
  rimAlpha: 0.8,
  /** Contorno interior oscuro: define los píxeles del borde contra fondos claros. */
  innerColor: "#07050a",
  innerAlpha: 0.9,
  /** Realce de los píxeles de la figura. */
  filter: "contrast(1.18) saturate(1.15) brightness(1.08)",
  /** La niebla nunca tapa más que esto a un actor (antes llegaba a 0.85). */
  actorFogCap: 0.45,
  /** Tamaño visual extra en cámaras 3D externas (hombro, frente, aérea). */
  externalScale: 1.22,
  /** Tamaño visual extra en las cámaras 3D aéreas (cenital/isométrica). */
  aerialScale: 1.5,
  /** Tamaño visual extra en el mapa cenital/isométrico 2D. */
  overheadScale: 1.3,
  /** Radio (m) en el que una figura cercana anula el desenfoque/giro del balanceo al caminar. */
  swayActorRadius: 9,
  /** Brillo propio de la figura en la vista 3D, para que no se pierda en zonas oscuras. */
  emissive: 0.14,
  /** Grosor mínimo del contorno en píxeles de pantalla cuando se conoce el tamaño mostrado. */
  minScreenRim: 1,
} as const;

/** Colores del contorno exterior según quién es. */
export const RIM = {
  self: "#7ad8ff",
  enemy: "#ff5a48",
  elite: "#ffd34a",
  boss: "#ff2a6a",
} as const;

/** Grosor del contorno (px de la imagen fuente). Con `shownHeight` (px en pantalla) nunca queda por debajo de 1 px visible. */
export function rimWidth(sourceHeight: number, shownHeight = 0) {
  const h = Number.isFinite(sourceHeight) && sourceHeight > 0 ? sourceHeight : 0;
  const base = Math.max(LEGIBILITY.rimMin, Math.min(LEGIBILITY.rimMax, Math.round(h / LEGIBILITY.rimDiv)));
  if (!(shownHeight > 0) || !h) return base;
  return Math.max(base, Math.min(LEGIBILITY.rimMax * 2, Math.ceil(h / shownHeight * LEGIBILITY.minScreenRim)));
}

/** Opacidad de la capa de niebla sobre una figura; los actores quedan siempre reconocibles. */
export function actorFog(fog: number, actor: boolean) {
  const f = Math.max(0, Math.min(1, fog)) * 0.85;
  return actor ? Math.min(LEGIBILITY.actorFogCap, f) : f;
}

type Img = HTMLImageElement | HTMLCanvasElement;
const still = new WeakMap<Img, Map<string, HTMLCanvasElement>>();
const live = new WeakMap<Img, HTMLCanvasElement>();
const liveOut = new WeakSet<Img>();
/** Lienzos que cambian cada cuadro: las capas de tinte/niebla no deben cachearlos. */
export function isLiveSprite(img: Img) { return liveOut.has(img); }
let mask: HTMLCanvasElement | null = null;

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7071, 0.7071], [-0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, -0.7071]] as const;

function ring(src: Img, out: CanvasRenderingContext2D, w: number, h: number, radius: number, color: string, alpha: number) {
  mask ??= document.createElement("canvas");
  if (mask.width !== w || mask.height !== h) { mask.width = w; mask.height = h; }
  const m = mask.getContext("2d"); if (!m) return;
  m.setTransform(1, 0, 0, 1, 0, 0); m.globalCompositeOperation = "source-over"; m.clearRect(0, 0, w, h); m.imageSmoothingEnabled = false;
  for (let r = 1; r <= radius; r++) for (const [dx, dy] of DIRS) m.drawImage(src, Math.round(dx * r), Math.round(dy * r));
  m.globalCompositeOperation = "source-in"; m.fillStyle = color; m.fillRect(0, 0, w, h); m.globalCompositeOperation = "source-over";
  out.globalAlpha = alpha; out.drawImage(mask, 0, 0); out.globalAlpha = 1;
}

function paint(src: Img, dst: HTMLCanvasElement, color: string, outer: number) {
  const w = src.width, h = src.height;
  if (dst.width !== w || dst.height !== h) { dst.width = w; dst.height = h; }
  const c = dst.getContext("2d"); if (!c) return;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h); c.imageSmoothingEnabled = false;
  ring(src, c, w, h, outer, color, LEGIBILITY.rimAlpha);
  ring(src, c, w, h, Math.max(1, Math.round(outer / 2)), LEGIBILITY.innerColor, LEGIBILITY.innerAlpha);
  c.filter = LEGIBILITY.filter; c.drawImage(src, 0, 0); c.filter = "none";
}

/**
 * Figura con contorno y píxeles realzados, del mismo tamaño que la original (mismo pie y proporción).
 * `shownHeight`: alto aproximado en pantalla (px) para que el contorno se vea aun de lejos.
 * `animated`: el lienzo fuente se redibuja cada cuadro (jugador, compañeros), así que se repinta siempre.
 */
export function legible<T extends Img | null | undefined>(src: T, color: string, animated = false, shownHeight = 0): T | HTMLCanvasElement {
  if (!src || typeof document === "undefined" || !src.width || !src.height) return src;
  if (src instanceof HTMLImageElement && !src.complete) return src;
  if (animated) {
    let dst = live.get(src); if (!dst) { dst = document.createElement("canvas"); live.set(src, dst); liveOut.add(dst); }
    paint(src, dst, color, rimWidth(src.height, shownHeight)); return dst;
  }
  let byColor = still.get(src); if (!byColor) { byColor = new Map(); still.set(src, byColor); }
  // Imágenes fijas: sólo 3 grosores en caché (memoria acotada por fotograma).
  const rim = Math.min(LEGIBILITY.rimMax * 2, Math.ceil(rimWidth(src.height, shownHeight) / 3) * 3), key = `${color}|${rim}`;
  let dst = byColor.get(key);
  if (!dst) { dst = document.createElement("canvas"); paint(src, dst, color, rim); byColor.set(key, dst); }
  return dst;
}

/** Color de contorno de un enemigo según su rango. */
export function enemyRim(e: { elite?: unknown; miniBoss?: unknown; kind?: string }) {
  return e.kind === "librero" || e.miniBoss ? RIM.boss : e.elite ? RIM.elite : RIM.enemy;
}
