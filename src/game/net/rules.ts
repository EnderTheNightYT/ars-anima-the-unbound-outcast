/**
 * Reglas del modo EXPEDICIÓN COMPARTIDA (2–8 jugadores): modalidades, puntuación individual por rol,
 * robos, duelos, revividas y títulos. Puro, sin DOM: lo usan el servidor y la interfaz.
 */

export type RuleMode = "coop" | "traicion" | "caos";
export type Role = "dano" | "soporte" | "tanque" | "control" | "exploracion";

export const MP = {
  minPlayers: 2, maxPlayers: 8,
  tickHz: 30, snapHz: 15,
  reconnectSeconds: 60,
  downSeconds: 30, reviveSeconds: 2.5, reviveSupport: 1.5, reviveHp: .35, reviveRange: 1.6,
  extractWait: 45, interlude: 9, floors: 6,
  stealRange: 1.3, stealCd: 20, stealShare: .15, stealMin: 5,
  killStealShare: .3, duelJoin: 15, duelLoseHp: .15, duelPenalty: .2, duelPenaltyMin: 10,
  tankShare: .3, tankRange: 3, supportHealShare: .5, supportRange: 4,
  leverDamage: 10, leverRange: 15, abandonPenalty: .2,
} as const;

export const MODES: Record<RuleMode, { name: string; friendlyFire: number; pvp: boolean; steal: boolean; sabotage: boolean; contracts: boolean; blurb: string }> = {
  coop: { name: "Cooperativa", friendlyFire: 0, pvp: false, steal: false, sabotage: false, contracts: false,
    blurb: "Sin ataques entre jugadores. Cada uno compite por su puntuación, botín y título." },
  traicion: { name: "Traicionera", friendlyFire: .5, pvp: true, steal: true, sabotage: true, contracts: true,
    blurb: "Fuego amigo al 50 %, robos por la espalda, palancas, cofres de emboscada y contratos secretos." },
  caos: { name: "Caótica", friendlyFire: 1, pvp: true, steal: true, sabotage: true, contracts: true,
    blurb: "PvP completo: matar a un jugador roba el 30 % de sus fichas y uno de sus objetos." },
};

export const ROLES: Record<Role, { name: string; color: string; blurb: string }> = {
  dano: { name: "Daño", color: "#ff5a6a", blurb: "+10 % de daño. Puntúa más por daño y bajas." },
  soporte: { name: "Soporte", color: "#7affc1", blurb: "Tus curas sanan a aliados cercanos y levantas antes. Puntúa por curar y revivir." },
  tanque: { name: "Tanque", color: "#7ad8ff", blurb: "Absorbes el 30 % del daño de aliados cercanos. Puntúa por daño absorbido." },
  control: { name: "Control", color: "#c99bff", blurb: "Tus golpes de quiebre aturden más. Puntúa por enemigos controlados." },
  exploracion: { name: "Exploración", color: "#ffd34a", blurb: "Ves palancas, altares y cofres sellados en el mapa. Puntúa por secretos y recursos." },
};

/** Estadísticas individuales de una expedición compartida. */
export interface MpStats {
  kills: number; damage: number; healing: number; absorbed: number; revives: number; controls: number;
  objectives: number; secrets: number; resources: number; valuables: number; pvpKills: number;
  betrayals: number; events: number; contracts: number; firstOut: number; downs: number; taken: number;
  stolen: number; seconds: number; items: number; titles: number;
}
export const emptyStats = (): MpStats => ({ kills: 0, damage: 0, healing: 0, absorbed: 0, revives: 0, controls: 0, objectives: 0, secrets: 0, resources: 0, valuables: 0, pvpKills: 0, betrayals: 0, events: 0, contracts: 0, firstOut: 0, downs: 0, taken: 0, stolen: 0, seconds: 0, items: 0, titles: 0 });

