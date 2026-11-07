import { describe, it, expect } from 'vitest';
import { shieldBlocks, squadDamageFactor, packSpeed, drumRoll } from './world-rules';
import { ENEMY_TYPES } from './data';
import { REGIONS } from './regions';
describe('squad roles', () => {
  it('shield blocks frontal hits but not flanks', () => {
    expect(shieldBlocks(0, 0, 0, 3, 0)).toBe(true);
    expect(shieldBlocks(0, 0, 0, -3, 0)).toBe(false);
  });
  it('shield cuts damage to 25%, guard and drum stack', () => {
    expect(squadDamageFactor({ shield: true, guarded: false, drummed: false })).toBeCloseTo(0.25);
    expect(squadDamageFactor({ shield: false, guarded: true, drummed: true })).toBeCloseTo(0.56);
  });
  it('pack speed caps at two packmates', () => { expect(packSpeed(5)).toBeCloseTo(1.4); });
  it('drum roll outcomes', () => { expect(drumRoll(1)).toBe('fail'); expect(drumRoll(4)).toBe('frenzy'); expect(drumRoll(6)).toBe('jackpot'); });
  it('new enemies spawn in some region', () => {
    for (const k of ['soldado','hereje','bestia','automata','bruja','ahogado','tahur']) {
      expect(ENEMY_TYPES).toHaveProperty(k);
      expect(REGIONS.some((r) => (r.enemies as readonly string[]).includes(k))).toBe(true);
    }
  });
});
import { backstab, SQUAD } from './world-rules';
describe('new squad roles', () => {
  it('backstab only when the player faces away', () => {
    expect(backstab(0, 3, 0, 0, 0)).toBe(false);
    expect(backstab(0, -3, 0, 0, 0)).toBe(true);
  });
  it('flank bonus is 1.5x and bishop summons cap at 3', () => { expect(SQUAD.flankBonus).toBe(1.5); expect(SQUAD.summonMax).toBe(3); });
  it('new enemies exist and spawn somewhere', () => {
    for (const k of ['acechador','fanatico','behemoth','screamer','caballero','ballestero','alquimista']) {
      expect(ENEMY_TYPES).toHaveProperty(k);
      expect(REGIONS.some((r) => (r.enemies as readonly string[]).includes(k))).toBe(true);
    }
  });
});
import { inkFactor } from './world-rules';
describe('support & combo roles', () => {
  it('ink raises damage taken by 25% only while inked', () => { expect(inkFactor(2)).toBe(1.25); expect(inkFactor(0)).toBe(1); });
  it('leech drains 1.5x from poisoned players', () => { expect(SQUAD.leechPoison).toBe(1.5); });
  it('relojero repairs mechanical allies', () => { expect(SQUAD.mechanical).toEqual(expect.arrayContaining(['automata','vigia','ballestero'])); });
  it('all 16 new enemies spawn in some region', () => {
    for (const k of ['tejedora','relojero','portaestandarte','sirena','sanguijuela','portador','golem','espejo']) expect(REGIONS.some((r) => (r.enemies as readonly string[]).includes(k))).toBe(true);
  });
});
