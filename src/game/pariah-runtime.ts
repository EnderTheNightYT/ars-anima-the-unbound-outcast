/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * P.A.R.I.A.H en partida: integra las reglas de `pariah.ts` con el motor existente (combate, Lumbre,
 * proyectiles, empujes, heridas y renderizado). Todas las funciones salen inmediatamente si la clase
 * activa no es P.A.R.I.A.H., así que el resto de clases no se ve afectado.
 */
import {
  PARIAH, isPariah, euphoria, paroxysm, painBonus, fistDamage, napeHit, takenMult, accelMult, splitPain,
  RUPTURE, ruptureRadius, waveHits, rupturePush, RUBBLE_MATERIALS, IMPULSE, impulsePower, lerp, growthDamage,
  VOID, voidChance, VOID_KINDS, type VoidKind, stackWound, woundPenalty, woundLevel, notePariahAction, PARIAH_UNLOCK_TEXT,
  type PariahAction, thrownDamage, PARIAH_WEAPONS,
} from "./pariah";
import { HEAVY } from "./combat-fx";

type G = any;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export interface Phantom { kind: string; x: number; y: number; t: number; life: number; still: boolean; ang: number }
export interface PariahRun {
  pain: number; moveT: number; stopT: number; chainMax: number; parox: boolean;
  ruptureCd: number; ruptureT: number; ruptureWave: number; ruptureHit: number[][];
  impulse: number; impulseCd: number; impulseT: number;
  voidT: number; voidKind: VoidKind | ""; voidLen: number; voidNext: number; voidRest: number; phantoms: Phantom[]; soundT: number;
  grabT: number; grabSprite: string;
}
export const newPariahRun = (): PariahRun => ({
  pain: 0, moveT: 0, stopT: 0, chainMax: 0, parox: false,
  ruptureCd: 0, ruptureT: -1, ruptureWave: -1, ruptureHit: [[], [], []],
  impulse: 0, impulseCd: 0, impulseT: 0,
  voidT: 0, voidKind: "", voidLen: 0, voidNext: VOID.interval[1], voidRest: 0, phantoms: [], soundT: 30,
  grabT: 0, grabSprite: "",
});

export const on = (g: G) => isPariah(g.cls?.id);
/** Arma propia (PUÑOS/RUINAS). */
export const pariahBase = (type: string) => PARIAH_WEAPONS.find(w => w.type === type);

// ---------------- Desbloqueo ----------------
export function noteUnlock(g: G, action: PariahAction) {
  if (!notePariahAction(action)) return;
  g.onSound?.("pact"); g.float?.("✦ ALGO TE RECONOCE ✦", "#d2b1ff");
  g.msg?.(PARIAH_UNLOCK_TEXT);
  if (g.mode === "play") { g.choice = { title: PARIAH_UNLOCK_TEXT, options: [{ name: "…", desc: "P.A.R.I.A.H aparecerá en la selección de clases.", apply: () => {} }] }; g.mode = "choice"; g.onUI?.(); }
}

// ---------------- Estado de combate ----------------
export function hostiles(g: G) {
  let n = 0; for (const e of g.enemies) if (!e.dead && e.aware && Math.hypot(e.x - g.px, e.y - g.py) < PARIAH.euphoria.range) {
    const toP = Math.atan2(g.py - e.y, g.px - e.x), off = Math.abs(Math.atan2(Math.sin(toP - (e.face ?? toP)), Math.cos(toP - (e.face ?? toP))));
    if (off < 1.2) n++;
  } return n;
}
export const euph = (g: G) => euphoria(hostiles(g));
export const parox = (g: G) => paroxysm(g.combo ?? 0);
export const inCombo = (g: G) => (g.combo ?? 0) > 0 && (g.comboT ?? 0) > 0;

/** Daño de puño determinista (sin tirada de daño ni crítico). `situation` agrupa cargado/cadena/abertura. */
export function fistDmg(g: G, situation: number) {
  const P: PariahRun = g.pariah;
  const temp = g.skillMul("damage") * (g.alterationAt()?.damage ?? 1) * g.needFx().damage * g.buff().damage;
  const arms = woundPenalty(g.wounds?.BRAZO);
  return fistDamage({ fueMod: g.mod("FUE"), cls: g.levelDamage() * growthDamage(g.level), temp: temp * arms, combo: parox(g), pain: painBonus(P.pain, g.hpMax), euphoria: euph(g), situation });
}

