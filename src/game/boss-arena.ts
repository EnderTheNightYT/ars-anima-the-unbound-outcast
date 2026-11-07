/** Reglas del combate de jefe (arena sellada, límite de tiempo, escombros, saltos-machaque). Sin DOM. */
export const BOSS_ARENA = {
  /** Segundos para vencer al jefe antes de que caigan escombros. */
  timeLimit: 240,
  /** Escombros tras agotar el tiempo: cada cuánto caen, aviso previo, radio y daño (fracción de vida máx.). */
  rubbleEvery: 2.2, rubbleWarn: 0.8, rubbleRadius: 1.25, rubbleDmgShare: 0.09,
  /** Cada cuánto el jefe invoca refuerzos (y más rápido con el tiempo agotado). */
  summonEvery: 22, summonEveryOvertime: 11, summonCap: 6,
  /** Penalización de puntaje: quieto (por segundo, tras un margen) y por tardar (por segundo). */
  stillGrace: 1.2, stillPenaltyPerSec: 6, slowPenaltyPerSec: 1, overtimePenaltyPerSec: 4,
  /** Fase de saltos: empieza bajo esta fracción de vida; duración del salto, altura y enfriamiento. */
  slamBelow: 0.6, slamAir: 0.95, slamHeight: 2.6, slamCd: [5.5, 8] as [number, number],
  slamRadius: 1.9, slamDmgShare: 0.18, slamAdds: 2,
  /** Nube del machaque: proyectiles lentos, muchos y con muchos rebotes. */
  slamShots: 34, slamShotSpeed: [1.6, 2.6] as [number, number], slamBounces: 12, slamLife: 11,
} as const;

/** Penalización de puntaje (negativa) para este fotograma del combate. */
export function arenaScorePenalty(dt: number, stillT: number, overtime: boolean) {
  const A = BOSS_ARENA;
  let p = (overtime ? A.overtimePenaltyPerSec : A.slowPenaltyPerSec) * dt;
  if (stillT > A.stillGrace) p += A.stillPenaltyPerSec * dt;
  return -p;
}

/** Daño de un escombro según la vida máxima. */
export const rubbleDamage = (hpMax: number) => Math.max(1, hpMax * BOSS_ARENA.rubbleDmgShare);

/** Intervalo de refuerzos del jefe. */
export const summonInterval = (overtime: boolean) => overtime ? BOSS_ARENA.summonEveryOvertime : BOSS_ARENA.summonEvery;

/** ¿El jefe ya salta para machacar? */
export const canSlam = (hp: number, hpMax: number) => hp > 0 && hp <= hpMax * BOSS_ARENA.slamBelow;

/** Altura del salto (parábola) en t∈[0,1]. */
export const slamArc = (t: number) => 4 * BOSS_ARENA.slamHeight * t * (1 - t);

/**
 * Patrón de la nube redonda del machaque: anillo base cuya forma se altera
 * un poco (ondulación aleatoria del radio/velocidad y ángulo) en cada machaque.
 */
export function slamCloud(rand: () => number) {
  const A = BOSS_ARENA, n = A.slamShots, lobes = 2 + Math.floor(rand() * 4), phase = rand() * Math.PI * 2, warp = 0.15 + rand() * 0.3;
  const out: { a: number; speed: number; dz: number; h: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.12;
    const k = 1 + Math.sin(a * lobes + phase) * warp;
    const speed = (A.slamShotSpeed[0] + rand() * (A.slamShotSpeed[1] - A.slamShotSpeed[0])) * k;
    out.push({ a, speed, dz: 0.6 + rand() * 1.6, h: rand() * 0.6 });
  }
  return out;
}
