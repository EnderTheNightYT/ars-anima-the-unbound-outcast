// @ts-nocheck
/**
 * WebGL2 hybrid renderer: consumes the raycaster's color buffer + G-buffer (depth, normal code,
 * material id, emissive, wetness) and runs PBR lighting, grid-marched shadows, SSAO, SSR, IBL,
 * volumetric fog, GPU particles, bloom, tonemapping (ACES or AgX), LUT grading and FXAA/sharpen.
 * Presentation only: nothing here writes back into the simulation. Motion blur does not exist.
 */
import { VERT, LIGHT_FRAG, VOL_FRAG, BRIGHT_FRAG, DOWN_FRAG, UP_FRAG, PART_VERT, PART_FRAG, FINAL_FRAG, POST_FRAG, MAX_LIGHTS } from './shaders';
import { MATERIALS, cullLights } from './pbr';
import { packGBuffer, occlusionCull, project, TargetPool, ResourceCache, memoryBudgetMB, type TargetFormat } from './pack';
import { zoneFog, zoneSun, zoneGrade } from './zones';
import { buildLut, buildEnvMap } from './grading';
import type { FrameCamera, FrameLight } from './frame';
import type { Effective } from './drs';
import type { GfxSettings } from './settings';

export interface FrameInput {
  color: TexImageSource; cam: FrameCamera; W: number; H: number;
  gDepth: Float32Array; gInfo: Uint8Array; sDepth: Float32Array;
  lights: FrameLight[]; occ: Uint8Array; map: number;
  palette: { ceiling: number[]; fog: number[]; floor: number[] };
}
export interface RenderStats { drawCalls: number; lights: number; shadowLights: number; memoryMB: number; width: number; height: number; lightW: number; lightH: number }

interface Target { fb: WebGLFramebuffer; tex: WebGLTexture[]; w: number; h: number; f: TargetFormat; bytes: number }
type Prog = { p: WebGLProgram; u: Map<string, WebGLUniformLocation | null> };

export const SHADOW_STEPS = [0, 12, 20, 32];
export const LUT_SIZE = 16;
export const ENV_SIZES: [number, number][] = [[64, 32], [128, 64], [256, 128], [512, 256]];

export class WebGL2Renderer {
  readonly backend = 'webgl2';
  gl: WebGL2RenderingContext;
  private progs = new Map<string, Prog>();
  private pool: TargetPool<Target>;
  private zones: ResourceCache<{ lut: WebGLTexture; env: WebGLTexture }>;
  private activeZone = '';
  private texColor!: WebGLTexture; private texDepth!: WebGLTexture; private texInfo!: WebGLTexture; private texOcc!: WebGLTexture;
  private vao!: WebGLVertexArrayObject;
  private packDepth = new Float32Array(0); private packInfo = new Uint8Array(0);
  private float: boolean; private hdrScale: number;
  private srcW = 0; private srcH = 0; private occSize = 0;
  private draws = 0;
  stats: RenderStats = { drawCalls: 0, lights: 0, shadowLights: 0, memoryMB: 0, width: 0, height: 0, lightW: 0, lightH: 0 };
  private worker: Worker | null = null; private pendingZone = new Set<string>(); private jobId = 0;