/** Golpe de puño de P.A.R.I.A.H tras superar la tirada de impacto D120 existente. */
export function strike(g: G, e: G, w: G, mult: number, sit: string) {
  const P: PariahRun = g.pariah;
  let situation = mult; if (e.stagger > 0) situation *= 1.5;
  const dmg = fistDmg(g, situation);
  g.sinceHit = 0;
  g.track("hits", 1, `${w.name}`, { critical: false, ranged: false, aerial: sit === "CRÍTICO AÉREO", dash: false, weapon: w.base.type });
  g.combo++; if (g.combo % 5 === 0) { g.onSound("combo"); g.track("combos", 1, "cinco ataques consecutivos"); g.score.gain("attackCombo", Math.min(4, g.combo / 5)); }
  g.track("comboRecord", g.combo, "ataques consecutivos"); g.comboT = 3; g.gainXp(2 + Math.min(6, Math.floor(g.combo / 3)), "combo");
  const px = parox(g); if (px.active && !P.parox) { P.parox = true; g.float("✦ PAROXISMO ✦", "#ff3a4a"); g.shake = Math.max(g.shake, .3); g.burst(g.px, g.py, .6, "#ff3a4a", 30); }
  g.damageEnemy(e, dmg, w.base.breakB + 1, { melee: true, critical: false, style: "punch" });
  if (!e.dead && Math.random() < PARIAH.bleed.chance) { e.pxBleed = PARIAH.bleed.seconds; e.pxBleedTick = e.pxBleedTick ?? 1; g.float("SANGRADO", "#c4121e"); }
  return true;
}

/** Multiplicador de daño recibido (resistencia física, Euforia y nuca). */
export function takenFactor(g: G, from?: { x: number; y: number }, hitZ?: number) {
  const head = hitZ === undefined ? false : hitZ - g.pz >= g.bodyH() * PARIAH.nape.headFrac;
  const nape = !!from && napeHit(g.ang, g.px, g.py, from.x, from.y, head);
  if (nape) { g.float("¡NUCA EXPUESTA! ×2.5", "#ff2a3a"); g.shake = Math.max(g.shake, .3); }
  return takenMult(euph(g), nape);
}

/** Dolor Diferido: devuelve el daño inmediato; acumula y refleja el resto. */
export function deferPain(g: G, dmg: number, from?: { x: number; y: number }) {
  const P: PariahRun = g.pariah; const s = splitPain(dmg, inCombo(g));
  if (s.store > 0) {
    P.pain += s.store;
    const src = (from ? g.enemies.filter((e: G) => !e.dead && Math.hypot(e.x - from.x, e.y - from.y) < 1.6) : g.enemies.filter((e: G) => !e.dead && e.aware && Math.hypot(e.x - g.px, e.y - g.py) < 3))
      .sort((a: G, b: G) => Math.hypot(a.x - g.px, a.y - g.py) - Math.hypot(b.x - g.px, b.y - g.py))[0];
    // El reflejo no pasa por hurtPlayer: no genera nuevas acumulaciones.
    if (src && s.reflect > 0) { g.damageEnemy(src, s.reflect, 0, {}); g.burst(src.x, src.y, .7, "#7a0a1a", 6); }
  }
  return s.now;
}

/** Herida localizada (Anatomía del Desamparado): +35 % probabilidad y severidad acumulable. */
export function maybeWound(g: G, crit: boolean, hostile: boolean) {
  if (!hostile) return false;
  if (!(crit || Math.random() < .08 * PARIAH.anatomy.injury)) return true;
  const parts = ["CABEZA", "TORSO", "BRAZO", "PIERNA"]; const part = parts[Math.floor(Math.random() * parts.length)]!;
  g.wounds[part] = stackWound(g.wounds[part], crit && g.hp < g.hpMax * .3);
  const lvl = ["LEVE", "MODERADA", "GRAVE", "CRÍTICA"][woundLevel(g.wounds[part])];
  g.track("wounds", 1, part); g.msg(`Herida ${lvl} en ${part}`); g.float(`HERIDA ${lvl}: ${part}`, "#ff5050");
  if (part === "TORSO") g.bleed = Math.max(g.bleed, 8);
  if (part === "CABEZA") g.pariah.voidNext = Math.min(g.pariah.voidNext, 2);
  return true;
}

