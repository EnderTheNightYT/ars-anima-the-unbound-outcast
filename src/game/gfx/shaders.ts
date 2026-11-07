/**
 * GLSL ES 3.00 shaders for the hybrid raycaster renderer.
 * Conventions: vUv is GL-style (y up). Source textures (color/depth/info, uploaded top row first)
 * are addressed in source pixels with y down: sp = vec2(vUv.x, 1 - vUv.y) * uSrc.
 * Motion blur is intentionally not part of this pipeline.
 */
export const MAX_LIGHTS = 16;

export const VERT = /* glsl */ `#version 300 es
out vec2 vUv;
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); vUv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

const HEADER = /* glsl */ `#version 300 es
precision highp float; precision highp int; precision highp sampler3D;
in vec2 vUv;
uniform vec2 uSrc; uniform vec2 uP; uniform float uEye; uniform vec2 uDir; uniform vec2 uPl;
uniform float uPitch; uniform float uHorizon; uniform float uTime;
float rowRay(float y){ return tan(clamp(uPitch + atan((uHorizon - y) * 0.95 / uSrc.y), -1.553, 1.553)); }
vec3 worldPos(vec2 sp, float d){ float cx = 2.0 * sp.x / uSrc.x - 1.0; vec2 r = uDir + uPl * cx; return vec3(uP + r * d, uEye + rowRay(sp.y) * d); }
vec3 projectW(vec3 q){ vec2 rel = q.xy - uP; float d = dot(rel, uDir); if (d < 0.02) return vec3(-1.0);
  float cx = dot(rel, uPl) / (dot(uPl, uPl) * d); float rz = (q.z - uEye) / d;
  return vec3((cx + 1.0) * 0.5 * uSrc.x, uHorizon - tan(atan(rz) - uPitch) * uSrc.y / 0.95, d); }
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
vec3 toLin(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`;

/** Shared lighting helpers: grid shadows, BRDF. */
const LIGHTING_LIB = /* glsl */ `
uniform highp sampler2D uOcc; uniform int uMap;
// Ray-marched shadow through the occupancy grid (each cell stores [lo,hi] solid heights).
float gridShadow(vec3 a, vec3 b, int steps){
  float vis = 1.0;
  for (int i = 1; i < 48; i++) { if (i >= steps) break;
    float t = float(i) / float(steps); vec3 p = mix(a, b, t);
    ivec2 c = ivec2(floor(p.xy)); if (c.x < 0 || c.y < 0 || c.x >= uMap || c.y >= uMap) continue;
    vec2 v = texelFetch(uOcc, c, 0).rg * 2.4;
    if (v.y > v.x && p.z >= v.x && p.z <= v.y) { vis = 0.0; break; } }
  return vis; }
const float PI = 3.14159265;
float D_GGX(float NoH, float r){ float a = r * r, a2 = a * a, d = NoH * NoH * (a2 - 1.0) + 1.0; return a2 / (PI * d * d); }
float G_Smith(float NoV, float NoL, float r){ float k = (r + 1.0) * (r + 1.0) / 8.0; return (NoV / (NoV * (1.0 - k) + k)) * (NoL / (NoL * (1.0 - k) + k)); }
vec3 F_Schlick(float c, vec3 f0){ return f0 + (1.0 - f0) * pow(1.0 - clamp(c, 0.0, 1.0), 5.0); }
float atten(float d, float r){ float x = d / r, w = clamp(1.0 - x * x * x * x, 0.0, 1.0); return w * w / (d * d + 1.0); }
`;

export const LIGHT_FRAG = HEADER + LIGHTING_LIB + /* glsl */ `
uniform sampler2D uColor; uniform highp sampler2D uDepth; uniform sampler2D uInfo; uniform sampler2D uEnv;
uniform vec4 uMatA[16]; // metallic, roughness, reflectance(F0), normalStrength
uniform vec4 uMatB[16]; // reflectivity, height, wrap(SSS), emissive
uniform vec4 uLPos[${MAX_LIGHTS}]; uniform vec4 uLCol[${MAX_LIGHTS}]; uniform vec4 uLDir[${MAX_LIGHTS}];
uniform int uNumLights; uniform int uShadowLights; uniform int uShadowSteps; uniform float uShadowDist;
uniform int uAoSamples; uniform int uSsrSteps; uniform float uHdrScale; uniform float uIbl;
uniform vec3 uSunDir; uniform vec3 uSunCol;
layout(location=0) out vec4 oDiffuse; layout(location=1) out vec4 oSpec;
ivec2 SP(vec2 sp){ return clamp(ivec2(sp), ivec2(0), ivec2(uSrc) - 1); }
vec3 albedoAt(ivec2 p){ return toLin(texelFetch(uColor, p, 0).rgb); }
float depthAt(ivec2 p){ return texelFetch(uDepth, p, 0).r; }
vec3 decodeN(int code){
  if (code == 0) return vec3(1,0,0); if (code == 1) return vec3(-1,0,0); if (code == 2) return vec3(0,1,0);
  if (code == 3) return vec3(0,-1,0); if (code == 4) return vec3(0,0,1); if (code == 5) return vec3(0,0,-1);
  return vec3(-uDir, 0.0); }
vec3 envSample(vec3 d, float rough){ float phi = atan(d.y, d.x); vec2 uv = vec2(phi / (2.0 * PI) + 0.5, 0.5 - asin(clamp(d.z, -1.0, 1.0)) / PI);
  return toLin(textureLod(uEnv, uv, rough * 6.0).rgb); }
void main(){
  vec2 sp = vec2(vUv.x, 1.0 - vUv.y) * uSrc; ivec2 ip = SP(sp);
  vec4 info = texelFetch(uInfo, ip, 0) * 255.0; int code = int(info.r + 0.5); int mid = int(info.g + 0.5);
  float d = depthAt(ip);
  vec3 alb = albedoAt(ip);
  if (code == 7 || d > 900.0) { oDiffuse = vec4(vec3(1.0) / uHdrScale, 1.0); oSpec = vec4(0.0); return; }
  vec4 mA = uMatA[mid], mB = uMatB[mid];
  float wet = info.a / 255.0, emis = info.b / 255.0;
  float metal = mA.x, rough = max(0.04, mA.y * (1.0 - 0.85 * wet));
  // Height / normal maps derived from texel luminance (per source texel: stays pixelated).
  float hC = luma(alb), hR = luma(albedoAt(SP(sp + vec2(1, 0)))), hL = luma(albedoAt(SP(sp - vec2(1, 0))));
  float hU = luma(albedoAt(SP(sp - vec2(0, 1)))), hD = luma(albedoAt(SP(sp + vec2(0, 1))));
  vec3 N0 = decodeN(code);
  vec3 T1 = abs(N0.z) > 0.5 ? vec3(uPl / length(uPl), 0.0) : vec3(-N0.y, N0.x, 0.0), T2 = abs(N0.z) > 0.5 ? vec3(uDir, 0.0) : vec3(0, 0, 1);
  bool sprite = code == 6;
  vec3 N = sprite ? N0 : normalize(N0 - mA.w * 1.6 * ((hR - hL) * T1 + (hU - hD) * T2 * sign(N0.z + 0.001)));
  float bakedAO = sprite ? 1.0 : mix(1.0, 0.55 + 0.45 * smoothstep(0.0, 0.5, hC), mB.y);
  vec3 P = worldPos(sp, d), V = normalize(vec3(uP, uEye) - P);
  float NoV = max(dot(N, V), 1e-3);
  vec3 F0 = mix(vec3(mA.z), alb, metal);
  // Water refraction: offset the transmitted albedo (screen-space).
  if (mid == 5) { vec2 off = vec2(sin(P.y * 9.0 + uTime * 2.0), cos(P.x * 8.0 + uTime * 1.7)) * 1.5; alb = mix(alb, albedoAt(SP(sp + off)), 0.7); }
  // SSAO: world-space hemisphere samples projected to the depth buffer.
  float ao = 1.0;
  if (uAoSamples > 0) { float occ = 0.0, n0 = ign(gl_FragCoord.xy) * 6.283;
    for (int i = 0; i < 16; i++) { if (i >= uAoSamples) break;
      float fi = float(i) + 0.5, a = n0 + fi * 2.39996, r = 0.12 + 0.38 * fi / float(uAoSamples);
      vec3 s = P + N * 0.06 + (T1 * cos(a) + T2 * sin(a)) * r * 0.8 + N * r * 0.5;
      vec3 q = projectW(s); if (q.z < 0.0 || q.x < 0.0 || q.y < 0.0 || q.x >= uSrc.x || q.y >= uSrc.y) continue;
      float sd = depthAt(SP(q.xy)); float diff = q.z - sd;
      occ += step(0.02, diff) * smoothstep(0.0, 1.0, 0.6 / max(0.6, diff)); }
    ao = sprite ? 1.0 : clamp(1.0 - occ / float(uAoSamples) * 1.25, 0.45, 1.0); }
  vec3 Ld = vec3(0.0), Ls = vec3(0.0);
  float wrap = mB.z;
  for (int i = 0; i < ${MAX_LIGHTS}; i++) { if (i >= uNumLights) break;
    vec4 lp = uLPos[i], lc = uLCol[i], ld = uLDir[i];
    vec3 Lv = lp.xyz - P; float dist = length(Lv); if (dist > lp.w) continue; vec3 L = Lv / dist;
    float att = atten(dist, lp.w);
    if (lc.w > 0.5) { float c = dot(-L.xy / max(1e-3, length(L.xy)), ld.xy); att *= smoothstep(ld.z, ld.z + 0.15, c); }
    float NoLr = dot(N, L), NoL = clamp((NoLr + wrap) / (1.0 + wrap), 0.0, 1.0); if (NoL <= 0.0 && wrap == 0.0) continue;
    float sh = 1.0;
    if (i < uShadowLights && uShadowSteps > 0 && length(P.xy - uP) < uShadowDist) {
      vec3 a = P + N0 * 0.03; int st = int(mix(float(uShadowSteps), float(uShadowSteps) * 0.4, clamp(dist / lp.w, 0.0, 1.0)));
      sh = gridShadow(a, lp.xyz, st);
      if (uShadowSteps >= 20) { vec3 j = vec3(T1.xy, 0.0) * ld.w; sh = (sh * 2.0 + gridShadow(a, lp.xyz + j, st) + gridShadow(a, lp.xyz - j, st)) * 0.25; }
      sh = mix(sh, 1.0, smoothstep(uShadowDist * 0.7, uShadowDist, length(P.xy - uP))); }
    // Contact shadow: short screen-space march toward the light.
    if (i == 0 && uAoSamples > 0) { for (int k = 1; k < 5; k++) { vec3 q = projectW(P + L * 0.05 * float(k)); if (q.z < 0.0) break; float sd = depthAt(SP(q.xy)); if (q.z - sd > 0.02 && q.z - sd < 0.3) { sh *= 0.6; break; } } }
    vec3 rad = lc.rgb * att * sh;
    vec3 H = normalize(L + V); float NoH = max(dot(N, H), 0.0), VoH = max(dot(V, H), 0.0), NoLs = max(NoLr, 0.0);
    vec3 F = F_Schlick(VoH, F0);
    vec3 spec = D_GGX(NoH, rough) * G_Smith(NoV, NoLs, rough) * F / max(4.0 * NoV * NoLs, 1e-3);
    vec3 kd = (1.0 - F) * (1.0 - metal); // energy conservation
    Ld += kd / PI * rad * NoL * 3.0;
    // Subsurface: back-lit transmission for organic surfaces.
    if (wrap > 0.0) Ld += rad * wrap * pow(clamp(dot(V, -L), 0.0, 1.0), 3.0) * vec3(1.0, 0.35, 0.25);
    Ls += spec * rad * NoLs;
    // Clearcoat lobe on polished / water surfaces.
    if (mid == 9 || mid == 5) Ls += D_GGX(NoH, 0.06) * 0.25 * F_Schlick(VoH, vec3(0.04)) * rad * NoLs / max(4.0 * NoV, 1e-3);
  }
  // Directional (zone sun/moon) with grid shadow.
  { vec3 L = normalize(uSunDir); float NoL = max(dot(N, L), 0.0);
    if (NoL > 0.0) { float sh = uShadowSteps > 0 ? gridShadow(P + N0 * 0.03, P + L * 6.0, max(8, uShadowSteps / 2)) : 1.0;
      Ld += (1.0 - metal) / PI * uSunCol * NoL * sh; vec3 H = normalize(L + V); Ls += D_GGX(max(dot(N, H), 0.0), rough) * F_Schlick(max(dot(V, H), 0.0), F0) * uSunCol * NoL * sh * 0.25; } }
  // Image based lighting (environment probe per region) + roughness-aware SSR.
  vec3 R = reflect(-V, N); vec3 Fr = F0 + (max(vec3(1.0 - rough), F0) - F0) * pow(1.0 - NoV, 5.0);
  float refl = max(mB.x, wet);
  vec3 env = envSample(R, rough) * uIbl;
  vec3 ssr = env; float hitW = 0.0;
  if (uSsrSteps > 0 && refl > 0.05 && rough < 0.65) {
    float stepL = 0.18 + ign(gl_FragCoord.xy + 7.0) * 0.08; vec3 q = P + N0 * 0.02;
    for (int i = 0; i < 32; i++) { if (i >= uSsrSteps) break;
      q += R * stepL; stepL *= 1.12; vec3 s = projectW(q);
      if (s.z < 0.0 || s.x < 0.0 || s.y < 0.0 || s.x >= uSrc.x || s.y >= uSrc.y) break;
      float sd = depthAt(SP(s.xy));
      if (s.z > sd && s.z - sd < 0.5 + stepL) { vec2 e = abs(s.xy / uSrc * 2.0 - 1.0);
        hitW = (1.0 - smoothstep(0.75, 1.0, max(e.x, e.y))) * (1.0 - float(i) / float(uSsrSteps));
        ssr = mix(env, albedoAt(SP(s.xy)) * 1.15, hitW); break; } }
    ssr = mix(ssr, env, smoothstep(0.15, 0.65, rough)); }
  vec3 specAmb0 = (refl > 0.05 ? ssr : env) * Fr * mix(0.35, 1.0, refl) * ao;
  vec3 specAmb = specAmb0;
  vec3 emissive = alb * emis * mB.w * 4.0;
  // Selective bloom source: bright saturated texels (flames, glows) in sprites/decor.
  float sat = max(alb.r, max(alb.g, alb.b)) - min(alb.r, min(alb.g, alb.b));
  // Figuras (code 6) brillan menos que la decoración: su halo emborronaba la silueta.
  if (code == 6 || mid == 7) emissive += alb * smoothstep(0.55, 0.9, max(alb.r, max(alb.g, alb.b))) * smoothstep(0.25, 0.6, sat) * (code == 6 ? 0.8 : 2.5);
  bool isFlat = code == 4 || code == 5;
  vec3 diffuseFactor = (vec3((sprite ? 1.05 : 0.95) * bakedAO * ao) + Ld * ao) * (isFlat ? 1.0 : (1.0 - 0.6 * metal * refl));
  if (isFlat || sprite) { diffuseFactor = max(diffuseFactor, vec3(0.85)); specAmb *= 0.35; }
  oDiffuse = vec4(diffuseFactor / uHdrScale, 1.0);
  oSpec = vec4((Ls + specAmb + emissive) / uHdrScale, 1.0);
}`;

/** Low-resolution volumetric fog / light shafts / height fog. RGB = in-scatter, A = transmittance. */
export const VOL_FRAG = HEADER + LIGHTING_LIB + /* glsl */ `
uniform highp sampler2D uDepth;
uniform vec4 uLPos[${MAX_LIGHTS}]; uniform vec4 uLCol[${MAX_LIGHTS}]; uniform int uVolLights; uniform int uSteps;
uniform vec4 uFog; // density, height, falloff, scatter
uniform vec3 uFogCol; uniform float uAniso; uniform float uNoise; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uHdrScale;
out vec4 o;
float hg(float c, float g){ float g2 = g * g; return (1.0 - g2) / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }
float noise3(vec3 p){ return 0.5 + 0.5 * sin(p.x * 1.7 + uTime * 0.4) * sin(p.y * 1.3 - uTime * 0.3) * sin(p.z * 3.1 + p.x * 0.7); }
void main(){
  vec2 sp = vec2(vUv.x, 1.0 - vUv.y) * uSrc;
  float d = min(texelFetch(uDepth, clamp(ivec2(sp), ivec2(0), ivec2(uSrc) - 1), 0).r, 14.0);
  vec3 E = vec3(uP, uEye), P = worldPos(sp, d), Rv = P - E; float len = length(Rv); vec3 dir = Rv / max(len, 1e-3);
  float stepL = len / float(uSteps), j = ign(gl_FragCoord.xy + fract(uTime) * 61.0);
  vec3 acc = vec3(0.0); float T = 1.0;
  for (int i = 0; i < 24; i++) { if (i >= uSteps) break;
    vec3 x = E + dir * (float(i) + j) * stepL;
    float dens = uFog.x * exp(-max(x.z, 0.0) * uFog.z / max(uFog.y, 0.1)) * mix(1.0, noise3(x), uNoise);
    vec3 Li = uFogCol * 0.35 + uSunCol * hg(dot(dir, normalize(uSunDir)), uAniso) * 2.0;
    for (int k = 0; k < 6; k++) { if (k >= uVolLights) break;
      vec3 Lv = uLPos[k].xyz - x; float ld = length(Lv); if (ld > uLPos[k].w) continue;
      float vis = gridShadow(x, uLPos[k].xyz, 8);
      Li += uLCol[k].rgb * atten(ld, uLPos[k].w) * hg(dot(dir, Lv / ld), uAniso) * vis * 6.0; }
    float ext = dens * stepL; acc += T * Li * dens * uFog.w * stepL; T *= exp(-ext); }
  o = vec4(acc / uHdrScale, T);
}`;

/** Bright pass: compose albedo × light + spec at low res, keep luminance above threshold (soft knee). */
export const BRIGHT_FRAG = HEADER + /* glsl */ `
uniform sampler2D uColor; uniform sampler2D uDiffuse; uniform sampler2D uSpec; uniform float uThreshold; uniform float uHdrScale;
out vec4 o;
void main(){
  vec3 alb = toLin(texture(uColor, vec2(vUv.x, 1.0 - vUv.y)).rgb);
  vec3 c = (alb * texture(uDiffuse, vUv).rgb + texture(uSpec, vUv).rgb) * uHdrScale;
  float l = max(c.r, max(c.g, c.b)), knee = uThreshold * 0.5, s = clamp(l - uThreshold + knee, 0.0, 2.0 * knee);
  s = s * s / (4.0 * knee + 1e-4); float w = max(s, l - uThreshold) / max(l, 1e-4);
  o = vec4(min(c * w, vec3(32.0)) / uHdrScale, 1.0);
}`;

/** 4-tap (13-tap-equivalent box) downsample and tent upsample for the bloom chain. */
export const DOWN_FRAG = /* glsl */ `#version 300 es
precision highp float; in vec2 vUv; uniform sampler2D uTex; uniform vec2 uTexel; out vec4 o;
void main(){ vec4 a = texture(uTex, vUv + uTexel * vec2(-1,-1)), b = texture(uTex, vUv + uTexel * vec2(1,-1)), c = texture(uTex, vUv + uTexel * vec2(-1,1)), d = texture(uTex, vUv + uTexel * vec2(1,1));
  o = (a + b + c + d) * 0.25; }`;
export const UP_FRAG = /* glsl */ `#version 300 es
precision highp float; in vec2 vUv; uniform sampler2D uTex; uniform vec2 uTexel; uniform float uWeight; out vec4 o;
void main(){ vec4 s = texture(uTex, vUv) * 4.0;
  s += (texture(uTex, vUv + vec2(uTexel.x, 0)) + texture(uTex, vUv - vec2(uTexel.x, 0)) + texture(uTex, vUv + vec2(0, uTexel.y)) + texture(uTex, vUv - vec2(0, uTexel.y))) * 2.0;
  s += texture(uTex, vUv + uTexel) + texture(uTex, vUv - uTexel) + texture(uTex, vUv + vec2(uTexel.x, -uTexel.y)) + texture(uTex, vUv + vec2(-uTexel.x, uTexel.y));
  o = vec4(s.rgb / 16.0 * uWeight, 1.0); }`;

/** Stateless instanced GPU particles: ambient motes around the camera + embers above heat lights. */
export const PART_VERT = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uSrc; uniform vec2 uP; uniform float uEye; uniform vec2 uDir; uniform vec2 uPl; uniform float uPitch; uniform float uHorizon; uniform float uTime;
uniform vec4 uHeat[4]; uniform int uNumHeat; uniform vec2 uOut;
out vec3 vCol; out float vDepth; out vec2 vSp;
float h(float n){ return fract(sin(n) * 43758.5453); }
void main(){
  float id = float(gl_InstanceID); vec3 q; vec3 col;
  bool ember = uNumHeat > 0 && mod(id, 3.0) < 1.0;
  if (ember) { int k = int(mod(id, float(uNumHeat))); vec4 L = uHeat[k]; float life = fract(uTime * (0.25 + 0.2 * h(id)) + h(id * 1.3));
    q = vec3(L.xy + (vec2(h(id * 2.1), h(id * 3.7)) - 0.5) * 0.5 + vec2(sin(uTime + id), cos(uTime * 0.7 + id)) * 0.08 * life, L.z + life * 1.2);
    col = vec3(3.0, 1.2, 0.35) * (1.0 - life); }
  else { vec3 b = vec3(h(id * 1.1), h(id * 2.3), h(id * 4.7)) * vec3(8.0, 8.0, 2.4);
    vec3 drift = vec3(sin(uTime * 0.13 + id), cos(uTime * 0.11 + id * 0.7), sin(uTime * 0.07 + id * 0.3) * 0.5) * 0.3;
    q = vec3(floor(uP / 8.0) * 8.0, 0.0) + b + drift; q.xy += step(b.xy + floor(uP / 8.0) * 8.0, uP - 4.0) * 8.0 - step(uP + 4.0, b.xy + floor(uP / 8.0) * 8.0) * 8.0;
    col = vec3(0.35, 0.32, 0.28) * (0.5 + 0.5 * sin(uTime * 2.0 + id)); }
  vec2 rel = q.xy - uP; float d = dot(rel, uDir);
  if (d < 0.15 || d > 12.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float cx = dot(rel, uPl) / (dot(uPl, uPl) * d); float rz = (q.z - uEye) / d;
  vec2 sp = vec2((cx + 1.0) * 0.5 * uSrc.x, uHorizon - tan(atan(rz) - uPitch) * uSrc.y / 0.95);
  vSp = sp; vDepth = d; vCol = col * (1.0 - d / 12.0);
  gl_Position = vec4(sp.x / uSrc.x * 2.0 - 1.0, 1.0 - sp.y / uSrc.y * 2.0, 0.0, 1.0);
  gl_PointSize = max(1.0, uOut.y / uSrc.y * (ember ? 1.0 : 0.7) * clamp(2.0 / d, 0.6, 2.0));
}`;
export const PART_FRAG = /* glsl */ `#version 300 es
precision highp float; uniform highp sampler2D uDepth; uniform vec2 uSrc; uniform float uHdrScale;
in vec3 vCol; in float vDepth; in vec2 vSp; layout(location=1) out vec4 o;
void main(){ float sd = texelFetch(uDepth, clamp(ivec2(vSp), ivec2(0), ivec2(uSrc) - 1), 0).r; if (vDepth > sd) discard; o = vec4(vCol / uHdrScale, 1.0); }`;

/** Final composite: albedo (nearest, full res) × lighting + spec, volumetrics, bloom, flares, DoF, tonemap, LUT, grain. */
export const FINAL_FRAG = HEADER + /* glsl */ `
uniform sampler2D uColor; uniform sampler2D uDiffuse; uniform sampler2D uSpec; uniform sampler2D uVol; uniform sampler2D uBloom;
uniform highp sampler2D uDepth; uniform sampler3D uLut; uniform sampler2D uInfo;
uniform float uHdrScale; uniform float uExposure; uniform float uBloomI; uniform int uTonemap; uniform float uLutMix;
uniform float uVolOn; uniform float uGrain; uniform float uCA; uniform float uVignette; uniform float uHurt; uniform float uDof; uniform float uFlares;
uniform vec4 uFlare[4]; uniform int uNumFlares; uniform vec4 uHeatS[4]; uniform int uNumHeat;
out vec4 o;
vec3 aces(vec3 x){ x *= 0.6; return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 agx(vec3 c){ // minimal AgX (Troy Sobotka) base + default look
  mat3 inM = mat3(0.842479, 0.0423282, 0.0423756, 0.0784336, 0.878468, 0.0784336, 0.0792237, 0.0791661, 0.879142);
  mat3 outM = mat3(1.19688, -0.0528968, -0.0529716, -0.0980209, 1.15190, -0.0980434, -0.0990297, -0.0989612, 1.15107);
  c = inM * max(c, vec3(1e-10)); c = clamp((log2(c) + 12.47393) / 16.5, 0.0, 1.0);
  vec3 x2 = c * c, x4 = x2 * x2;
  c = 15.5 * x4 * x2 - 40.14 * x4 * c + 31.96 * x4 - 6.868 * x2 * c + 0.4298 * x2 + 0.1191 * c - 0.00232;
  c = outM * c; return pow(max(c, vec3(0.0)), vec3(2.2)); }
// Píxel de figura (jugador, enemigo, objeto en pie): nunca se distorsiona ni se difumina.
bool spriteAt(vec2 uv){ vec2 sp = vec2(uv.x, 1.0 - uv.y) * uSrc; return int(texelFetch(uInfo, clamp(ivec2(sp), ivec2(0), ivec2(uSrc) - 1), 0).r * 255.0 + 0.5) == 6; }
vec3 hdrAt(vec2 uv){ vec3 alb = toLin(texture(uColor, vec2(uv.x, 1.0 - uv.y)).rgb);
  vec3 c = (alb * texture(uDiffuse, uv).rgb + texture(uSpec, uv).rgb) * uHdrScale;
  if (uVolOn > 0.5) { vec4 v = texture(uVol, uv); c = c * v.a + v.rgb * uHdrScale; }
  return c; }
// Figuras: luz leída sin mezclar con el fondo vecino (texel más cercano) y niebla volumétrica a la mitad.
vec3 hdrSprite(vec2 uv){ vec3 alb = toLin(texture(uColor, vec2(uv.x, 1.0 - uv.y)).rgb);
  ivec2 ls = textureSize(uDiffuse, 0), lp = clamp(ivec2(uv * vec2(ls)), ivec2(0), ls - 1);
  vec3 lit = (alb * texelFetch(uDiffuse, lp, 0).rgb + texelFetch(uSpec, lp, 0).rgb) * uHdrScale;
  // Luz, sombras, oclusión y reflejos sólo tiñen un poco la figura: sus píxeles originales mandan (nitidez).
  vec3 c = mix(alb, lit, 0.3);
  if (uVolOn > 0.5) { vec4 v = texture(uVol, uv); c = mix(c, c * v.a + v.rgb * uHdrScale, 0.1); }
  return c; }
void main(){
  vec2 uv = vUv; bool spr = spriteAt(vUv);
  // Heat distortion near fire lights + screen-space hurt distortion (never over or into a figure).
  if (!spr) {
    for (int i = 0; i < 4; i++) { if (i >= uNumHeat) break; vec2 c = uHeatS[i].xy; float r = uHeatS[i].z, dd = length((uv - c) * vec2(1.6, 1.0));
      if (dd < r && uv.y > c.y) uv += vec2(sin(uv.y * 90.0 + uTime * 9.0), 0.0) * 0.0025 * uHeatS[i].w * (1.0 - dd / r); }
    if (uHurt > 0.0) uv += (vec2(ign(gl_FragCoord.xy), ign(gl_FragCoord.yx)) - 0.5) * 0.004 * uHurt;
    if (spriteAt(uv)) uv = vUv;
  }
  vec3 c;
  if (spr) c = hdrSprite(uv);
  else if (uCA > 0.0) { vec2 off = (uv - 0.5) * uCA * 0.002; c = vec3(hdrAt(uv + off).r, hdrAt(uv).g, hdrAt(uv - off).b); } else c = hdrAt(uv);
  // Depth of field (far focus blur, optional; figures stay sharp).
  if (uDof > 0.0 && !spr) { vec2 sp = vec2(uv.x, 1.0 - uv.y) * uSrc; float dep = texelFetch(uDepth, clamp(ivec2(sp), ivec2(0), ivec2(uSrc) - 1), 0).r;
    float coc = clamp((dep - 7.0) / 6.0, 0.0, 1.0) * uDof; if (coc > 0.01) { vec3 s = c; for (int k = 0; k < 8; k++) { float a = float(k) * 0.785; s += hdrAt(uv + vec2(cos(a), sin(a)) * coc * 2.5 / uSrc); } c = mix(c, s / 9.0, coc); } }
  c += texture(uBloom, uv).rgb * uHdrScale * uBloomI * (spr ? 0.08 : 1.0);
  // Lens flares: halo + ghosts mirrored through the center for bright visible lights.
  for (int i = 0; i < 4; i++) { if (i >= uNumFlares) break; vec2 lp = uFlare[i].xy; vec3 fc = vec3(1.0, 0.75, 0.5) * uFlare[i].z * uFlares;
    float dl = length((uv - lp) * vec2(1.6, 1.0)); c += fc * 0.12 * exp(-dl * 18.0);
    for (int g = 1; g < 4; g++) { vec2 gp = mix(lp, vec2(1.0) - lp, float(g) * 0.33); c += fc * vec3(0.4, 0.6, 1.0) * 0.03 * smoothstep(0.06, 0.0, length((uv - gp) * vec2(1.6, 1.0))); } }
  c *= uExposure;
  c = uTonemap == 1 ? agx(c) : aces(c); // never both
  vec3 s = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  if (uLutMix > 0.0) s = mix(s, texture(uLut, clamp(s, 0.0, 1.0) * (15.0 / 16.0) + 0.5 / 16.0).rgb, uLutMix);
  vec2 q = vUv - 0.5; float vig = 1.0 - dot(q, q) * uVignette; s *= vig;
  s = mix(s, s * vec3(1.0, 0.35, 0.3), uHurt * smoothstep(0.1, 0.5, length(q)));
  if (uGrain > 0.0) s += (ign(gl_FragCoord.xy + fract(uTime * 7.0) * 113.0) - 0.5) * uGrain * (spr ? 0.0 : 0.06);
  o = vec4(clamp(s, 0.0, 1.0), 1.0);
}`;

/** FXAA restricted to geometric edges (depth discontinuities) + contrast-adaptive sharpening.
 *  Texture interiors are never blurred so pixel art stays crisp. */
export const POST_FRAG = /* glsl */ `#version 300 es
precision highp float; in vec2 vUv; uniform sampler2D uTex; uniform highp sampler2D uDepth; uniform sampler2D uInfo; uniform vec2 uSrc; uniform vec2 uTexel;
uniform float uFxaa; uniform float uSharpen; out vec4 o;
bool S(vec2 uv){ return int(texelFetch(uInfo, clamp(ivec2(vec2(uv.x, 1.0 - uv.y) * uSrc), ivec2(0), ivec2(uSrc) - 1), 0).r * 255.0 + 0.5) == 6; }
float L(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
float D(vec2 uv){ return texelFetch(uDepth, clamp(ivec2(vec2(uv.x, 1.0 - uv.y) * uSrc), ivec2(0), ivec2(uSrc) - 1), 0).r; }
void main(){
  vec3 c = texture(uTex, vUv).rgb;
  vec3 n = texture(uTex, vUv + vec2(0, uTexel.y)).rgb, s = texture(uTex, vUv - vec2(0, uTexel.y)).rgb, e = texture(uTex, vUv + vec2(uTexel.x, 0)).rgb, w = texture(uTex, vUv - vec2(uTexel.x, 0)).rgb;
  // Bordes de figuras: sin FXAA (difuminaba la silueta del jugador y los enemigos).
  vec2 st0 = 1.0 / uSrc; bool nearSprite = S(vUv) || S(vUv + vec2(st0.x, 0)) || S(vUv - vec2(st0.x, 0)) || S(vUv + vec2(0, st0.y)) || S(vUv - vec2(0, st0.y));
  if (uFxaa > 0.0 && !nearSprite) {
    vec2 st = 1.0 / uSrc; float d0 = D(vUv), dm = max(max(abs(D(vUv + vec2(st.x, 0)) - d0), abs(D(vUv - vec2(st.x, 0)) - d0)), max(abs(D(vUv + vec2(0, st.y)) - d0), abs(D(vUv - vec2(0, st.y)) - d0)));
    float edge = smoothstep(0.08, 0.3, dm / max(d0, 0.1)) * smoothstep(2.0, 5.0, d0);
    if (edge > 0.0) { float ln = L(n), ls = L(s), le = L(e), lw = L(w), lc = L(c);
      vec2 dir = vec2(-((ln) - (ls)), (le) - (lw)); float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + 1e-3); dir = clamp(dir * rcp, -4.0, 4.0) * uTexel;
      vec3 a = 0.5 * (texture(uTex, vUv + dir * (1.0 / 3.0 - 0.5)).rgb + texture(uTex, vUv + dir * (2.0 / 3.0 - 0.5)).rgb);
      vec3 b = a * 0.5 + 0.25 * (texture(uTex, vUv - dir * 0.5).rgb + texture(uTex, vUv + dir * 0.5).rgb);
      float lb = L(b), lmin = min(lc, min(min(ln, ls), min(le, lw))), lmax = max(lc, max(max(ln, ls), max(le, lw)));
      c = mix(c, (lb < lmin || lb > lmax) ? a : b, edge * uFxaa); } }
  // Figuras: sin realce (dejaba halos que se veían como desenfoque).
  if (uSharpen > 0.0 && !nearSprite) { vec3 mn = min(c, min(min(n, s), min(e, w))), mx = max(c, max(max(n, s), max(e, w)));
    vec3 amp = sqrt(clamp(min(mn, 2.0 - mx) / max(mx, 1e-3), 0.0, 1.0)); vec3 wgt = -amp * mix(0.125, 0.2, uSharpen);
    c = clamp((c + (n + s + e + w) * wgt) / (1.0 + 4.0 * wgt), 0.0, 1.0); }
  o = vec4(c, 1.0);
}`;
