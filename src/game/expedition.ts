// EXPEDITION COLLAPSE — browser-safe rules for the mandatory level sequence.
// Engine owns the live state; this module only decides phases, timings and hazards.

export type ExpeditionPhase = 1 | 2 | 3 | 4 | 5 | 6;
/** Portal silhouette and entry area share world dimensions across cameras. */
export const PORTAL = { height: 1.8, enterRadius: 1.35, interactRadius: 2, clearance: 3 } as const;
export const PHASE_NAMES: Record<ExpeditionPhase, string> = {
  1: "Exploración y documentación",
  2: "Descifrado y acceso",
  3: "Fragmento de mapa",
  4: "Exploración de la guarida",
  5: "Jefe",
  6: "Colapso y extracción",
};

export interface ExpeditionState {
  noteRead: boolean; // found the document with the code
  unlocked: boolean; // used the code on the sealed chamber
  hasMap: boolean; // picked the map fragment
  bossSpawned: boolean;
  bossDead: boolean;
  extracted: boolean;
}

export function expeditionPhase(s: ExpeditionState): ExpeditionPhase {
  if (s.bossDead) return 6;
  if (s.bossSpawned) return 5;
  if (s.hasMap) return 4;
  if (s.unlocked) return 3;
  if (s.noteRead) return 2;
  return 1;
}

/** The lair (boss room) only awakens its guardian once the map fragment is in hand. */
export function lairOpen(s: Pick<ExpeditionState, "hasMap">) { return s.hasMap; }

export const COLLAPSE = {
  baseSeconds: 150,
  perFloor: 12,
  minSeconds: 60,
  hazardEveryBase: 3.2, // seconds between debris at the start of the collapse
  hazardEveryMin: 0.9,
  warnSeconds: 1.35, // telegraph before debris lands
  debrisRadius: 0.9,
  debrisDamageBase: 6,
  debrisDamagePerFloor: 1.5,
  toxicEvery: 7,
};

/** Seconds to reach the portal. Deeper floors and harder difficulty (enemy damage multiplier) give less time. */
export function collapseSeconds(floor: number, difficultyDamage = 1) {
  const raw = COLLAPSE.baseSeconds - (floor - 1) * COLLAPSE.perFloor;
  const diff = 1 / Math.max(0.6, Math.min(1.6, difficultyDamage));
  return Math.round(Math.max(COLLAPSE.minSeconds, raw * Math.sqrt(diff)));
}

/** 0 → collapse just started, 1 → timer reached zero. */
export function collapseProgress(t: number, max: number) { return Math.max(0, Math.min(1, 1 - t / Math.max(1, max))); }

/** Hazards intensify as the timer runs out and with depth. */
export function hazardInterval(progress: number, floor: number) {
  const k = COLLAPSE.hazardEveryBase - (COLLAPSE.hazardEveryBase - COLLAPSE.hazardEveryMin) * progress - floor * 0.08;
  return Math.max(COLLAPSE.hazardEveryMin, k);
}

export function debrisDamage(floor: number) { return Math.round(COLLAPSE.debrisDamageBase + floor * COLLAPSE.debrisDamagePerFloor); }

/** Rule: extraction only happens when the player physically interacts with the portal before zero. */
/** Area falloff: full damage in the core, 35% at the edge, never above 18% of max HP per impact. */
export const DEBRIS_AREA = { coreRadius: 0.9, outerRadius: 1.6, edgeFactor: 0.35, maxHpShare: 0.18 };
export function debrisAreaDamage(floor: number, dist: number, hpMax: number) {
  const { coreRadius, outerRadius, edgeFactor, maxHpShare } = DEBRIS_AREA;
  if (dist >= outerRadius) return 0;
  const k = dist <= coreRadius ? 1 : 1 - (1 - edgeFactor) * (dist - coreRadius) / (outerRadius - coreRadius);
  return Math.max(1, Math.round(Math.min(debrisDamage(floor) * k, hpMax * maxHpShare)));
}
/** Collapse reinforcements: grace period, interval tightening with progress, capped alive count. */
export const COLLAPSE_SPAWN = { grace: 20, startEvery: 25, endEvery: 18, baseCap: 1, maxCap: 2, lowHpShare: 0.25 };
export function collapseSpawnInterval(progress: number) { const { startEvery, endEvery } = COLLAPSE_SPAWN; return startEvery - (startEvery - endEvery) * Math.min(1, Math.max(0, progress)); }
export function collapseSpawnCap(floor: number) { return Math.min(COLLAPSE_SPAWN.maxCap, COLLAPSE_SPAWN.baseCap + Math.floor(floor / 4)); }
/** Near-player reinforcements pause while the player is badly hurt (portal guards still appear). */
export function canSpawnNearPlayer(alive: number, floor: number, hp: number, hpMax: number) { return alive < collapseSpawnCap(floor) && hp > hpMax * COLLAPSE_SPAWN.lowHpShare; }

export function canExtract(collapseActive: boolean, t: number, playerNearPortal: boolean) {
  return collapseActive && t > 0 && playerNearPortal;
}

export const COLLAPSE_WARNINGS = [
  { at: 0.25, text: "LAS PAREDES SANGRAN TINTA" },
  { at: 0.5, text: "EL TECHO CEDE · CORRE AL PORTAL" },
  { at: 0.75, text: "EL MUNDO SE BORRA" },
  { at: 0.9, text: "ÚLTIMOS SEGUNDOS" },
];

/** Persistent floor darkening: map taken < boss slain, each palimpsest misread adds a bit. */
export const DREAD = { map: 0.28, boss: 0.5, misread: 0.12, max: 0.72 } as const;
export function dreadLevel(hasMap: boolean, bossDead: boolean, misreads: number): number {
  const base = bossDead ? DREAD.boss : hasMap ? DREAD.map : 0;
  return Math.min(DREAD.max, base + misreads * DREAD.misread);
}

/** Refuge portal spot: the free cell farthest from benches, decor, merchant and other objects. */
export function refugePortalSpot(cands: { x: number; y: number }[], busy: { x: number; y: number }[]): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null, bestD = -1;
  for (const c of cands) {
    const d = busy.length ? Math.min(...busy.map(b => Math.hypot(b.x - c.x, b.y - c.y))) : 99;
    if (d > bestD) { bestD = d; best = c; }
  }
  return best && bestD >= PORTAL.clearance ? best : null;
}