// ---------------- Movimiento ----------------
export const moveFactor = (g: G) => accelMult(g.pariah.moveT) * (1 + parox(g).move) * woundPenalty(g.wounds?.PIERNA) / (g.wounds?.PIERNA ? .8 : 1);
export const jumpFactor = (g: G) => Math.sqrt(PARIAH.jump) * Math.sqrt(woundPenalty(g.wounds?.PIERNA));

// ---------------- Ruptura del Desposeído ----------------
export function startRupture(g: G) {
  const P: PariahRun = g.pariah;
  if (P.ruptureT >= 0) return;
  if (P.ruptureCd > 0) { g.float(`RUPTURA · ${Math.ceil(P.ruptureCd)} s`, "#8a8a9a"); return; }
  if (g.lumbre < RUPTURE.cost) { g.float(`RUPTURA · necesita ${RUPTURE.cost} Lumbre`, "#b5f"); return; }
  if (g.pz > g.floorHeight() + .1) { g.float("RUPTURA · necesitas suelo firme", "#8a8a9a"); return; }
  g.lumbre -= RUPTURE.cost; P.ruptureT = 0; P.ruptureWave = -1; P.ruptureHit = [[], [], []];
  g.float("RUPTURA DEL DESPOSEÍDO", "#ffb14a"); g.onSound("charged", "PUÑOS"); g.vx = g.vy = 0;
}
function ruptureWave(g: G, wave: number) {
  const P: PariahRun = g.pariah, R = ruptureRadius(wave), hit = P.ruptureHit[wave]!;
  const base = fistDmg(g, 1);
  for (const e of g.enemies) {
    if (e.dead || e.grabbed || hit.includes(e.id) || Math.abs(e.z - g.pz) > 1.1) continue;
    const d = Math.hypot(e.x - g.px, e.y - g.py);
    if (!waveHits(wave, d, g.actorRadius(e)) || !g.los(g.px, g.py, e.x, e.y, g.pz + .3, e.z + .3)) continue;
    hit.push(e.id); // cada onda registra su propio impacto: nunca dos veces la misma
    g.damageEnemy(e, base, 3, { melee: true, style: "smash" });
    const push = rupturePush(wave, HEAVY.includes(e.kind), e.kind === "librero" || !!e.miniBoss);
    if (push > 0 && !e.dead) { g.launch(e, Math.atan2(e.y - g.py, e.x - g.px), push); e.vz = Math.max(e.vz ?? 0, 2 + wave); }
  }
  g.shake = Math.max(g.shake, .22 + wave * .1); g.poundFx(R * 1.4); g.onSound("pound"); if (wave > 0) g.onSound("rubble");
  const z = g.floorHeight();
  for (let i = 0; i < 18 + wave * 10; i++) { const a = Math.random() * Math.PI * 2, r = R * rnd(.7, 1); g.parts.push({ x: g.px + Math.cos(a) * r, y: g.py + Math.sin(a) * r, z: z + .03, vx: Math.cos(a) * rnd(.3, 1.2), vy: Math.sin(a) * rnd(.3, 1.2), vz: rnd(1, 3.5), life: rnd(.4, .9), color: ["#4a443c", "#6e6458", "#8f8577", "#2a2420"][i % 4], size: rnd(.025, .06) }); }
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; g.arcFx.push({ x: g.px + Math.cos(a) * .3, y: g.py + Math.sin(a) * .3, z: z + .02, vx: Math.cos(a) * R * 2.4, vy: Math.sin(a) * R * 2.4, life: .42, color: "#d9b27a" }); }
  g.float(["¡IMPACTO!", "¡SEGUNDO IMPACTO!", "¡RUPTURA!"][wave] ?? "", "#ffb14a");
}
function updateRupture(g: G, dt: number) {
  const P: PariahRun = g.pariah; P.ruptureCd = Math.max(0, P.ruptureCd - dt);
  if (P.ruptureT < 0) return;
  P.ruptureT += dt; g.vx *= .5; g.vy *= .5;
  const due = Math.floor((P.ruptureT - RUPTURE.windup) / RUPTURE.gap);
  while (P.ruptureWave < Math.min(2, due) && P.ruptureT >= RUPTURE.windup) { P.ruptureWave++; ruptureWave(g, P.ruptureWave); }
  if (P.ruptureWave >= 2 && P.ruptureT >= RUPTURE.windup + RUPTURE.gap * 2 + .05) {
    P.ruptureT = -1; P.ruptureCd = RUPTURE.cooldown; g.playerStagger = Math.max(g.playerStagger, RUPTURE.recovery);
    if (g.ranged?.base?.type === "RUINAS") { g.ranged.mag = RUPTURE.rubble; g.ranged.magMax = RUPTURE.rubble; }
    g.float(`ARSENAL DE RUINAS · ${RUPTURE.rubble} fragmentos`, "#d9b27a");
  }
}

