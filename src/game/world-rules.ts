// Browser-safe geometry and progression rules, shared by simulation and tests.
import { projectileHitsBody } from "./hitbox";
export const BODY_RADIUS = 0.25;
export const BODY_HEIGHT = 0.65;
/** Jump physics and the solid ceiling shared by movement and level-design checks. */
export const JUMP = { ground: 6.5, air: 6, gravity: 18, ceiling: 2.4 };
export const jumpApex = (vz: number, g = JUMP.gravity) => vz * vz / (2 * g);
/** Highest standing height reachable from z with a ground jump plus `air` extra jumps, capped by the ceiling. */
export function reachHeight(z: number, air = 1, bodyH = BODY_HEIGHT) {
  return Math.min(JUMP.ceiling - bodyH, z + jumpApex(JUMP.ground) + air * jumpApex(JUMP.air));
}
/** Clamp a body to the ceiling: returns the corrected z and whether the head hit. */
export function clampCeiling(z: number, bodyH: number) {
  const top = JUMP.ceiling - 0.04 - bodyH; return z > top ? { z: top, hit: true } : { z, hit: false };
}
/** Low profile while crouching/sliding: shorter body fits crawl ducts and is harder to hit. */
export const LOW_PROFILE = { height: 0.34, hitRadius: 0.24, standRadius: 0.4, meleeReach: 1.35, standReach: 1.8, meleeRollPenalty: 3 };
export function playerHitbox(low: boolean) {
  return low ? { height: LOW_PROFILE.height, radius: LOW_PROFILE.hitRadius, reach: LOW_PROFILE.meleeReach, rollPenalty: LOW_PROFILE.meleeRollPenalty }
    : { height: BODY_HEIGHT, radius: LOW_PROFILE.standRadius, reach: LOW_PROFILE.standReach, rollPenalty: 0 };
}
/** Whether an enemy shot at height z, distance d from the player's feet pz, hits the body. */
export function projectileHitsPlayer(low: boolean, pz: number, z: number, d: number, projR?: number) {
  const b = playerHitbox(low); return projectileHitsBody(low, pz, b.height, z, d, projR);
}
export function cellVolume(cell: number): [number, number] | null {
  if (cell === 0) return null;
  if (cell === 5) return [0, 0.72];
  if (cell === 7) return [0, 0.36];
  if (cell === 8) return [0, 1.08];
  if (cell === 9) return [0.9, 2.4]; // Beam with a traversable opening beneath.
  if (cell === 11) return [0.42, 2.4]; // Crawl duct: only a crouching/sliding body fits beneath.
  if (cell === 10) return [0, 1.1]; // Breakable rubble cover, never a sealed wall.
  return [0, 2.4];
}
export function combatXpMultiplier(combo: number, streak: number) {
  return 1 + Math.min(1, Math.max(0, combo) * 0.08) + Math.min(1.5, Math.max(0, streak - 1) * 0.25);
}
export type DoorSeal = { kind: 'key' | 'code' | 'kills' | 'health' | 'level' | 'boss'; value: number; code?: string; solved?: boolean; group?: number[] };
export function sealSatisfied(seal: DoorSeal, state: { keys: number; kills: number; hp: number; hpMax: number; level: number; bossDead: boolean }) {
  if (seal.solved) return true;
  switch (seal.kind) {
    case 'key': return state.keys > 0;
    case 'code': return false;
    case 'kills': return state.kills >= seal.value;
    case 'health': return state.hp >= state.hpMax * seal.value;
    case 'level': return state.level >= seal.value;
    case 'boss': return state.bossDead;
  }
}
// Breakable scenery: some props hide loot, others burst into bleeding splinters.
export const STURDY_PROPS = ['fountain', 'tree', 'dead_tree', 'hole', 'crack', 'healing_brazier', 'fire', 'rocks', 'pebbles'];
export const REWARD_PROPS = ['flowerpot', 'skeleton', 'litter'];
export const SPLINTER_PROPS = ['bench', 'target', 'small_pillar', 'plant'];
export const SPLINTER = { radius: 1.6, damage: 3, bleed: 3 };
export type PropOutcome = 'reward' | 'splinters' | 'scatter' | 'none';
export function propBreakOutcome(deco: string, roll: number): PropOutcome {
  if (STURDY_PROPS.includes(deco)) return 'none';
  if (deco === 'crate') return roll < 0.6 ? 'reward' : 'splinters';
  if (REWARD_PROPS.includes(deco)) return roll < 0.7 ? 'reward' : 'scatter';
  if (SPLINTER_PROPS.includes(deco)) return 'splinters';
  if (roll < 0.25) return 'reward';
  if (roll > 0.88) return 'splinters';
  return 'scatter';
}
/** Per-level stat growth on top of chosen level perks. */
export function levelBonus(level: number) {
  const l = Math.max(0, level - 1);
  return { hp: l * 4, stam: Math.floor(l / 2), damage: 1 + l * 0.04 };
}
/** Powder kegs: shooting/hitting detonates them; walking up and pressing E steals bombs instead. */
export const POWDER_KEG = { radius: 3.2, steal: [1, 2] as const, reach: 1.3 };
export const kegDamage = (floor: number) => 28 + floor * 6;
/** Enemies left at or under this share of HP by a hit become "exposed" for an execution (E rob / V kick). */
export const EXPOSE = { hpShare: 0.25, seconds: 4, kickAmmo: 6, kickHeal: 10, robAmmo: 3, robHeal: 5 };
export function propMaterial(deco: string): 'wood' | 'stone' | 'bone' | 'plant' {
  if (['crate', 'bench', 'target', 'litter', 'powder'].includes(deco)) return 'wood';
  if (['skeleton', 'bones'].includes(deco)) return 'bone';
  if (['plant', 'vegetation', 'leaves'].includes(deco)) return 'plant';
  return 'stone';
}
// Group synergy rules for the newer enemy roster.
export const SQUAD = { shieldArc: Math.PI / 3, shieldCut: 0.25, guardRadius: 2.5, guardCut: 0.2, healRadius: 6, healShare: 0.25, drumRadius: 7, drumSeconds: 5, drumSpeed: 1.35, drumCut: 0.3, packBonus: 0.2, packMax: 2, hookPull: 9, flankBonus: 1.5, screamRadius: 14, screamSeconds: 4, slamRadius: 3.2, bulwarkRadius: 3, zealotHp: 0.35, zealotRadius: 2.4, sniperRange: 13, summonMax: 3, inkSeconds: 3, inkDamage: 1.25, bannerRadius: 6, songPull: 7, leechPoison: 1.5, sporeRadius: 3, mechanical: ['vigia', 'automata', 'ballestero', 'relojero'] as string[] };
// La tinta de la tejedora debilita: todo daño recibido sube mientras dure.
export const inkFactor = (inked: number) => (inked > 0 ? SQUAD.inkDamage : 1);
// Ataque por la espalda: el acechador hace más daño si el jugador le da la espalda.
export const backstab = (playerAng: number, ex: number, ey: number, px: number, py: number) => { const a = Math.atan2(ey - py, ex - px); let d = a - playerAng; d = Math.atan2(Math.sin(d), Math.cos(d)); return Math.abs(d) > Math.PI * 0.6; };
/** True when the attacker stands inside the shield-bearer's frontal arc. */
export function shieldBlocks(face: number, ex: number, ey: number, ax: number, ay: number) {
  let d = Math.atan2(ay - ey, ax - ex) - face; d = Math.atan2(Math.sin(d), Math.cos(d));
  return Math.abs(d) <= SQUAD.shieldArc;
}
/** Damage multiplier an enemy takes given its own shield and nearby allied support. */
export function squadDamageFactor(o: { shield: boolean; guarded: boolean; drummed: boolean }) {
  let f = 1; if (o.shield) f *= SQUAD.shieldCut; if (o.guarded) f *= 1 - SQUAD.guardCut; if (o.drummed) f *= 1 - SQUAD.drumCut; return f;
}
export const packSpeed = (packmates: number) => 1 + Math.min(SQUAD.packMax, packmates) * SQUAD.packBonus;
/** Drummer's d6: 1 fails, 2-5 frenzy, 6 frenzy plus heal. */
export const drumRoll = (roll: number) => roll <= 1 ? "fail" : roll >= 6 ? "jackpot" : "frenzy";
