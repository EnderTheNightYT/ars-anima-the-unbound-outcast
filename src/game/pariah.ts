/**
 * P.A.R.I.A.H · The Unbound Outcast — clase secreta. Reglas puras y estado; el motor sólo las lee
 * cuando la clase activa es `pariah`. Browser-safe, sin dependencias del motor.
 */
import type { WeaponBase } from "./data";

export const PARIAH_ID = "pariah";
export const isPariah = (id: string | undefined) => id === PARIAH_ID;

/** Perfil y pasivas (todos los porcentajes del diseño, en un único lugar). */
export const PARIAH = {
  damage: 1.8, strength: 1.6, physRes: 1.5, inventory: .6, loot: .65, jump: .7,
  /** Daño de referencia: espada estándar (1d8 → 4,5) + FUE×2 + 3, como cualquier clase. */
  refDice: 4.5,
  bleed: { chance: .25, pctPerSec: .03, seconds: 4 },
  /** Euforia Hostil: por enemigo adicional, con techo de +20 % (ajuste de balance). */
  euphoria: { per: { str: .08, atk: .05, res: .04 }, max: { str: .2, atk: .2, res: .16 }, range: 7 },
  /** Paroxismo: cada 5 impactos; ofensivo máx. +30 %. */
  paroxysm: { every: 5, dmg: .05, atk: .03, move: .02, max: { dmg: .3, atk: .3, move: .2 }, state: 20 },
  /** Techo común de bonificaciones temporales combinadas (Euforia + Paroxismo + Dolor + Frenesí). */
  tempCap: .5,
  pain: { store: .6, reflect: .15, maxBonus: .4 },
  parry: { window: 1.4, stunChance: .2, stunSec: .8, waverChance: .1, waverEvery: 6 },
  dodge: 1.2, thrown: .7, keg: 1.5, needs: .5, consumable: 1.5,
  view: { fov: .7, depth: .75 },
  nape: { mult: 2.5, cone: 25 * Math.PI / 180, headFrac: .8 },
  /** Movilidad pesada: 65 % → 75 % de la velocidad estándar en 5 s de marcha continua. */
  accel: { speed0: .65, perSec: .02, max: .1, stopAfter: 1, decay: 2 },
  /** Progresión anómala: +25 % de EXP por nivel; crecimiento extra en FUE/RES/AGI a partir del nivel 6. */
  xp: 1.25,
  growth: { from: 6, strongFrom: 12, dmgPerLevel: .02, dmgMax: .4, attrs: ["FUE", "RES", "AGI"] as const },
  /** Anatomía del Desamparado. */
  anatomy: { perception: 1.5, injury: 1.35, visualDuration: 1.25, severity: 1.2 },
} as const;

/** Armas propias: puños desnudos y escombros del entorno. Nunca entran en botín, tienda ni wiki. */
export const PARIAH_WEAPONS: WeaponBase[] = [
  { type: "PUÑOS", ranged: false, dice: [1, 1], range: 1.7, rate: 0.3, breakB: 3, color: "#3a2a24", ammo: 0 },
  { type: "RUINAS", ranged: true, dice: [1, 8], range: 13, rate: 0.42, breakB: 2, color: "#8f8577", ammo: 1, magazine: 7, reloadTime: 0 },
];
export const isPariahWeapon = (type?: string) => type === "PUÑOS" || type === "RUINAS";

// ---------------- Desbloqueo secreto ----------------
export type PariahAction = "bench" | "food" | "drink" | "meleeKill" | "otherKill" | "merchant";
const ORDER: PariahAction[] = ["bench", "food", "drink", "meleeKill", "merchant"];
export const PARIAH_KEY = "ars_anima_pariah_v1";
/** Código manual de prueba (pantalla de inicio → CÓDIGO SECRETO). */
export const PARIAH_CODE = "SINDUENO";
export const normalizeCode = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
/** 0 sin progreso · 1 banca · 2 alimento · 3 bebida · 4 victoria cuerpo a cuerpo · 5 mercader · 6 desbloqueada. */
export function pariahStep(state: number, action: PariahAction): number {
  if (state >= 6) return 6;
  if (action === ORDER[state]) { const next = state + 1; return next >= 5 ? 6 : next; }
  // Cualquier otra acción de la secuencia la rompe; la banca vuelve a empezarla.
  return action === "bench" ? 1 : 0;
}
export function readPariahState(): number { try { const n = Number(localStorage.getItem(PARIAH_KEY) ?? 0); return Number.isFinite(n) ? Math.max(0, Math.min(6, Math.floor(n))) : 0; } catch { return 0; } }
export function writePariahState(n: number) { try { localStorage.setItem(PARIAH_KEY, String(n)); } catch { /* sin almacenamiento */ } }
export const pariahUnlocked = () => readPariahState() >= 6;
/** Registra una acción; devuelve true sólo en el instante del desbloqueo. */
export function notePariahAction(action: PariahAction) {
  const before = readPariahState(); if (before >= 6) return false;
  const after = pariahStep(before, action); if (after !== before) writePariahState(after);
  return after >= 6;
}
export function redeemPariahCode(code: string) { if (normalizeCode(code) !== PARIAH_CODE) return false; writePariahState(6); return true; }
export const PARIAH_UNLOCK_TEXT = "Hay existencias que nunca encontraron un lugar en la creación. Sin nombre, sin propósito y sin dueño... algo acaba de reconocerte.";