/** Disparo del Arsenal de Ruinas: material aleatorio con color/tamaño/daño propios. */
export function decorateRubble(g: G, before: number) {
  const m = RUBBLE_MATERIALS[Math.floor(Math.random() * RUBBLE_MATERIALS.length)]!;
  for (let i = before; i < g.projs.length; i++) { const p = g.projs[i]; p.color = m.color; p.size = .14; p.sprite = "pellet"; p.attackMult = (p.attackMult ?? 1) * m.dmg; p.dz = (p.dz ?? 0) + .6; p.lob = true; }
  g.float(m.name, m.color);
}

// ---------------- Impulso del Desposeído ----------------
export function updateImpulse(g: G, dt: number, inp: G, pressed: (k: string) => boolean, grounded: boolean, fx: number, fy: number) {
  const P: PariahRun = g.pariah; P.impulseCd = Math.max(0, P.impulseCd - dt);
  const moving = Math.abs(inp.mx) > .2 || Math.abs(inp.my) > .2;
  const busy = g.swingT > 0 || g.playerStagger > 0 || g.sitting || g.reloadT > 0 || P.ruptureT >= 0 || g.mode !== "play";
  const before = P.impulse;
  if (moving) P.impulse = 0;
  else if (!busy && grounded && P.impulseCd <= 0) P.impulse = Math.min(IMPULSE.full, P.impulse + dt);
  if (before < IMPULSE.partial && P.impulse >= IMPULSE.partial) g.float("IMPULSO PARCIAL", "#d9b27a");
  if (before < IMPULSE.full && P.impulse >= IMPULSE.full) { g.float("IMPULSO COMPLETO", "#ffb14a"); g.onSound("chargeReady", "PUÑOS"); }
  if (P.impulse > .3 && !moving && grounded && Math.random() < dt * 8) { const a = Math.random() * Math.PI * 2; g.parts.push({ x: g.px + Math.cos(a) * .35, y: g.py + Math.sin(a) * .35, z: g.floorHeight() + .02, vx: -Math.cos(a) * .4, vy: -Math.sin(a) * .4, vz: .3, life: .5, color: "#6e6458", size: .03, soft: true }); }
  if (P.impulseT > 0) {
    P.impulseT -= dt;
    // Choca con enemigos sólidos: se detiene delante, sin atravesarlos.
    const sp = Math.hypot(g.vx, g.vy) || 1, ux = g.vx / sp, uy = g.vy / sp;
    const blocker = g.enemies.find((e: G) => !e.dead && !e.grabbed && Math.abs(e.z - g.pz) < 1 && Math.hypot(e.x - (g.px + ux * .5), e.y - (g.py + uy * .5)) < g.actorRadius(e) + .3);
    if (blocker) { g.damageEnemy(blocker, Math.round(fistDmg(g, .6)), 4, { melee: true, style: "punch" }); g.launch(blocker, Math.atan2(uy, ux), HEAVY.includes(blocker.kind) ? 4 : 8); g.vx *= .1; g.vy *= .1; P.impulseT = 0; g.shake = Math.max(g.shake, .25); }
    if (Math.random() < .7) g.parts.push({ x: g.px - ux * .3, y: g.py - uy * .3, z: g.pz + .05, vx: -ux * .8, vy: -uy * .8, vz: .4, life: .6, color: "#8f8577", size: .05, soft: true });
  }
  if (!pressed("dash")) return;
  const k = impulsePower(P.impulse);
  if (P.impulseCd > 0) { g.float(`IMPULSO · ${Math.ceil(P.impulseCd)} s`, "#8a8a9a"); return; }
  if (k <= 0) { g.float("IMPULSO · quédate quieto para cargarlo", "#8a8a9a"); return; }
  if (g.lumbre < IMPULSE.cost) { g.float("IMPULSO · sin Lumbre", "#b5f"); return; }
  g.lumbre -= IMPULSE.cost; P.impulseCd = IMPULSE.cooldown; P.impulse = 0; P.impulseT = IMPULSE.time + k * .15;
  const has = Math.hypot(fx, fy) > .1, dx = has ? fx : Math.cos(g.ang), dy = has ? fy : Math.sin(g.ang), l = Math.hypot(dx, dy) || 1;
  if (grounded && !inp.jump) { const s = lerp(IMPULSE.ground, k); g.vx = dx / l * s; g.vy = dy / l * s; g.motionFx("dash", 8); }
  else { const s = lerp(IMPULSE.airFwd, k); g.vx = dx / l * s; g.vy = dy / l * s; g.vz = lerp(IMPULSE.airUp, k); g.motionFx("jump", 8); }
  g.onSound("dash"); g.shake = Math.max(g.shake, .2); g.poundFx(1.2); g.float(k >= 1 ? "¡IMPULSO DEL DESPOSEÍDO!" : "IMPULSO", "#ffb14a");
}

