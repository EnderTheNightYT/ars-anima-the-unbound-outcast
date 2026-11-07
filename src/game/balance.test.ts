import { describe, expect, it } from 'vitest';
import { playerRating, forbiddenEnemyLevel, forbiddenHpMult, playerScore } from './balance';
import { passiveExamples, CLASS_PASSIVES } from './class-passives';
import { Game } from './engine';
import { CLASSES } from './data';

describe('player rating', () => {
  it('equals level for an average player with no kills', () => { expect(playerRating(5, 1, 0)).toBe(5); });
  it('rises with performance and score, capped at +2', () => {
    expect(playerRating(5, 1.4, 30)).toBeGreaterThan(5);
    expect(playerRating(5, 3, 10000)).toBe(7);
  });
  it('drops for a struggling player, at most -2', () => { expect(playerRating(5, 0.2, 0)).toBe(3); });
  it('score grows with kills', () => { expect(playerScore(10, 1, 1)).toBeGreaterThan(playerScore(0, 1, 1)); });
});

describe('forbidden zone balance', () => {
  it('enemies never drop below the zone level and grow with the player', () => {
    expect(forbiddenEnemyLevel(2, 4)).toBe(6);
    expect(forbiddenEnemyLevel(10, 4)).toBe(12);
    expect(forbiddenHpMult(100, 4)).toBeCloseTo(1.96);
    expect(forbiddenHpMult(10, 4)).toBeGreaterThan(forbiddenHpMult(4, 4));
  });
  it('the zone is reachable through two sealed doors on most maps', () => {
    let two = 0; for (let i = 0; i < 15; i++) { localStorage.clear(); const g = new Game(); g.start(CLASSES[0]!); if (g.forbiddenDoors.length === 2) two++; for (const d of g.forbiddenDoors) expect(g.seals[d]?.kind).toBe('level'); }
    expect(two).toBeGreaterThanOrEqual(10);
  });
});

describe('class examples', () => {
  it('shows a damage example for crit damage passives', () => {
    expect(passiveExamples(CLASS_PASSIVES['duelista']![1]!)).toContain('Crítico de un golpe de 20: 40 → 48');
  });
});