// ---------------- Combate ----------------
/** Euforia Hostil: ≥2 enemigos hostiles encarando al jugador; cada enemigo adicional suma, con tope. */
export function euphoria(hostiles: number) {
  const k = hostiles >= 2 ? hostiles - 1 : 0, E = PARIAH.euphoria;
  return { str: Math.min(E.max.str, k * E.per.str), atk: Math.min(E.max.atk, k * E.per.atk), res: Math.min(E.max.res, k * E.per.res) };
}
/** Paroxismo: cada 5 impactos consecutivos. */
export function paroxysm(chain: number) {
  const s = Math.floor(Math.max(0, chain) / PARIAH.paroxysm.every), P = PARIAH.paroxysm;
  return { dmg: Math.min(P.max.dmg, s * P.dmg), atk: Math.min(P.max.atk, s * P.atk), move: Math.min(P.max.move, s * P.move), active: chain >= P.state };
}
/** Bonificación de Dolor Diferido: +1% daño por cada 1% de vida máxima acumulada, tope +40%. */
export const painBonus = (stored: number, hpMax: number) => Math.min(PARIAH.pain.maxBonus, Math.max(0, stored) / Math.max(1, hpMax));
/** Suma (no multiplica) las bonificaciones temporales y las limita al techo común. */
export const tempBonus = (...parts: number[]) => Math.min(PARIAH.tempCap, parts.reduce((a, b) => a + Math.max(0, b), 0));
/** Crecimiento a largo plazo: daño físico extra por nivel desde el 6. */
export const growthDamage = (level: number) => 1 + Math.min(PARIAH.growth.dmgMax, Math.max(0, level - (PARIAH.growth.from - 1)) * PARIAH.growth.dmgPerLevel);
/** Atributos extra que reparte la progresión anómala al subir a `level`. */
export function growthAttrs(level: number): string[] {
  const G = PARIAH.growth; if (level < G.from) return [];
  const a = G.attrs[level % 3]!, b = G.attrs[(level + 1) % 3]!;
  return level >= G.strongFrom ? [a, b] : [a];
}
export const pariahXp = (base: number) => Math.round(base * PARIAH.xp);

/**
 * Daño de puño determinista, sin tirada de daño ni críticos. Orden: base → clase → temporales/combo
 * (suma con techo) → situación. Resistencias y vulnerabilidades del objetivo las aplica después el motor.
 */
export function fistDamage(o: { fueMod: number; cls?: number; temp: number; combo: { dmg: number }; pain: number; euphoria: { str: number }; situation: number }) {
  const base = PARIAH.refDice + Math.max(0, o.fueMod) * PARIAH.strength * 2 + 3;
  const cls = base * PARIAH.damage * (o.cls ?? 1);
  const temp = cls * o.temp;
  const bonus = 1 + tempBonus(o.euphoria.str, o.combo.dmg, o.pain);
  return Math.round(temp * bonus * o.situation * 100) / 100;
}
/** Arma lanzada (Arsenal Improvisado): 70% del daño físico de referencia del arma. */
export const thrownDamage = (dice: [number, number], dmgMult: number, fueMod: number) => Math.round((dice[0] * (dice[1] + 1) / 2 + Math.max(0, fueMod) * 2 + 3) * dmgMult * PARIAH.thrown * 10) / 10;