// ---------------- Percepción del Vacío ----------------
export const reducedFx = () => { try { return localStorage.getItem("ars_anima_pariah_fx") === "reduced"; } catch { return false; } };
function updateVoid(g: G, dt: number) {
  const P: PariahRun = g.pariah;
  if (P.voidT > 0) { P.voidT -= dt; if (P.voidT <= 0) { P.voidKind = ""; P.voidRest = VOID.rest; } }
  else if (P.voidRest > 0) P.voidRest -= dt;
  else if ((P.voidNext -= dt) <= 0) {
    P.voidNext = rnd(...VOID.interval);
    const wounds = Object.keys(g.wounds ?? {}).length;
    const ch = voidChance({ dark: Math.max(g.darkness ?? 0, g.gloom ?? 0), fatigue: Math.min(1, (g.fatigue ?? 0) / 100), hunger: (g.food < 30 || g.thirst < 30) ? 1 : 0, head: !!g.wounds?.CABEZA, wounds, hpFrac: g.hp / Math.max(1, g.hpMax), danger: g.enemiesNear(12) ? 1 : 0 });
    if (Math.random() < ch) {
      P.voidKind = VOID_KINDS[Math.floor(Math.random() * VOID_KINDS.length)]!; P.voidLen = P.voidT = rnd(...VOID.episode) * PARIAH.anatomy.visualDuration;
      if (Math.random() < .55) spawnPhantom(g);
    }
  }
  for (const ph of P.phantoms) { ph.t += dt; if (!ph.still) { ph.x += Math.cos(ph.ang) * dt * .6; ph.y += Math.sin(ph.ang) * dt * .6; }
    const d = Math.hypot(ph.x - g.px, ph.y - g.py), look = Math.abs(Math.atan2(Math.sin(Math.atan2(ph.y - g.py, ph.x - g.px) - g.ang), Math.cos(Math.atan2(ph.y - g.py, ph.x - g.px) - g.ang)));
    if (d < 2.2 || (look < .12 && ph.t > 1.2) || ph.t > ph.life) ph.life = 0; }
  P.phantoms = P.phantoms.filter(p => p.life > 0).slice(-3);
  // Manifestaciones audiovisuales: ocasionales, nunca constantes.
  if ((P.soundT -= dt) <= 0) { P.soundT = rnd(25, 60) / (g.wounds?.CABEZA ? 1.5 : 1); const k = Math.random(); if (k < .35) g.onSound("step"); else if (k < .6) g.onSound("enemy", g.enemies[0]?.kind ?? "sombra"); else if (k < .8) g.onSound("rubble"); else g.onSound("notice"); }
}
function spawnPhantom(g: G) {
  const kinds = [...new Set((g.enemies as G[]).map(e => e.kind))]; const kind = kinds[Math.floor(Math.random() * kinds.length)] ?? "sombra";
  for (let tries = 0; tries < 12; tries++) {
    const a = g.ang + rnd(-1.4, 1.4), d = rnd(4, 10), x = g.px + Math.cos(a) * d, y = g.py + Math.sin(a) * d;
    if (g.solid(x, y) || !g.los(g.px, g.py, x, y, g.pz + .5, .5)) continue;
    g.pariah.phantoms.push({ kind, x, y, t: 0, life: rnd(2.5, 6), still: Math.random() < .6, ang: Math.random() * Math.PI * 2 });
    return;
  }
}

