/** Peleas entre enemigos y ascenso del Tirano. Puro, sin DOM. */
export const FEUD = {
  /** Segundos entre intentos de provocar una pelea. */
  every: [35, 65] as const,
  /** Distancia máxima entre los dos rivales y desde el jugador (casillas). */
  pairRange: 6, playerRange: 16,
  /** Daño por golpe entre rivales, como fracción de su vida máxima, y pausa entre golpes. */
  hitFrac: 0.12, cd: 1.1, reach: 1.15,
  /** Ascenso del Tirano al ganar: vida ×, daño ×, velocidad ×. */
  tyrantHp: 1.6, tyrantDmg: 1.3, tyrantSpeed: 1.15,
} as const;

export interface FeudActor { id: number; kind: string; x: number; y: number; dead: boolean; aware?: boolean; miniBoss?: boolean; boss?: boolean; rival?: number | undefined; tyrant?: boolean; ambush?: unknown }

/** Elige la pareja más cercana de enemigos de distinta especie, ajenos al jugador y cerca de él. */
export function pickFeud<T extends FeudActor>(list: readonly T[], px: number, py: number): [T, T] | null {
  const ok = list.filter((e) => !e.dead && !e.aware && !e.miniBoss && !e.boss && !e.ambush && e.rival === undefined && Math.hypot(e.x - px, e.y - py) < FEUD.playerRange);
  let best: [T, T] | null = null, bd = Infinity;
  for (let i = 0; i < ok.length; i++) for (let j = i + 1; j < ok.length; j++) {
    const a = ok[i]!, b = ok[j]!; if (a.kind === b.kind) continue;
    const d = Math.hypot(a.x - b.x, a.y - b.y); if (d < FEUD.pairRange && d < bd) { bd = d; best = [a, b]; }
  }
  return best;
}

/** El ganador asciende a Tirano: más vida (curado al nuevo máximo) y alerta. Solo una vez. */
export function ascend(e: { hp: number; hpMax: number; tyrant?: boolean; rival?: number | undefined; aware?: boolean }) {
  e.rival = undefined;
  if (e.tyrant) return false;
  e.tyrant = true; e.hpMax = Math.round(e.hpMax * FEUD.tyrantHp); e.hp = e.hpMax; e.aware = true;
  return true;
}