/** Puntos extra por cada título ganado durante la partida. */
export const MID_TITLE_BONUS = 300;
/** Títulos que se ganan EN PLENA partida al cruzar un umbral de acciones (uno por jugador y título). */
export const MID_TITLES: { id: string; name: string; meaning: string; test: (s: MpStats) => boolean }[] = [
  { id: "segador", name: "SEGADOR INCONNU", meaning: "15 enemigos derrotados", test: s => s.kills >= 15 },
  { id: "verdugo", name: "VERDUGO DE TINTA", meaning: "40 enemigos derrotados", test: s => s.kills >= 40 },
  { id: "lazaro", name: "LÁZARO INCONNU", meaning: "levantó a 2 aliados", test: s => s.revives >= 2 },
  { id: "sangre", name: "SANGRE COMPARTIDA", meaning: "curó 150 de vida a aliados", test: s => s.healing >= 150 },
  { id: "muralla", name: "MURALLA SIN NOMBRE", meaning: "absorbió 150 de daño ajeno", test: s => s.absorbed >= 150 },
  { id: "ojo", name: "OJO DEL PALIMPSESTO", meaning: "halló 3 secretos", test: s => s.secrets >= 3 },
  { id: "carcelero", name: "CARCELERO DEL LIBRO", meaning: "controló 20 enemigos", test: s => s.controls >= 20 },
  { id: "judas", name: "JUDAS INCONNU", meaning: "3 traiciones", test: s => s.betrayals >= 3 },
  { id: "cain", name: "CAÍN DE LA TINTA", meaning: "derrotó a 2 jugadores", test: s => s.pvpKills >= 2 },
  { id: "agente", name: "AGENTE DEL CONTRATO", meaning: "cumplió un contrato secreto", test: s => s.contracts >= 1 },
  { id: "heraldo", name: "HERALDO DEL SUCESO", meaning: "completó 2 eventos", test: s => s.events >= 2 },
];
/** Títulos nuevos que cumple `s` y que el jugador aún no tenía. */
export function newMidTitles(s: MpStats, owned: ReadonlySet<string>) { return MID_TITLES.filter(t => !owned.has(t.id) && t.test(s)); }

/** Puntos por unidad de cada categoría y la categoría de rol que la potencia. */
const WEIGHTS: Record<keyof MpStats, { pts: number; roles?: Role[]; cap?: number }> = {
  kills: { pts: 40, roles: ["dano"], cap: 1200 }, damage: { pts: .5, roles: ["dano"], cap: 1500 },
  healing: { pts: 1.6, roles: ["soporte"], cap: 1500 }, absorbed: { pts: 1.2, roles: ["tanque"], cap: 1500 },
  revives: { pts: 180, roles: ["soporte"], cap: 1400 }, controls: { pts: 12, roles: ["control"], cap: 1300 },
  objectives: { pts: 150 }, secrets: { pts: 90, roles: ["exploracion"], cap: 1300 }, resources: { pts: 12, roles: ["exploracion"], cap: 900 },
  valuables: { pts: 50, cap: 1000 }, pvpKills: { pts: 140, cap: 900 }, betrayals: { pts: 60, cap: 600 }, events: { pts: 120, cap: 1000 },
  contracts: { pts: 260 }, firstOut: { pts: 160 }, downs: { pts: -60 }, taken: { pts: 0 }, stolen: { pts: .5, cap: 500 }, seconds: { pts: 0 }, items: { pts: 0 }, titles: { pts: MID_TITLE_BONUS },
};
/** Multiplicador de rol: principal ×1.6, secundario ×1.25. */
export const roleBoost = (primary: Role, secondary: Role | "" , key: keyof MpStats) => {
  const r = WEIGHTS[key].roles; if (!r) return 1;
  return r.includes(primary) ? 1.6 : secondary && r.includes(secondary) ? 1.25 : 1;
};
/** Rendimientos decrecientes por encima del tope: ninguna actividad sola gana la partida. */
export function capped(points: number, cap?: number) {
  if (!cap || points <= cap) return points;
  return cap + Math.sqrt(points - cap) * 8;
}

