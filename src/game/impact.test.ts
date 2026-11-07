import { describe, expect, it } from 'vitest';
import { IMPACT, bodyDamage, wallSlamDamage, wallBounceSpeed, chainChance, transferSpeed, downedBonus } from './impact';
import { Game } from './engine';
import { CLASSES } from './data';
import { createMerchantQuest, advanceMerchantQuest, MERCHANT_TALKS } from './merchant-quests';

describe('body impacts', () => {
  it('wall slams hurt more than body hits', () => { expect(wallSlamDamage(10, 0)).toBeGreaterThan(bodyDamage(10, 0)); });
  it('each chain bounce is weaker and slower', () => {
    expect(bodyDamage(10, 1)).toBeLessThan(bodyDamage(10, 0));
    expect(transferSpeed(10, 1)).toBeLessThan(transferSpeed(10, 0));
    expect(wallBounceSpeed(10, 1)).toBeLessThan(wallBounceSpeed(10, 0));
  });
  it('chains are less likely deeper and when enemies are far apart', () => {
    expect(chainChance(1, 0.5)).toBeLessThan(chainChance(0, 0.5));
    expect(chainChance(0, 3)).toBeLessThan(chainChance(0, 0.5));
    expect(chainChance(IMPACT.maxDepth, 0)).toBe(0);
  });
  it('downed enemies take extra damage', () => { expect(downedBonus(true)).toBe(IMPACT.downedMult); expect(downedBonus(false)).toBe(1); });
});

function start() { localStorage.clear(); const g = new Game(); g.start(CLASSES[0]!); g.enemies = []; g.restRoom = null; return g; }

describe('enemy rescue', () => {
  it('teleports an enemy embedded in a wall to a walkable spot', () => {
    const g = start(); const r = g.rooms[1]!; g.spawn('sombra', r.x + r.w / 2, r.y + r.h / 2);
    const e = g.enemies[0]!; let wx = -1, wy = -1;
    for (let y = 0; y < 64 && wx < 0; y++) for (let x = 0; x < 64; x++) if (g.solid(x + .5, y + .5, 0)) { wx = x + .5; wy = y + .5; break; }
    e.x = wx; e.y = wy;
    expect(g.unstickEnemy(e)).toBe(true);
    expect(g.canOccupy(e.x, e.y, e.z, g.actorRadius(e))).toBe(true);
  });
});

describe('merchant quests', () => {
  it(`unlock after ${MERCHANT_TALKS} talks and pay gold on delivery`, () => {
    const g = start(); g.merchantTalks = MERCHANT_TALKS;
    g.merchantQuest = { ...createMerchantQuest(3, 2, 'Port', 10, 1, 0.1), kind: 'jump', count: 2 };
    expect(g.claimMerchantQuest()).toBe(false);
    advanceMerchantQuest(g.merchantQuest, 'jump', 2);
    const gold = g.gold; const reward = g.merchantQuest.gold;
    expect(g.claimMerchantQuest()).toBe(true);
    expect(g.gold).toBe(gold + reward);
  });
  it('weapon rewards are usable at the current level', () => {
    const g = start(); g.merchantQuest = { ...createMerchantQuest(1, 1, 'Port', 10, 1, 0.9), complete: true };
    const n = g.bag.length; g.claimMerchantQuest();
    const w = g.bag[n]!; expect(w.kind).toBe('weapon'); expect(w.rarity).toBeLessThanOrEqual(1);
  });
});
