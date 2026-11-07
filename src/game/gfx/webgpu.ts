// @ts-nocheck
/**
 * WebGPU backend (WGSL). Single deferred pass over the raycaster G-buffer: GGX/Fresnel PBR with
 * point/spot/directional lights, height fog, ACES or AgX (never both), vignette and grain.
 * Used only when the player picks WebGPU and the browser exposes an adapter; otherwise WebGL2.
 * Uniforms are packed as array<vec4f> so the TS layout matches WGSL alignment exactly.
 */
import { MATERIALS, cullLights } from './pbr';
import { packGBuffer } from './pack';
import { zoneFog, zoneSun } from './zones';
import type { FrameInput, RenderStats } from './webgl2';
import type { Effective } from './drs';
import type { GfxSettings } from './settings';

export const WGPU_MAX_LIGHTS = 16;
export const WGPU_UNIFORM_VEC4 = 8 + WGPU_MAX_LIGHTS * 3 + 16; // header + lights + materials

export const WGSL = /* wgsl */ `
struct U { v: array<vec4f, ${WGPU_UNIFORM_VEC4}> };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var tColor: texture_2d<f32>;
@group(0) @binding(2) var tDepth: texture_2d<f32>;
@group(0) @binding(3) var tInfo: texture_2d<f32>;
struct VO { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u)); var o: VO; o.pos = vec4f(p * 2.0 - 1.0, 0.0, 1.0); o.uv = vec2f(p.x, 1.0 - p.y); return o; }
const PI = 3.14159265;
fn toLin(c: vec3f) -> vec3f { return select(pow((c + 0.055) / 1.055, vec3f(2.4)), c / 12.92, c < vec3f(0.04045)); }
fn ggx(nh: f32, r: f32) -> f32 { let a = r * r; let a2 = a * a; let d = nh * nh * (a2 - 1.0) + 1.0; return a2 / (PI * d * d); }
fn smith(nv: f32, nl: f32, r: f32) -> f32 { let k = (r + 1.0) * (r + 1.0) / 8.0; return (nv / (nv * (1.0 - k) + k)) * (nl / (nl * (1.0 - k) + k)); }
fn fres(c: f32, f0: vec3f) -> vec3f { return f0 + (1.0 - f0) * pow(1.0 - clamp(c, 0.0, 1.0), 5.0); }
fn atten(d: f32, r: f32) -> f32 { let x = d / r; let w = clamp(1.0 - x * x * x * x, 0.0, 1.0); return w * w / (d * d + 1.0); }
fn aces(x0: vec3f) -> vec3f { let x = x0 * 0.6; return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), vec3f(0.0), vec3f(1.0)); }
fn agx(c0: vec3f) -> vec3f {
  let inM = mat3x3f(0.842479, 0.0423282, 0.0423756, 0.0784336, 0.878468, 0.0784336, 0.0792237, 0.0791661, 0.879142);
  let outM = mat3x3f(1.19688, -0.0528968, -0.0529716, -0.0980209, 1.15190, -0.0980434, -0.0990297, -0.0989612, 1.15107);
  var c = inM * max(c0, vec3f(1e-10)); c = clamp((log2(c) + 12.47393) / 16.5, vec3f(0.0), vec3f(1.0));
  let x2 = c * c; let x4 = x2 * x2;
  c = 15.5 * x4 * x2 - 40.14 * x4 * c + 31.96 * x4 - 6.868 * x2 * c + 0.4298 * x2 + 0.1191 * c - 0.00232;
  return pow(max(outM * c, vec3f(0.0)), vec3f(2.2)); }
fn decodeN(code: i32, dir: vec2f) -> vec3f {
  switch code { case 0: { return vec3f(1.0, 0.0, 0.0); } case 1: { return vec3f(-1.0, 0.0, 0.0); } case 2: { return vec3f(0.0, 1.0, 0.0); }
    case 3: { return vec3f(0.0, -1.0, 0.0); } case 4: { return vec3f(0.0, 0.0, 1.0); } case 5: { return vec3f(0.0, 0.0, -1.0); } default: { return vec3f(-dir, 0.0); } } }
@fragment fn fs(i: VO) -> @location(0) vec4f {
  let src = u.v[0].xy; let P0 = u.v[0].zw; let eye = u.v[1].x; let dir = u.v[1].yz; let pl = vec2f(u.v[1].w, u.v[2].x);
  let pitch = u.v[2].y; let horizon = u.v[2].z; let nL = i32(u.v[3].x);
  let ip = clamp(vec2i(i.uv * src), vec2i(0), vec2i(src) - 1);
  let alb = toLin(textureLoad(tColor, ip, 0).rgb);
  let d = textureLoad(tDepth, ip, 0).r; let info = textureLoad(tInfo, ip, 0) * 255.0;
  let code = i32(info.r + 0.5); let mid = clamp(i32(info.g + 0.5), 0, 15);
  var col = alb;
  if (code != 7 && d < 900.0) {
    let sp = vec2f(ip) + 0.5; let cx = 2.0 * sp.x / src.x - 1.0; let r = dir + pl * cx;
    let rz = tan(clamp(pitch + atan((horizon - sp.y) * 0.95 / src.y), -1.553, 1.553));
    let P = vec3f(P0 + r * d, eye + rz * d); let V = normalize(vec3f(P0, eye) - P); let N = decodeN(code, dir);
    let mA = u.v[8 + ${WGPU_MAX_LIGHTS * 3} + mid];
    let metal = mA.x; let rough = max(0.04, mA.y * (1.0 - 0.85 * info.a / 255.0)); let f0 = mix(vec3f(mA.z), alb, metal);
    let nv = max(dot(N, V), 1e-3);
    let isFlat = code == 4 || code == 5 || code == 6; var Ld = vec3f(select(0.95, 1.0, isFlat)); var Ls = vec3f(0.0);
    for (var k = 0; k < ${WGPU_MAX_LIGHTS}; k++) { if (k >= nL) { break; }
      let lp = u.v[8 + k]; let lc = u.v[8 + ${WGPU_MAX_LIGHTS} + k]; let ld = u.v[8 + ${WGPU_MAX_LIGHTS * 2} + k];
      let Lv = lp.xyz - P; let dist = length(Lv); if (dist > lp.w) { continue; } let L = Lv / dist;
      var a = atten(dist, lp.w);
      if (lc.w > 0.5) { let cs = dot(-L.xy / max(1e-3, length(L.xy)), ld.xy); a *= smoothstep(ld.z, ld.z + 0.15, cs); }
      let nl = max(dot(N, L), 0.0); if (nl <= 0.0) { continue; }
      let H = normalize(L + V); let F = fres(max(dot(V, H), 0.0), f0);
      let spec = ggx(max(dot(N, H), 0.0), rough) * smith(nv, nl, rough) * F / max(4.0 * nv * nl, 1e-3);
      Ld += (1.0 - F) * (1.0 - metal) / PI * lc.rgb * a * nl * 3.0; Ls += spec * lc.rgb * a * nl; }
    let L = normalize(u.v[5].xyz); let nl = max(dot(N, L), 0.0); Ld += (1.0 - metal) / PI * u.v[6].rgb * nl;
    if (isFlat) { Ld = max(Ld, vec3f(0.85)); Ls *= 0.35; }
    col = alb * Ld + Ls + alb * info.b / 255.0 * 4.0;
    let fog = 1.0 - exp(-d * u.v[4].w); col = mix(col, u.v[4].rgb, fog);
  }
  col = col * u.v[3].y;
  col = select(aces(col), agx(col), u.v[3].z > 0.5);
  var s = select(1.055 * pow(col, vec3f(1.0 / 2.4)) - 0.055, col * 12.92, col < vec3f(0.0031308));
  let q = i.uv - 0.5; s *= 1.0 - dot(q, q) * u.v[3].w;
  s = mix(s, s * vec3f(1.0, 0.35, 0.3), u.v[6].w * smoothstep(0.1, 0.5, length(q)));
  let n = fract(52.9829189 * fract(dot(i.pos.xy + u.v[2].w * 61.0, vec2f(0.06711056, 0.00583715))));
  s += (n - 0.5) * u.v[5].w * 0.06;
  return vec4f(clamp(s, vec3f(0.0), vec3f(1.0)), 1.0);
}`;

