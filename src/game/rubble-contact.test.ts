import { describe, expect, it, vi } from 'vitest';
import { Game } from './engine';
import { CLASSES } from './data';

describe('boss overtime falling contact in simulation', () => {
  it('hurts before landing and does not hurt again on landing', () => {
    localStorage.clear(); const cls = CLASSES[0]; if (!cls) throw new Error('Missing class');
    const g = new Game(); g.start(cls); g.enemies = []; g.restRoom = null;
    g.map.fill(0); g.spawn('librero', g.px + 4, g.py);
    g.arena = { t: -1, sealed: [], rubbleT: 100, rubble: [{ x: g.px, y: g.py, t: .15 }], summonT: 100, scoreAcc: 0, slam: null, slamCd: 100 };
    const hurt = vi.spyOn(g, 'hurtPlayer');
    g.updateArena(.07);
    expect(g.arena.rubble[0]?.t).toBeGreaterThan(0);
    expect(hurt).toHaveBeenCalledWith(g.hpMax * .09, 'escombros');
    expect(hurt).toHaveBeenCalledTimes(1);
    g.updateArena(.1);
    expect(hurt).toHaveBeenCalledTimes(1);
    expect(g.arena.rubble).toHaveLength(0);
  });
});