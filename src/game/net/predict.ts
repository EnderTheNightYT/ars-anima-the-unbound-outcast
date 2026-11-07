/**
 * Predicción local del propio jugador en la expedición compartida.
 * El cliente mueve a su personaje al instante con las mismas reglas de velocidad del motor y,
 * cuando llega la posición autoritativa del servidor para una entrada ya confirmada (`ack`),
 * corrige el error acumulado. La corrección se reparte en unos cuadros para que no se note.
 */
export const PREDICT = {
  /** Aceleración en suelo / aire: igual que el motor (engine.ts, `accel`). */
  accelGround: 12,
  accelAir: 5,
  /** Velocidad de desvanecimiento de la corrección visual (1/s). */
  smooth: 12,
  /** Error mayor que esto: se salta directo a la posición del servidor. */
  snap: 2.5,
  /** Radio de colisión de la predicción. */
  radius: 0.2,
  /** Entradas recordadas a la espera de confirmación. */
  history: 90,
  /** Sin entrada de referencia: fracción del error que se corrige por paquete. */
  blindBlend: 0.25,
} as const;

const ease = (rate: number, dt: number) => 1 - Math.exp(-rate * Math.max(0, dt));

export interface MoveIntent { fx: number; fy: number; speed: number; grounded: boolean }

export class Predictor {
  x = NaN; y = NaN; vx = 0; vy = 0;
  /** Desfase visual que se desvanece tras una corrección. */
  offX = 0; offY = 0;
  private hist: { q: number; x: number; y: number }[] = [];
  get ready() { return Number.isFinite(this.x) && Number.isFinite(this.y); }

  reset(x: number, y: number, vx = 0, vy = 0) { this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.offX = this.offY = 0; this.hist = []; }

  /** Avanza la predicción un cuadro. `solid(x, y)` = hay pared. */
  step(dt: number, m: MoveIntent, solid: (x: number, y: number) => boolean) {
    if (!this.ready) return;
    const len = Math.max(1, Math.hypot(m.fx, m.fy)), k = ease(m.grounded ? PREDICT.accelGround : PREDICT.accelAir, dt);
    this.vx += (m.fx / len * m.speed - this.vx) * k; this.vy += (m.fy / len * m.speed - this.vy) * k;
    const r = PREDICT.radius, nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
    const free = (x: number, y: number) => !solid(x + r, y) && !solid(x - r, y) && !solid(x, y + r) && !solid(x, y - r);
    if (free(nx, this.y)) this.x = nx; else this.vx = 0;
    if (free(this.x, ny)) this.y = ny; else this.vy = 0;
    const d = ease(PREDICT.smooth, dt); this.offX -= this.offX * d; this.offY -= this.offY * d;
  }

  /** Recuerda dónde estaba la predicción cuando se envió la entrada `q`. */
  mark(q: number) { if (!this.ready) return; this.hist.push({ q, x: this.x, y: this.y }); if (this.hist.length > PREDICT.history) this.hist.shift(); }

  /**
   * El servidor dice que tras aplicar la entrada `ack` el jugador estaba en (sx, sy).
   * Devuelve el tamaño del error corregido.
   */
  reconcile(ack: number, sx: number, sy: number) {
    if (!Number.isFinite(sx) || !Number.isFinite(sy)) return 0;
    if (!this.ready) { this.reset(sx, sy); return 0; }
    const i = this.hist.findIndex(h => h.q === ack);
    if (i < 0) {
      // Sin referencia (entrada descartada o demasiado antigua): acercarse suavemente al servidor.
      if (this.hist.length && ack < this.hist[0]!.q) return 0;
      const ex = sx - this.x, ey = sy - this.y, e = Math.hypot(ex, ey);
      if (e > PREDICT.snap) { this.reset(sx, sy, this.vx, this.vy); return e; }
      const k = PREDICT.blindBlend; this.x += ex * k; this.y += ey * k; this.offX -= ex * k; this.offY -= ey * k;
      return e * k;
    }
    const h = this.hist[i]!, ex = sx - h.x, ey = sy - h.y, e = Math.hypot(ex, ey);
    this.hist.splice(0, i + 1);
    if (e > PREDICT.snap) { this.reset(sx, sy, this.vx, this.vy); return e; }
    if (e < 1e-4) return 0;
    this.x += ex; this.y += ey; this.offX -= ex; this.offY -= ey;
    for (const r of this.hist) { r.x += ex; r.y += ey; }
    return e;
  }

  /** Posición que se dibuja (predicción + desfase que se desvanece). */
  view() { return { x: this.x + this.offX, y: this.y + this.offY }; }
}