  constructor(public canvas: HTMLCanvasElement, mobile: boolean) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL2 no disponible');
    this.gl = gl;
    this.float = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
    this.hdrScale = this.float ? 1 : 8;
    this.pool = new TargetPool<Target>((w, h, f) => this.createTarget(w, h, f), t => this.destroyTarget(t));
    this.zones = new ResourceCache(memoryBudgetMB((navigator as { deviceMemory?: number }).deviceMemory, mobile) * 1024 * 1024 * 0.25, z => { gl.deleteTexture(z.lut); gl.deleteTexture(z.env); });
    this.init();
    try { this.worker = new Worker(new URL('./gfx-worker.ts', import.meta.url), { type: 'module' }); this.worker.onmessage = e => this.onZone(e.data); this.worker.onerror = () => { this.worker = null; }; } catch { this.worker = null; }
  }

  /** (Re)create every GL object. Called on construction and after context restoration. */
  init() {
    const gl = this.gl;
    this.progs.clear(); this.zones.clear(); this.activeZone = ''; this.pendingZone.clear();
    const make = (name: string, vs: string, fs: string) => {
      const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error(`${name}: ${gl.getShaderInfoLog(s)}`); return s; };
      const p = gl.createProgram()!; const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
      gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p); gl.deleteShader(v); gl.deleteShader(f);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(`${name}: ${gl.getProgramInfoLog(p)}`);
      this.progs.set(name, { p, u: new Map() });
    };
    make('light', VERT, LIGHT_FRAG); make('vol', VERT, VOL_FRAG); make('bright', VERT, BRIGHT_FRAG);
    make('down', VERT, DOWN_FRAG); make('up', VERT, UP_FRAG); make('part', PART_VERT, PART_FRAG);
    make('final', VERT, FINAL_FRAG); make('post', VERT, POST_FRAG);
    this.vao = gl.createVertexArray()!;
    const tex = (filter: number) => { const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
    // Pixel art: the albedo is always sampled nearest-neighbour.
    this.texColor = tex(gl.NEAREST); this.texDepth = tex(gl.NEAREST); this.texInfo = tex(gl.NEAREST); this.texOcc = tex(gl.NEAREST);
    this.srcW = this.srcH = this.occSize = 0;
  }

  private createTarget(w: number, h: number, f: TargetFormat): Target {
    const gl = this.gl, fb = gl.createFramebuffer()!, mrt = f === 'rgba16f' ? 1 : 1;
    const texs: WebGLTexture[] = [];
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    for (let i = 0; i < mrt; i++) {
      const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t);
      const hf = f === 'rgba16f' && this.float;
      gl.texImage2D(gl.TEXTURE_2D, 0, hf ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, hf ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0); texs.push(t);
    }
    return { fb, tex: texs, w, h, f, bytes: w * h * (f === 'rgba16f' && this.float ? 8 : 4) };
  }
  private destroyTarget(t: Target) { this.gl.deleteFramebuffer(t.fb); t.tex.forEach(x => this.gl.deleteTexture(x)); }
  /** MRT target for the lighting pass (diffuse + specular). Pooled as two textures on one FBO. */
  private acquireMrt(w: number, h: number): Target {
    const a = this.pool.acquire(w, h, 'rgba16f'), b = this.pool.acquire(w, h, 'rgba16f');
    const gl = this.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, a.fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, b.tex[0], 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    (a as Target & { pair?: Target }).pair = b; return a;
  }
  private releaseMrt(a: Target) {
    const gl = this.gl, b = (a as Target & { pair?: Target }).pair!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, a.fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, null, 0); gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    this.pool.release(a); this.pool.release(b);
  }

  private use(name: string) { const p = this.progs.get(name)!; this.gl.useProgram(p.p); return p; }
  private loc(p: Prog, n: string) { if (!p.u.has(n)) p.u.set(n, this.gl.getUniformLocation(p.p, n)); return p.u.get(n)!; }
  private bindTex(p: Prog, n: string, unit: number, t: WebGLTexture, target: number = this.gl.TEXTURE_2D) { const gl = this.gl; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(target, t); gl.uniform1i(this.loc(p, n), unit); }
  private camUniforms(p: Prog, c: FrameCamera, W: number, H: number) {
    const gl = this.gl;
    gl.uniform2f(this.loc(p, 'uSrc'), W, H); gl.uniform2f(this.loc(p, 'uP'), c.px, c.py); gl.uniform1f(this.loc(p, 'uEye'), c.eye);
    gl.uniform2f(this.loc(p, 'uDir'), c.dirX, c.dirY); gl.uniform2f(this.loc(p, 'uPl'), c.plX, c.plY); gl.uniform1f(this.loc(p, 'uPitch'), c.pitch);
    gl.uniform1f(this.loc(p, 'uHorizon'), H / 2 + c.horizonOffset); gl.uniform1f(this.loc(p, 'uTime'), c.time);
  }
  private draw(t: Target | null, w: number, h: number) { const gl = this.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fb : null); gl.viewport(0, 0, w, h); gl.bindVertexArray(this.vao); gl.drawArrays(gl.TRIANGLES, 0, 3); this.draws++; }

  /** Region LUT + environment probe: built in a Worker (Transferables), cached with refcount/LRU. */
  private ensureZone(region: string, palette: FrameInput['palette'], lights: FrameLight[], texQ: number) {
    const key = `${region}:${texQ}`;
    if (this.activeZone !== key) { if (this.activeZone) this.zones.release(this.activeZone); this.activeZone = key; if (this.zones.has(key)) this.zones.retain(key); }
    if (this.zones.has(key) || this.pendingZone.has(key)) return this.zones.get(key);
    const [ew, eh] = ENV_SIZES[texQ];
    const lc = lights.filter(l => l.type === 0).slice(0, 6).map(l => [l.r * 255, l.g * 255, l.b * 255]);
    if (this.worker) { this.pendingZone.add(key); this.worker.postMessage({ id: ++this.jobId, region: key, lutSize: LUT_SIZE, envW: ew, envH: eh, ceiling: palette.ceiling, fog: palette.fog, floor: palette.floor, lights: lc }); return undefined; }
    this.onZone({ region: key, lut: buildLut(LUT_SIZE, zoneGrade(region)), env: buildEnvMap(ew, eh, palette.ceiling, palette.fog, palette.floor, lc) });
    return this.zones.get(key);
  }
  private onZone(r: { region: string; lut: Uint8Array; env: Uint8Array }) {
    const gl = this.gl; this.pendingZone.delete(r.region); if (gl.isContextLost()) return;
    const texQ = +r.region.split(':')[1] || 0, [ew, eh] = ENV_SIZES[texQ];
    const lut = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_3D, lut);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, LUT_SIZE, LUT_SIZE, LUT_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, r.lut);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    for (const w of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, w, gl.CLAMP_TO_EDGE);
    const env = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, env);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, ew, eh, 0, gl.RGBA, gl.UNSIGNED_BYTE, r.env); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.zones.put(r.region, { lut, env }, LUT_SIZE ** 3 * 4 + Math.round(ew * eh * 4 * 1.34));
    if (r.region === this.activeZone) this.zones.retain(r.region); // never evict the zone on screen
  }

  private upload(f: FrameInput) {
    const gl = this.gl, n = f.W * f.H;
    if (this.packDepth.length !== n) { this.packDepth = new Float32Array(n); this.packInfo = new Uint8Array(n * 4); }
    packGBuffer(f.gDepth, f.gInfo, f.sDepth, this.packDepth, this.packInfo);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    const resize = this.srcW !== f.W || this.srcH !== f.H;
    gl.bindTexture(gl.TEXTURE_2D, this.texColor); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, f.color);
    gl.bindTexture(gl.TEXTURE_2D, this.texDepth);
    if (resize) gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, f.W, f.H, 0, gl.RED, gl.FLOAT, this.packDepth); else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, f.W, f.H, gl.RED, gl.FLOAT, this.packDepth);
    gl.bindTexture(gl.TEXTURE_2D, this.texInfo);
    if (resize) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, f.W, f.H, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.packInfo); else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, f.W, f.H, gl.RGBA, gl.UNSIGNED_BYTE, this.packInfo);
    gl.bindTexture(gl.TEXTURE_2D, this.texOcc);
    if (this.occSize !== f.map) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8, f.map, f.map, 0, gl.RG, gl.UNSIGNED_BYTE, f.occ); else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, f.map, f.map, gl.RG, gl.UNSIGNED_BYTE, f.occ);
    this.srcW = f.W; this.srcH = f.H; this.occSize = f.map;
  }

  /** Render one frame to the canvas. `outMul` = integer output multiplier of the source resolution. */
  render(f: FrameInput, s: GfxSettings, e: Effective, outMul: number) {
    const gl = this.gl; if (gl.isContextLost()) return;
    this.draws = 0;
    const W = f.W, H = f.H, c = f.cam, outW = W * outMul, outH = H * outMul;
    if (this.canvas.width !== outW || this.canvas.height !== outH) { this.canvas.width = outW; this.canvas.height = outH; this.pool.trim(); }
    this.upload(f);
    const zone = this.ensureZone(c.region, f.palette, f.lights, s.textureQuality);

    // Lights: budget + frustum (cullLights) + occlusion against the occupancy grid; shadow casters first.
    let lights = occlusionCull(cullLights(f.lights, c, Math.min(MAX_LIGHTS, e.lightBudget)), c, f.occ, f.map);
    lights = [...lights.filter(l => l.shadow), ...lights.filter(l => !l.shadow)];
    const shadowSteps = SHADOW_STEPS[e.shadowQuality], shadowLights = shadowSteps ? Math.min(lights.filter(l => l.shadow).length, [0, 2, 4, 8][e.shadowQuality]) : 0;
    const lp = new Float32Array(MAX_LIGHTS * 4), lc = new Float32Array(MAX_LIGHTS * 4), ld = new Float32Array(MAX_LIGHTS * 4);
    lights.forEach((l, i) => { lp.set([l.x, l.y, l.z, l.radius], i * 4); lc.set([l.r * l.intensity, l.g * l.intensity, l.b * l.intensity, l.type === 1 ? 1 : 0], i * 4); ld.set([l.dx ?? 0, l.dy ?? 0, l.cone ?? 0, l.size ?? 0.1], i * 4); });
    const sun = zoneSun(c.region), el = sun.elevation, sunDir = [sun.dir[0] * Math.cos(el), sun.dir[1] * Math.cos(el), Math.sin(el)], sunCol = sun.color.map(v => v * sun.intensity * (1 - c.darkness * 0.7));

    // Lighting resolution: source × min(outMul, 2) × renderScale (DRS scales this).
    const lm = Math.min(outMul, 2) * e.renderScale, lw = Math.max(64, Math.round(W * lm)), lh = Math.max(40, Math.round(H * lm));
    const mrt = this.acquireMrt(lw, lh);
    let p = this.use('light'); this.camUniforms(p, c, W, H);
    this.bindTex(p, 'uColor', 0, this.texColor); this.bindTex(p, 'uDepth', 1, this.texDepth); this.bindTex(p, 'uInfo', 2, this.texInfo); this.bindTex(p, 'uOcc', 3, this.texOcc);
    if (zone) this.bindTex(p, 'uEnv', 4, zone.env);
    const mA = new Float32Array(64), mB = new Float32Array(64);
    MATERIALS.forEach((m, i) => { mA.set([m.metallic, m.roughness, m.reflectance, m.normalStrength * (0.4 + 0.2 * s.textureQuality)], i * 4); mB.set([m.reflectivity, m.height, m.wrap, m.emissive], i * 4); });
    gl.uniform4fv(this.loc(p, 'uMatA'), mA); gl.uniform4fv(this.loc(p, 'uMatB'), mB);
    gl.uniform4fv(this.loc(p, 'uLPos'), lp); gl.uniform4fv(this.loc(p, 'uLCol'), lc); gl.uniform4fv(this.loc(p, 'uLDir'), ld);
    gl.uniform1i(this.loc(p, 'uNumLights'), lights.length); gl.uniform1i(this.loc(p, 'uShadowLights'), shadowLights); gl.uniform1i(this.loc(p, 'uShadowSteps'), shadowSteps);
    gl.uniform1f(this.loc(p, 'uShadowDist'), e.shadowDistance); gl.uniform1i(this.loc(p, 'uAoSamples'), e.aoSamples); gl.uniform1i(this.loc(p, 'uSsrSteps'), e.ssrSteps);
    gl.uniform1f(this.loc(p, 'uHdrScale'), this.hdrScale); gl.uniform1f(this.loc(p, 'uIbl'), zone ? 0.6 + 0.15 * s.globalIllumination : 0);
    gl.uniform1i(this.loc(p, 'uMap'), f.map); gl.uniform3fv(this.loc(p, 'uSunDir'), sunDir); gl.uniform3fv(this.loc(p, 'uSunCol'), sunCol);
    this.draw(mrt, lw, lh);
    const diffTex = mrt.tex[0], specTex = (mrt as Target & { pair?: Target }).pair!.tex[0];

    // GPU particles (instanced, stateless), additive into the specular buffer, depth-tested in shader.
    const heat = lights.filter(l => l.heat).slice(0, 4);
    if (e.particles > 0.3) {
      p = this.use('part'); this.camUniforms(p, c, W, H);
      this.bindTex(p, 'uDepth', 1, this.texDepth); gl.uniform1f(this.loc(p, 'uHdrScale'), this.hdrScale); gl.uniform2f(this.loc(p, 'uOut'), lw, lh);
      const hp = new Float32Array(16); heat.forEach((l, i) => hp.set([l.x, l.y, l.z, 1], i * 4));
      gl.uniform4fv(this.loc(p, 'uHeat'), hp); gl.uniform1i(this.loc(p, 'uNumHeat'), heat.length);
      gl.bindFramebuffer(gl.FRAMEBUFFER, mrt.fb); gl.drawBuffers([gl.NONE, gl.COLOR_ATTACHMENT1]); gl.viewport(0, 0, lw, lh);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.bindVertexArray(this.vao);
      gl.drawArraysInstanced(gl.POINTS, 0, 1, Math.round(220 * e.particles)); this.draws++;
      gl.disable(gl.BLEND); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    }

    // Volumetric fog / god rays at reduced resolution (bilinear reconstruction in the composite).
    let vol: Target | null = null; const fog = zoneFog(c.region);
    if (e.volumetricScale > 0 && s.fogQuality + s.volumetricLighting > 0) {
      const vw = Math.max(32, Math.round(W * e.volumetricScale * 2)), vh = Math.max(20, Math.round(H * e.volumetricScale * 2));
      vol = this.pool.acquire(vw, vh, 'rgba16f');
      p = this.use('vol'); this.camUniforms(p, c, W, H); this.bindTex(p, 'uDepth', 1, this.texDepth); this.bindTex(p, 'uOcc', 3, this.texOcc);
      gl.uniform1i(this.loc(p, 'uMap'), f.map); gl.uniform4fv(this.loc(p, 'uLPos'), lp); gl.uniform4fv(this.loc(p, 'uLCol'), lc);
      gl.uniform1i(this.loc(p, 'uVolLights'), Math.min(lights.length, [0, 2, 4, 6][s.volumetricLighting])); gl.uniform1i(this.loc(p, 'uSteps'), [6, 10, 16, 24][s.fogQuality]);
      gl.uniform4f(this.loc(p, 'uFog'), fog.density * (1 + c.darkness * 0.6), fog.height, fog.falloff, fog.scatter); gl.uniform3fv(this.loc(p, 'uFogCol'), fog.color);
      gl.uniform1f(this.loc(p, 'uAniso'), fog.anisotropy); gl.uniform1f(this.loc(p, 'uNoise'), fog.noise); gl.uniform3fv(this.loc(p, 'uSunDir'), sunDir); gl.uniform3fv(this.loc(p, 'uSunCol'), sunCol);
      gl.uniform1f(this.loc(p, 'uHdrScale'), this.hdrScale);
      this.draw(vol, vw, vh);
    }

    // Bloom: threshold bright pass + downsample/upsample chain (selective emissive sources weigh most).
    let bloom: Target | null = null; const chain: Target[] = [];
    if (s.bloom > 0) {
      const levels = [0, 3, 4, 5][s.bloom];
      let bw = Math.max(16, lw >> 1), bh = Math.max(10, lh >> 1);
      const b0 = this.pool.acquire(bw, bh, 'rgba16f'); chain.push(b0);
      p = this.use('bright'); this.camUniforms(p, c, W, H);
      this.bindTex(p, 'uColor', 0, this.texColor); this.bindTex(p, 'uDiffuse', 1, diffTex); this.bindTex(p, 'uSpec', 2, specTex);
      gl.uniform1f(this.loc(p, 'uThreshold'), 1.0); gl.uniform1f(this.loc(p, 'uHdrScale'), this.hdrScale);
      this.draw(b0, bw, bh);
      for (let i = 1; i < levels; i++) {
        const prev = chain[i - 1]; bw = Math.max(4, bw >> 1); bh = Math.max(3, bh >> 1);
        const t = this.pool.acquire(bw, bh, 'rgba16f'); chain.push(t);
        p = this.use('down'); this.bindTex(p, 'uTex', 0, prev.tex[0]); gl.uniform2f(this.loc(p, 'uTexel'), 1 / prev.w, 1 / prev.h); this.draw(t, bw, bh);
      }
      p = this.use('up'); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      for (let i = chain.length - 1; i > 0; i--) { const src = chain[i], dst = chain[i - 1];
        this.bindTex(p, 'uTex', 0, src.tex[0]); gl.uniform2f(this.loc(p, 'uTexel'), 1 / src.w, 1 / src.h); gl.uniform1f(this.loc(p, 'uWeight'), 1); this.draw(dst, dst.w, dst.h); }
      gl.disable(gl.BLEND); bloom = chain[0];
    }

    // Lens flares / heat distortion sources projected to screen (visible only if unoccluded).
    const flares = new Float32Array(16); let nf = 0; const heatS = new Float32Array(16); let nh = 0;
    for (const l of lights) {
      if (l.priority === 0 || l.type === 2) continue;
      const q = project([l.x, l.y, l.z], c, W, H); if (!q) continue; const [sx, sy, d] = q;
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
      const visible = this.packDepth[Math.floor(sy) * W + Math.floor(sx)] >= d - 0.3;
      if (visible && s.lensFlares && nf < 4) { flares.set([sx / W, 1 - sy / H, Math.min(1.5, l.intensity / (d * 0.6 + 1)), 0], nf * 4); nf++; }
      if (l.heat && nh < 4 && d < 8) { heatS.set([sx / W, 1 - sy / H, 0.08 / Math.max(0.5, d * 0.3), 1], nh * 4); nh++; }
    }

    // Composite + tonemap. If FXAA or sharpening is on, composite to an LDR target and post-process.
    const needPost = s.antiAliasing === 'fxaa' || s.sharpening > 0.01;
    const ldr = needPost ? this.pool.acquire(outW, outH, 'rgba8') : null;
    p = this.use('final'); this.camUniforms(p, c, W, H);
    this.bindTex(p, 'uColor', 0, this.texColor); this.bindTex(p, 'uDiffuse', 1, diffTex); this.bindTex(p, 'uSpec', 2, specTex);
    if (vol) this.bindTex(p, 'uVol', 3, vol.tex[0]); if (bloom) this.bindTex(p, 'uBloom', 4, bloom.tex[0]);
    this.bindTex(p, 'uInfo', 7, this.texInfo);
    this.bindTex(p, 'uDepth', 5, this.texDepth); if (zone) this.bindTex(p, 'uLut', 6, zone.lut, gl.TEXTURE_3D); else { gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_3D, null); gl.uniform1i(this.loc(p, 'uLut'), 6); }
    gl.uniform1f(this.loc(p, 'uHdrScale'), this.hdrScale); gl.uniform1f(this.loc(p, 'uExposure'), s.exposure * (1 - c.darkness * 0.25));
    gl.uniform1f(this.loc(p, 'uBloomI'), bloom ? [0, 0.04, 0.07, 0.1][s.bloom] : 0); gl.uniform1i(this.loc(p, 'uTonemap'), s.tonemapper === 'agx' ? 1 : 0);
    gl.uniform1f(this.loc(p, 'uLutMix'), zone && s.colorGrading ? 0.85 : 0); gl.uniform1f(this.loc(p, 'uVolOn'), vol ? 1 : 0);
    gl.uniform1f(this.loc(p, 'uGrain'), s.filmGrain ? 1 : 0); gl.uniform1f(this.loc(p, 'uCA'), s.chromaticAberration ? 0.6 + c.hurt * 2 : 0);
    gl.uniform1f(this.loc(p, 'uVignette'), 0.9 + c.darkness * 0.8 + (1 - c.hpRatio) * 0.6); gl.uniform1f(this.loc(p, 'uHurt'), c.hurt);
    gl.uniform1f(this.loc(p, 'uDof'), s.depthOfField ? 1 - c.aiming * 0.7 : 0); gl.uniform1f(this.loc(p, 'uFlares'), s.lensFlares ? 1 : 0);
    gl.uniform4fv(this.loc(p, 'uFlare'), flares); gl.uniform1i(this.loc(p, 'uNumFlares'), nf); gl.uniform4fv(this.loc(p, 'uHeatS'), heatS); gl.uniform1i(this.loc(p, 'uNumHeat'), nh);
    this.draw(ldr, outW, outH);
    if (ldr) {
      p = this.use('post'); this.bindTex(p, 'uTex', 0, ldr.tex[0]); this.bindTex(p, 'uDepth', 1, this.texDepth); this.bindTex(p, 'uInfo', 2, this.texInfo);
      gl.uniform2f(this.loc(p, 'uSrc'), W, H); gl.uniform2f(this.loc(p, 'uTexel'), 1 / outW, 1 / outH);
      gl.uniform1f(this.loc(p, 'uFxaa'), s.antiAliasing === 'fxaa' ? 1 : 0); gl.uniform1f(this.loc(p, 'uSharpen'), s.sharpening);
      this.draw(null, outW, outH); this.pool.release(ldr);
    }
    this.releaseMrt(mrt); if (vol) this.pool.release(vol); chain.forEach(t => this.pool.release(t));
    const srcBytes = W * H * (4 + 4 + 4) + f.map * f.map * 2;
    this.stats = { drawCalls: this.draws, lights: lights.length, shadowLights, memoryMB: +((this.pool.liveBytes + this.pool.idleBytes + this.zones.bytes + srcBytes + outW * outH * 4) / 1048576).toFixed(1), width: outW, height: outH, lightW: lw, lightH: lh };
  }

  dispose() {
    this.worker?.terminate(); this.pool.dispose(); this.zones.clear();
    const gl = this.gl; for (const p of this.progs.values()) gl.deleteProgram(p.p);
    [this.texColor, this.texDepth, this.texInfo, this.texOcc].forEach(t => gl.deleteTexture(t));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
  /** Context loss: drop JS handles (GPU already freed them); restore rebuilds everything. */
  onLost() { this.pool = new TargetPool<Target>((w, h, f) => this.createTarget(w, h, f), () => {}); this.zones = new ResourceCache(this.zones.budgetBytes, () => {}); this.progs.clear(); }
  onRestored() { this.pool = new TargetPool<Target>((w, h, f) => this.createTarget(w, h, f), t => this.destroyTarget(t)); this.float = !!this.gl.getExtension('EXT_color_buffer_float') || !!this.gl.getExtension('EXT_color_buffer_half_float'); this.hdrScale = this.float ? 1 : 8; this.init(); }
}