// ---------------- Bucle por fotograma ----------------
export function update(g: G, dt: number, inp: G, grounded: boolean) {
  const P: PariahRun = g.pariah;
  const moving = (Math.abs(inp.mx) > .2 || Math.abs(inp.my) > .2) && Math.hypot(g.vx, g.vy) > .6;
  if (moving) { P.moveT = Math.min(5, P.moveT + dt); P.stopT = 0; } else { P.stopT += dt; if (P.stopT > PARIAH.accel.stopAfter) P.moveT = Math.max(0, P.moveT - dt * PARIAH.accel.decay); }
  if (g.combo === 0) P.parox = false;
  // Dolor Diferido: al romperse la cadena se paga todo de una vez (nunca desaparece gratis).
  if (P.pain > 0 && !inCombo(g)) {
    const pay = P.pain; P.pain = 0; g.hp -= pay; g.score.damage(pay); g.floorDamage += pay; g.hurtFlash = .4; g.shake = Math.max(g.shake, .3);
    g.float(`DOLOR DIFERIDO −${Math.round(pay)}`, "#ff2a3a"); g.track("damageTaken", pay, "dolor diferido"); g.onSound("hurt");
    if (g.hp <= 0) g.die();
  }
  // Sangrado de P.A.R.I.A.H: una sola instancia renovable, 3 % de vida máxima por segundo.
  for (const e of g.enemies) if (!e.dead && (e.pxBleed ?? 0) > 0) { e.pxBleed -= dt; e.pxBleedTick = (e.pxBleedTick ?? 1) - dt; if (e.pxBleedTick <= 0) { e.pxBleedTick += 1; g.damageEnemy(e, e.hpMax * PARIAH.bleed.pctPerSec, 0, { melee: true }); } }
  // Torso herido: el aguante se recupera más lento.
  if (g.wounds?.TORSO && !g.blocking) g.stam = Math.max(0, g.stam - dt * .6 * (1 + woundLevel(g.wounds.TORSO) * .3));
  // Heridas críticas: no se curan esperando.
  for (const k of Object.keys(g.wounds ?? {})) if (woundLevel(g.wounds[k]) === 3) g.wounds[k] = Math.max(g.wounds[k], 999);
  if (P.grabT > 0) P.grabT = Math.max(0, P.grabT - dt);
  updateRupture(g, dt);
  updateVoid(g, dt);
}

/** Lanzar un arma recogida (no se puede equipar). */
export function throwWeapon(g: G, it: G) {
  const cos = Math.cos(g.ang), sin = Math.sin(g.ang);
  const dmg = thrownDamage(it.base.dice, it.dmgMult ?? 1, g.mod("FUE"));
  g.projs.push({ x: g.px, y: g.py, z: .6 + g.pz, dx: cos * 15, dy: sin * 15, life: 1, dmg, friendly: true, color: it.base.color ?? "#ccc", sprite: "arrow", size: .2, bounces: 0 });
  g.bag = g.bag.filter((b: G) => b.uid !== it.uid); g.onSound("swing"); g.float(`LANZAS ${it.name.toUpperCase()} · ${Math.round(dmg)}`, "#ffd27a");
  g.mode = "play"; g.onUI?.();
}
/** Recoger y lanzar un barril de pólvora existente (radio y daño ×1,5 sólo para P.A.R.I.A.H). */
export function throwKeg(g: G, k: G, radius: number, dmg: number) {
  k.used = true; const cos = Math.cos(g.ang), sin = Math.sin(g.ang);
  g.projs.push({ x: g.px, y: g.py, z: .9 + g.pz, dx: cos * 8, dy: sin * 8, dz: 3, lob: true, life: 2, dmg: dmg * PARIAH.keg, friendly: true, color: "#ff9a2a", bomb: true, blast: radius * PARIAH.keg, size: .3 });
  g.float("¡BARRIL LANZADO!", "#ff9a2a"); g.onSound("swing");
}