/** Pack per-frame uniforms (pure; tested). */
export function packWgpuUniforms(f: FrameInput, s: GfxSettings, lights: FrameInput['lights']): Float32Array {
  const u = new Float32Array(WGPU_UNIFORM_VEC4 * 4), c = f.cam, fog = zoneFog(c.region), sun = zoneSun(c.region), el = sun.elevation;
  u.set([f.W, f.H, c.px, c.py, c.eye, c.dirX, c.dirY, c.plX, c.plY, c.pitch, f.H / 2 + c.horizonOffset, c.time,
    lights.length, s.exposure, s.tonemapper === 'agx' ? 1 : 0, 0.9 + c.darkness * 0.8,
    fog.color[0], fog.color[1], fog.color[2], fog.density * (1 + c.darkness),
    sun.dir[0] * Math.cos(el), sun.dir[1] * Math.cos(el), Math.sin(el), s.filmGrain ? 1 : 0,
    sun.color[0] * sun.intensity, sun.color[1] * sun.intensity, sun.color[2] * sun.intensity, c.hurt]);
  lights.slice(0, WGPU_MAX_LIGHTS).forEach((l, i) => {
    u.set([l.x, l.y, l.z, l.radius], (8 + i) * 4);
    u.set([l.r * l.intensity, l.g * l.intensity, l.b * l.intensity, l.type === 1 ? 1 : 0], (8 + WGPU_MAX_LIGHTS + i) * 4);
    u.set([l.dx ?? 0, l.dy ?? 0, l.cone ?? 0, 0], (8 + WGPU_MAX_LIGHTS * 2 + i) * 4);
  });
  MATERIALS.forEach((m, i) => u.set([m.metallic, m.roughness, m.reflectance, 0], (8 + WGPU_MAX_LIGHTS * 3 + i) * 4));
  return u;
}