/** Nuca Expuesta: sólo golpes desde la zona posterior real (cono estrecho detrás de la cabeza). */
export function napeHit(face: number, px: number, py: number, fx: number, fy: number, headHit = true) {
  if (!headHit || Math.hypot(fx - px, fy - py) < .05) return false;
  const toAttacker = Math.atan2(fy - py, fx - px);
  const behind = face + Math.PI;
  const d = Math.abs(((toAttacker - behind) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
  return d <= PARIAH.nape.cone;
}
/** Multiplicador de daño recibido: resistencia física (+50% y Euforia) y vulnerabilidad de nuca al final. */
export const takenMult = (eu: { res: number }, nape: boolean) => (1 / PARIAH.physRes) * (1 - eu.res) * (nape ? PARIAH.nape.mult : 1);

/** Arranque Pesado: 65% → 75% en 5 s de desplazamiento continuo. */
export function accelMult(moveT: number) { return PARIAH.accel.speed0 + Math.min(PARIAH.accel.max, Math.max(0, moveT) * PARIAH.accel.perSec); }

/** Dolor Diferido: reparte un golpe entre daño inmediato, acumulado y reflejado (nunca más que lo recibido). */
export function splitPain(dmg: number, inCombo: boolean) {
  if (!inCombo || dmg <= 0) return { now: dmg, store: 0, reflect: 0 };
  const store = dmg * PARIAH.pain.store;
  return { now: dmg - store, store, reflect: Math.min(dmg, dmg * PARIAH.pain.reflect) };
}

// ---------------- Ruptura del Desposeído ----------------
export const RUPTURE = {
  cost: 3, cooldown: 10, windup: .45, gap: .4, recovery: .6, baseRadius: 1.7,
  waves: [{ r: 1, push: 9 }, { r: 1.6, push: 8 }, { r: 2.3, push: 7 }],
  heavyPush: .5, rubble: 7,
} as const;
export const ruptureRadius = (wave: number) => RUPTURE.baseRadius * (RUPTURE.waves[wave]?.r ?? 1);
/** ¿Alcanza la onda `wave` a un cuerpo a distancia `dist` con radio `bodyR`? (colisión circular independiente) */
export const waveHits = (wave: number, dist: number, bodyR: number) => dist - bodyR <= ruptureRadius(wave);
/** Empuje según peso: jefes inmunes al desplazamiento, pesados a la mitad. */
export const rupturePush = (wave: number, heavy: boolean, boss: boolean) => boss ? 0 : (RUPTURE.waves[wave]?.push ?? 0) * (heavy ? RUPTURE.heavyPush : 1);

export const RUBBLE_MATERIALS = [
  { id: "piedra", name: "PIEDRA", color: "#8f8577", dmg: 1 },
  { id: "escombro", name: "ESCOMBRO", color: "#6e6458", dmg: .95 },
  { id: "hueso", name: "HUESO", color: "#e8dcc0", dmg: .85 },
  { id: "chatarra", name: "CHATARRA", color: "#7c8590", dmg: 1.15 },
  { id: "tierra", name: "TIERRA", color: "#5a4632", dmg: .8 },
  { id: "fragmento", name: "FRAGMENTO", color: "#a39fb5", dmg: 1.05 },
] as const;

// ---------------- Impulso del Desposeído ----------------
export const IMPULSE = { partial: 1, full: 2.5, cooldown: 6, cost: 1, ground: [10, 22] as const, airUp: [5.5, 9] as const, airFwd: [7, 13] as const, time: .32, loseOnHit: .05 } as const;
/** Fracción de impulso (0 si aún no llega a la carga parcial). */
export const impulsePower = (charge: number) => charge < IMPULSE.partial ? 0 : Math.min(1, .4 + .6 * (charge - IMPULSE.partial) / (IMPULSE.full - IMPULSE.partial));
export const lerp = (r: readonly [number, number], k: number) => r[0] + (r[1] - r[0]) * k;

// ---------------- Percepción del Vacío / Anatomía del Desamparado ----------------
export const VOID = { chance: [.08, .12] as const, interval: [9, 22] as const, rest: 14, episode: [3, 6] as const };
/** Probabilidad de episodio según oscuridad, cansancio, heridas y salud; nunca pasa del 45 %. */
export function voidChance(o: { dark: number; fatigue: number; hunger: number; head: boolean; wounds: number; hpFrac: number; danger: number }) {
  const base = VOID.chance[0] + (VOID.chance[1] - VOID.chance[0]) * Math.min(1, o.danger);
  const k = 1 + o.dark * .6 + o.fatigue * .5 + o.hunger * .4 + (o.head ? .8 : 0) + Math.min(3, o.wounds) * .15 + (o.hpFrac < .35 ? .5 : 0);
  return Math.min(.45, base * k * PARIAH.anatomy.perception);
}
export type VoidKind = "blur" | "dark" | "fragment" | "chroma" | "noise";
export const VOID_KINDS: VoidKind[] = ["blur", "dark", "fragment", "chroma", "noise"];
/** Severidad de una herida: 0 leve · 1 moderada · 2 grave · 3 crítica (requiere tratamiento). */
export const WOUND = { light: 15, moderate: 30, grave: 60, critical: 999 } as const;
export const woundLevel = (v: number) => v >= WOUND.critical ? 3 : v >= WOUND.grave ? 2 : v >= WOUND.moderate ? 1 : 0;
/** Nueva herida sobre una región: se acumula (+15 s por impacto) hasta grave; crítica sólo con golpes críticos. */
export const stackWound = (cur: number | undefined, critical: boolean) => critical && (cur ?? 0) >= WOUND.moderate ? WOUND.critical : Math.min(WOUND.grave + 10, Math.max(cur ?? 0, 0) + 15 * PARIAH.anatomy.severity + (cur ? 0 : 10));
/** Penalización mecánica de una región herida (multiplicador ≤1), +20 % de severidad. */
export const woundPenalty = (v: number | undefined) => v ? Math.max(.5, 1 - (.12 + woundLevel(v) * .08) * PARIAH.anatomy.severity) : 1;
