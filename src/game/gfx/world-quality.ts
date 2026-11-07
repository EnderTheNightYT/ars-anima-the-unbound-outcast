/**
 * Calidad adaptable de la vista 3D (cámaras de hombro, frente, arriba e isométrica).
 * Nivel 0 = todo; 1 = sin reflejos; 2 = sin sombras; 3 = sin posproceso (resplandor y gradación).
 * Baja un nivel tras un rato sostenido por debajo de ~45 fps y sólo lo recupera tras un rato
 * largo a 60 fps; cada recaída duplica la espera para no alternar (cada cambio recompila sombreadores).
 */
export const WORLD_QUALITY = { slowMs: 22, fastMs: 17.5, downAfter: 1.5, upAfter: 10, maxUpAfter: 120, maxLevel: 3 } as const;

export class WorldQualityGovernor {
  level = 0;
  private over = 0; private under = 0; private wait: number = WORLD_QUALITY.upAfter; private raised = false;
  update(frameMs: number, dt: number): number {
    if (!Number.isFinite(frameMs) || frameMs <= 0 || !Number.isFinite(dt) || dt <= 0) return this.level;
    const step = Math.min(dt, .25), Q = WORLD_QUALITY;
    if (frameMs > Q.slowMs) { this.over += step; this.under = 0; }
    else if (frameMs < Q.fastMs) { this.under += step; this.over = Math.max(0, this.over - step); }
    else { this.over = Math.max(0, this.over - step); this.under = Math.max(0, this.under - step * .5); }
    if (this.over >= Q.downAfter && this.level < Q.maxLevel) {
      this.level++; this.over = 0; this.under = 0;
      if (this.raised) this.wait = Math.min(Q.maxUpAfter, this.wait * 2); this.raised = false;
    } else if (this.under >= this.wait && this.level > 0) { this.level--; this.under = 0; this.raised = true; }
    return this.level;
  }
}