/** Méritos multijugador de un jugador (se suman a su puntuación del ScoreKeeper del juego). */
export function mpMerits(s: MpStats, primary: Role, secondary: Role | "" = "") {
  const lines: { key: keyof MpStats; points: number }[] = [];
  for (const key of Object.keys(WEIGHTS) as (keyof MpStats)[]) {
    const w = WEIGHTS[key], raw = (s[key] ?? 0) * w.pts * roleBoost(primary, secondary, key);
    if (!raw) continue;
    lines.push({ key, points: Math.round(raw < 0 ? raw : capped(raw, w.cap)) });
  }
  return { lines, total: lines.reduce((a, l) => a + l.points, 0) };
}
/** Bono por terminar rápido (sólo si se extrajo). */
export const timeBonus = (seconds: number, extracted: boolean) => extracted ? Math.max(0, Math.round(600 - seconds) * 1) : 0;

export const STAT_LABEL: Record<keyof MpStats, string> = {
  kills: "Enemigos derrotados", damage: "Daño efectivo", healing: "Curación efectiva", absorbed: "Daño absorbido", revives: "Aliados revividos",
  controls: "Enemigos controlados", objectives: "Objetivos", secrets: "Secretos", resources: "Recursos encontrados", valuables: "Objetos valiosos",
  pvpKills: "Jugadores derrotados", betrayals: "Traiciones", events: "Eventos completados", contracts: "Contratos secretos", firstOut: "Primero en salir",
  downs: "Veces caído", taken: "Daño recibido", stolen: "Fichas robadas", seconds: "Tiempo", items: "Objetos obtenidos", titles: "Títulos ganados en partida",
};

/** Título por acciones al final de la expedición (el rasgo más destacado frente al grupo). */
export function mpTitle(s: MpStats, group: MpStats[]): { name: string; meaning: string } {
  const best = (k: keyof MpStats) => s[k] > 0 && group.every(o => o[k] <= s[k]);
  if (s.betrayals >= 3 && best("betrayals")) return { name: "JUDAS INCONNU", meaning: "Nadie le dio la espalda dos veces." };
  if (s.pvpKills >= 2 && best("pvpKills")) return { name: "CAÍN DE LA TINTA", meaning: "Cazó a los suyos." };
  if (s.revives >= 2 && best("revives")) return { name: "LÁZARO INCONNU", meaning: "Levantó a los caídos." };
  if (s.absorbed >= 80 && best("absorbed")) return { name: "MURALLA SIN NOMBRE", meaning: "Recibió los golpes de otros." };
  if (s.healing >= 80 && best("healing")) return { name: "SANGRE COMPARTIDA", meaning: "Curó más que nadie." };
  if (s.secrets >= 2 && best("secrets")) return { name: "OJO DEL PALIMPSESTO", meaning: "Encontró lo escondido." };
  if (s.contracts >= 1) return { name: "AGENTE DEL CONTRATO", meaning: "Cumplió un encargo secreto." };
  if (s.kills >= 5 && best("kills")) return { name: "SEGADOR INCONNU", meaning: "Más bajas que nadie." };
  if (s.firstOut >= 1 && s.betrayals >= 1) return { name: "EL QUE NO MIRÓ ATRÁS", meaning: "Salió primero y dejó a otros." };
  if (s.downs === 0 && s.seconds > 60) return { name: "INTACTO", meaning: "Nunca cayó." };
  return { name: "IL'INCONNU", meaning: "Uno más entre los desconocidos." };
}

export interface Standing { id: string; name: string; score: number; stats: MpStats; title?: { name: string; meaning: string } }
/** Podio: mayor puntuación; empate → menos caídas → más revividas → nombre. */
export function podium<T extends Standing>(list: T[]): T[] {
  return [...list].sort((a, b) => b.score - a.score || a.stats.downs - b.stats.downs || b.stats.revives - a.stats.revives || a.name.localeCompare(b.name));
}

