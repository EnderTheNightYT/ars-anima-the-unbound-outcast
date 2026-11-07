/** Habilidad activa propia de cada clase (botón dedicado). Puro, sin DOM. */
export type SkillEffect = "buff" | "volley" | "nova" | "bomb" | "leap" | "shout" | "heal" | "curse";
/** Cómo se recarga: por tiempo, por muertes, por golpes recibidos o por daño infligido. */
export type ChargeKind = "time" | "kills" | "hurt" | "damage";
export interface ClassSkill {
  id: string; name: string; desc: string; effect: SkillEffect;
  charge: ChargeKind; need: number; // segundos, muertes, golpes o puntos de daño
  power: number; duration: number; // multiplicador / daño base y segundos de buff
  buff?: { damage?: number; taken?: number; speed?: number; lifesteal?: number };
  /** Volley: dispersión estrecha (ráfaga recta) en vez de abanico. */ tight?: boolean;
  /** Bomba que además envenena el área de caída. */ poison?: boolean;
}

const SIGNATURE: Record<string, ClassSkill> = {
  cuervo: { id: "bandada", name: "Bandada de Nunca Más", desc: "9 plumas afiladas en abanico; ideal contra Tiranos.", effect: "volley", charge: "kills", need: 3, power: 16, duration: 0 },
  archivista: { id: "glosa", name: "Glosa Ardiente", desc: "La tinta estalla a tu alrededor y hace sangrar.", effect: "curse", charge: "damage", need: 220, power: 1.3, duration: 6 },
  campanero: { id: "tanido", name: "Tañido de Bronce", desc: "Onda de campana que daña y tambalea todo alrededor.", effect: "nova", charge: "hurt", need: 5, power: 38, duration: 0 },
  duelista: { id: "danza", name: "Danza de Acero", desc: "6 s de +45% daño y +20% velocidad.", effect: "buff", charge: "kills", need: 3, power: 1, duration: 6, buff: { damage: 1.45, speed: 1.2 } },
  cazador: { id: "lluvia", name: "Lluvia de Flechas", desc: "Abanico de 7 flechas.", effect: "volley", charge: "time", need: 12, power: 14, duration: 0 },
  guardian: { id: "muro", name: "Muro de Hierro", desc: "5 s recibiendo solo el 30% del daño.", effect: "buff", charge: "hurt", need: 6, power: 1, duration: 5, buff: { taken: 0.3 } },
  resonante: { id: "faro", name: "Faro Arcano", desc: "Estallido de lumbre a tu alrededor.", effect: "nova", charge: "time", need: 15, power: 30, duration: 0 },
  alquimista: { id: "matraz", name: "Matraz Volátil", desc: "Lanza un frasco que envenena el área.", effect: "bomb", charge: "time", need: 10, power: 24, duration: 0, poison: true },
  acrobata: { id: "mortal", name: "Salto Mortal", desc: "Salto altísimo hacia delante que cae machacando.", effect: "leap", charge: "time", need: 8, power: 1, duration: 0 },
  guerrero: { id: "grito", name: "Grito de Guerra", desc: "Tambalea a los cercanos y da 6 s de +35% daño.", effect: "shout", charge: "kills", need: 4, power: 1, duration: 6, buff: { damage: 1.35 } },
  tecnomante: { id: "rafaga", name: "Ráfaga Mecánica", desc: "Ocho balas rectas en un instante.", effect: "volley", charge: "time", need: 12, power: 10, duration: 0, tight: true },
  hereje: { id: "sombra", name: "Manifestación de Sombra", desc: "8 s robando el 35% del daño como vida.", effect: "buff", charge: "damage", need: 250, power: 1, duration: 8, buff: { lifesteal: 0.35 } },
  ocultista: { id: "runa", name: "Runa de Sangre", desc: "Hace sangrar a todos los enemigos cercanos.", effect: "curse", charge: "kills", need: 3, power: 1, duration: 6 },
  ingeniero: { id: "mina", name: "Carga del Engranaje", desc: "Bomba pesada de gran radio.", effect: "bomb", charge: "time", need: 14, power: 45, duration: 0 },
  peregrino: { id: "voluntad", name: "Voluntad Obstinada", desc: "Recupera el 30% de vida y limpia estados.", effect: "heal", charge: "time", need: 25, power: 0.3, duration: 0 },
};

