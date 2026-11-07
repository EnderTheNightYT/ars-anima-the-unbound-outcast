/** Puntaje de ARS ANIMA: tabla de méritos, penalizaciones, recuento y bono de fichas. Sin DOM. */

export const SCORE = {
  pickup: 2, gold: 3, sell: 4, kill: 8, barrel: 10, chest: 14, keyDoor: 18, glory: 25,
  defense: 30, opening: 35, mechCombo: 45, attackCombo: 50, killCombo: 60, mission: 80,
  pact: 90, levelUp: 100, skill: 110, secret: 130, secretDoor: 150, secretRoom: 170,
  boss: 250, map: 280, palimpsest: 500, portal: 300, floor: 350, perfect: 600,
} as const;

export const PENALTY = {
  spendPer: 10, missionFail: 40, itemUse: 5, missedExecution: 15, comboBreak: 10,
  timeEvery: 2, starveEvery: 3, death: 300,
} as const;

export type ScoreKey = keyof typeof SCORE | "spend" | "missionFail" | "damage" | "hunger" | "thirst" | "itemUse" | "missedExecution" | "comboBreak" | "time" | "death";

export const SCORE_LABEL: Record<ScoreKey, string> = {
  pickup: "Objetos recogidos", gold: "Fichas y ventas", sell: "Armas vendidas", kill: "Enemigos abatidos",
  barrel: "Barriles destruidos", chest: "Cofres abiertos", keyDoor: "Puertas de llave", glory: "Ejecuciones",
  defense: "Bloqueos, esquives y reflejos", opening: "Aperturas aprovechadas", mechCombo: "Combos de mecánicas",
  attackCombo: "Combos de ataques", killCombo: "Combos de muertes", mission: "Misiones cumplidas", pact: "Pactos",
  levelUp: "Subidas de nivel", skill: "Puntos de clase y habilidades", secret: "Secretos descubiertos",
  secretDoor: "Pasajes secretos abiertos", secretRoom: "Salas secretas superadas", boss: "Jefe derrotado",
  map: "Mapa completo", palimpsest: "Palimpsestos descifrados", portal: "Portal cruzado", floor: "Nivel superado", perfect: "Nivel al 100%",
  spend: "Fichas gastadas", missionFail: "Misiones fallidas", damage: "Daño sufrido", hunger: "Hambre",
  thirst: "Sed", itemUse: "Objetos usados", missedExecution: "Ejecuciones perdidas", comboBreak: "Combos rotos",
  time: "Tiempo (−1 cada 2 s)", death: "Muerte",
};

export interface ScoreLine { key: ScoreKey; label: string; count: number; points: number }
export interface Recap {
  reason: "floor" | "death" | "won"; floor: number; lines: ScoreLine[]; floorScore: number; total: number;
  grade: Grade; title: string; message: string; advice: string; bonus: number; seconds: number; narrative?: string;
}
export type Grade = "S" | "A" | "B" | "C" | "D" | "F";

/** Calificación según los puntos del tramo frente a lo esperado para ese piso. */
export function gradeFor(points: number, floor: number): Grade {
  const r = points / (500 + floor * 150);
  return r >= 1.5 ? "S" : r >= 1 ? "A" : r >= .6 ? "B" : r >= .3 ? "C" : r >= .1 ? "D" : "F";
}

const GRADE_BONUS: Record<Grade, number> = { S: 80, A: 55, B: 35, C: 20, D: 10, F: 0 };
/** Bono de fichas moderado para el siguiente nivel o partida. */
export function bonusFor(grade: Grade, floor: number) { return grade === "F" ? 0 : GRADE_BONUS[grade] + Math.min(6, floor) * 5; }

const TITLES: Record<Grade, [string, string]> = {
  S: ["¡OBRA MAESTRA!", "Los dados se inclinan ante ti. Pocas tintas escriben así."],
  A: ["¡GRAN HAZAÑA!", "Un recorrido brillante; el Libro recordará tu nombre."],
  B: ["BUEN TRABAJO", "Sólido y valiente. Aún queda margen para brillar."],
  C: ["SUPERVIVIENTE", "Saliste adelante, pero dejaste méritos por el camino."],
  D: ["A DURAS PENAS", "La tinta tiembla. Este tramo pudo salir mucho mejor."],
  F: ["DECEPCIÓN", "El Libro apenas registró tu paso. Hay que cambiar la estrategia."],
};

const ADVICE: Partial<Record<ScoreKey, string>> = {
  damage: "Bloquea justo antes del golpe o esquiva con el dash: recibir daño fue tu mayor pérdida.",
  time: "Avanza con más decisión: cada 2 segundos cuesta un punto.",
  missedExecution: "Cuando un enemigo quede EXPUESTO, pulsa E o patéalo para ejecutarlo.",
  comboBreak: "Mantén las rachas encadenando bajas sin pausas largas.",
  spend: "Gasta fichas sólo en lo imprescindible; ahorrar también puntúa.",
  hunger: "Lleva raciones y come antes de quedarte sin comida.",
  thirst: "Bebe agua antes de que la sed llegue a cero.",
  itemUse: "Usa objetos con cabeza: cada uso resta un poco.",
  missionFail: "Acepta misiones que puedas terminar a tiempo.",
  death: "Retírate al refugio cuando la vida esté baja.",
};

