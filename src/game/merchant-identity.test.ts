import { describe, expect, it } from 'vitest';
import { Game } from './engine';
import { CLASSES } from './data';
import { nextIdentityRevelation, normalizeIdentitySeen } from './merchant-identity';

function start() { const g = new Game(); const cls = CLASSES[0]; if (!cls) throw new Error('Missing class'); g.start(cls); return g; }

describe('merchant identity progression', () => {
  it.each([[1, 'inconnu', []], [3, 'lin', ['inconnu']], [6, 'lincon', ['inconnu', 'lin']], [10, 'nuconi', ['inconnu', 'lin', 'lincon']]] as const)('unlocks the %i milestone in order', (level, id, seen) => {
    expect(nextIdentityRevelation(level, seen)?.id).toBe(id);
    expect(nextIdentityRevelation(level - 1, seen)).toBeUndefined();
  });
  it('queues missed milestones instead of skipping them', () => {
    expect(nextIdentityRevelation(10, [])?.id).toBe('inconnu');
    expect(nextIdentityRevelation(10, ['inconnu'])?.id).toBe('lin');
  });
  it('persists each shown revelation across sessions and new runs', () => {
    localStorage.clear(); const g = start();
    for (const level of [1, 3, 6, 10]) { g.level = level; g.vendorDialogue(); }
    expect(g.legacy.identitySeen).toEqual(['inconnu', 'lin', 'lincon', 'nuconi']);
    const restored = start(); restored.level = 10; restored.vendorDialogue();
    expect(restored.legacy.identitySeen).toEqual(g.legacy.identitySeen);
    expect(restored.choice?.dialogue).toBeUndefined();
  });
  it('loads old legacy saves without inventing seen milestones', () => {
    localStorage.clear(); localStorage.setItem('ars_anima_legacy', JSON.stringify({ lockLvl: 4, kills: 21 }));
    const g = start(); expect(g.legacy.lockLvl).toBe(4); expect(g.legacy.kills).toBe(21); expect(g.legacy.identitySeen).toEqual([]);
    expect(normalizeIdentitySeen(['lin', 'lin', 'bad'])).toEqual(['lin']);
  });
  it('keeps commercial services and farol cooldown unchanged', () => {
    localStorage.clear(); const g = start(); const before = { gold: g.gold, bag: g.bag.length, lumbre: g.lumbre };
    g.vendorDialogue(); expect(g.choice?.options).toHaveLength(5);
    expect({ gold: g.gold, bag: g.bag.length, lumbre: g.lumbre }).toEqual(before);
    g.choose(0); expect(g.mode).toBe('menu'); expect(g.menuTab).toBe('tienda'); expect(g.shopStock).toHaveLength(19);
    g.vendorDialogue(); g.lumbre = 0; g.choose(1); expect(g.lumbre).toBe(2); const cooldown = g.vendorTalkCd;
    g.choose(1); expect(g.lumbre).toBe(2); expect(g.vendorTalkCd).toBe(cooldown);
  });
});