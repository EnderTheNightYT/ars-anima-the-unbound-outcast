/**
 * Hitbox ajustada a la silueta real del sprite de El Desconocido (medida sobre el atlas 8 direcciones).
 * El cuerpo se divide en tres tramos de altura con su propio radio: piernas, torso (con brazos/capa) y cabeza.
 * Browser-safe: la usan el motor de un jugador, el servidor de salas (PvP) y las pruebas.
 */
export const SILHOUETTE = {
  /** [fracción de altura donde empieza el tramo, radio horizontal en unidades de mundo]. */
  standing: [[0, .13], [.45, .16], [.8, .11]] as const,
  low: [[0, .15], [.6, .12]] as const,
  /** Margen vertical: los pies tocan el suelo, la cabeza no tiene "aire" por encima. */
  above: .02,
  /** Radio por defecto de una bala/flecha enemiga cuando no informa tamaño. */
  projectile: .04,
};

export function silhouetteRadius(low: boolean, frac: number) {
  const prof = low ? SILHOUETTE.low : SILHOUETTE.standing;
  let r: number = prof[0][1];
  for (const [f, rad] of prof) if (frac >= f) r = rad;
  return r;
}

/** ¿Un proyectil a altura z, a distancia horizontal d del eje del cuerpo, toca la silueta? */
export function projectileHitsBody(low: boolean, pz: number, height: number, z: number, d: number, projR = SILHOUETTE.projectile) {
  if (z < pz - projR || z > pz + height + SILHOUETTE.above + projR) return false;
  const frac = Math.max(0, Math.min(1, (z - pz) / height));
  return d < silhouetteRadius(low, frac) + projR;
}

/** Distancia mínima entre un segmento (x0,y0)->(x1,y1) y un punto. */
export function segPointDist(x0: number, y0: number, x1: number, y1: number, px: number, py: number) {
  const sx = x1 - x0, sy = y1 - y0, l2 = sx * sx + sy * sy;
  const t = l2 > 1e-9 ? Math.max(0, Math.min(1, ((px - x0) * sx + (py - y0) * sy) / l2)) : 0;
  return Math.hypot(x0 + sx * t - px, y0 + sy * t - py);
}

/** Contacto barrido de un proyectil contra la silueta (sin atravesar el cuerpo entre fotogramas). */
export function sweptProjectileHits(low: boolean, pz: number, height: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, bx: number, by: number, projR = SILHOUETTE.projectile) {
  const sx = x1 - x0, sy = y1 - y0, l2 = sx * sx + sy * sy;
  const t = l2 > 1e-9 ? Math.max(0, Math.min(1, ((bx - x0) * sx + (by - y0) * sy) / l2)) : 0;
  const d = Math.hypot(x0 + sx * t - bx, y0 + sy * t - by), z = z0 + (z1 - z0) * t;
  return projectileHitsBody(low, pz, height, z, d, projR);
}

/**
 * Golpe cuerpo a cuerpo de un atacante contra la silueta: el filo debe llegar al borde del cuerpo
 * (no al centro de una caja grande) y el cuerpo debe estar dentro del arco real del golpe.
 * `reach` = alcance del arma medido desde el borde del atacante.
 */
export function meleeReachesBody(o: { dist: number; attackerRadius: number; reach: number; angleOff: number; halfArc: number; low: boolean }) {
  const r = silhouetteRadius(o.low, .55);
  if (o.dist - r - o.attackerRadius > o.reach) return false;
  const widen = Math.atan2(r, Math.max(.05, o.dist));
  return Math.abs(o.angleOff) <= o.halfArc + widen;
}