/** Animación de agarre: palma abierta y luego el objeto alzado. */
export function grabFx(g: G, sprite: string) { if (!on(g)) return; g.pariah.grabT = .9; g.pariah.grabSprite = sprite; }

// ---------------- Render ----------------
export function drawFists(g: G, ctx: CanvasRenderingContext2D, W: number, H: number) {
  const P: PariahRun = g.pariah, fist = g.sprites.pariahFist, hammer = g.sprites.pariahHammer, palm = g.sprites.pariahPalm;
  if (!fist || !hammer || !palm) return false;
  const sp = Math.hypot(g.vx, g.vy), bobX = Math.sin(g.time * 7) * 6 * Math.min(1, sp / 3), bobY = Math.abs(Math.cos(g.time * 7)) * 6 * Math.min(1, sp / 3);
  const draw = (img: G, x: number, y: number, h: number, rot = 0, flip = false) => { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); if (flip) ctx.scale(-1, 1); const w = h * img.width / img.height; ctx.drawImage(img, -w / 2, -h, w, h); ctx.restore(); };
  // Agarre: palma abierta (0–40 %) y luego el objeto sostenido hacia arriba.
  if (P.grabT > 0) {
    const k = 1 - P.grabT / .9, lift = k < .4 ? 0 : Math.min(1, (k - .4) / .3);
    draw(palm, W * .62 + bobX, H + 30 - lift * 40, 150 + lift * 10, -.15);
    const item = g.sprites[P.grabSprite]; if (item && k >= .4) { const s = 34; ctx.drawImage(item, W * .62 - s / 2 + bobX - 6, H - 120 - lift * 40, s, s * item.height / item.width); }
    return true;
  }
  // Ruptura: los puños unidos golpean el suelo tres veces.
  if (P.ruptureT >= 0) {
    const t = P.ruptureT < RUPTURE.windup ? 0 : ((P.ruptureT - RUPTURE.windup) % RUPTURE.gap) / RUPTURE.gap, up = P.ruptureT < RUPTURE.windup ? P.ruptureT / RUPTURE.windup : t < .25 ? 1 - t * 4 : (t - .25) / .75;
    draw(hammer, W / 2, H + 60 - up * 70 + (1 - up) * 30, 170 + up * 20, 0);
    return true;
  }
  if (g.slot === 1) { // fragmento de escombro listo para lanzar
    draw(palm, W * .66 + bobX, H + 34 + bobY - (g.swingT > 0 ? 30 : 0), 140, -.2);
    if ((g.ranged?.mag ?? 0) > 0) { ctx.fillStyle = "#6e6458"; ctx.beginPath(); ctx.ellipse(W * .64 + bobX, H - 92 + bobY, 13, 10, .4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#8f8577"; ctx.fillRect(W * .64 - 6 + bobX, H - 98 + bobY, 6, 5); }
    return true;
  }
  const charge = Math.min(1, g.chargeT / .55), prog = g.swingMax > 0 ? 1 - g.swingT / g.swingMax : 1;
  if (g.swingT > 0 && g.attackAlternate) { // golpe descendente con ambas manos entrelazadas
    const down = Math.min(1, prog * 1.6), y = H - 40 + down * 120;
    draw(hammer, W / 2, y + 60, 190 - down * 20, 0);
    if (down > .5 && down < 1) { ctx.strokeStyle = "rgba(255,220,180,.5)"; ctx.lineWidth = 2; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 18, H * .35); ctx.lineTo(W / 2 + i * 18, H * .55); ctx.stroke(); } ctx.lineWidth = 1; }
    return true;
  }
  if (charge > 0) { draw(hammer, W / 2 + bobX * .3, H + 90 - charge * 80, 170 + charge * 20, 0); return true; }
  // Jab: un solo puño avanza hacia el centro y vuelve, alternando lado en la cadena.
  const right = (g.meleeStep ?? 0) % 2 === 0;
  if (g.swingT > 0) {
    const punch = Math.sin(Math.min(1, prog) * Math.PI), x = (right ? W * .7 : W * .3) + (W / 2 - (right ? W * .7 : W * .3)) * punch * .8;
    draw(fist, x, H + 40 - punch * 70, 150 - punch * 30, (right ? -.25 : .25) * (1 - punch), !right);
    if (punch > .6) { ctx.strokeStyle = "rgba(255,240,220,.45)"; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { const a = i * 1.6 + g.time * 10; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 30, H * .6 + Math.sin(a) * 18); ctx.lineTo(x + Math.cos(a) * 52, H * .6 + Math.sin(a) * 30); ctx.stroke(); } ctx.lineWidth = 1; }
    return true;
  }
  draw(fist, W * .72 + bobX, H + 70 + bobY, 150, -.25);
  draw(fist, W * .28 - bobX, H + 78 + bobY, 140, .25, true);
  return true;
}

