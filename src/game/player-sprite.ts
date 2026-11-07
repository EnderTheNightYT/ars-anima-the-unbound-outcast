/**
 * El Desconocido: sprite del jugador en 8 direcciones × 7 acciones (pack del usuario).
 * Reglas puras (dirección, acción, fotograma, temblor/respiración/inclinación) + compositor de canvas.
 * El atlas es 8 columnas (N, NE, E, SE, S, SW, W, NW) × 11 filas de 112×160 (filas 1..8 del pack + deslizar, saltar, machacar).
 */
export const DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type Dir = (typeof DIRS)[number];
export type PlayerAction = "idle" | "walk" | "run" | "crouch" | "shoot" | "melee_light" | "melee_heavy" | "slide" | "jump" | "smash";
export const CELL_W = 112, CELL_H = 160;

/** Filas del atlas por acción y secuencia de poses (fotogramas repetidos como indica manifest.json). */
export const ACTIONS: Record<PlayerAction, { rows: number[]; seq: number[]; fps: number; mirror?: boolean }> = {
  idle: { rows: [0], seq: [0, 0, 0, 0], fps: 4 },
  walk: { rows: [1, 2], seq: [0, 1, 0, 1], fps: 6 },
  run: { rows: [3], seq: [0, 0, 0, 0], fps: 10, mirror: true },
  crouch: { rows: [4], seq: [0, 0, 0, 0], fps: 4 },
  shoot: { rows: [5], seq: [0, 0, 0], fps: 12 },
  melee_light: { rows: [6], seq: [0, 0], fps: 12, mirror: true },
  melee_heavy: { rows: [7], seq: [0, 0], fps: 8 },
  slide: { rows: [8], seq: [0], fps: 4 },
  jump: { rows: [9], seq: [0], fps: 4 },
  smash: { rows: [10], seq: [0], fps: 4 },
};

/** Altura del jugador en el mundo: un poco menor que el enemigo más pequeño (escala 0.85). */
export const PLAYER_SPRITE_SCALE = 0.8;

const TAU = Math.PI * 2;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Dirección del sprite según hacia dónde mira el cuerpo respecto a la cámara.
 * 0 = de espaldas a la cámara (N), π = de frente (S), +π/2 = hacia la derecha de la pantalla (E).
 */
export function spriteDir(facing: number, camAng: number): Dir {
  const rel = wrap(facing - camAng);
  const i = ((Math.round(rel / (Math.PI / 4)) % 8) + 8) % 8;
  return DIRS[i] ?? "N";
}

export interface ActionState { speed: number; sprinting: boolean; dashing: boolean; crouching: boolean; sliding: boolean; swinging: boolean; heavy: boolean; ranged: boolean; aiming: boolean; airborne?: boolean; pounding?: boolean }
/** Acción visible: ataque > disparo > agacharse/deslizarse > dash/correr > caminar > idle. */
export function pickAction(s: ActionState): PlayerAction {
  if (s.pounding) return "smash";
  if (s.swinging && !s.ranged) return s.heavy ? "melee_heavy" : "melee_light";
  if (s.ranged && (s.swinging || s.aiming)) return "shoot";
  if (s.sliding) return "slide";
  if (s.airborne) return "jump";
  if (s.crouching) return "crouch";
  if (s.dashing || (s.sprinting && s.speed > 2.4) || s.speed > 4.2) return "run";
  if (s.speed > 0.3) return "walk";
  return "idle";
}

/** Cuerpo: al moverse mira hacia donde camina; al atacar/apuntar/quieto, hacia la mira. */
export function bodyFacing(aimAng: number, vx: number, vy: number, action: PlayerAction) {
  if (action === "shoot" || action === "melee_light" || action === "melee_heavy" || action === "idle") return aimAng;
  if (Math.hypot(vx, vy) < 0.3) return aimAng;
  return Math.atan2(vy, vx);
}

/** Celda del atlas para una acción/dirección/tiempo. */
export const MIRROR: Record<Dir, Dir> = { N: "N", NE: "NW", E: "W", SE: "SW", S: "S", SW: "SE", W: "E", NW: "NE" };
export function atlasCell(action: PlayerAction, dir: Dir, time: number, speed = 0) {
  const a = ACTIONS[action], rate = action === "walk" ? a.fps * Math.max(.6, Math.min(1.8, speed / 2.2)) : a.fps;
  const f = Math.floor(time * rate) % a.seq.length;
  const row = a.rows[a.seq[f] ?? 0] ?? a.rows[0] ?? 0;
  // Acciones de un solo dibujo: los fotogramas impares reutilizan la dirección espejo volteada
  // (E↔W, NE↔NW, SE↔SW; N/S se voltean sobre sí mismas) para alternar piernas/brazos y simular animación.
  if (a.mirror && f % 2 === 1) return { col: DIRS.indexOf(MIRROR[dir]), row, frame: f, flip: true };
  return { col: DIRS.indexOf(dir), row, frame: f, flip: false };
}

