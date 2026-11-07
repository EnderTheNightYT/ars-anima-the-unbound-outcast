import { describe, it, expect } from 'vitest';
import { Game, MAP_SIZE } from './engine';
import { CLASSES } from './data';
import { reachHeight, jumpApex, JUMP, clampCeiling, BODY_HEIGHT } from './world-rules';

const H: Record<number, number> = { 0: 0, 5: .72, 7: .36, 8: 1.08 };
const STEP_UP = .4;

describe('plataformeo alcanzable', () => {
  it('un salto normal supera la cornisa más alta (1.08) con margen', () => {
    expect(jumpApex(JUMP.ground)).toBeGreaterThan(1.08);
    expect(reachHeight(0, 1)).toBeGreaterThan(1.08 + .5);
  });
  it('el techo detiene la cabeza y nunca deja subir por encima de los muros', () => {
    expect(clampCeiling(3, BODY_HEIGHT)).toEqual({ z: JUMP.ceiling - .04 - BODY_HEIGHT, hit: true });
    expect(reachHeight(1.08, 2) + BODY_HEIGHT).toBeLessThanOrEqual(JUMP.ceiling);
  });
  it('cada cornisa generada se alcanza caminando o con un salto desde una vecina', () => {
    const g = new Game(); g.start(CLASSES[0]!);
    const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let run = 0; run < 25; run++) {
      g.floor = 1 + (run % 6); g.genFloor();
      for (let y = 1; y < MAP_SIZE - 1; y++) for (let x = 1; x < MAP_SIZE - 1; x++) {
        const c = g.map[y * MAP_SIZE + x] ?? 0; if (!(c in H) || c === 0) continue;
        const ns = DIRS.map(([dx, dy]) => g.map[(y + dy) * MAP_SIZE + x + dx] ?? 0).filter((n) => n in H);
        const ok = ns.some((n) => (H[c] ?? 0) - (H[n] ?? 0) <= STEP_UP || (H[c] ?? 0) < jumpApex(JUMP.ground) + (H[n] ?? 0) - .05);
        expect(ok, `cornisa ${c} en ${x},${y} piso ${g.floor}`).toBe(true);
      }
    }
  });
});