/** Percepción Fragmentada (permanente) + Percepción del Vacío (episodios) + alucinaciones. */
export function drawPerception(g: G, ctx: CanvasRenderingContext2D, W: number, H: number) {
  const P: PariahRun = g.pariah, reduced = reducedFx();
  // Visión periférica reducida y oscura con poco contraste.
  const vg = ctx.createRadialGradient(W / 2, H / 2, W * .18, W / 2, H / 2, W * .55);
  vg.addColorStop(0, "rgba(10,6,14,0)"); vg.addColorStop(1, `rgba(10,6,14,${.55 + Math.max(g.darkness ?? 0, g.gloom ?? 0) * .3})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(60,55,70,.08)"; ctx.fillRect(0, 0, W, H);
  // Alucinaciones: sólo dibujo, sin colisión, vida ni IA.
  const dirX = Math.cos(g.ang), dirY = Math.sin(g.ang), plX = -dirY * .56, plY = dirX * .56, inv = 1 / (plX * dirY - dirX * plY);
  for (const ph of P.phantoms) {
    const img = g.frame?.(ph.kind, "idle", (g.time * 4) % 12) ?? g.sprites[ph.kind]; if (!img) continue;
    const rx = ph.x - g.px, ry = ph.y - g.py, tx = inv * (dirY * rx - dirX * ry), depth = inv * (-plY * rx + plX * ry);
    if (depth < .3) continue; const sx = (W / 2) * (1 + tx / depth), h = H / depth * .9, w = h * img.width / img.height;
    const fade = Math.min(1, ph.t * 2, (ph.life - ph.t) * 2);
    ctx.save(); ctx.globalAlpha = Math.max(0, fade) * (reduced ? .35 : .6); ctx.filter = "grayscale(.6) brightness(.6)"; ctx.drawImage(img, sx - w / 2, H / 2 + h * .5 - h, w, h); ctx.restore();
  }
  if (!P.voidKind) return;
  const k = Math.min(1, P.voidT, (P.voidLen - P.voidT) + .2) * (reduced ? .35 : 1);
  ctx.save();
  if (P.voidKind === "blur") { ctx.globalAlpha = .35 * k; ctx.drawImage(ctx.canvas, 2, 1, W, H); ctx.drawImage(ctx.canvas, -2, -1, W, H); }
  else if (P.voidKind === "dark") { const dg = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W * .4); dg.addColorStop(0, "rgba(0,0,0,0)"); dg.addColorStop(1, `rgba(0,0,0,${.75 * k})`); ctx.fillStyle = dg; ctx.fillRect(0, 0, W, H); }
  else if (P.voidKind === "fragment") { ctx.globalAlpha = .25 * k; ctx.drawImage(ctx.canvas, 10 * Math.sin(g.time * .7), 0, W, H); ctx.globalAlpha = .15 * k; ctx.fillStyle = "#000"; ctx.fillRect(W * .7, H * .1, W * .2, H * .25); }
  else if (P.voidKind === "chroma") { ctx.globalCompositeOperation = "color"; ctx.globalAlpha = .3 * k; ctx.fillStyle = Math.sin(g.time * .5) > 0 ? "#8a2a8a" : "#55506a"; ctx.fillRect(0, 0, W, H); }
  else if (P.voidKind === "noise") { ctx.globalAlpha = .18 * k; for (let i = 0; i < 40; i++) { const x = (i * 97.3 + Math.floor(g.time * 3) * 31) % W, y = (i * 53.7 + Math.floor(g.time * 3) * 17) % H; ctx.fillStyle = i % 3 ? "#12080e" : "#d9cbb0"; ctx.fillRect(x, y, 3 + (i % 5) * 3, 2 + (i % 4) * 2); } }
  ctx.restore();
}
