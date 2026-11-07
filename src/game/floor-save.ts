/** Progreso del piso en curso (enemigos, cofres, puertas, objetivos). Browser-safe.
 * El piso se reconstruye con su semilla; luego se aplica este estado sobre los objetos originales (oid = índice al generar). */

export interface FloorState {
  v: 1; floor: number; seed: number;
  enemies: { oid: number; hp: number; extra?: Record<string, unknown> }[];
  spawned?: Record<string, unknown>[];
  map?: number[];
  pickups: { oid?: number; used?: boolean | undefined; locked?: boolean | undefined; armed?: boolean | undefined; extra?: Record<string, unknown> }[];
  doors: number[]; breakables: number[]; visited: string[]; cleared: string[]; seals: number[];
  flags: Record<string, unknown>;
}
type Oid = { oid?: number };
function savedEnemy(e: object) {
  return Object.fromEntries(Object.entries(e).filter(([k]) => !['cutFrames','chainHit','dodgedProj'].includes(k)).map(([k,v]) => [k, k === 'grabbed' ? false : v]));
}
interface Src {
  floor: number; floorSeed: number;
  enemies: (Oid & { dead: boolean; hp: number })[];
  pickups: (Oid & { used?: boolean | undefined; locked?: boolean | undefined; armed?: boolean | undefined; kind: string })[];
  doors: Set<number>; breakables: Set<number>; visitedZones: Set<string>; clearedZones: Set<string>; seals: Record<number, unknown>;
}
export const FLOOR_FLAGS = ["floorKills", "bossSpawned", "bossDead", "regionCollected", "mapDone", "restHealed", "exp", "contract", "arena", "collapse", "hazards", "bossFight", "floorDamage", "doorAnim"] as const;

export function captureFloor(g: Src): FloorState {
  const me = g as unknown as Record<string, unknown>;
  return JSON.parse(JSON.stringify({
    v: 1, floor: g.floor, seed: g.floorSeed,
    enemies: g.enemies.filter(e => !e.dead && e.oid !== undefined).map(e => ({ oid: e.oid, hp: e.hp, extra: savedEnemy(e) })),
    spawned: g.enemies.filter(e => !e.dead && e.oid === undefined).map(savedEnemy),
    map: me['map'] ? Array.from(me['map'] as Uint8Array) : undefined,
    // Objetos originales por índice; los soltados después se guardan completos (oro, armas, materiales).
    pickups: g.pickups.map(p => p.oid !== undefined ? { oid: p.oid, used: p.used, locked: p.locked, armed: p.armed }
      : ["item", "gold", "mat", "ammo", "food", "water", "key", "portal", "mapfrag", "shop"].includes(p.kind) ? { extra: { ...p } } : null).filter(Boolean),
    doors: [...g.doors], breakables: [...g.breakables], visited: [...g.visitedZones], cleared: [...g.clearedZones],
    seals: Object.keys(g.seals).map(Number),
    flags: Object.fromEntries(FLOOR_FLAGS.map(k => [k, me[k]])),
  }));
}

/** Aplica el estado si corresponde al mismo piso y semilla. Devuelve true si se aplicó. */
export function applyFloor(g: Src, s: FloorState | null | undefined): boolean {
  if (!s || s.v !== 1 || s.floor !== g.floor || s.seed !== g.floorSeed) return false;
  const alive = new Map(s.enemies.map(e => [e.oid, e.hp]));
  g.enemies = g.enemies.filter(e => e.oid === undefined || alive.has(e.oid));
  for (const e of g.enemies) if (e.oid !== undefined) {
    const saved = s.enemies.find(x => x.oid === e.oid);
    if (saved?.extra) Object.assign(e, saved.extra);
    const hp = alive.get(e.oid); if (hp !== undefined) e.hp = hp;
  }
  g.enemies.push(...(s.spawned ?? []).map(e => ({ ...e } as Src['enemies'][number])));
  const kept = new Map(s.pickups.filter(p => p.oid !== undefined).map(p => [p.oid, p]));
  const orig = g.pickups.filter(p => p.oid !== undefined && kept.has(p.oid));
  for (const p of orig) { const k = kept.get(p.oid); if (!k) continue; p.used = k.used; p.locked = k.locked; p.armed = k.armed; }
  g.pickups = [...orig, ...s.pickups.filter(p => p.extra).map(p => ({ ...p.extra } as Src["pickups"][number]))];
  g.doors = new Set(s.doors); g.breakables = new Set(s.breakables); g.visitedZones = new Set(s.visited); g.clearedZones = new Set(s.cleared);
  const keepSeals = new Set(s.seals); for (const k of Object.keys(g.seals)) if (!keepSeals.has(Number(k))) delete g.seals[Number(k)];
  const me = g as unknown as Record<string, unknown>;
  if (Array.isArray(s.map) && s.map.length === 1600 && me['map'] instanceof Uint8Array) me['map'].set(s.map);
  for (const k of FLOOR_FLAGS) if (k in s.flags) me[k] = s.flags[k];
  return true;
}
