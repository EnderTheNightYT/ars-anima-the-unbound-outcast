/**
 * Efectos sólo visuales del cliente multijugador: el servidor no envía partículas ni números de daño,
 * así que el cliente los deriva del movimiento interpolado y de las bajadas de vida de los enemigos.
 */
import { motionBurst, type MotionEvent } from "../motion-fx";
import { makeDmgNum, stepDmgNums, type DmgNum } from "../dmg-numbers";

export interface FxPartLike { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; color: string; size: number; soft?: boolean }

/** Umbrales de los eventos de movimiento detectados a partir de posiciones. */
export const DUST = { run: 4.2, walk: 1.8, stopFrom: 2.4, stopTo: .7, air: .18, stepEvery: 1.4, slideSpeed: 6.5 } as const;

interface ActorTrack { x: number; y: number; z: number; sp: number; air: boolean; acc: number }

/** Detecta saltos, aterrizajes, frenazos, pasos y deslizamientos de un actor a partir de su posición. */
export class DustTracker {
  private actors = new Map<string, ActorTrack>();
  /** Devuelve los eventos de movimiento de este cuadro para el actor `id`. */
  observe(id: string, x: number, y: number, z: number, floor: number, dt: number): { ev: MotionEvent; vx: number; vy: number }[] {
    if (![x, y, z, dt].every(Number.isFinite) || dt <= 0) return [];
    const a = this.actors.get(id);
    const air = z - floor > DUST.air;
    if (!a || Math.hypot(x - a.x, y - a.y) > 3) { this.actors.set(id, { x, y, z, sp: 0, air, acc: 0 }); return []; }
    const vx = (x - a.x) / dt, vy = (y - a.y) / dt, raw = Math.hypot(vx, vy), sp = a.sp + (raw - a.sp) * Math.min(1, dt * 10);
    const out: { ev: MotionEvent; vx: number; vy: number }[] = [];
    if (!a.air && air && z > a.z) out.push({ ev: "jump", vx, vy });
    if (a.air && !air) out.push({ ev: "land", vx, vy });
    if (!air) {
      if (a.sp > DUST.stopFrom && sp < DUST.stopTo) out.push({ ev: "stop", vx: vx || (x - a.x), vy: vy || (y - a.y) });
      if (sp > DUST.slideSpeed && z - floor < .05) { a.acc += sp * dt; if (a.acc > .6) { a.acc = 0; out.push({ ev: "slide", vx, vy }); } }
      else if (sp > DUST.walk) { a.acc += sp * dt; if (a.acc > DUST.stepEvery * (sp > DUST.run ? .7 : 1)) { a.acc = 0; out.push({ ev: "step", vx, vy }); } }
    }
    a.x = x; a.y = y; a.z = z; a.sp = sp; a.air = air;
    return out;
  }
  forget(keep: Set<string>) { for (const id of this.actors.keys()) if (!keep.has(id)) this.actors.delete(id); }
  clear() { this.actors.clear(); }
}

/** Emite el polvo/piedritas de los eventos en la lista de partículas del juego. */
export function emitDust(parts: FxPartLike[], events: { ev: MotionEvent; vx: number; vy: number }[], x: number, y: number, z: number, ground: number, quality = .7) {
  for (const e of events) for (const p of motionBurst(e.ev, x, y, z, ground, e.vx, e.vy, { impact: 4, quality })) parts.push({ ...p, soft: p.size > .03 });
}

/** Física simple de partículas (igual que el motor) para el cliente que no simula. */
export function stepParts<T extends FxPartLike>(parts: T[], dt: number, cap: number): T[] {
  for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= (p.soft ? 1.5 : 9) * dt; if (p.soft) { p.vx *= Math.exp(-3 * dt); p.vy *= Math.exp(-3 * dt); p.size += dt * .05; } p.life -= dt; if (p.z < 0) { p.z = 0; p.vz *= -.3; p.vx *= .6; p.vy *= .6; } }
  return parts.filter(p => p.life > 0).slice(-cap);
}

/** Números de daño a partir de las bajadas de vida entre instantáneas. */
export class HpWatch {
  private hp = new Map<number, number>();
  diff(enemies: { id: number; hp: number; hpMax: number; x: number; y: number; z?: number; dead?: boolean }[], into: DmgNum[]): DmgNum[] {
    const seen = new Set<number>();
    for (const e of enemies) {
      seen.add(e.id); const prev = this.hp.get(e.id);
      if (prev !== undefined && Number.isFinite(e.hp) && e.hp < prev - .5) into.push(makeDmgNum(e.x, e.y, (e.z ?? 0) + .9, prev - Math.max(0, e.hp), e.hpMax));
      this.hp.set(e.id, e.hp);
    }
    for (const id of this.hp.keys()) if (!seen.has(id)) this.hp.delete(id);
    return into;
  }
  clear() { this.hp.clear(); }
}

export { stepDmgNums };
