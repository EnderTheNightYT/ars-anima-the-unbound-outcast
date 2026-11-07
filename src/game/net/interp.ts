/**
 * Interpolación de entidades remotas (compañeros, enemigos) a partir de muestras del servidor.
 * Se dibuja un poco en el pasado (`INTERP.delay`) para tener siempre dos muestras entre las que
 * interpolar: el movimiento queda fluido aunque los paquetes lleguen a saltos.
 */
export const INTERP = {
  /** Retraso de dibujo (s): ~2 paquetes rápidos de 20 Hz + margen de fluctuación. */
  delay: 0.11,
  /** Extrapolación máxima (s) cuando faltan paquetes. */
  maxExtrapolate: 0.2,
  /** Muestras guardadas por entidad. */
  keep: 8,
  /** Salto mayor que esto = teletransporte: no se interpola. */
  snap: 4,
} as const;

export interface Sample { t: number; x: number; y: number; z: number }

export class Track {
  samples: Sample[] = [];
  push(t: number, x: number, y: number, z: number) {
    if (![t, x, y, z].every(Number.isFinite)) return;
    const last = this.samples.at(-1);
    if (last && t <= last.t) { if (t === last.t) { last.x = x; last.y = y; last.z = z; } return; }
    if (last && Math.hypot(x - last.x, y - last.y) > INTERP.snap) this.samples = [];
    this.samples.push({ t, x, y, z });
    if (this.samples.length > INTERP.keep) this.samples.splice(0, this.samples.length - INTERP.keep);
  }
  /** Posición en el instante `t` del reloj del servidor. */
  at(t: number): Sample | null {
    const s = this.samples; if (!s.length) return null;
    const first = s[0]!;
    if (t <= first.t || s.length === 1) return first;
    for (let i = s.length - 1; i > 0; i--) {
      const a = s[i - 1]!, b = s[i]!;
      if (t >= a.t && t <= b.t) { const k = (t - a.t) / Math.max(1e-6, b.t - a.t); return { t, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k }; }
    }
    // Más allá de la última muestra: extrapolar poco con la última velocidad conocida.
    const a = s[s.length - 2]!, b = s[s.length - 1]!, span = Math.max(1e-6, b.t - a.t), ahead = Math.min(INTERP.maxExtrapolate, t - b.t);
    return { t, x: b.x + (b.x - a.x) / span * ahead, y: b.y + (b.y - a.y) / span * ahead, z: b.z + (b.z - a.z) / span * ahead };
  }
}

/** Reloj del servidor estimado en el cliente (filtro que favorece los paquetes más rápidos). */
export class ServerClock {
  private offset = NaN;
  /** `serverT`: reloj del servidor en el paquete; `localT`: segundos locales al recibirlo. */
  observe(serverT: number, localT: number) {
    if (!Number.isFinite(serverT)) return;
    const o = localT - serverT;
    if (!Number.isFinite(this.offset) || Math.abs(o - this.offset) > 1) this.offset = o;
    // Paquetes que llegan antes de lo esperado bajan el desfase enseguida; los tardíos, despacio.
    else this.offset += (o - this.offset) * (o < this.offset ? 0.3 : 0.02);
  }
  now(localT: number) { return Number.isFinite(this.offset) ? localT - this.offset : NaN; }
  get ready() { return Number.isFinite(this.offset); }
}