/**
 * Movimiento del propio sprite: temblor/balanceo al caminar, respiración lenta casi imperceptible
 * (escala vertical ±1.5%) e inclinación del eje X hacia delante/atrás según avance y mira vertical.
 */
export function spriteMotion(time: number, speed: number, forward: number, pitch: number) {
  const walk = Math.min(1, speed / 3);
  const step = time * (6 + speed * 1.6);
  const sway = Math.sin(step) * 0.07 * walk;            // rotación lado a lado (rad)
  const shiftX = Math.sin(step) * 2.2 * walk;           // vaivén en px del atlas
  const bounce = Math.abs(Math.cos(step)) * 3 * walk;    // sube y baja al pisar
  const jitter = walk > 0.05 ? (Math.sin(time * 47) * 0.4 + Math.sin(time * 31) * 0.3) * walk : 0; // temblor
  const breath = Math.sin(time * TAU / 3.6);           // ciclo de ~3.6 s
  const scaleY = 1 + breath * 0.015, scaleX = 1 - breath * 0.006;
  const tiltX = Math.max(-0.35, Math.min(0.35, forward * 0.06 - pitch * 0.25)); // >0 hacia delante
  return { sway, shiftX: shiftX + jitter, bounce, scaleY, scaleX, tiltX };
}

let atlas: HTMLImageElement | null = null;
let loading: Promise<HTMLImageElement | null> | null = null;
export function loadPlayerAtlas(url: string) {
  if (atlas) return Promise.resolve(atlas);
  if (!loading) loading = new Promise(res => { const im = new Image(); im.decoding = "async"; im.onload = () => { atlas = im; res(im); }; im.onerror = () => res(null); im.src = url; });
  return loading;
}
export const playerAtlas = () => atlas;

let comp: HTMLCanvasElement | null = null;
/**
 * Compone el fotograma con las transformaciones (Nearest Neighbor) en un canvas reutilizable.
 * `tiltX` simula la rotación del eje X: se acorta la altura y se cizalla la parte superior.
 */
export function composeFrame(cell: { col: number; row: number }, m: ReturnType<typeof spriteMotion>, flip = false, target?: HTMLCanvasElement | null) {
  const img = atlas; if (!img) return null;
  if (!target && !comp) { comp = document.createElement("canvas"); comp.width = CELL_W + 24; comp.height = CELL_H + 12; }
  const out = target ?? comp; if (!out) return null;
  if (out.width !== CELL_W + 24) { out.width = CELL_W + 24; out.height = CELL_H + 12; }
  const c = out.getContext("2d"); if (!c) return null;
  c.imageSmoothingEnabled = false; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, out.width, out.height);
  const footX = out.width / 2, footY = out.height - 2;
  const tilt = Math.cos(m.tiltX), shear = -Math.sin(m.tiltX) * 0.35;
  c.translate(footX + m.shiftX, footY - m.bounce);
  c.rotate(m.sway);
  c.transform(1, 0, shear, 1, 0, 0);
  c.scale((flip ? -1 : 1) * m.scaleX, m.scaleY * tilt);
  c.drawImage(img, cell.col * CELL_W, cell.row * CELL_H, CELL_W, CELL_H, -CELL_W / 2, -CELL_H, CELL_W, CELL_H);
  return out;
}

/** Fotograma de un compañero (multijugador) en su propio canvas, con las mismas reglas que el jugador local. */
export function remoteFrame(r: { z: number; ang: number; pitch: number; vx: number; vy: number; slot: number; dashT: number; crouching: boolean; slideT: number; swingT: number; heavy: boolean; aiming: boolean; pounding: boolean; state: string; canvas?: HTMLCanvasElement | null }, camAng: number, time: number, ground = 0) {
  if (!atlas || typeof document === "undefined") return null;
  r.canvas ??= document.createElement("canvas");
  const speed = Math.hypot(r.vx, r.vy), ranged = r.slot === 1;
  const action: PlayerAction = r.state === "downed" ? "crouch" : pickAction({ speed, sprinting: speed > 3, dashing: r.dashT > 0, crouching: r.crouching, sliding: r.slideT > 0, swinging: r.swingT > 0, heavy: r.heavy, ranged, aiming: r.aiming, airborne: r.z > ground + .25, pounding: r.pounding });
  const facing = bodyFacing(r.ang, r.vx, r.vy, action), dir = spriteDir(facing, camAng);
  const cell = atlasCell(action, dir, time, speed);
  const forward = r.vx * Math.cos(facing) + r.vy * Math.sin(facing);
  return composeFrame(cell, spriteMotion(time, speed, forward, r.pitch), cell.flip, r.canvas);
}