/** Habilidades alternativas que cada clase puede elegir en lugar de la propia. */
const POOL: Record<string, ClassSkill> = {
  eco: { id: "eco", name: "Eco Resonante", desc: "Onda de choque corta alrededor tuyo.", effect: "nova", charge: "time", need: 14, power: 22, duration: 0 },
  frenesi: { id: "frenesi", name: "Frenesí", desc: "6 s de +30% daño y +15% velocidad.", effect: "buff", charge: "kills", need: 3, power: 1, duration: 6, buff: { damage: 1.3, speed: 1.15 } },
  baluarte: { id: "baluarte", name: "Baluarte", desc: "5 s recibiendo solo el 45% del daño.", effect: "buff", charge: "hurt", need: 5, power: 1, duration: 5, buff: { taken: 0.45 } },
  sanguijuela: { id: "sanguijuela", name: "Sanguijuela", desc: "6 s robando el 25% del daño como vida.", effect: "buff", charge: "damage", need: 200, power: 1, duration: 6, buff: { lifesteal: 0.25 } },
  metralla: { id: "metralla", name: "Metralla", desc: "Abanico de 7 esquirlas.", effect: "volley", charge: "time", need: 10, power: 9, duration: 0 },
  zancada: { id: "zancada", name: "Zancada del Cuervo", desc: "Salto largo que termina machacando.", effect: "leap", charge: "time", need: 9, power: 1, duration: 0 },
  aullido: { id: "aullido", name: "Aullido", desc: "Tambalea a los cercanos y 5 s de +20% daño.", effect: "shout", charge: "kills", need: 4, power: 1, duration: 5, buff: { damage: 1.2 } },
  remedio: { id: "remedio", name: "Remedio de Campaña", desc: "Recupera el 25% de vida y limpia estados.", effect: "heal", charge: "time", need: 25, power: 0.25, duration: 0 },
  maldicion: { id: "maldicion", name: "Maldición Menor", desc: "Sangrado a los enemigos cercanos.", effect: "curse", charge: "kills", need: 3, power: 0.8, duration: 6 },
  granada: { id: "granada", name: "Granada de Pólvora", desc: "Bomba de radio medio.", effect: "bomb", charge: "time", need: 12, power: 30, duration: 0 },
  frasco: { id: "frasco", name: "Frasco Tóxico", desc: "Frasco que envenena el área.", effect: "bomb", charge: "hurt", need: 4, power: 16, duration: 0, poison: true },
};
const ALTS: Record<string, string[]> = {
  cuervo: ["zancada", "sanguijuela"], archivista: ["eco", "remedio"], campanero: ["aullido", "baluarte"],
  duelista: ["zancada", "sanguijuela"], cazador: ["frasco", "zancada"], guardian: ["aullido", "remedio"], resonante: ["maldicion", "baluarte"],
  alquimista: ["remedio", "eco"], acrobata: ["metralla", "frenesi"], guerrero: ["baluarte", "zancada"], tecnomante: ["granada", "baluarte"],
  hereje: ["maldicion", "eco"], ocultista: ["sanguijuela", "frasco"], ingeniero: ["metralla", "baluarte"], peregrino: ["frenesi", "aullido"],
};
/** Todas las habilidades que puede elegir la clase: la propia primero. */
export const CLASS_SKILLS: Record<string, ClassSkill[]> = Object.fromEntries(Object.entries(SIGNATURE).map(([k, v]) => [k, [v, ...(ALTS[k] ?? []).map((id) => POOL[id]!)]]));
export const skillOptions = (classId: string) => CLASS_SKILLS[classId] ?? [];

/** Explicación breve de la recarga. */
export function chargeText(s: ClassSkill) { return s.charge === "time" ? `Se recarga en ${s.need} s` : s.charge === "kills" ? `Se recarga con ${s.need} muertes` : s.charge === "hurt" ? `Se recarga al recibir ${s.need} golpes` : `Se recarga al infligir ${s.need} de daño`; }

/** Subclase "-ataque" potencia el efecto ×1,3; "-resguardo" recarga un 25% antes y alarga buffs 2 s. */
export function skillFor(classId: string, subclassId = "", pick = 0): ClassSkill | null {
  const opts = skillOptions(classId); const base = opts[pick] ?? opts[0]; if (!base) return null;
  if (subclassId.endsWith("-ataque")) return { ...base, power: base.power * 1.3, ...(base.buff ? { buff: { ...base.buff, ...(base.buff.damage ? { damage: 1 + (base.buff.damage - 1) * 1.3 } : {}) } } : {}) };
  if (subclassId.endsWith("-resguardo")) return { ...base, need: Math.max(1, Math.round(base.need * 0.75)), duration: base.duration ? base.duration + 2 : 0 };
  return base;
}

/** Suma progreso de recarga según el evento; devuelve el nuevo valor limitado a `need`. */
export function chargeSkill(skill: ClassSkill, current: number, event: ChargeKind, amount = 1) {
  if (event !== skill.charge) return current;
  return Math.min(skill.need, current + amount);
}

export const CHARGE_LABEL: Record<ChargeKind, string> = { time: "s", kills: "muertes", hurt: "golpes recibidos", damage: "daño" };

