import { describe, it, expect } from 'vitest';
import { zonePlan, LoadTracker } from './asset-loader';

describe('zone streaming plan', () => {
  it('first floor keeps current zone active and preloads the next two', () => {
    const p = zonePlan(1, 6);
    expect(p.active).toEqual([0]);
    expect(p.preload).toEqual([1, 2]);
    expect(p.unload).toEqual([3, 4, 5]);
  });
  it('middle floor preloads neighbours and releases far zones', () => {
    const p = zonePlan(4, 6);
    expect(p.active).toEqual([3]);
    expect(p.preload.sort()).toEqual([2, 4, 5]);
    expect(p.unload).toEqual([0, 1]);
  });
});

describe('load progress', () => {
  it('reaches 100% only when every task is ready', () => {
    const t = new LoadTracker(); t.add('a'); t.add('b');
    t.set('a', 'ready'); t.set('b', 'decode');
    expect(t.progress).toBeLessThan(1);
    t.set('b', 'ready');
    expect(t.progress).toBe(1);
  });
});