/** Fichas robadas por la espalda. */
export const stealAmount = (gold: number) => Math.min(Math.max(0, Math.floor(gold)), Math.max(MP.stealMin, Math.floor(gold * MP.stealShare)));
/** Fichas que pierde quien muere a manos de otro jugador en modo caótico. */
export const killLoot = (gold: number) => Math.max(0, Math.floor(gold * MP.killStealShare));
/** Penalización del perdedor de un duelo por el legendario. */
export const duelPenalty = (gold: number) => Math.min(Math.max(0, Math.floor(gold)), Math.max(MP.duelPenaltyMin, Math.floor(gold * MP.duelPenalty)));
/** Daño entre jugadores según modalidad (los duelistas siempre al 100 %). */
export const pvpDamage = (base: number, mode: RuleMode, duel = false, atkLevel = 1, defLevel = 1) =>
  Math.round((duel ? base : base * MODES[mode].friendlyFire) * levelEdge(atkLevel, defLevel));
/**
 * Ventaja de nivel en PvP/fuego amigo: crece cuadráticamente con la diferencia (tope ×4) y el más débil
 * hace mucho menos daño (mínimo ×0,35). Igual nivel = ×1.
 */
export function levelEdge(atkLevel: number, defLevel: number) {
  const d = Math.round(atkLevel - defLevel);
  if (d >= 0) return Math.min(4, 1 + .12 * d + .04 * d * d);
  return Math.max(.35, 1 + .08 * d);
}
/** Experiencia en multijugador: quien va por detrás del grupo sube más rápido y quien va por delante, más lento. */
export function mpXpMult(level: number, groupLevels: number[]) {
  if (groupLevels.length < 2) return 1;
  const avg = groupLevels.reduce((a, b) => a + b, 0) / groupLevels.length, d = level - avg;
  return d < 0 ? Math.min(1.6, 1 - .15 * d) : Math.max(.6, 1 - .1 * d);
}
/** Daño base de un golpe cuerpo a cuerpo PvP a partir del arma. */
export function weaponHit(dice: readonly [number, number] | number[] | undefined, dmgMult = 1, level = 1) {
  const [n, s] = [dice?.[0] ?? 1, dice?.[1] ?? 6];
  return Math.max(1, Math.round((n * (s + 1) / 2 + 2) * dmgMult * (1 + level * .04)));
}
/** ¿B está de espaldas a A? (A detrás de B, fuera de su cono de visión). */
export function isBehind(ax: number, ay: number, bx: number, by: number, bAng: number) {
  const toA = Math.atan2(ay - by, ax - bx);
  return Math.abs(Math.atan2(Math.sin(toA - bAng), Math.cos(toA - bAng))) > 2;
}
/** Tiempo para levantar a un aliado según el rol de quien ayuda. */
export const reviveTime = (role: Role, secondary: Role | "" = "") => role === "soporte" || secondary === "soporte" ? MP.reviveSupport : MP.reviveSeconds;

/** Contratos secretos posibles (sólo modos con traición). */
export type ContractKind = "kill" | "firstOut" | "steal" | "lever" | "greed";
export const CONTRACT_TEXT: Record<ContractKind, string> = {
  kill: "Derrota a {target} antes de salir del piso.", firstOut: "Sé el primero en cruzar el portal.", steal: "Roba al menos 30 fichas a tus compañeros.",
  lever: "Acciona una palanca de sabotaje.", greed: "Vacía el altar de la codicia.",
};
export const CONTRACT_REWARD = { gold: 60, points: 260 } as const;

/** Código de sala: 6 caracteres sin ambigüedades (sin 0/O/1/I). */
export function roomCode(rand: () => number = Math.random) {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = "";
  for (let i = 0; i < 6; i++) s += A[Math.floor(rand() * A.length)];
  return s;
}
export const validCode = (c: string) => /^[A-HJ-NP-Z2-9]{6}$/.test(c);
