import { describe, expect, it, vi, afterEach } from 'vitest';
import { Game } from './engine';
import { makeFrames } from './animation';

vi.mock('./animation', () => ({
  makeFrames: vi.fn((image: HTMLCanvasElement) => [image]),
}));
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe('cooperative visible animation preparation', () => {
  it('does not generate unused poses at asset arrival', () => {
    const g = new Game(); g.sprites['sombra'] = document.createElement('canvas');
    g.prepareAnimations();
    expect(makeFrames).not.toHaveBeenCalled();
    expect(g.animationQueue).toHaveLength(0);
  });
  it('yields before preparing twelve frames and shares aliases', async () => {
    vi.useFakeTimers();
    const g = new Game(), image = document.createElement('canvas');
    g.sprites['sombra'] = image; g.sprites['enemy'] = image; g.prepareAnimations();
    expect(g.frame('sombra', 'walk', 0)).toBe(image);
    g.frame('enemy', 'walk', 0);
    expect(makeFrames).not.toHaveBeenCalled();
    expect(g.animationQueue).toHaveLength(1);
    await vi.runAllTimersAsync();
    expect(makeFrames).toHaveBeenCalledTimes(12);
    expect(g.animationQueue).toHaveLength(0);
    expect(g.animations['enemy']).toBe(g.animations['sombra']);
    g.frame('enemy', 'walk', 11);
    expect(makeFrames).toHaveBeenCalledTimes(12);
  });
});