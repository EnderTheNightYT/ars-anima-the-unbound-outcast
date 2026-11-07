import { describe, expect, it } from 'vitest';
import { visibleBounds } from './render-performance';

describe('presentation culling', () => {
  it('rejects objects behind the player', () => {
    expect(visibleBounds(160, -.5, 100, 100, 1, 320, 200)).toBe(false);
  });
  it('rejects objects entirely outside the front viewport', () => {
    expect(visibleBounds(700, 4, 100, 100, 1, 320, 200)).toBe(false);
  });
  it('retains wide sprites whose edge is visible', () => {
    expect(visibleBounds(-35, 2, 200, 100, 1, 320, 200)).toBe(true);
  });
  it('retains front-facing enemies', () => {
    expect(visibleBounds(160, 8, 100, 100, 1, 320, 200)).toBe(true);
  });
});