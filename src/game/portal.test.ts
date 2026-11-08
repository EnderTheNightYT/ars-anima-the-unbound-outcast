import { describe, expect, it } from 'vitest';
import { Game, emptyInput } from './engine';
import { CLASSES } from './data';
import { captureFloor, applyFloor } from './floor-save';

function game() { const cls = CLASSES[0]; if (!cls) throw new Error('Missing class'); const g = new Game(); g.start(cls); return g; }
describe('portal lifecycle', () => {
  it('restores a missing portal from a saved active collapse without resetting its timer', () => {
    const g = game(); g.startCollapse(); g.collapse && (g.collapse.t = 75);
    g.pickups = g.pickups.filter(p => p.kind !== 'portal');
    const s = captureFloor(g);
    const resumed = game(); resumed.floorSeed = g.floorSeed;
    expect(applyFloor(resumed, s)).toBe(true);
    resumed.update(.01, emptyInput());
    expect(resumed.pickups.filter(p => p.kind === 'portal' && !p.used)).toHaveLength(1);
    expect(resumed.collapse?.t).toBeCloseTo(74.99);
  });
  it('entering the portal sprite crosses without pressing interact', () => {
    const g = game(); g.startCollapse(); const portal = g.pickups.find(p => p.kind === 'portal');
    if (!portal) throw new Error('No portal');
    g.px = portal.x + 1.2; g.py = portal.y; g.pz = g.floorHeight();
    g.update(.01, emptyInput());
    expect(g.mode).toBe('erased'); expect(g.exp.extracted).toBe(true);
  });
  it('never crosses a portal through a wall', () => {
    const g = game(); g.startCollapse(); const portal = g.pickups.find(p => p.kind === 'portal');
    if (!portal) throw new Error('No portal');
    g.px = portal.x + 1.2; g.py = portal.y;
    g.map[Math.floor(portal.y) * 40 + Math.floor(portal.x + .6)] = 1;
    g.update(.01, emptyInput()); expect(g.mode).toBe('play');
  });
  it('does not respawn an already extracted portal', () => {
    const g = game(); g.startCollapse(); const p = g.pickups.find(p => p.kind === 'portal');
    if (!p) throw new Error('No portal'); g.usePortal(p, true); g.updateWorld(.01);
    expect(g.pickups.some(p => p.kind === 'portal' && !p.used)).toBe(false);
  });
});