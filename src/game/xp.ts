/** Experience tuning and per-run XP sources. Browser-safe. */
export type XpSource = 'enemigos' | 'combo' | 'zonas' | 'danio' | 'mercader' | 'misiones' | 'retos' | 'otros';

export const XP_SOURCES: Record<XpSource, { label: string; how: string }> = {
  enemigos: { label: 'Enemigos derrotados', how: 'Según la vida del enemigo; élite +25, minijefe +50, emboscados ×1.25.' },
  combo: { label: 'Golpes en combo', how: '2 XP por golpe, +1 cada 3 golpes seguidos (máx. +6).' },
  zonas: { label: 'Zonas despejadas', how: '25 XP × piso al limpiar una zona con enemigos.' },
  danio: { label: 'Daño recibido y sobrevivido', how: '1 XP por cada 5 de daño que aguantas, hasta 40 XP por piso.' },
  mercader: { label: 'Encargos del mercader', how: '20 XP + 10 por nivel de valoración al entregar el encargo.' },
  misiones: { label: 'Misiones secundarias', how: 'Su recompensa en fichas también se suma como XP.' },
  retos: { label: 'Retos y contratos', how: '80 XP por reto superado.' },
  otros: { label: 'Otros', how: 'Eventos, bonificaciones y alteraciones de zona.' },
};

/** XP needed to go from `level` to `level + 1`. Gentle quadratic curve (was ×1.35 per level). */
export const xpForLevel = (level: number) => Math.round(100 + 55 * (level - 1) + 6 * (level - 1) ** 2);

export const DAMAGE_XP = { per: 5, capPerFloor: 40 } as const;
/** XP for surviving `dmg` damage given what was already earned this floor. */
export const damageXp = (dmg: number, earnedThisFloor: number) => Math.max(0, Math.min(DAMAGE_XP.capPerFloor - earnedThisFloor, dmg / DAMAGE_XP.per));

export const merchantXp = (rating: number) => 20 + 10 * rating;