export class WebGPURenderer {
  readonly backend = 'webgpu';
  stats: RenderStats = { drawCalls: 0, lights: 0, shadowLights: 0, memoryMB: 0, width: 0, height: 0, lightW: 0, lightH: 0 };
  lost = false;
  private texs: { color: GPUTexture; depth: GPUTexture; info: GPUTexture } | null = null;
  private bind: GPUBindGroup | null = null;
  private pd = new Float32Array(0); private pi = new Uint8Array(0); private rgba = new Uint8Array(0);
  private ubo: GPUBuffer;
  private constructor(public canvas: HTMLCanvasElement, private device: GPUDevice, private ctx: GPUCanvasContext, private pipe: GPURenderPipeline, private format: GPUTextureFormat) {
    this.ubo = device.createBuffer({ size: WGPU_UNIFORM_VEC4 * 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  }
  static async create(canvas: HTMLCanvasElement, onLost: () => void): Promise<WebGPURenderer | null> {
    const gpu = (navigator as Navigator & { gpu?: GPU }).gpu; if (!gpu) return null;
    const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' }).catch(() => null); if (!adapter) return null;
    const device = await adapter.requestDevice().catch(() => null); if (!device) return null;
    const ctx = canvas.getContext('webgpu') as GPUCanvasContext | null; if (!ctx) return null;
    const format = gpu.getPreferredCanvasFormat(); ctx.configure({ device, format, alphaMode: 'opaque' });
    const module = device.createShaderModule({ code: WGSL });
    const info = await module.getCompilationInfo(); if (info.messages.some(m => m.type === 'error')) { console.warn('[gfx] WGSL', info.messages); return null; }
    const pipe = device.createRenderPipeline({ layout: 'auto', vertex: { module, entryPoint: 'vs' }, fragment: { module, entryPoint: 'fs', targets: [{ format }] }, primitive: { topology: 'triangle-list' } });
    const r = new WebGPURenderer(canvas, device, ctx, pipe, format);
    device.lost.then(i => { r.lost = true; if (i.reason !== 'destroyed') onLost(); });
    return r;
  }
  render(f: FrameInput, s: GfxSettings, e: Effective, outMul: number) {
    if (this.lost) return;
    const d = this.device, W = f.W, H = f.H, n = W * H;
    if (this.canvas.width !== W * outMul) { this.canvas.width = W * outMul; this.canvas.height = H * outMul; }
    if (this.texs && this.texs.color.width !== W) { this.texs.color.destroy(); this.texs.depth.destroy(); this.texs.info.destroy(); this.texs = null; }
    if (!this.texs) {
      const mk = (format: GPUTextureFormat) => d.createTexture({ size: [W, H], format, usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
      this.texs = { color: mk('rgba8unorm'), depth: mk('r32float'), info: mk('rgba8unorm') };
      this.bind = d.createBindGroup({ layout: this.pipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: this.ubo } }, { binding: 1, resource: this.texs.color.createView() }, { binding: 2, resource: this.texs.depth.createView() }, { binding: 3, resource: this.texs.info.createView() }] });
      this.pd = new Float32Array(n); this.pi = new Uint8Array(n * 4);
    }
    packGBuffer(f.gDepth, f.gInfo, f.sDepth, this.pd, this.pi);
    d.queue.copyExternalImageToTexture({ source: f.color as HTMLCanvasElement }, { texture: this.texs.color }, [W, H]);
    d.queue.writeTexture({ texture: this.texs.depth }, this.pd, { bytesPerRow: W * 4 }, [W, H]);
    d.queue.writeTexture({ texture: this.texs.info }, this.pi, { bytesPerRow: W * 4 }, [W, H]);
    const lights = cullLights(f.lights, f.cam, Math.min(16, e.lightBudget));
    d.queue.writeBuffer(this.ubo, 0, packWgpuUniforms(f, s, lights));
    const enc = d.createCommandEncoder();
    const pass = enc.beginRenderPass({ colorAttachments: [{ view: this.ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
    pass.setPipeline(this.pipe); pass.setBindGroup(0, this.bind!); pass.draw(3); pass.end(); d.queue.submit([enc.finish()]);
    this.stats = { drawCalls: 1, lights: lights.length, shadowLights: 0, memoryMB: +((n * 12 + this.canvas.width * this.canvas.height * 4) / 1048576).toFixed(1), width: this.canvas.width, height: this.canvas.height, lightW: W, lightH: H };
    void this.rgba; void this.format;
  }
  dispose() { this.texs?.color.destroy(); this.texs?.depth.destroy(); this.texs?.info.destroy(); this.ubo.destroy(); this.device.destroy(); }
}