export class ScoreKeeper {
  total = 0; floorPts = 0; floorT = 0;
  private run = new Map<ScoreKey, ScoreLine>(); private floorLines = new Map<ScoreKey, ScoreLine>();
  private timeAcc = 0; private starveAcc = { hunger: 0, thirst: 0 }; private mechs: { k: string; t: number }[] = [];
  private mechCd = 0; recent: { text: string; t: number; good: boolean }[] = [];

  reset() { this.total = 0; this.run.clear(); this.newFloor(); }
  /** Estado de la run para guardarla (el tramo del piso actual se reinicia al reanudar). */
  dump() { return { total: this.total, run: [...this.run.values()] }; }
  load(d: unknown) {
    const v = d as { total?: number; run?: ScoreLine[] } | null; this.reset(); if (!v) return;
    this.total = Number(v.total) || 0; for (const l of v.run ?? []) if (l && l.key in SCORE_LABEL) this.run.set(l.key, { ...l, label: SCORE_LABEL[l.key] });
  }
  /** Mejores méritos de la run (para explicar la puntuación). */
  topLines(n = 4) { return [...this.run.values()].sort((a, b) => b.points - a.points).slice(0, n); }
  newFloor() { this.floorPts = 0; this.floorT = 0; this.floorLines.clear(); this.timeAcc = 0; this.mechs = []; }

  add(key: ScoreKey, points: number, count = 1) {
    points = Math.round(points); if (!points) return 0;
    for (const map of [this.run, this.floorLines]) { const l = map.get(key) ?? { key, label: SCORE_LABEL[key], count: 0, points: 0 }; l.count += count; l.points += points; map.set(key, l); }
    this.total += points; this.floorPts += points;
    if (key !== "time" && key !== "hunger" && key !== "thirst") this.recent.push({ text: `${points > 0 ? "+" : ""}${points} ${SCORE_LABEL[key]}`, t: 1.6, good: points > 0 }); this.recent = this.recent.slice(-3);
    return points;
  }
  gain(key: keyof typeof SCORE, mult = 1) { return this.add(key, SCORE[key] * mult); }
  spend(gold: number) { if (gold > 0) this.add("spend", -Math.ceil(gold / PENALTY.spendPer)); }
  damage(dmg: number) { if (dmg > 0) this.add("damage", -Math.max(1, Math.ceil(dmg))); }

  /** Tiempo: −1 cada 2 s; hambre/sed en cero: −1 cada 3 s. */
  tick(dt: number, food: number, thirst: number) {
    this.floorT += dt; this.mechCd = Math.max(0, this.mechCd - dt);
    for (const r of this.recent) r.t -= dt; this.recent = this.recent.filter(r => r.t > 0);
    this.timeAcc += dt; while (this.timeAcc >= PENALTY.timeEvery) { this.timeAcc -= PENALTY.timeEvery; this.add("time", -1); }
    for (const [k, v] of [["hunger", food], ["thirst", thirst]] as const) {
      if (v > 0) { this.starveAcc[k] = 0; continue; }
      this.starveAcc[k] += dt; while (this.starveAcc[k] >= PENALTY.starveEvery) { this.starveAcc[k] -= PENALTY.starveEvery; this.add(k, -1); }
    }
  }

  /** Registra una mecánica (cargar, dash, salto, machacar, golpe, disparo). */
  mech(kind: string, now: number) { this.mechs.push({ k: kind, t: now }); this.mechs = this.mechs.filter(m => now - m.t < 3).slice(-8); }
  /** Al dañar a un enemigo: 3+ mecánicas distintas en 3 s cuentan como combo de mecánicas. */
  mechHit(now: number) {
    const kinds = new Set(this.mechs.filter(m => now - m.t < 3).map(m => m.k));
    if (kinds.size >= 3 && this.mechCd <= 0) { this.mechCd = 2; this.mechs = []; return this.gain("mechCombo", kinds.size - 2); }
    return 0;
  }

  recap(reason: Recap["reason"], floor: number): Recap {
    const lines = [...(reason === "floor" ? this.floorLines : this.run).values()].sort((a, b) => b.points - a.points);
    const pts = reason === "floor" ? this.floorPts : this.total;
    const grade = gradeFor(reason === "floor" ? pts : pts / Math.max(1, floor), floor);
    const worst = lines.filter(l => l.points < 0 && ADVICE[l.key]).sort((a, b) => a.points - b.points)[0];
    const advice = worst ? ADVICE[worst.key]! : "Encadena dash, salto, machacar, golpes y disparos para combos de mecánicas.";
    const [title, message] = reason === "death" && ["C", "D", "F"].includes(grade) ? ["LA TINTA SE SECA", "Caíste, y el recuento no te favorece. Aprende y vuelve."] : TITLES[grade];
    const bonus = reason === "floor" ? bonusFor(grade, floor) : Math.round(bonusFor(grade, floor) / 2);
    return { reason, floor, lines, floorScore: this.floorPts, total: this.total, grade, title, message, advice, bonus, seconds: Math.round(this.floorT) };
  }
}
