import { describe, it, expect, beforeEach } from 'vitest';
import { chooseBackend, shouldRender } from './hybrid';
import { sanitize, applyPreset, gfxStore, DEFAULTS, PRESETS } from './settings';
import { degrade, baseEffective, DrsController } from './drs';
import { ResourceCache, TargetPool } from './pack';
import { FINAL_FRAG, LIGHT_FRAG } from './shaders';
import { WGSL, packWgpuUniforms, WGPU_UNIFORM_VEC4 } from './webgpu';
import { MAT, NRM } from './frame';

describe('graphics backend selection', () => {
  it('auto uses WebGL2, WebGPU only when requested and available, else falls back', () => {
    expect(chooseBackend('auto', { webgl2: true, webgpu: true })).toBe('webgl2');
    expect(chooseBackend('webgpu', { webgl2: true, webgpu: true })).toBe('webgpu');
    expect(chooseBackend('webgpu', { webgl2: true, webgpu: false })).toBe('webgl2');
    expect(chooseBackend('webgl2', { webgl2: false, webgpu: false })).toBe('canvas2d');
  });
  it('maximum FPS 30 skips frames closer than ~33 ms', () => {
    expect(shouldRender(16, 30)).toBe(false);
    expect(shouldRender(33, 30)).toBe(true);
    expect(shouldRender(1, 0)).toBe(true);
  });
});

describe('graphics settings', () => {
  beforeEach(() => { localStorage.clear(); gfxStore.reset(); });
  it('motion blur never survives saved data', () => {
    expect('motionBlur' in sanitize({ motionBlur: true })).toBe(false);
  });
  it('changing one option turns a preset into CUSTOM and persists', () => {
    gfxStore.set({ preset: 'high' });
    gfxStore.set({ bloom: 0 });
    expect(gfxStore.get().preset).toBe('custom');
    gfxStore.reset();
    expect(gfxStore.get().bloom).toBe(0);
  });
  it('ULTRA enables the heaviest shadows/AO and LOW disables them', () => {
    expect(applyPreset(DEFAULTS, 'ultra').shadowQuality).toBe(3);
    expect(applyPreset(DEFAULTS, 'low').ambientOcclusion).toBe(0);
    expect(PRESETS.ultra.dynamicResolution).toBe(false);
  });
});

describe('adaptive quality', () => {
  it('reduces resolution first, then shadows, AO, volumetrics, SSR, particles', () => {
    const b = baseEffective(applyPreset(DEFAULTS, 'ultra'));
    expect(degrade(b, 1, true).renderScale).toBe(0.9);
    expect(degrade(b, 2, true).shadowQuality).toBe(2);
    const d8 = degrade(b, 8, true);
    expect(d8.aoSamples).toBeLessThan(b.aoSamples); expect(d8.ssrSteps).toBeLessThan(b.ssrSteps); expect(d8.particles).toBeLessThan(b.particles);
  });
  it('steps down under sustained load and recovers slowly with headroom', () => {
    const c = new DrsController();
    for (let i = 0; i < 60; i++) c.update(40, 0.05, 60);
    expect(c.step).toBeGreaterThan(0);
    const s = c.step;
    for (let i = 0; i < 400; i++) c.update(5, 0.05, 60);
    expect(c.step).toBeLessThan(s);
  });
});

describe('GPU memory management', () => {
  it('never evicts referenced resources and evicts LRU first', () => {
    const gone: string[] = []; const c = new ResourceCache<string>(100, v => gone.push(v));
    c.put('a', 'a', 60); c.retain('a'); c.put('b', 'b', 30); c.put('c', 'c', 30);
    expect(gone).toEqual(['b']); expect(c.has('a')).toBe(true);
  });
  it('pools render targets instead of reallocating', () => {
    const p = new TargetPool<object>(() => ({}), () => {});
    const t = p.acquire(64, 40, 'rgba8'); p.release(t);
    expect(p.acquire(64, 40, 'rgba8')).toBe(t); expect(p.allocations).toBe(1);
  });
});

describe('shaders', () => {
  it('apply exactly one tonemapper and contain no motion blur', () => {
    expect(FINAL_FRAG).toContain('uTonemap == 1 ? agx(c) : aces(c)');
    for (const src of [FINAL_FRAG, LIGHT_FRAG, WGSL]) expect(src.toLowerCase()).not.toContain('motion');
  });
  it('WebGPU uniforms match the WGSL array size', () => {
    const f = { W: 320, H: 200, cam: { px: 1, py: 2, eye: .5, dirX: 1, dirY: 0, plX: 0, plY: .66, pitch: 0, horizonOffset: 0, fogDist: 10, fog: [0, 0, 0] as [number, number, number], region: 'port', time: 0, shake: 0, hurt: 0, crit: 0, hpRatio: 1, darkness: 0, aiming: 0 } } as never;
    const u = packWgpuUniforms(f, DEFAULTS, [{ x: 3, y: 4, z: 1, r: 1, g: 1, b: 1, intensity: 2, radius: 5, type: 0, shadow: false }]);
    expect(u.length).toBe(WGPU_UNIFORM_VEC4 * 4);
    expect(u[12]).toBe(1); // one light
    expect(u[8 * 4 + 3]).toBe(5); // light radius
    expect(WGSL).toContain(`array<vec4f, ${WGPU_UNIFORM_VEC4}>`);
    expect(MAT.POLISHED).toBeLessThan(16); expect(NRM.SKY).toBe(7);
  });
});