/** Cómo se desbloquea una habilidad durante la partida (la propia de la clase siempre está abierta). */
export type UnlockKind = "start" | "level" | "floor" | "kills" | "bosses" | "secrets" | "puzzles" | "pacts" | "merchant";
export interface SkillUnlock { kind: UnlockKind; n: number }
export const SKILL_UNLOCKS: Record<string, SkillUnlock> = {
  eco: { kind: "level", n: 3 }, frenesi: { kind: "kills", n: 15 }, baluarte: { kind: "floor", n: 2 }, sanguijuela: { kind: "pacts", n: 1 },
  metralla: { kind: "merchant", n: 60 }, zancada: { kind: "secrets", n: 1 }, aullido: { kind: "bosses", n: 1 }, remedio: { kind: "merchant", n: 40 },
  maldicion: { kind: "puzzles", n: 1 }, granada: { kind: "floor", n: 3 }, frasco: { kind: "kills", n: 25 },
};
export const unlockOf = (id: string): SkillUnlock => SKILL_UNLOCKS[id] ?? { kind: "start", n: 0 };
/** Progreso de la partida que abre habilidades. */
export interface RunProgress { level: number; floor: number; kills: number; bosses: number; secrets: number; puzzles: number; pacts: number; bought: string[] }
export function skillUnlocked(id: string, p: RunProgress) {
  const u = unlockOf(id);
  if (u.kind === "start") return true;
  if (u.kind === "merchant") return p.bought.includes(id);
  return p[u.kind] >= u.n;
}
export function unlockText(id: string) {
  const u = unlockOf(id), n = u.n;
  return u.kind === "start" ? "Disponible desde el inicio" : u.kind === "level" ? `Se desbloquea en Nv ${n}` : u.kind === "floor" ? `Se desbloquea al llegar al piso ${n}`
    : u.kind === "kills" ? `Se desbloquea al derrotar ${n} enemigos` : u.kind === "bosses" ? `Se desbloquea al vencer a un jefe`
    : u.kind === "secrets" ? `Se desbloquea al descubrir un secreto` : u.kind === "puzzles" ? `Se desbloquea al resolver un palimpsesto del libro`
    : u.kind === "pacts" ? `Se desbloquea al sellar un pacto` : `Se compra al Mercader por ${n} fichas`;
}
/** Combos y sinergias de cada efecto (texto de wiki). */
export const EFFECT_COMBO: Record<SkillEffect, string> = {
  buff: "Actívala antes de un combo cuerpo a cuerpo o una ejecución: el bono se suma al daño del arma y a los mini críticos de ritmo.",
  volley: "Cada proyectil puede critar; a quemarropa impactan casi todos. Combina con enemigos tambaleados o en fila.",
  nova: "Golpea a todo lo que te rodea; úsala cuando te acorralen o justo tras un Grito para rematar.",
  bomb: "Explota al tocar; lánzala a grupos o barriles de pólvora para encadenar explosiones.",
  leap: "Al caer machaca el suelo y aturde; enlaza con un ataque fuerte mientras siguen tambaleados.",
  shout: "Tambalea a los cercanos: abre ventanas para ejecuciones, agarres (E) y golpes por la espalda.",
  heal: "Cura y limpia sangrado, fuego y veneno; guárdala para después de un pacto con precio de vida.",
  curse: "El sangrado sigue dañando mientras peleas; combínala con robo de vida o con muertes en cadena.",
};
/** Daño o efecto principal legible para la pantalla de habilidades. */
export function skillPowerText(s: ClassSkill, level = 1) {
  const lvl = 1 + level * 0.08, d = (x: number) => Math.round(x * lvl);
  if (s.effect === "volley") return `${s.tight ? 8 : 7} × ${d(s.power)} daño (máx. ${d(s.power) * (s.tight ? 8 : 7)})`;
  if (s.effect === "nova") return `${d(s.power)} daño en área (radio 3,6)`;
  if (s.effect === "bomb") return `${d(s.power)} daño de explosión${s.poison ? " + veneno 8 s" : ""}`;
  if (s.effect === "heal") return `Cura ${Math.round(s.power * 100)}% de vida`;
  if (s.effect === "curse") return `Sangrado ${Math.round(s.duration * s.power)} s a enemigos cercanos`;
  if (s.effect === "leap") return "Salto + golpe en el suelo";
  if (s.effect === "shout") return `Tambaleo ${(1.5 * s.power).toFixed(1)} s`;
  const b = s.buff ?? {};
  return [b.damage && `+${Math.round((b.damage - 1) * 100)}% daño`, b.speed && `+${Math.round((b.speed - 1) * 100)}% velocidad`, b.taken && `recibes ${Math.round(b.taken * 100)}% del daño`, b.lifesteal && `${Math.round(b.lifesteal * 100)}% robo de vida`].filter(Boolean).join(", ") + ` durante ${s.duration} s`;
}
/** Todas las habilidades activas distintas (propias + alternativas) con las clases que pueden usarlas. */
export function allSkills() {
  const m = new Map<string, { skill: ClassSkill; classes: string[] }>();
  for (const [cls, list] of Object.entries(CLASS_SKILLS)) for (const sk of list) { const e = m.get(sk.id) ?? { skill: sk, classes: [] }; e.classes.push(cls); m.set(sk.id, e); }
  return [...m.values()];
}
