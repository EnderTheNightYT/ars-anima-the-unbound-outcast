import { describe, expect, it } from 'vitest';
import { Game, emptyInput } from './engine';
import { CLASSES } from './data';

describe('recogida compartida', () => {
  for (const cls of CLASSES) it(`recoger activa y termina el gesto para ${cls.id}`, () => {
    const g = new Game(); g.start(cls);
    g.pickups = [{ kind: 'gold', x: g.px, y: g.py, n: 5, bob: 0 }];
    const gold = g.gold;
    g.updateWorld(.01);
    expect(g.gold).toBe(gold + 5);
    expect(g.pickupAnimation.t).toBeGreaterThan(0);
    expect(g.pickupAnimation.sprite).toBe('gold');
    g.pickups = [];
    for (let i = 0; i < 25; i++) g.update(.05, emptyInput());
    expect(g.pickupAnimation.t).toBe(0);
  });
});