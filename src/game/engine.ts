// @ts-nocheck
import { applyFloor, captureFloor, type FloorState } from "./floor-save";
import { ChronicleKeeper, type Metric } from './chronicles';
import { readPlayer } from './run-save';
import { readStats, recordStat, recordBoss } from './statistics';
import { docById } from './palimpsest-data';
import { rollEnemyLoot } from './enemy-loot';
import { CARRY_LIMIT, SUPPLY_WEIGHT, carryWeight, itemWeight, itemPrice, sellPrice, fitsCarry } from './carry';
import { subclasses, subclassMods } from './subclasses';
import { RUN_FIELDS, writeRunSave, clearRunSave, pushHistory, type FloorRecord, type RunRecord, type RunSave } from "./run-save";
import { barkLine, BARK_RULES, BARK_SECONDS, BARK_MAX_ACTIVE, type BarkEvent } from "./barks";
import { RHYTHM, wantsFloorMusic } from "./beat";
import { EVADE, evadeChance, evadeStyle, evadeMotion, type EvadeStyle, RETREAT, retreatChance, PERFECT_BLOCK, meleeStyle, KICK, kickDamage, BULLET_MARKS, type MeleeStyle } from "./combat-fx";
import { CHAINS, HOLD_DIST, nextComboStep, comboStep, isFinisher, comboSwingMult, type ComboStep } from "./melee-combo";
import { getDifficulty, adaptOnHurt, adaptOnKill, challenge, performanceDelta, dodgeNotice, clampAdapt, PERF, type Difficulty, type DodgeReason, type DodgeMsgMode } from "./difficulty";
import {
  AFFIXES, AffixId, CLASSES, ClassDef, ELITE_AFFIXES, ENEMY_TYPES, EnemyKind, EPIPHANIES, Epiphany,
  Item, MATERIALS, modD120, PACTS, Pact, RARITY, RECIPES, SKILLS, WEAPONS, WEATHERS, EVENTS, BODY_PARTS,
} from "./data";
import { ALL_SUFFIXES, forgeBase, variantsFor, weaponName, starterStats } from "./weapon-forge";

import { clampPitch, verticalRay, projectHeight, shotRange, smoothFactor, stepWalkSway } from "./camera";
import { floorPressure } from "./progression";
import { weaponLevel, canUseWeapon } from './weapon-access';
import { classMods, forbiddenZoneLevel, FORBIDDEN, passivesUnlockedAt, passiveReward } from './class-passives';
import { xpForLevel, damageXp, merchantXp, type XpSource } from './xp';
import { playerRating, playerScore, forbiddenEnemyLevel, forbiddenHpMult } from './balance';
import { SWAP, nextSwapStacks, swapDamageMult, swapStaggers } from './weapon-swap';
import { IMPACT, bodyDamage, wallSlamDamage, wallBounceSpeed, chainChance, transferSpeed, downedBonus } from './impact';
import { RICOCHET, segmentContact } from './ricochet';
import { MERCHANT_TALKS, createMerchantQuest, advanceMerchantQuest, merchantReward, type MerchantQuest } from './merchant-quests';
import { nextIdentityRevelation, normalizeIdentitySeen, type IdentityId } from './merchant-identity';
import { evolution, threatLevel, newTraits, TRAIT_LABEL, type Trait } from "./evolution";
import { meleeMode, meleeContains, aimedReady, rewardRarity } from "./weapon-modes";
import { makeFrames, type Pose } from "./animation";
import { FRAGMENT, fragmentImpact, fragmentRandom, fragmentMotion, chipCut, cropFragment, damagedSprite, type Cut, type FragmentHit } from './enemy-fragments';
import { FEUD, pickFeud, ascend } from './feuds';
import { skillFor, chargeSkill, type ChargeKind, skillUnlocked, unlockText, unlockOf, skillOptions, type RunProgress } from './class-skills';
import { visibleBounds, yieldToBrowser, type SpriteImage } from './render-performance';
import { rangedProfile, volleyOffsets, falloffMult, STAMINA, DASH, SPRINT_MULT, regenHeal, REGEN, HEAVY, KNOCKDOWN_SECONDS, addSanity, sanityChance, SANITY_FX, damageCause, type RangedProfile, type SanityEvent, type SanityFx, type ShotSprite } from "./combat-fx";
import { ScoreKeeper, SCORE, PENALTY, type Recap } from "./score";
import { frenzy, frenzyWindow, OPENING, NEEDS, needPenalty, LUMBRE_REGEN, MIRROR_BUFFS, MIRROR, mirrorPick, rollAttributes, ATTR_UP, type MirrorBuffId } from "./momentum";
import { normalizeQuest, type ActiveQuest, type Quest } from "./quests";
import { regionForFloor, regionEnemies } from "./regions";
import { enemyCap } from "./enemy-cap";
import { buildRoomTiles, puddleAt } from "./render-cache";
import { legible, enemyRim, actorFog, isLiveSprite, LEGIBILITY, RIM } from "./sprite-legibility";
import type { Sound } from "./audio";
import { PROP_SCALE } from "./props";
import { addPuddle, castShadow, enemyGlow, FLAME_DECOS, flameFlicker, flyerDone, GIB, launchFrom, PLANT_DECOS, shatterFlyer, speedFx, stepFlyer, stepGib, swayAmount, fountainDrop, FOUNTAIN, type Flyer, type Gib, type Puddle, type ShadowLight } from "./world-fx";
import { GUIDE, compassWord } from "./guide";
import { motionBurst, STEP_INTERVAL, dripRate, drip, splash, type MotionEvent } from "./motion-fx";
import { explosionFrame, EXPLOSION_DURATION } from "./explosion-sprites";
import { sceneryTheme, LIGHTS, type ScenicProp } from './scenery';
import { MAT, NRM, type FrameCamera, type FrameLight } from './gfx/frame';
import { ALTERATIONS, type Alteration } from "./alterations";
import { MISREAD, shouldSummonMisread } from "./palimpsest";
import { expeditionPhase, PHASE_NAMES, collapseSeconds, collapseProgress, hazardInterval, debrisDamage, COLLAPSE, COLLAPSE_WARNINGS, lairOpen, DEBRIS_AREA, debrisAreaDamage, COLLAPSE_SPAWN, collapseSpawnInterval, collapseSpawnCap, canSpawnNearPlayer, dreadLevel, refugePortalSpot } from "./expedition";
import { loadPalimpsest, savePalimpsest, pickBook, pickFolio, nextUnfound, runBonuses, consumeTabula, mementoFactor, type PalimpsestState } from "./palimpsest";
import { ensureWear, failChance, applyWear, wearDamage, WEAR, repairCost, repairGold, repair, upgradeCost, upgradeGold, upgrade, canUpgrade, enchantCost, enchantGold, enchant, canEnchant, payCost } from "./weapon-wear";
import { loadCamera, saveCamera, topZoom, type CameraSettings } from "./camera-view";
import { spriteDir, pickAction, bodyFacing, atlasCell, spriteMotion, composeFrame, playerAtlas, remoteFrame, PLAYER_SPRITE_SCALE, CELL_H } from "./player-sprite";
import type { RemoteView, NetMark } from "./net/view";
import { BOSS_ARENA, arenaScorePenalty, rubbleDamage, summonInterval, canSlam, slamArc, slamCloud } from "./boss-arena";
import { fallingRubbleHits, rubbleHeight, RUBBLE_FALL, type FallingRubble } from "./falling-rubble";
import { ROLES, ROLE_LABEL, rollEnemyRole, cloudPattern, type EnemyRole } from "./enemy-roles";
import { makeDmgNum, stepDmgNums, dmgNumLook, DMG_NUM, type DmgNum } from "./dmg-numbers";
import { sweptProjectileHits, meleeReachesBody } from "./hitbox";
import * as PX from "./pariah-runtime";
import { newPickupAnimation, PICKUP_DURATION, drawPickup } from "./pickup-animation";
import { PORTAL } from './expedition';
import { isPariah, PARIAH_WEAPONS, pariahXp, growthAttrs, PARIAH } from "./pariah";
import { BODY_RADIUS, BODY_HEIGHT, cellVolume, playerHitbox, projectileHitsPlayer, LOW_PROFILE, JUMP, clampCeiling, combatXpMultiplier, sealSatisfied, type DoorSeal, propBreakOutcome, SPLINTER, levelBonus, POWDER_KEG, kegDamage, EXPOSE, propMaterial, SQUAD, shieldBlocks, squadDamageFactor, packSpeed, drumRoll, backstab, inkFactor } from "./world-rules";

export const W = 320, H = 200;
const MAP = 40;
const STEP_UP = .4; // max ledge height walked onto without jumping (stairs are .36 per step)
const TEX = 128;

export interface Input {
  mx: number; my: number; lookX: number; lookY: number;
  jump: boolean; dash: boolean; slide: boolean; attack: boolean; alternate: boolean; sprint: boolean;
  interact: boolean; finisher: boolean; grab: boolean; kick: boolean; swap: boolean; nova: boolean; bomb: boolean; skill?: boolean;
  block: boolean; parry: boolean; reload: boolean; pact: boolean; sneak: boolean; pound: boolean;
}
export const emptyInput = (): Input => ({ mx: 0, my: 0, lookX: 0, lookY: 0, jump: false, dash: false, slide: false, attack: false, alternate: false, sprint: false, interact: false, finisher: false, grab: false, kick: false, swap: false, nova: false, bomb: false, block: false, parry: false, reload: false, pact: false, sneak: false, pound: false });

interface Enemy {
  spriteCuts?: Cut[]; cutFrames?: WeakMap<SpriteImage, SpriteImage>; shattered?: boolean; fragmentHits?: number;
  id: number; kind: EnemyKind; x: number; y: number; z: number; vz: number; hp: number; hpMax: number; def: number;
  brk: number; brkMax: number; stagger: number; cd: number; tele: number; hurt: number; elite?: string;
  kx: number; ky: number; burn: number; poison: number; bleed: number; dead: boolean; state: number; t: number; grabbed?: boolean; phase: number; barkCd?: number;
  aware?: boolean; stun?: number; face?: number; notice?: number; stolen?: boolean; variant?: string;
  miniBoss?: boolean; rival?: number | undefined; tyrant?: boolean; ambushed?: boolean; breachCd?: number; exposed?: number; exposedOnce?: boolean; buff?: number; teleMax?: number;
  role?: EnemyRole; fuse?: number; gunCd?: number; burstLeft?: number; burstT?: number; lobCd?: number; cloudCd?: number;
  downT?: number; alertT?: number; atkA?: number; stuckT?: number; stuckN?: number; flowT?: number; evadeT?: number; evadeA?: number; evadeCd?: number; evadeMax?: number; evadeStyle?: EvadeStyle; evading?: boolean; dodgedProj?: Set<object>; detourT?: number; detourA?: number; wasAware?: boolean; lvl?: number; traits?: Trait[]; trickCd?: number; retreatT?: number; retreatMax?: number; retreatA?: number; retreatCd?: number; chain?: number; chainHit?: Set<number>; embedT?: number; unstuckJumps?: number; surge?: boolean; misread?: boolean; misreadT?: number;
  ambush?: { source: string; stage: "hidden" | "warning" | "strike"; timer: number; cover?: number; tx?: number; ty?: number; door?: number; room?: string };
  /** Multijugador: el servidor sólo mueve al enemigo durante el turno de simulación de su jugador objetivo. */
  netSkip?: boolean; netOwner?: string;
  /** P.A.R.I.A.H: sangrado propio y si el último golpe fue cuerpo a cuerpo. */
  pxBleed?: number; pxBleedTick?: number; lastMelee?: boolean;
}
interface Proj { blast?: number; lob?: boolean; cloud?: boolean; sprite?: ShotSprite; size?: number; bounces?: number; wave?: number; falloff?: boolean; ox?: number; oy?: number; range?: number; weapon?: Item; attackMult?: number; precision?: boolean; hitIds?: Set<number>; x: number; y: number; z: number; dx: number; dy: number; dz?: number; life: number; dmg: number; friendly: boolean; color: string; pierce?: boolean; bomb?: boolean }
interface Pickup { x: number; y: number; kind: "note" | "decor" | "item" | "mat" | "gold" | "chest" | "shop" | "trap" | "altar" | "portal" | "food" | "water" | "ammo" | "key" | "lore" | "sanctuary" | "pactstone" | "palimpsest" | "folio" | "mapfrag" | "cipherlock"; item?: Item; mat?: string; n?: number; armed?: boolean; used?: boolean; locked?: boolean; deco?: string; text?: string; code?: string; quality?: number; vault?: boolean; z?: number; bob: number }
interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; color: string; size: number; water?: boolean; drop?: boolean; soft?: boolean }
interface Debris extends FallingRubble {}
export interface FloatText { text: string; color: string; t: number; x: number; y: number; hurt?: boolean }

type Mode = "title" | "play" | "menu" | "dead" | "choice" | "won" | "recap" | "erased";
export interface Choice { title: string; dialogue?: string; options: { name: string; desc: string; apply: () => void }[] }

let UID = 1;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const ri = (a: number, b: number) => Math.floor(rnd(a, b + 1));
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
const d = (n: number, s: number) => { let t = 0; for (let i = 0; i < n; i++) t += ri(1, s); return t; };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Ground loot that should call attention: consumables, crafting materials, weapons, fichas, keys. */
export const GRABBABLE = new Set(["item","mat","gold","food","water","ammo","key"]);
/** Slow float, quick pulse, spin around the vertical axis (sprite width = |cos|) and periodic glint. */
export function grabFx(time: number, seed: number) {
  const spinC = Math.cos(time * 2.4 + seed * 7);
  return { lift: .1 + Math.sin(time * 1.3 + seed * 5) * .06, pulse: 1 + Math.sin(time * 9 + seed * 3) * .1, spin: Math.max(.12, Math.abs(spinC)), flash: Math.abs(spinC) > .97 };
}
export class Game {
  mode: Mode = "title";
  erasedAt = 0;
  score = new ScoreKeeper(); recap: Recap | null = null; recapChecks: { label: string; ok: boolean }[] = []; merchantCd = 90; floorDamage = 0; mapDone = false; secretSeen = new Set<string>(); lastDefT = -9; needSpread = false; needWarn = { food: 100, thirst: 100 };
  menuTab = "personaje";
  /** Entrada de la wiki a abrir (p. ej. "weapon:ESPADA", "enemy:sombra", "world:Cofre"). */
  wikiFocus = ""; wikiFocusKey = 0;
  openWiki(id: string) { this.wikiFocus = id; this.wikiFocusKey++; this.menuTab = "wiki"; if (this.mode === "play") this.mode = "menu"; this.onUI(); }
  choice: Choice | null = null;
  cls: ClassDef = CLASSES[0];
  map: Uint8Array = new Uint8Array(MAP * MAP); // 0 floor 1 wall 2 pillar 3 secret 4 wall2
  floor = 1;
  // player
  px = 2.5; py = 2.5; pz = 0; vz = 0; ang = 0; pitch = 0; vx = 0; vy = 0;
  jumps = 0; dashT = 0; dashCd = 0; dashes = 2; slideT = 0; wallT = 0; onWall = false; wallNx = 0; wallNy = 0;
  crouching = false; poundZ = 0; swapStacks = 0; swapT = 0; sinceHit = 99; vaultDoors = new Set<number>();
  aiming = false; aimT = 0; aimBlend = 0; attackAlternate = false; swingMax = .25; hitGrace = 0;
  chargeT = 0; attackCd = 0; swingT = 0; stampede = 0; shieldEnemy: Enemy | null = null; shieldT = 0; slowmo = 0;
  level = 1; xp = 0; xpNext = 100; sp = 1; gold = 30; anima = 0;
  // Ars Anima: Grado, Ciclos y Estado del Alma son ejes separados del nivel de experiencia.
  grado = 1; mt = 0; cycles = 0; resonance = 0; mastery = 0; mtAwardedRun = false;
  difficulty: Difficulty = getDifficulty("normal"); adapt = 1; evadeMsgAt = -9; dodgeMsgs: DodgeMsgMode = "todos"; perfT = 0; perfDmg = 0; perfKills = 0;
  get chal() { return challenge(this.difficulty, this.adapt); }
  hp = 50; hpMax = 50; stam = 10; stamMax = 10; mh = 8; mhMax = 8; lumbre = 4; lumbreMax = 4; def = 10; breakValue = 0; breakMax = 6; capacity = 5;
  playerStagger = 0; breakDelay = 0; blocking = false; perfectBlockT = 0; parryT = 0; parryCd = 0; reloadT = 0; reloadProgress = 0;
  activePact: { id: string; t: number; hits: number; failed?: boolean } | null = null; pactCooldowns: Record<string, number> = {}; pactBaneT = 0; epiphanyLastStand = false; detectionRadius = 10;
  food = 100; thirst = 100; ammo = 30; bombs = 1; keys = 0;
  wounds: Record<string, number> = {}; burn = 0; poison = 0; bleed = 0;
  skills = new Set<string>(); pacts: Pact[] = []; epiph: Epiphany[] = [];
  bag: Item[] = []; mats: Record<string, number> = {}; cons: Record<string, number> = { venda: 1, antidoto: 0, racion: 1, agua: 1, tonico: 0 };
  melee!: Item; ranged!: Item; armor: Item | null = null; slot = 0;
  combo = 0; comboT = 0; kills = 0; meleeStep = 0; meleeLast = -9;
  levelPerks = { hp: 0, dmg: 0, stam: 0 };
  hitDirs: { a: number; t: number }[] = [];
  dmgNums: DmgNum[] = [];
  // world
  enemies: Enemy[] = []; projs: Proj[] = []; pickups: Pickup[] = []; parts: Particle[] = []; marks: { x: number; y: number; z: number; t: number }[] = []; debris: Debris[] = []; flyers: Flyer[] = []; gibs: Gib[] = []; puddles: Puddle[] = []; fxAcc = 0; dripAcc = 0; stepFxT = 0;
  explosions: { x: number; y: number; z: number; t: number }[] = [];
  floats: FloatText[] = []; log: string[] = [];
  chronicles = new ChronicleKeeper();
  extractionConditions: Record<string, boolean | number | string> = {};
  chronicleAttempt = 0; chronicleZone = "";
  track(kind: Metric, amount = 1, context = '', conditions = {}, id?: string) { if (kind === 'kills' || kind === 'bosses' || kind === 'secrets' || kind === 'puzzles' || kind === 'pacts') this.bumpSkillRun(kind, amount); return this.chronicles.event(kind, amount, context, conditions, id ? `${this.chronicleAttempt}:${id}` : undefined, this.floor); }
  runFloors: FloorRecord[] = []; runName = ""; runId = ""; resumed = false; uidFloor = 1;
  barks: { e: Enemy; ev?: BarkEvent; text: string; t: number }[] = []; barkLabels: { x: number; y: number; text: string; a: number; depth: number }[] = [];
  onRunEnd: (r: RunRecord) => void = () => {}; onFloorEnd: () => void = () => {};
  onDialogue: () => Promise<string> = async () => 'Los diálogos de IA no están disponibles.';
  onSave: () => void = () => {};
  onFind: (w: Item) => void = () => {};
  meleeHitStep = 0;
  foundWeapon(w: Item) { recordStat(this.runId, "find", w); try { this.onFind(w); } catch { /* optional world wiki */ } }
  weather = 0; weatherT = 40; eventT = 25; eventName = ""; eventLeft = 0; darkness = 0; screamer = 0; gloom = 0; portalMsgT = 0; misreads = 0;
  wind = { x: 0, y: 0 }; shake = 0; hurtFlash = 0; critFlash = 0; time = 0;
  dotMsgCd: Record<string, number> = {}; lastHurt = ""; hurtCounts: Record<string, number> = {}; deathCause = "";
  challenge: { goal: number; kills: number; t: number; name: string } | null = null;
  temp = 50;
  stillT = 0; lastDashT = 9; sneaking = false; ductMsgT = -9; ceilMsgT = -9; safeX = 2.5; safeY = 2.5;
  killStreak = 0; streakT = 0; streakMax = 0;
  fatigue = 0; needEpisodeT = 30; needBlur = 0; sitting = false; vendorTalkCd = 0;
  mirrorBuff: { id: MirrorBuffId; t: number } | null = null;
  attrs: Record<string, number> = {}; attrPoints = 0;
  subclassId = '';
  skillCharge = 0; skillBuffT = 0;
  skillPick: Record<string, number> = (() => { try { return JSON.parse(localStorage.getItem("ars_anima_skill_pick") ?? "{}"); } catch { return {}; } })();
  /** Progreso de desbloqueo de habilidades activas en esta partida. */
  skillRun = (() => { try { return { kills: 0, bosses: 0, secrets: 0, puzzles: 0, pacts: 0, bought: [] as string[], ...JSON.parse(localStorage.getItem("ars_anima_skill_run") ?? "{}") }; } catch { return { kills: 0, bosses: 0, secrets: 0, puzzles: 0, pacts: 0, bought: [] as string[] }; } })();
  skillProgress(): RunProgress { return { ...this.skillRun, level: this.level, floor: this.floor }; }
  skillOpen(id: string) { return skillUnlocked(id, this.skillProgress()); }
  resetSkillRun() { this.skillRun = { kills: 0, bosses: 0, secrets: 0, puzzles: 0, pacts: 0, bought: [] }; this.saveSkillRun(); }
  saveSkillRun() { try { localStorage.setItem("ars_anima_skill_run", JSON.stringify(this.skillRun)); } catch { /* sin almacenamiento */ } }
  /** Anuncia habilidades recién abiertas para la clase actual. */
  checkSkillUnlocks(before: Set<string>) { for (const sk of skillOptions(this.cls?.id ?? "")) if (!before.has(sk.id) && this.skillOpen(sk.id)) { this.float(`✦ HABILIDAD DESBLOQUEADA: ${sk.name.toUpperCase()}`, "#9cf"); this.msg(`Nueva habilidad activa: ${sk.name}. Elígela en la pestaña Clase.`); this.onSound("level"); } }
  openSkills() { return new Set(skillOptions(this.cls?.id ?? "").filter(sk => this.skillOpen(sk.id)).map(sk => sk.id)); }
  bumpSkillRun(k: "kills" | "bosses" | "secrets" | "puzzles" | "pacts", n = 1) { const b = this.openSkills(); this.skillRun[k] += n; this.saveSkillRun(); this.checkSkillUnlocks(b); }
  buySkill(id: string) { const u = unlockOf(id); if (u.kind !== "merchant" || this.skillRun.bought.includes(id)) return; if (this.gold < u.n) { this.msg(`Te faltan fichas (${this.gold}/${u.n}).`); return; } const b = this.openSkills(); this.gold -= u.n; this.skillRun.bought.push(id); this.saveSkillRun(); this.checkSkillUnlocks(b); }
  classSkill() { const i = this.skillPick[this.cls?.id ?? ""] ?? 0; const id = skillOptions(this.cls?.id ?? "")[i]?.id ?? ""; return skillFor(this.cls?.id ?? "", this.subclassId, this.skillOpen(id) ? i : 0); }
  pickSkill(i: number) { const id = skillOptions(this.cls.id)[i]?.id ?? ""; if (!this.skillOpen(id)) { this.float(unlockText(id), "#8a8a9a"); return; } this.skillPick[this.cls.id] = i; this.skillCharge = 0; this.skillBuffT = 0; try { localStorage.setItem("ars_anima_skill_pick", JSON.stringify(this.skillPick)); } catch { /* sin almacenamiento */ } this.onUI(); }
  skillMul(k: "damage" | "taken" | "speed" | "lifesteal") { if (this.skillBuffT <= 0) return k === "lifesteal" ? 0 : 1; const b = this.classSkill()?.buff?.[k]; return b ?? (k === "lifesteal" ? 0 : 1); }
  skillEvent(kind: ChargeKind, amount = 1) { const s = this.classSkill(); if (!s) return; const before = this.skillCharge; this.skillCharge = chargeSkill(s, this.skillCharge, kind, amount); if (before < s.need && this.skillCharge >= s.need && kind !== "time") this.float(`✦ ${s.name.toUpperCase()} LISTA (B)`, "#9cf"); else if (before < s.need && this.skillCharge >= s.need) this.float(`✦ ${s.name.toUpperCase()} LISTA`, "#9cf"); }
  /** Habilidad activa de clase: efecto propio, luego se vacía la recarga. */
  useClassSkill() {
    const s = this.classSkill(); if (!s) return;
    if (this.skillCharge < s.need) { this.float(`${s.name}: ${Math.floor(this.skillCharge)}/${s.need}`, "#8a8a9a"); return; }
    this.skillCharge = 0; const cos = Math.cos(this.ang), sin = Math.sin(this.ang), lvl = 1 + this.level * 0.08;
    this.float(`✦ ${s.name.toUpperCase()}`, "#9cf"); this.onSound("pact"); this.shake = Math.max(this.shake, .2);
    if (s.duration) this.skillBuffT = s.duration;
    if (s.effect === "volley") { const n = s.tight ? 8 : 7; for (let i = 0; i < n; i++) { const a = this.ang + (s.tight ? (Math.random() - .5) * .06 : (i - (n - 1) / 2) * .09); this.projs.push({ x: this.px, y: this.py, z: .6 + this.pz, dx: Math.cos(a) * 16, dy: Math.sin(a) * 16, life: 1.2, dmg: s.power * lvl, friendly: true, color: s.tight ? "#ffd34a" : "#9cf" }); } }
    if (s.effect === "nova") { this.explode(this.px, this.py, 3.6, s.power * lvl, true); this.burst(this.px, this.py, .5, "#9cf", 40); }
    if (s.effect === "bomb") this.projs.push({ x: this.px, y: this.py, z: .7 + this.pz, dx: cos * 9, dy: sin * 9, life: .9, dmg: s.power * lvl, friendly: true, color: s.poison ? "#5f5" : "#ffb14a", bomb: true });
    if (s.effect === "leap") { this.vz = 9; this.vx = cos * 9; this.vy = sin * 9; setTimeout(() => { if (this.pz > this.floorHeight() + .3) this.startPound(); }, 380); }
    if (s.effect === "shout") for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - this.px, e.y - this.py) < 4.5) { e.stagger = Math.max(e.stagger, 1.5 * s.power); e.aware = true; }
    if (s.effect === "curse") for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - this.px, e.y - this.py) < 5) { e.bleed = Math.max(e.bleed, s.duration * s.power); this.burst(e.x, e.y, .6, "#c4121e", 8); }
    if (s.effect === "heal") { this.heal(this.hpMax * s.power); this.bleed = this.burn = this.poison = 0; this.burst(this.px, this.py, .5, "#9f9", 25); }
    if (s.poison) for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - (this.px + cos * 6), e.y - (this.py + sin * 6)) < 3) e.poison = Math.max(e.poison, 8);
  }
  subclassFx() { return subclassMods(this.cls.id, this.subclassId); }
  carryWeight() { return carryWeight(this.bag, [this.melee, this.ranged, ...(this.armor ? [this.armor] : [])].filter(Boolean), this.mats, this.cons, this.ammo, this.bombs, this.keys); }
  canCarry(weight: number) { return isPariah(this.cls?.id) ? this.carryWeight() + weight <= CARRY_LIMIT * PARIAH.inventory + 1e-8 : fitsCarry(this.carryWeight(), weight); }
  /** Desposesión: 65 % del botín de enemigos y un nivel menos de calidad (no toca tablas globales). */
  pariahLoot(from: number) { const fresh = this.pickups.slice(from), kept = fresh.filter(() => Math.random() < PARIAH.loot); for (const k of kept) if (k.item?.kind === "weapon" && k.item.rarity > 0) k.item = this.makeWeapon(k.item.base?.type, k.item.rarity - 1); this.pickups.length = from; this.pickups.push(...kept); }
  receiveItem(item: Item) {
    if (this.canCarry(itemWeight(item))) { this.bag.push(item); if (item.kind === 'weapon') this.foundWeapon(item); }
    else { this.pickups.push({ x: this.px + Math.cos(this.ang), y: this.py + Math.sin(this.ang), kind: 'item', item, bob: 0 }); this.msg('Mochila llena: el objeto queda en el suelo.'); }
  }
  buff() { const b = this.mirrorBuff ? MIRROR_BUFFS[this.mirrorBuff.id] : null; return b ?? { damage: 1, move: 1, rate: 1, lifesteal: 0, armor: 0 }; }
  needFx() { return needPenalty(this.food, this.thirst, this.fatigue); }
  frenzyFx() { return frenzy(this.streakT > 0 ? this.killStreak : 0); }
  raiseAttr(a: string) { if (this.attrPoints <= 0 || (this.attrs[a] ?? 0) >= ATTR_UP.max) return; this.attrPoints--; this.score.gain("skill"); this.attrs[a] = Math.min(ATTR_UP.max, (this.attrs[a] ?? 60) + ATTR_UP.step); this.recalc(); this.onUI(); }
  enemiesNear(r = 10) { return this.enemies.some(e => !e.dead && Math.hypot(e.x - this.px, e.y - this.py) < r); }
  restoreLumbre(n: number) { this.lumbre = Math.min(this.lumbreMax, this.lumbre + n); }
  /** Compañeros cercanos que ven (o escuchan muy cerca) a un aliado herido te buscan aunque no te hayan visto. */
  alertAllies(v: Enemy) {
    let n = 0;
    for (const o of this.enemies) { if (o === v || o.dead || o.aware || o.ambush) continue; const d = Math.hypot(o.x - v.x, o.y - v.y); if (d < 3.5 || (d < 8 && this.los(o.x, o.y, v.x, v.y, o.z + .5, v.z + .5))) { o.aware = true; o.notice = 1; o.alertT = .5; n++; } }
    if (n) this.float(n > 1 ? `¡${n} ENEMIGOS VIERON EL ATAQUE!` : "¡UN COMPAÑERO LO VIO!", "#ff9a3a");
  }
  /** Multiplicador de fichas: +0.5 por muerte consecutiva y +0.1 por golpe de combo. */
  chipMult() { return 1 + 0.5 * Math.max(0, this.killStreak - 1) + 0.1 * this.combo; }
  zones: { x: number; y: number; w: number; h: number; name: string }[] = [];
  /** Door cell of this floor's level-gated forbidden zone (-1 if none). */
  forbiddenDoor = -1;
  forbiddenDoors: number[] = [];
  forbiddenIds = new Set<number>();
  forbiddenScaled = false;
  classRewards: string[] = [];
  /** Gives a usable weapon or a shield/armor when a class passive unlocks. */
  grantClassRewards() {
    for (const p of passivesUnlockedAt(this.cls.id, this.level)) {
      const kind = passiveReward(p); if (!kind) continue;
      let item: Item;
      if (kind === 'arma') { const r = Math.min(3, Math.max(1, Math.floor(this.rating / 3))); item = this.makeWeapon(undefined, r); for (let i = 0; i < 20 && !canUseWeapon(item, this.level); i++) item = this.makeWeapon(undefined, Math.max(0, r - 1)); }
      else item = this.makeArmor();
      this.receiveItem(item); this.classRewards.push(`${p.name}: ${item.name}`);
      this.msg(`Habilidad desbloqueada · ${p.name}. Recompensa: ${item.name}.`); this.float(`¡${p.name.toUpperCase()}! +${kind.toUpperCase()}`, "#ffd34a");
    }
  }
  get rating() { return playerRating(this.level, this.adapt, this.kills); }
  /** Re-balances Forbidden Zone enemies to the player's current rating (level + performance + score). */
  scaleForbidden() {
    const need = forbiddenZoneLevel(this.floor), r = this.rating;
    for (const e of this.enemies) if (this.forbiddenIds.has(e.id) && !e.dead) {
      const base = ENEMY_TYPES[e.kind].hp * this.chal.hp * floorPressure(this.floor).hp, frac = e.hp / e.hpMax;
      e.hpMax = Math.round(base * forbiddenHpMult(r, need, FORBIDDEN.hpMult)); e.hp = Math.max(1, Math.round(e.hpMax * frac)); e.lvl = forbiddenEnemyLevel(r, need, FORBIDDEN.extraLevels);
    }
    this.forbiddenScaled = true;
  }
  visitedZones = new Set<string>(); clearedZones = new Set<string>(); combatZones = new Set<string>();
  doors = new Set<number>(); breakables = new Set<number>();
  legacy = { runs: 0, kills: 0, maxFloor: 1, maxLevel: 1, backstabs: 0, steals: 0, picks: 0, lockLvl: 1, lockXp: 0, identitySeen: [] as IdentityId[] };
  loadLegacy() { try { Object.assign(this.legacy, JSON.parse(localStorage.getItem("ars_anima_legacy") || "{}")); } catch { /* optional */ } this.legacy.identitySeen = normalizeIdentitySeen(this.legacy.identitySeen); }
  saveLegacy() { try { localStorage.setItem("ars_anima_legacy", JSON.stringify(this.legacy)); } catch { /* optional */ } }
  zoneAt(x = this.px, y = this.py) { return this.zones.find(z => x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h)?.name ?? "Pasadizo"; }
  lockXp(n: number) { const L = this.legacy; L.lockXp += n; const need = L.lockLvl * 3 + 3; if (L.lockXp >= need && L.lockLvl < 10) { L.lockXp -= need; L.lockLvl++; this.float(`GANZÚA NV ${L.lockLvl}`, "#ffd34a"); this.msg(`Tu habilidad de forzar sube a ${L.lockLvl}.`); this.onSound("level"); } this.saveLegacy(); }
  /** Forzar: d20 + nivel de ganzúa + PRE contra CD. Fallo = riesgo. */
  forceRoll(cd: number) { const nat = ri(1, 20); const total = nat + this.legacy.lockLvl + this.mod("PRE") + (this.cls.id === "cazador" ? 2 : 0); return { ok: nat !== 1 && (nat === 20 || total >= cd), total, nat }; }
  alertNear(x: number, y: number, r: number) { if (this.enemies.some(e => !e.dead && !e.aware && Math.hypot(e.x-x,e.y-y) < r)) this.track("alarms", 1, "ruido que alerta a enemigos"); for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - x, e.y - y) < r) e.aware = true; }
  contract: { name: string; goal: number; kills: number; t: number; done: boolean } | null = null;
  bossSpawned = false; bossDead = false;
  bossFight = { seconds: 0, damage: 0 };
  /** Combate de jefe: arena sellada, cronómetro, escombros, refuerzos y saltos-machaque (reglas en boss-arena.ts). */
  arena: { t: number; sealed: { i: number; v: number }[]; rubbleT: number; rubble: FallingRubble[]; summonT: number; scoreAcc: number; slam: { t: number; fx: number; fy: number; tx: number; ty: number } | null; slamCd: number } | null = null;
  openArena() { if (!this.arena) return; for (const c of this.arena.sealed) this.map[c.i] = c.v; this.arena = null; }
  sealArena(b: { x: number; y: number; w: number; h: number }) {
    const sealed: { i: number; v: number }[] = [];
    for (let y = b.y - 1; y <= b.y + b.h; y++) for (let x = b.x - 1; x <= b.x + b.w; x++) {
      if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) continue; if (x < 0 || y < 0 || x >= MAP || y >= MAP) continue;
      const i = y * MAP + x, v = this.map[i]; if (v !== 1) { sealed.push({ i, v }); this.map[i] = 1; }
    }
    this.arena = { t: BOSS_ARENA.timeLimit, sealed, rubbleT: BOSS_ARENA.rubbleEvery, rubble: [], summonT: BOSS_ARENA.summonEvery, scoreAcc: 0, slam: null, slamCd: 4 };
    this.bossFight = { seconds: 0, damage: 0 };
    this.float(`¡LAS PUERTAS SE CIERRAN! · ${Math.round(BOSS_ARENA.timeLimit / 60)} MIN`, "#ff3355");
  }
  updateArena(dt: number) {
    const A = this.arena; if (!A) return; const boss = this.enemies.find(e => e.kind === "librero" && !e.dead);
    if (!boss) { this.openArena(); return; }
    A.t -= dt; this.bossFight.seconds += dt; const over = A.t <= 0;
    if (over && A.t + dt > 0) { this.float("¡SE DERRUMBA EL TECHO! ¡ACABA CON ÉL!", "#ff3355"); this.msg("El tiempo se agotó: caen escombros sobre ti."); this.shake = .8; }
    boss.aware = true;
    // puntaje: quieto o lento cuesta mucho
    A.scoreAcc += arenaScorePenalty(dt, this.stillT, over); if (A.scoreAcc <= -1) { const n = Math.ceil(A.scoreAcc); this.score.add("time", n); A.scoreAcc -= n; if (this.stillT > BOSS_ARENA.stillGrace && Math.random() < dt * .7) this.float("¡QUIETO PIERDES PUNTOS!", "#ff8a3a"); }
    // refuerzos
    A.summonT -= dt;
    if (A.summonT <= 0) { A.summonT = summonInterval(over); const alive = this.enemies.filter(e => !e.dead && e.kind !== "librero" && Math.hypot(e.x - boss.x, e.y - boss.y) < 9).length;
      if (alive < BOSS_ARENA.summonCap) { this.spawnBossAdds(boss, over ? 2 : 1); this.float("EL JEFE INVOCA REFUERZOS", "#b58cff"); } }
    // escombros
    if (over) { A.rubbleT -= dt; if (A.rubbleT <= 0) { A.rubbleT = BOSS_ARENA.rubbleEvery; const rx = this.px + this.vx * .4 + rnd(-.6, .6), ry = this.py + this.vy * .4 + rnd(-.6, .6); A.rubble.push({ x: rx, y: ry, t: BOSS_ARENA.rubbleWarn + RUBBLE_FALL.duration }); } }
    for (const r of A.rubble) {
      const previousT = r.t; r.t -= dt;
      const box = playerHitbox(this.crouching || this.slideT > 0);
      if (fallingRubbleHits(r, previousT, { x: this.px, y: this.py, z: this.pz, height: box.height, radius: box.radius }, this.floorHeight(r.x, r.y))) { r.hit = true; this.hurtPlayer(rubbleDamage(this.hpMax), "escombros"); }
      if (r.t <= RUBBLE_FALL.duration && Math.random() < dt * 30) this.parts.push({ x: r.x + rnd(-.12, .12), y: r.y + rnd(-.12, .12), z: rubbleHeight(r.t, this.floorHeight(r.x, r.y)), vx: 0, vy: 0, vz: -4, life: .25, color: "#8a7a6a", size: .03 });
      if (r.t <= 0) { this.onSound("rubble"); this.burst(r.x, r.y, .1, "#9a8a78", 18); this.shake = Math.max(this.shake, .35);
        if (!r.hit && Math.hypot(r.x - this.px, r.y - this.py) < BOSS_ARENA.rubbleRadius && this.pz <= this.floorHeight(r.x, r.y) + .2) this.hurtPlayer(rubbleDamage(this.hpMax), "escombros"); }
    }
    A.rubble = A.rubble.filter(r => r.t > 0);
    // saltos-machaque
    if (A.slam) { const S = A.slam; S.t += dt / BOSS_ARENA.slamAir; const k = Math.min(1, S.t);
      boss.x = S.fx + (S.tx - S.fx) * k; boss.y = S.fy + (S.ty - S.fy) * k; boss.z = this.floorHeight(boss.x, boss.y) + slamArc(k); boss.vz = 0; boss.tele = 0; boss.cd = Math.max(boss.cd, .5);
      if (k >= 1) { A.slam = null; boss.z = this.floorHeight(boss.x, boss.y); this.slamLand(boss); } }
    else if (canSlam(boss.hp, boss.hpMax) && boss.stagger <= 0 && (boss.downT ?? 0) <= 0) { A.slamCd -= dt;
      if (A.slamCd <= 0) { A.slamCd = rnd(BOSS_ARENA.slamCd[0], BOSS_ARENA.slamCd[1]); let tx = this.px + this.vx * .3, ty = this.py + this.vy * .3; if (this.solid(tx, ty, 0, .5)) { tx = this.px; ty = this.py; }
        A.slam = { t: 0, fx: boss.x, fy: boss.y, tx, ty }; this.float("¡EL JEFE SALTA PARA MACHACARTE!", "#ffd34a"); this.onSound("event"); } }
  }
  spawnBossAdds(boss: Enemy, n: number) {
    const kinds = [...new Set(this.enemies.filter(e => !e.boss && !e.miniBoss && e.kind !== "librero").map(e => e.kind))]; const pool = (kinds.length ? kinds : ["sombra", "espectro"]) as EnemyKind[];
    for (let i = 0; i < n; i++) { const a = rnd(0, Math.PI * 2); let x = boss.x + Math.cos(a) * 1.4, y = boss.y + Math.sin(a) * 1.4; if (this.solid(x, y, 0, .5)) { x = boss.x; y = boss.y; } this.spawn(pick(pool), x, y); const e = this.enemies[this.enemies.length - 1]; if (e) e.aware = true; this.burst(x, y, .5, "#b58cff", 10); }
  }
  slamLand(boss: Enemy) {
    this.shake = 1; this.onSound("explosion"); this.onSound("cloud"); this.burst(boss.x, boss.y, .1, "#c9b08a", 30);
    if (Math.hypot(boss.x - this.px, boss.y - this.py) < BOSS_ARENA.slamRadius && this.pz < .6) this.hurtPlayer(this.hpMax * BOSS_ARENA.slamDmgShare, "machaque del jefe", false, { x: boss.x, y: boss.y });
    const colors = ["#ff3a7a", "#ffd34a", "#7ad8ff", "#c35bff", "#7affc1"], col = pick(colors), dmg = ENEMY_TYPES.librero.dmg * ROLES.cloudDmg;
    for (const s of slamCloud(Math.random)) this.projs.push({ x: boss.x + Math.cos(s.a) * .4, y: boss.y + Math.sin(s.a) * .4, z: boss.z + .3 + s.h, dx: Math.cos(s.a) * s.speed, dy: Math.sin(s.a) * s.speed, dz: s.dz, life: BOSS_ARENA.slamLife, dmg, friendly: false, ownerId: boss.id, color: col, cloud: true, bounces: BOSS_ARENA.slamBounces, sprite: "orb" });
    this.float("¡MACHAQUE! · NUBE DE PROYECTILES", col); this.spawnBossAdds(boss, BOSS_ARENA.slamAdds);
  }
  /** EXPEDITION COLLAPSE live state (rules in expedition.ts). */
  palimMemento = false; palimView: "investigar" | "diario" = "diario";
  enemyLabels: { x: number; y: number; w: number; depth: number; hp: number; brk: number; name: string; state: string; elite: boolean; boss: boolean; miniBoss: boolean; tele: boolean; retreat: boolean; alert: boolean; notice: boolean; ally?: string }[] = [];
  /** Multijugador (sólo presentación): compañeros y marcas del servidor que dibujan las cámaras. */
  remotes: RemoteView[] = []; netMarks: NetMark[] = [];
  remoteLabel(r: RemoteView) { const who = [CLASSES.find(c => c.id === r.cls)?.name?.toUpperCase(), r.title ? `«${r.title}»` : ""].filter(Boolean).join(" · "); return r.state === "downed" ? "CAÍDO · mantén E para levantarlo" : r.state === "dead" ? "SIN ALMA HASTA EL PRÓXIMO PISO" : [who, r.traitor > 0 ? `TRAIDOR ×${r.traitor}` : ""].filter(Boolean).join(" · "); }
  /** Nombre, nivel y vida de otro jugador (etiqueta sobre su cabeza). */
  remoteName(r: RemoteView) { return `${r.name} · Nv ${r.level ?? 1} · ${Math.max(0, Math.round(r.hp))}/${Math.round(r.hpMax)}`; }
  exp = { noteRead: false, unlocked: false, hasMap: false, extracted: false };
  lairHint: { x: number; y: number; r: number } | null = null; lairWarnT = 0;
  collapse: { t: number; max: number; hazardT: number; toxicT: number; warned: number; spawnT: number; portal: { x: number; y: number } | null } | null = null;
  hazards: { x: number; y: number; t: number; max: number }[] = [];
  /** PALIMPSESTOS persistent journal (rules in palimpsest.ts). */
  palim: PalimpsestState = loadPalimpsest();
  savePalim(next: PalimpsestState) {
    const before = this.palim;
    if (!before.hasBook && next.hasBook) this.track('books', 1, 'recoger el libro antiguo');
    for (const id of next.found.filter(id => !before.found.includes(id))) this.track('documents', 1, docById(id)?.title ?? id, {}, `document-${id}`);
    for (const id of next.solved.filter(id => !before.solved.includes(id))) { const doc = docById(id); this.track('puzzles', 1, `reconstruir «${doc?.title ?? id}»`, { noHints: (before.hints[id] ?? 0) === 0, memory: next.memories.includes(id) }, `solve-${id}`); }
    for (const id of next.dict.filter(id => !before.dict.includes(id))) this.track('words', 1, id, {}, `word-${id}`);
    for (const id of next.memories.filter(id => !before.memories.includes(id))) this.track('memories', 1, id, {}, `memory-${id}`);
    for (const id of next.pacts.filter(id => !before.pacts.includes(id))) this.track('forbidden', 1, id, {}, `writing-${id}`);
    this.palim = next; savePalimpsest(next); }
  expPhase() { return expeditionPhase({ ...this.exp, bossSpawned: this.bossSpawned, bossDead: this.bossDead }); }
  spawnMapFragment(x: number, y: number) {
    if (this.exp.hasMap || this.pickups.some(p => p.kind === "mapfrag" && !p.used)) return;
    let px = x, py = y; if (this.solid(px, py)) { const r = this.rooms.find(r => x >= r.x - 2 && x < r.x + r.w + 2 && y >= r.y - 2 && y < r.y + r.h + 2); if (r) { px = r.x + r.w / 2; py = r.y + r.h / 2; } }
    this.pickups.push({ x: px, y: py, kind: "mapfrag", bob: 0 }); this.float("FRAGMENTO DE MAPA REVELADO", "#ffd34a");
  }
  /** Wrong palimpsest answer: the misread text takes form and hunts the player across the level. */
  /** Big score for a first-time correct palimpsest solve (hints reduce it). */
  awardPalimpsest(points: number) { const pts = this.score.add("palimpsest", points); this.float(`+${pts} PUNTOS · PALIMPSESTO`, "#ffd34a"); return pts; }
  misreadSummon() {
    this.misreads++; this.gloom = Math.max(this.gloom, .45); this.float("LA SALA SE OSCURECE", "#8a6aff");
    const alive = this.enemies.some(e => !e.dead && e.misread);
    if (!shouldSummonMisread(alive, !!this.collapse)) { if (alive) this.msg("La lectura errónea ya te persigue."); return false; }
    const kinds = [...new Set(this.enemies.filter(e => !e.boss && e.kind !== "librero").map(e => e.kind))];
    const kind = (kinds.includes("carcelero") ? "carcelero" : kinds[0] ?? "sombra") as EnemyKind;
    const rooms = this.rooms.filter(r => r !== this.restRoom && r !== this.bossRoom && !this.isSafe(r.x + r.w / 2, r.y + r.h / 2)).sort((a, b) => Math.hypot(a.x + a.w / 2 - this.px, a.y + a.h / 2 - this.py) - Math.hypot(b.x + b.w / 2 - this.px, b.y + b.h / 2 - this.py));
    for (const r of rooms) { const before = this.enemies.length; if (this.tacticalSpawn(kind, r, 3)) { const m = this.enemies[before]; if (!m) break;
      m.misread = true; m.miniBoss = true; m.aware = true; m.elite = undefined; m.hp = m.hpMax = Math.round(m.hpMax * MISREAD.hpMult); m.brk = m.brkMax = m.brkMax * MISREAD.brkMult;
      this.sitting = false; this.mode = "play"; this.shake = .5; this.gloom = Math.max(this.gloom, .5); this.onSound("terror"); this.float("LECTURA ERRÓNEA · ALGO HA DESPERTADO", "#ff3355");
      this.msg("Pronunciaste mal el palimpsesto: lo invocado te perseguirá por todo el nivel hasta que lo derrotes."); this.onUI(); return true; } }
    return false;
  }
  portalMsg(quiet: boolean, t: string) { if (quiet && this.portalMsgT > 0) return; this.portalMsgT = 3; this.msg(t); }
  /** Portal use: walking into the sprite or pressing interact both cross it. */
  usePortal(p: Pickup, quiet: boolean) { if (this.collapse) { if (this.collapse.t > 0) { this.extractionConditions = { collapse: true, healthShare: this.hp / this.hpMax, remaining: this.collapse.t }; this.chronicles.finish(this.floor === 6 ? "won" : "transition", this.floor, this.time, "", this.extractionConditions); this.collapse = null; this.hazards = []; this.exp.extracted = true; this.darkness = 0; this.onSound("portal"); p.used = true; this.portalMsg(quiet, "Cruzas el portal mientras el mundo se derrumba a tu espalda."); this.mode = "erased"; this.erasedAt = performance.now(); this.onUI(); } return; } if(this.bossRequired && !this.bossDead) {this.portalMsg(quiet, "Debes vencer al guardián.");return;} if(!this.bossRequired && this.region.id!=="garden" && this.floorKills<3) {this.portalMsg(quiet, `El umbral exige 3 bajas (${this.floorKills}/3) o vencer al guardián.`);if(!this.bossDead)return;} if (!this.regionCollected) { this.portalMsg(quiet, `Antes de partir: ${this.region.objective}`); return; } this.onSound("portal"); p.used = true; this.finishFloor();
  }
  startCollapse() {
    const max = collapseSeconds(this.floor, this.chal.dmg ?? 1);
    this.raid = null; this.collapse = { t: max, max, hazardT: 2, toxicT: COLLAPSE.toxicEvery, warned: 0, spawnT: COLLAPSE_SPAWN.grace, portal: null }; this.hazards = [];
    const at = this.collapsePortalSpot(); this.collapse.portal = at; this.pickups.push({ x: at.x, y: at.y, kind: "portal", bob: 0 });
    for (const e of this.enemies) if (!e.dead) e.aware = true;
    this.shake = 0.9; this.onSound("explosion"); this.float(`EXPEDITION COLLAPSE · ${max}s`, "#ff3355");
    this.msg(`¡EL ESCENARIO COLAPSA! Un portal se abrió (rombo turquesa y dorado en el mapa). Vuelve y crúzalo antes de ${max}s.`);
  }
  /** Random, easily reachable room centre (not the lair, not the room the player is in). */
  collapsePortalSpot() {
    const rr = this.restRoom;
    if (rr) { const busy = [...this.pickups.filter(k => !k.used && k.kind !== "portal"), ...this.scenicProps]; const cands: { x: number; y: number }[] = [];
      for (let yy = rr.y + 1; yy < rr.y + rr.h - 1; yy++) for (let xx = rr.x + 1; xx < rr.x + rr.w - 1; xx++) { const c = { x: xx + .5, y: yy + .5 }; if (!this.solid(c.x, c.y) && this.cell(c.x, c.y) === 0) cands.push(c); }
      const at = refugePortalSpot(cands, busy); if (at) return at; }
    const inRoom = (r: { x: number; y: number; w: number; h: number }) => this.px >= r.x && this.px < r.x + r.w && this.py >= r.y && this.py < r.y + r.h;
    const busy = [...this.pickups.filter(k => !k.used && k.kind !== 'portal'), ...this.scenicProps];
    const clear = (c: { x: number; y: number }, d: number) => busy.every(k => Math.hypot(k.x - c.x, k.y - c.y) >= d);
    const cands: { x: number; y: number }[] = [];
    for (const r of this.rooms) { if (r === this.bossRoom || r === this.restRoom || inRoom(r)) continue;
      for (let yy = r.y + 1; yy < r.y + r.h - 1; yy++) for (let xx = r.x + 1; xx < r.x + r.w - 1; xx++) { const c = { x: xx + .5, y: yy + .5 }; if (!this.solid(c.x, c.y) && this.cell(c.x, c.y) === 0) cands.push(c); } }
    const at = refugePortalSpot(cands.filter(c => clear(c, PORTAL.clearance)), busy); if (at) return at;
    // Crowded refuge: reserve an empty patch, never displacing the merchant or functional props.
    const fixed = this.pickups.filter(k => !k.used && k.kind !== 'portal' && (k.kind !== 'decor' || this.isBench(k) || ['powder','healing_brazier','fountain'].includes(k.deco ?? '')));
    const fallback: { x: number; y: number }[] = [];
    for (const r of this.rooms) for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
      const c = { x: x + .5, y: y + .5 }; if (this.cell(c.x, c.y) === 0 && !this.solid(c.x, c.y) && fixed.every(k => Math.hypot(k.x - c.x, k.y - c.y) >= PORTAL.clearance)) fallback.push(c);
    }
    const spot = refugePortalSpot(fallback, fixed) ?? { x: this.px, y: this.py };
    for (const p of this.pickups) if (p.kind === 'decor' && !fixed.includes(p) && Math.hypot(p.x - spot.x, p.y - spot.y) < PORTAL.clearance) p.used = true;
    this.scenicProps = this.scenicProps.filter(p => Math.hypot(p.x - spot.x, p.y - spot.y) >= PORTAL.clearance);
    return spot;
  }
  /** Repair independent floor-save flags/pickups without restarting collapse or granting access. */
  ensurePortal() {
    if (this.exp.extracted || (this.collapse && this.collapse.t <= 0) || (this.bossRequired && !this.bossDead && !this.collapse)) return;
    if (this.pickups.some(p => p.kind === 'portal' && !p.used)) return;
    const at = this.collapse?.portal ?? this.collapsePortalSpot();
    if (this.collapse) this.collapse.portal = at;
    this.pickups.push({ x: at.x, y: at.y, kind: 'portal', bob: 0 });
  }
  /** Debris impact: area damage with falloff, breaks props/inner walls and sets off powder kegs. */
  debrisImpact(x: number, y: number) {
    const R = DEBRIS_AREA.outerRadius;
    const d = Math.hypot(x - this.px, y - this.py), hit = debrisAreaDamage(this.floor, d, this.hpMax);
    if (hit > 0 && this.pz < this.floorHeight() + 1) this.hurtPlayer(hit, "derrumbe");
    for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - x, e.y - y) < R) this.damageEnemy(e, debrisDamage(this.floor), 3);
    for (const k of this.pickups) if (!k.used && k.deco === "powder" && Math.hypot(k.x - x, k.y - y) < R) this.detonateKeg(k);
    for (const o of this.pickups) if (!o.used && o.kind === "decor" && o.deco !== "powder" && !this.isBench(o) && Math.hypot(o.x - x, o.y - y) < R) { o.used = true; this.shatter(o.x, o.y, this.floorHeight(o.x, o.y), o.deco ?? "book"); }
    this.environmentImpact(x, y, .3, true);
    // Crumble inner walls next to the impact (never the outer border).
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const cx = Math.floor(x) + dx!, cy = Math.floor(y) + dy!;
      if (cx > 1 && cy > 1 && cx < MAP - 2 && cy < MAP - 2 && this.map[cy * MAP + cx] === 1 && Math.random() < .35) { this.map[cy * MAP + cx] = 0; this.burst(cx + .5, cy + .5, .8, "#5a5058", 16); } }
  }
  updateCollapse(dt: number) {
    const c = this.collapse; if (!c) return;
    c.t -= dt; const prog = collapseProgress(c.t, c.max);
    const w = COLLAPSE_WARNINGS[c.warned]; if (w && prog >= w.at) { c.warned++; this.float(w.text, "#ff5a2a"); this.onSound("terror"); this.shake = Math.max(this.shake, .5); }
    if (Math.random() < dt * (0.6 + prog * 2.5)) this.shake = Math.max(this.shake, 0.12 + prog * 0.25);
    this.darkness = Math.max(this.darkness ?? 0, prog * 0.22);
    c.hazardT -= dt;
    if (c.hazardT <= 0) { c.hazardT = hazardInterval(prog, this.floor);
      const n = 1 + Math.floor(prog * 2.5);
      for (let i = 0; i < n; i++) { const a = rnd(0, Math.PI * 2), d = i === 0 ? rnd(0, 1.6) : rnd(1.5, 5), x = this.px + Math.cos(a) * d + this.vx * .4, y = this.py + Math.sin(a) * d + this.vy * .4; if (!this.solid(x, y) && !this.isSafe(x, y, .3)) this.hazards.push({ x, y, t: COLLAPSE.warnSeconds, max: COLLAPSE.warnSeconds }); }
    }
    for (const h of this.hazards) { h.t -= dt; if (h.t <= 0) { this.burst(h.x, h.y, 1.6, "#6a5a4a", 18); this.burst(h.x, h.y, .3, "#2a1a14", 10); this.onSound("break"); this.debrisImpact(h.x, h.y); } }
    c.spawnT -= dt; if (c.spawnT <= 0) { c.spawnT = collapseSpawnInterval(prog);
      const kinds = [...new Set(this.enemies.filter(e => !e.boss && !e.miniBoss && e.kind !== "librero").map(e => e.kind))]; const kind = (kinds[Math.floor(Math.random() * kinds.length)] ?? "sombra") as EnemyKind;
      const near = this.rooms.filter(r => r !== this.restRoom && Math.hypot(r.x + r.w / 2 - this.px, r.y + r.h / 2 - this.py) < 14);
      const room = near[Math.floor(Math.random() * near.length)]; const surge = this.enemies.filter(e => !e.dead && e.surge).length;
      if (room && canSpawnNearPlayer(surge, this.floor, this.hp, this.hpMax) && this.tacticalSpawn(kind, room, 4)) { const ne = this.enemies[this.enemies.length - 1]; if (ne) ne.surge = true; this.float("¡LA TINTA SE DESBORDA!", "#ff5a2a"); }

    }
    this.hazards = this.hazards.filter(h => h.t > 0);
    c.toxicT -= dt; if (c.toxicT <= 0) { this.onSound("drip"); c.toxicT = COLLAPSE.toxicEvery * (1 - prog * .5); if (!this.isSafe() && this.cls.id !== "alquimista") { this.poison = Math.max(this.poison, 2); this.float("LLUVIA TÓXICA", "#9aff6a"); } }
    if (c.t <= 0 && this.mode === "play") { this.collapse = null; this.hazards = []; this.lastHurt = "Colapso de la expedición"; this.msg("El tiempo se agotó: el escenario te borra."); this.die(); }
  }
  // render
  zbuf = new Float32Array(W);
  tex: Uint32Array | null = null; tex2: Uint32Array | null = null;
  sprites: Record<string, SpriteImage> = {};
  weaponImg: SpriteImage | null = null;
  buf: ImageData | null = null; buf32: Uint32Array | null = null;
  animationIds = new WeakMap<HTMLCanvasElement | HTMLImageElement, number>();
  nextAnimationId = 1;
  animations: Record<string, Partial<Record<Pose, (HTMLCanvasElement | HTMLImageElement)[]>>> = {};
  poseCache = new WeakMap<SpriteImage, Partial<Record<Pose, SpriteImage[]>>>();
  animationQueue: { image: SpriteImage; pose: Pose; floating: boolean; frames: SpriteImage[]; cache: Partial<Record<Pose, SpriteImage[]>> }[] = [];
  animationWorking = false;
  prepareAnimations() {
    // Only requested, visible poses are prepared; aliases share source-image caches.
    this.animations = {}; this.poseCache = new WeakMap(); this.animationQueue = [];
  }
  async prepareVisibleAnimations() {
    if (this.animationWorking) return;
    this.animationWorking = true;
    try {
      while (this.animationQueue.length) {
        await yieldToBrowser();
        const deadline = performance.now() + 3;
        while (this.animationQueue.length && performance.now() < deadline) {
          const task = this.animationQueue[0]; if (!task) break;
          task.frames.push(makeFrames(task.image, task.pose, task.floating, task.frames.length)[0] ?? task.image);
          if (task.frames.length === 12) { task.cache[task.pose] = task.frames; this.animationQueue.shift(); }
        }
      }
    } finally { this.animationWorking = false; }
  }
  frame(key: string, pose: Pose, clock: number) {
    const image = this.sprites[key]; if (!image) return;
    let cache = this.poseCache.get(image);
    if (!cache) { cache = {}; this.poseCache.set(image, cache); }
    this.animations[key] = cache;
    const frames = cache[pose];
    if (!frames && !this.animationQueue.some(t => t.image === image && t.pose === pose)) {
      this.animationQueue.push({image,pose,floating:["espectro","sirena","screamer","obispo","bruja","rune"].includes(key),frames:[],cache});
      void this.prepareVisibleAnimations();
    }
    return frames?.[Math.min(frames.length-1,Math.max(0,Math.floor(clock)))] ?? image;
  }
  sideQuest: ActiveQuest | null = null;
  questHistory: string[] = [];
  acceptQuest(q: Quest, declaredLevel: number) {
    const safe = normalizeQuest(q);
    this.sideQuest = { ...safe, progress: 0, complete: false, reward: 15 + Math.min(100,Math.max(1,declaredLevel))*3 };
    this.questHistory = [...this.questHistory, safe.title].slice(-8); this.onUI();
  }
  merchantTalks = 0;
  merchantQuest: MerchantQuest | null = null;
  /** Gives the merchant quest reward; weapon rewards stay usable at the player's level and floor. */
  claimMerchantQuest() {
    const q = this.merchantQuest; if (!q || !q.complete || q.claimed) return false;
    q.claimed = true; this.merchantQuest = null; this.merchantTalks = 0; this.gainXp(merchantXp(this.rating), "mercader");
    if (q.rewardKind === "gold") { this.gold += q.gold; this.msg(`El mercader paga ${q.gold} fichas por tu encargo.`); this.float(`+${q.gold} FICHAS`, "#ffd34a"); }
    else { const { rarity } = merchantReward(this.rating, this.floor); let w = this.makeWeapon(undefined, rarity); for (let i = 0; i < 20 && !canUseWeapon(w, this.level); i++) w = this.makeWeapon(undefined, Math.max(0, rarity - 1 - (i > 10 ? 1 : 0))); this.receiveItem(w); this.msg(`El mercader te entrega ${w.name}.`); this.float("ARMA RECIBIDA", "#ffd34a"); }
    this.onSound("pickup"); this.onUI(); return true;
  }
  questEvent(kind: Quest["kind"], amount = 1) {
    if (this.merchantQuest && advanceMerchantQuest(this.merchantQuest, kind, amount)) { this.msg(`Encargo del mercader cumplido: ${this.merchantQuest.title}. Vuelve a su farol.`); this.float("ENCARGO CUMPLIDO", "#ffcf7a"); }
    const q = this.sideQuest; if (!q || q.complete || q.kind !== kind) return;
    q.progress = Math.min(q.count,q.progress + amount);
    if (q.progress >= q.count) { q.complete = true; this.track("objectives", 1, "misión cumplida"); this.score.gain("mission"); this.gold += q.reward; this.gainXp(q.reward, "misiones"); this.msg(`Misión cumplida: ${q.title} · +${q.reward} fichas y EXP`); this.onSound("pickup"); }
    this.onUI();
  }
  onUI: () => void = () => {};
  onSound: (s: Sound, voice?: string) => void = () => {};
  /** Lo provee el audio: ¿el instante actual coincide con un golpe grave de la canción? */
  beatCheck: () => boolean = () => false;
  /** Pide iniciar/detener la música del piso. */
  onMusic: (play: boolean) => void = () => {};
  musicOn = false; rhythmHint = false;
  /** Comprueba el ritmo y avisa con un mensaje breve la primera vez. */
  onRhythm(label: string) { if (!this.beatCheck()) return false; this.float(`♪ AL RITMO · ${label}`, "#ffe18b"); this.critFlash = Math.max(this.critFlash, .18); this.shake = Math.max(this.shake, .22); this.slowmo = Math.max(this.slowmo, .12); this.onSound("parry"); if (!this.rhythmHint) { this.rhythmHint = true; this.msg("♪ La campana marca el compás: actuar sobre los golpes graves potencia ataques, patadas, machaques, defensas y dash."); } return true; }
  retreatMsgAt = -9;
  /** Ajustes de señales de retirada (solo presentación). */
  retreatCue = { sound: true, visual: true, volume: 1, size: 1, intensity: 1 };
  region = regionForFloor(1);
  journal: { name: string; text: string; icon: string }[] = [];
  regionCollected = false;
  sanctuaryT = 90;
  regionTextures: Record<string, Uint32Array> = {};
  interactionPrompt = "";
  alteredZones: {x:number;y:number;w:number;h:number;effect:Alteration}[] = [];
  alterationAt(x=this.px,y=this.py) {return this.alteredZones.find(r=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h)?.effect;}
  seals: Record<number, DoorSeal> = {};
  restRoom: {x:number;y:number;w:number;h:number} | null = null;
  restHealed = false; restInside = false;
  isSafe(x=this.px,y=this.py,radius=0) {const r=this.restRoom;return !!r && x+radius>r.x && x-radius<r.x+r.w && y+radius>r.y && y-radius<r.y+r.h;}
  updateRest() {const inside=this.isSafe();{const hostile=this.enemies.some(e=>!e.dead&&e.aware&&Math.hypot(e.x-this.px,e.y-this.py)<12);const want=wantsFloorMusic(this.floor,this.musicOn,inside,hostile);if(want!==this.musicOn){this.musicOn=want;this.onMusic(want);if(want)this.msg("♪ Suena «The Bell That Never Rings». Escucha los golpes graves: actuar al compás da bonus.");}}if(inside && !this.restInside && !this.restHealed && this.hp<this.hpMax) {this.hp=this.hpMax;this.restHealed=true;this.onSound("level");this.float("REFUGIO · VIDA RESTAURADA", "#7affc1");this.msg("El mercader te ofrece descanso. Esta sala ya entregó su curación.");}this.restInside=inside;}
  actorRadius(e: Enemy) {return e.kind==="librero"?.42:e.kind==="behemoth"||e.kind==="golem"?.4:e.kind==="carcelero"||e.kind==="caballero"?.34:e.kind==="sanguijuela"||e.kind==="screamer"?.22:.28;}
  get lowProfile() { return this.crouching || this.slideT > 0; }
  bodyH() { return this.lowProfile ? LOW_PROFILE.height : BODY_HEIGHT; }
  canMoveActor(x:number,y:number,z:number,radius:number,actor?:Enemy,fromX?:number,fromY?:number) {
    if(!this.canOccupy(x,y,z,radius,actor?BODY_HEIGHT:this.bodyH()))return false;
    if(actor && this.isSafe(x,y,radius))return false;
    // Bodies may always move apart: only reject moves that deepen an existing overlap (prevents permanent lock-ups).
    const blocks=(ox:number,oy:number,min:number)=>{const nd=Math.hypot(ox-x,oy-y);return nd<min-.005&&(fromX===undefined||fromY===undefined||nd<Math.hypot(ox-fromX,oy-fromY)-.0005);};
    if(this.enemies.some(e=>e!==actor&&!e.dead&&!e.grabbed&&Math.abs(e.z-z)<BODY_HEIGHT&&blocks(e.x,e.y,radius+this.actorRadius(e))))return false;
    return !actor || Math.abs(this.pz-z)>=BODY_HEIGHT || !blocks(this.px,this.py,radius+BODY_RADIUS);
  }
  /** Tries one sub-step, auto-climbing low ledges/stairs (<= STEP_UP) and sliding around corners. */
  private stepActor(x:number,y:number,z:number,sx:number,sy:number,radius:number,actor?:Enemy):{x:number;y:number;z:number}|null {
    const nx=x+sx,ny=y+sy;
    if(this.canMoveActor(nx,ny,z,radius,actor,x,y))return {x:nx,y:ny,z};
    const fh=Math.max(this.floorHeight(nx+Math.sign(sx)*radius,ny+Math.sign(sy)*radius),this.floorHeight(nx,ny));
    if(fh>z&&fh-z<=STEP_UP&&this.canMoveActor(nx,ny,fh,radius,actor,x,y))return {x:nx,y:ny,z:fh};
    // corner slide: nudge sideways when the leading edge clips a block corner
    const len=Math.hypot(sx,sy)||1;
    for(const k of [.05,.12]){const px=-sy/len*k,py=sx/len*k;for(const s of [1,-1]) if(this.canMoveActor(nx+px*s,ny+py*s,z,radius,actor,x,y)&&this.canMoveActor(x+px*s,y+py*s,z,radius,actor,x,y))return {x:nx+px*s,y:ny+py*s,z};}
    return null;
  }
  sweepActor(x:number,y:number,z:number,dx:number,dy:number,radius=BODY_RADIUS,actor?:Enemy) {
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/.06));let hit=false;
    for(let i=0;i<steps;i++){
      const ax=dx/steps,ay=dy/steps;
      // try the full diagonal first so diagonal movement along walls feels smooth
      const both=ax&&ay?this.stepActor(x,y,z,ax,ay,radius,actor):null;
      if(both){x=both.x;y=both.y;z=both.z;continue;}
      let mv=false;
      if(ax){const r=this.stepActor(x,y,z,ax,0,radius,actor);if(r){x=r.x;y=r.y;z=r.z;mv=true;}else hit=true;}
      if(ay){const r=this.stepActor(x,y,z,0,ay,radius,actor);if(r){x=r.x;y=r.y;z=r.z;mv=true;}else hit=true;}
      if(!mv)break; // fully blocked: skip the remaining sub-steps (saves CPU in crowded fights)
    }
    return {x,y,z,hit};
  }
  // ---------- navegación enemiga (campo de flujo BFS hacia el jugador) ----------
  flow = new Int16Array(MAP*MAP).fill(-1); flowT = 0; flowCell = -1;
  updateFlow(dt:number) {
    this.flowT-=dt;const pc=Math.floor(this.py)*MAP+Math.floor(this.px);
    if(this.flowT>0&&pc===this.flowCell)return;this.flowT=.35;this.flowCell=pc;
    const f=this.flow;f.fill(-1);if(pc<0||pc>=MAP*MAP)return;
    const passable=(id:number)=>{const c=this.map[id];return c===0||c===5||c===6||c===7||c===8||c===9||c===10;};
    const h=(id:number)=>{const c=this.map[id];return c===5?.72:c===7?.36:c===8?1.08:0;};
    const q=new Int32Array(MAP*MAP);let qh=0,qt=0;f[pc]=0;q[qt++]=pc;
    while(qh<qt){const id=q[qh++],x=id%MAP,y=(id/MAP)|0;
      for(const [ox,oy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const nx=x+ox,ny=y+oy;if(nx<0||ny<0||nx>=MAP||ny>=MAP)continue;const n=ny*MAP+nx;if(f[n]!==-1||!passable(n))continue;
        if(ox&&oy&&(!passable(y*MAP+nx)||!passable(ny*MAP+x)))continue; // no cortar esquinas
        if(Math.abs(h(n)-h(id))>STEP_UP+.01)continue;
        f[n]=f[id]+(ox&&oy?3:2);q[qt++]=n;}}
  }
  /** World-space sprite offset while an enemy dodges (lateral step or hop with tremble); presentation only. */
  enemyEvadeOffset(e: Enemy) {
    const m = evadeMotion(e.evading || (e.evadeT ?? 0) > 0 ? e.evadeT ?? 0 : 0, e.evadeMax ?? 0, e.evadeStyle ?? "side", this.time + e.id * .13);
    if (!m.lat && !m.up && !m.shake) return { dx: 0, dy: 0, up: 0 };
    const a = e.evadeA ?? 0, c = Math.cos(a), s = Math.sin(a);
    return { dx: c * m.lat - s * m.shake, dy: s * m.lat + c * m.shake, up: m.up };
  }
  /** Evasive footwork: back-steps / sidesteps when the player charges, a shot flies at them, after their own swing or at low health. Cooldown keeps them hittable. */
  updateEvade(e:Enemy,seen:boolean,dist:number,ux:number,uy:number,dt:number):boolean {
    e.evadeCd=Math.max(0,(e.evadeCd??0)-dt);
    if((e.evadeT??0)>0){e.evadeT=(e.evadeT??0)-dt;return true;}
    if(!seen||e.tele>0||e.kind==="librero"||e.miniBoss||(e.evadeCd??0)>0||dist>EVADE.maxRange)return false;
    const heavy=HEAVY.includes(e.kind),low=e.hp<e.hpMax*EVADE.lowHpRatio;
    const side=(Math.random()<.5?1:-1),back=Math.atan2(-uy,-ux),lat=Math.atan2(ux*side,-uy*side);
    let chance=0,ang=lat,dur=rnd(.25,.45),why:DodgeReason="feint";
    // proyectil del jugador que viene hacia el enemigo
    for(const p of this.projs){if(!p.friendly)continue;const rx=e.x-p.x,ry=e.y-p.y,rd=Math.hypot(rx,ry);if(rd>3.5||rd<.4)continue;const pv=Math.hypot(p.dx,p.dy)||1;
      if((rx*p.dx+ry*p.dy)/(rd*pv)>.93){(e.dodgedProj??=new Set()).has(p)||(e.dodgedProj.add(p),chance=Math.max(chance,evadeChance("projectile",dt,heavy)),why="projectile",ang=Math.atan2(p.dx*side,-p.dy*side),dur=rnd(.22,.35));break;}}
    // el jugador carga un ataque
    if(!chance&&this.chargeT>.12&&dist<4.5){chance=evadeChance("charge",dt,heavy);why="charge";ang=Math.random()<.6?back+side*rnd(.3,.8):lat;dur=rnd(.35,.6);}
    // justo después de atacar
    else if(!chance&&e.cd>.5&&dist<2.4){chance=evadeChance("afterSwing",dt,heavy);why="afterSwing";ang=back+side*rnd(.2,1);dur=rnd(.3,.5);}
    // poca vida: retroceso errático
    else if(!chance&&low&&dist<5){chance=evadeChance("lowHp",dt,heavy);why="lowHp";ang=back+side*rnd(0,1.2);dur=rnd(.4,.7);}
    // finta errática ocasional
    else if(!chance&&dist<3.5){chance=evadeChance("feint",dt,heavy);ang=lat;dur=rnd(.2,.35);}
    if(!chance||Math.random()>Math.min(1,chance*this.chal.evade))return false;
    // no retroceder hacia una pared: elige la dirección libre
    const r=this.actorRadius(e),ok=(a:number)=>this.canOccupy(e.x+Math.cos(a)*.7,e.y+Math.sin(a)*.7,e.z,r);
    if(!ok(ang)){const alts=[ang+Math.PI/2,ang-Math.PI/2,lat,-lat];const f=alts.find(ok);if(f===undefined)return false;ang=f;}
    e.evadeA=ang;e.evadeT=dur;e.evadeMax=dur;e.evadeStyle=evadeStyle(heavy);e.evadeCd=rnd(EVADE.cooldown[0],EVADE.cooldown[1])*(low?.8:1);e.cd=Math.max(e.cd,dur+EVADE.recover);if(e.dodgedProj&&e.dodgedProj.size>20)e.dodgedProj.clear();{const n=dodgeNotice(this.dodgeMsgs,dist,ENEMY_TYPES[e.kind].name,why);if(n&&this.time-this.evadeMsgAt>.8){this.evadeMsgAt=this.time;this.float(n.text,n.color);}}return true;
  }
  /** Direction an enemy should walk: straight at the player when the lane is clear, else along the flow field. */
  navDir(e:Enemy,tx=this.px,ty=this.py):[number,number] {
    const dx=tx-e.x,dy=ty-e.y,d=Math.hypot(dx,dy)||1,r=this.actorRadius(e);
    // clear lane = rays from both body edges reach the target
    const ox=-dy/d*r,oy=dx/d*r;
    if((e.flowT??0)>0)e.flowT=(e.flowT??0)-1/60;
    if((e.flowT??0)<=0&&this.los(e.x+ox,e.y+oy,tx+ox,ty+oy,e.z+.3,e.z+.3)&&this.los(e.x-ox,e.y-oy,tx-ox,ty-oy,e.z+.3,e.z+.3))return [dx/d,dy/d];
    const cx=Math.floor(e.x),cy=Math.floor(e.y),here=this.flow[cy*MAP+cx];let best=here<0?1e9:here,bx=0,by=0;
    for(const [ox2,oy2] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const nx=cx+ox2,ny=cy+oy2;if(nx<0||ny<0||nx>=MAP||ny>=MAP)continue;const v=this.flow[ny*MAP+nx];if(v>=0&&v<best){best=v;bx=nx+.5;by=ny+.5;}}
    if(!bx)return [dx/d,dy/d];
    let vx=bx-e.x,vy=by-e.y,l=Math.hypot(vx,vy)||1;
    return [vx/l,vy/l];
  }
  separateActors() {
    // Resolve landing/teleport overlaps without ever pushing a body through masonry.
    for(let pass=0;pass<4;pass++) for(let i=0;i<this.enemies.length;i++) {const a=this.enemies[i];if(!a||a.dead||a.grabbed)continue;
      if(this.isSafe(a.x,a.y,this.actorRadius(a))) {const r=this.rooms.find(r=>r!==this.restRoom&&!this.isSafe(r.x+r.w/2,r.y+r.h/2));if(r){a.x=r.x+r.w/2;a.y=r.y+r.h/2;a.z=this.floorHeight(a.x,a.y);}a.tele=0;}
      if(Math.abs(a.z-this.pz)<BODY_HEIGHT) {const dx=a.x-this.px,dy=a.y-this.py,d=Math.hypot(dx,dy),min=this.actorRadius(a)+BODY_RADIUS;if(d<min){const ux=d>.001?dx/d:1,uy=d>.001?dy/d:0,nx=a.x+ux*(min-d+.002),ny=a.y+uy*(min-d+.002);if(this.canOccupy(nx,ny,a.z,this.actorRadius(a))&&!this.isSafe(nx,ny,this.actorRadius(a))){a.x=nx;a.y=ny;}}}
      for(let j=i+1;j<this.enemies.length;j++){const b=this.enemies[j];if(!b||b.dead||b.grabbed||Math.abs(a.z-b.z)>=BODY_HEIGHT)continue;const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),min=this.actorRadius(a)+this.actorRadius(b);if(d>=min)continue;const ux=d>.001?dx/d:1,uy=d>.001?dy/d:0,push=(min-d+.002)/2;
        for(const [e,sign] of [[a,-1],[b,1]] as const){const nx=e.x+ux*push*sign,ny=e.y+uy*push*sign;if(this.canOccupy(nx,ny,e.z,this.actorRadius(e))&&!this.isSafe(nx,ny,this.actorRadius(e))){e.x=nx;e.y=ny;}}
      }
    }
  }
  floorKills = 0; bossRequired = true;
  raid: { room: { x: number; y: number; w: number; h: number }; wave: number; timer: number; remaining: number } | null = null;
  fear = 0; visionT = 0; horrorCd = 0; bossPulseT = 8;
  // Hidden sanity meter (0-100). Never shown; raises odds of rare perception episodes.
  sanity = (() => { try { return Number(localStorage.getItem("ars_anima_sanity")) || 0; } catch { return 0; } })(); sanityFx: { fx: SanityFx; t: number } | null = null; sanityRollT = 1; phantoms: { x: number; y: number; kind: string; t: number }[] = [];
  lastHp = 0; lastPactCount = 0; burstQueue: { w: Item; prof: RangedProfile; mult: number; precision: boolean; left: number; t: number } | null = null; slideHits = new Set<number>();
  projSprites: Record<string, HTMLImageElement> = {};
  bumpSanity(ev: SanityEvent) { this.sanity = addSanity(this.sanity, ev); }
  denial: { action: "dash" | "magic" | "reload"; t: number } | null = null;
  depthPixels = new Float32Array(W * H);
  /** GPU frame contract (presentation only): per-pixel view depth, packed surface info
   *  [normal code, material id, emissive, wetness], sprite depth and the pre-sprite color. */
  gDepth = new Float32Array(W * H); gInfo = new Uint8Array(W * H * 4); sDepth = new Float32Array(W * H);
  gfxCam: FrameCamera | null = null; gfxRowRays = new Float32Array(H);
  rowRays = new Float64Array(H);
  groundTextures: Uint32Array[] = [];
  scenicProps: ScenicProp[] = [];
  scenicRooms = new Int16Array(MAP*MAP).fill(-1);
  scenicLight = new Float32Array(MAP*MAP*3);
  sceneryAt(x=this.px,y=this.py) { return sceneryTheme(this.region.id,this.scenicRooms[Math.floor(y)*MAP+Math.floor(x)]??-1,this.floor); }
  prepareScenery() {
    this.scenicProps=[];this.scenicRooms.fill(-1);this.scenicLight.fill(0);
    this.rooms.forEach((r,i)=>{
      const theme=sceneryTheme(this.region.id,i,this.floor);
      for(let y=r.y-1;y<=r.y+r.h;y++)for(let x=r.x-1;x<=r.x+r.w;x++)if(x>=0&&y>=0&&x<MAP&&y<MAP)this.scenicRooms[y*MAP+x]=i;
      for(let k=0;k<4;k++) {const x=k%2?r.x+r.w-1.3:r.x+1.3,y=k<2?r.y+1.4:r.y+r.h-1.4;
        if(!this.solid(x,y,this.floorHeight(x,y)))this.scenicProps.push({x,y,deco:theme.props[k%theme.props.length]});
      }
    });
    for(const p of this.scenicProps) {const l=LIGHTS[p.deco];if(!l)continue;
      for(let y=Math.max(0,Math.floor(p.y-l.radius));y<Math.min(MAP,p.y+l.radius);y++)for(let x=Math.max(0,Math.floor(p.x-l.radius));x<Math.min(MAP,p.x+l.radius);x++){
        const d=Math.hypot(x+.5-p.x,y+.5-p.y);if(d>=l.radius)continue;
        // Sample just inside solid surfaces so a wall receives light on its visible face.
        const tx=x+.5,ty=y+.5,steps=Math.ceil(d*8);let blocked=false;
        for(let k=1;k<steps-2;k++){const f=k/steps;if(this.solid(p.x+(tx-p.x)*f,p.y+(ty-p.y)*f,1,.05)){blocked=true;break;}}
        if(blocked)continue;const strength=(1-d/l.radius)**2*.4,id=(y*MAP+x)*3;
        for(let c=0;c<3;c++)this.scenicLight[id+c]+=l.color[c]*strength;
      }
    }
  }
  private grTiles: Int16Array | null = null; private grRooms: unknown = null; private grN = -1;
  /** Sala que contiene (x, y): tabla por casilla (se rehace al cambiar de piso) en lugar de Array.find por píxel. */
  roomAt(x: number, y: number) {
    if (this.grRooms !== this.rooms || this.grN !== this.rooms.length) { this.grRooms = this.rooms; this.grN = this.rooms.length; this.grTiles = buildRoomTiles(this.rooms, MAP); }
    const t = this.grTiles;
    if (!t || x < 0 || y < 0 || x >= MAP || y >= MAP) return this.rooms.find(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
    const i = t[Math.floor(y) * MAP + Math.floor(x)]!; return i >= 0 ? this.rooms[i] : undefined;
  }
  private gkGrid: Uint8Array | null = null; private gkKey: unknown = null; private gkRegion = ""; private gkRest: unknown = null;
  /** Tipo de suelo cacheado a media casilla (el dibujo en primera persona lo consulta por píxel). */
  groundKindFast(x: number, y: number) {
    if (x < 0 || y < 0 || x >= MAP || y >= MAP) return 2;
    if (!this.gkGrid || this.gkKey !== this.rooms || this.gkRegion !== this.region.id || this.gkRest !== this.restRoom) {
      const R = MAP * 2, gr = this.gkGrid ?? new Uint8Array(R * R); for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) gr[j * R + i] = this.groundKind((i + .5) / 2, (j + .5) / 2);
      this.gkGrid = gr; this.gkKey = this.rooms; this.gkRegion = this.region.id; this.gkRest = this.restRoom;
    }
    return this.gkGrid[(Math.floor(y * 2)) * MAP * 2 + Math.floor(x * 2)]!;
  }
  groundKind(x:number,y:number) {const room=this.roomAt(x,y);if(!room)return 2;if(room===this.restRoom)return 3;const path=Math.abs(x-(room.x+room.w/2))<.7||Math.abs(y-(room.y+room.h/2))<.7;if(path)return 2;return this.region.id==="port"?1:this.region.id==="garden"||this.region.id==="pits"?0:3;}
  /** Presentation-only light list for the GPU renderer (scenic props, player lantern, projectiles, explosions). */
  gfxLights(): FrameLight[] {
    const out: FrameLight[] = [];
    const hex = (c: string): [number, number, number] => { const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c); if (!m) return [1, .7, .4]; const h = m[1].length === 3 ? m[1].split('').map(ch => ch + ch).join('') : m[1]; return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]; };
    const lantern = this.darkness ? 1.4 : 0.9;
    out.push({ x: this.px, y: this.py, z: .5 + this.pz, r: 1, g: .82, b: .58, intensity: lantern * 2.2, radius: 6.5, type: 1, dx: Math.cos(this.ang), dy: Math.sin(this.ang), cone: .62, shadow: false, size: .05, priority: 0 });
    for (const p of this.scenicProps) { const l = LIGHTS[p.deco]; if (!l) continue; const flick = p.deco === 'gothic_lantern' || p.deco === 'votive' ? .88 + .12 * Math.sin(this.time * 11 + p.x * 3.1) * Math.sin(this.time * 7.3 + p.y) : 1;
      out.push({ x: p.x, y: p.y, z: this.floorHeight(p.x, p.y) + l.height, r: l.color[0] / 255, g: l.color[1] / 255, b: l.color[2] / 255, intensity: 3.2 * flick, radius: l.radius * 1.6, type: 0, shadow: true, heat: p.deco === 'votive' || p.deco === 'gothic_lantern', size: .12, priority: 2 }); }
    for (const p of this.pickups) { if (p.kind !== "decor" || p.used || (p.deco !== "fire" && p.deco !== "healing_brazier")) continue; const fl = flameFlicker(this.time, p.x * 3 + p.y); out.push({ x: p.x, y: p.y, z: this.floorHeight(p.x, p.y) + .3, r: p.deco === "fire" ? 1 : .5, g: p.deco === "fire" ? .6 : .95, b: p.deco === "fire" ? .25 : .7, intensity: 3 * fl.bright, radius: 4.5, type: 0, shadow: true, heat: true, size: .1, priority: 2 }); }
    for (const pr of this.projs) { if (out.length > 40) break; const [r, g, b] = hex(pr.color); out.push({ x: pr.x, y: pr.y, z: pr.z, r, g, b, intensity: 1.4, radius: 2.4, type: 0, shadow: false, size: .03, priority: 3 }); }
    for (const fx of this.explosions) { const k = Math.max(0, 1 - fx.t / EXPLOSION_DURATION); out.push({ x: fx.x, y: fx.y, z: fx.z + .5, r: 1, g: .55, b: .2, intensity: 14 * k, radius: 6, type: 0, shadow: true, heat: true, size: .4, priority: 1 }); }
    return out;
  }
  /** Occupancy grid for GPU shadow marching: [lo, hi] volume heights per cell in 0..255 (2.4 units = 255). */
  gfxOccupancy(out: Uint8Array) {
    for (let i = 0; i < MAP * MAP; i++) { const cell = this.map[i], v = cellVolume(cell); let lo = v ? v[0] : 0, hi = v ? v[1] : 0;
      if (cell === 6) { const a = this.doorAnim[i]; if (a !== undefined) lo = a * 2.4; }
      if (cell === 5 || cell === 7) hi = 0; // glass/low decor do not block light
      out[i * 2] = Math.round(Math.min(1, lo / 2.4) * 255); out[i * 2 + 1] = Math.round(Math.min(1, hi / 2.4) * 255); }
    return out;
  }
  dustT=0; ceilFxT=-9; sanT=0;
  /** Brillos de área de golpe: separados de las partículas físicas para no alterar su tope ni su simulación. */
  arcFx: Particle[] = [];
  xpMult() { return combatXpMultiplier(this.combo, this.killStreak); }
  sealLabel(seal: DoorSeal) { return seal.kind === "key" ? "Cerradura de hueso · llave o forzar" : seal.kind === "code" ? "Combinación · busca la nota" : seal.kind === "kills" ? `Sello: ${this.floorKills}/${seal.value} bajas` : seal.kind === "health" ? `Sello: PV ≥ ${Math.round(seal.value*100)}%` : seal.kind === "level" ? `Sello: nivel ${seal.value}` : "Sello: derrota al guardián"; }
  releaseSeal(i: number) { const seal = this.seals[i]; if (seal) { this.track("mechanisms", 1, `sello ${seal.kind}`); if (this.vaultDoors.has(i)) this.track("routes", 1, "pasaje de cámara del tesoro"); } if (seal) this.score.gain(this.vaultDoors.has(i) ? "secretDoor" : "keyDoor");
    if (this.forbiddenDoors.includes(i) && !this.forbiddenScaled) this.scaleForbidden();
    if (seal?.kind === "key") {
      const x=i%MAP+.5,y=Math.floor(i/MAP)+.5;
      const candidates=[[x+1,y],[x-1,y],[x,y+1],[x,y-1]].filter(([x,y])=>this.canOccupy(x,y,this.floorHeight(x,y)));
      const spot=candidates.sort((a,b)=>Math.hypot(a[0]-this.px,a[1]-this.py)-Math.hypot(b[0]-this.px,b[1]-this.py))[0] ?? [this.px,this.py];
      this.pickups.push({x:spot[0],y:spot[1],kind:"chest",quality:rewardRarity("key",this.floor),bob:0});
      this.msg("El sello libera un cofre de tesoro raro.");
    }
    for (const id of seal?.group ?? [i]) delete this.seals[id];
  }
  solveCode(i: number, answer: string) { const seal = this.seals[i]; if (seal?.kind !== "code") return false; if (answer !== seal.code) { this.alertNear(i%MAP+.5, Math.floor(i/MAP)+.5, 10); this.terror(2); this.msg("Combinación incorrecta: el archivo susurra."); return false; } this.releaseSeal(i); this.openDoor(i%MAP+.5, Math.floor(i/MAP)+.5); this.msg("Combinación correcta. El sello cede."); if (this.bossRequired && !this.exp.unlocked) { this.exp.unlocked = true; this.exp.noteRead = true; const dx = (i%MAP+.5) - this.px, dy = (Math.floor(i/MAP)+.5) - this.py, d = Math.hypot(dx, dy) || 1; this.spawnMapFragment(i%MAP+.5 + dx/d*1.3, Math.floor(i/MAP)+.5 + dy/d*1.3); this.msg("Dentro de la cámara brilla un fragmento de mapa."); } return true; }
  terror(intensity = 3) { this.fear = Math.min(10, this.fear + intensity); this.visionT = Math.max(this.visionT, 1.5 + intensity*.4); if (this.horrorCd <= 0) { this.bumpSanity("scream"); this.screamer = .55; this.gloom = Math.max(this.gloom, .55); this.horrorCd = 10; this.onSound("terror"); } }
  updateHorror(dt: number) {
    this.horrorCd = Math.max(0, this.horrorCd-dt); this.visionT = Math.max(0, this.visionT-dt); this.fear = Math.max(0, this.fear-dt*.3);
    if (this.denial) { this.denial.t -= dt; if (this.denial.t <= 0) this.denial = null; }
    if(this.isSafe()){this.denial=null;this.fear=0;this.visionT=0;this.screamer=0;return;}
    const boss = this.enemies.find(e => !e.dead && (e.kind === "librero" || e.miniBoss) && Math.hypot(e.x-this.px,e.y-this.py)<12 && this.los(e.x,e.y,this.px,this.py,e.z+.5,this.pz+.5));
    const distressed = this.hp < this.hpMax*.25 || !!this.wounds.CABEZA;
    if (boss) { this.bossPulseT -= dt; if (this.bossPulseT <= 0) { this.bossPulseT = 12; this.denial = { action: pick(["dash", "magic", "reload"] as const), t: 4 }; this.terror(4); this.float(`EL JEFE SELLA ${this.denial.action === "dash" ? "DASH" : this.denial.action === "magic" ? "MAGIA" : "RECARGA"} · 4s`, "#b58cff"); } }
    if (distressed && this.horrorCd <= 0 && Math.random() < dt*.15) this.terror(2);
    const swarm=this.enemies.filter(e=>!e.dead&&e.aware&&Math.hypot(e.x-this.px,e.y-this.py)<6).length;
    if(swarm>=3&&Math.random()<dt*.25){this.fear=Math.min(10,this.fear+1);this.visionT=Math.max(this.visionT,.8);if(Math.random()<.4)this.float(pick(["…te rodean…","no mires atrás","la tinta te nombra","CORRE"]),"#b58cff");}
  }
  canOccupy(x: number, y: number, z: number, radius = BODY_RADIUS, height = BODY_HEIGHT) {
    for (let cy = Math.floor(y-radius); cy <= Math.floor(y+radius); cy++) for (let cx = Math.floor(x-radius); cx <= Math.floor(x+radius); cx++) {
      const qx = clamp(x,cx,cx+1), qy = clamp(y,cy,cy+1);
      if ((qx-x)**2+(qy-y)**2 >= radius**2) continue;
      if (this.solid(cx+.5,cy+.5,z,height)) return false;
    } return true;
  }
  sweep(x: number, y: number, z: number, dx: number, dy: number, radius = BODY_RADIUS) {
    const steps = Math.max(1,Math.ceil(Math.hypot(dx,dy)/.1)); let hit = false;
    for(let n=0;n<steps;n++) { if(this.canOccupy(x+dx/steps,y,z,radius)) x+=dx/steps; else hit=true; if(this.canOccupy(x,y+dy/steps,z,radius)) y+=dy/steps; else hit=true; }
    return { x,y,hit };
  }
  tacticalSpawn(kind: EnemyKind, room: { x:number; y:number; w:number; h:number }, minDistance = 0) {
    const candidates: {x:number;y:number;score:number}[]=[]; const pat=ENEMY_TYPES[kind].pattern;
    for(let y=room.y;y<room.y+room.h;y++) for(let x=room.x;x<room.x+room.w;x++) {
      const z=this.floorHeight(x+.5,y+.5), distance=Math.hypot(x+.5-this.px,y+.5-this.py);
      if(distance<minDistance || !this.canOccupy(x+.5,y+.5,z,.28) || this.enemies.some(e=>!e.dead && Math.hypot(e.x-x-.5,e.y-y-.5)<.8)) continue;
      const cover=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>this.solid(x+dx+.5,y+dy+.5,z)).length;
      candidates.push({x:x+.5,y:y+.5,score: Math.random()+ (pat==="ranged" ? z*8+cover+distance*.1 : pat==="jumper" || pat==="blink" ? z*5+cover : pat==="charger" ? -cover*2 : cover*2)});
    } candidates.sort((a,b)=>b.score-a.score); const at=candidates[0]; if(!at) return false; const before=this.enemies.length; this.spawn(kind,at.x,at.y); if(this.enemies.length>before && minDistance>0) {const e=this.enemies[this.enemies.length-1];if(e)e.aware=true;} return this.enemies.length>before;
  }
  beginRaid() { if (this.collapse || this.region.id === "garden" || this.raid) return; const room=this.rooms.find(r=>this.px>=r.x&&this.px<r.x+r.w&&this.py>=r.y&&this.py<r.y+r.h) ?? this.rooms[1]; if(!room || room === this.rooms[0]) return; this.raid={room,wave:0,timer:1,remaining:3}; this.eventName="RAID DE LOS DESHILADOS"; this.eventLeft=25; this.msg("La tinta vuelve a poblar la sala: tres oleadas."); }
  environmentImpact(x:number,y:number,z:number, destructive=false) {
    this.burst(x,y,z,"#9f9290",destructive?20:7);
    const keg=this.pickups.find(p=>!p.used&&p.kind==="decor"&&p.deco==="powder"&&Math.hypot(p.x-x,p.y-y)<.8);
    if(keg){this.detonateKeg(keg);return;}
    const prop=this.pickups.find(p=>!p.used&&p.kind==="decor"&&p.deco!=="powder"&&Math.hypot(p.x-x,p.y-y)<.8&&propBreakOutcome(p.deco??"book",0)!=="none");
    if(prop) { prop.used=true; this.shatter(prop.x,prop.y,this.floorHeight(prop.x,prop.y),prop.deco??"book");
      const out=propBreakOutcome(prop.deco??"book",Math.random());
      if(out==="scatter"&&Math.random()<.18&&!this.isSafe(prop.x,prop.y)){this.debris.push({x:prop.x+rnd(-.4,.4),y:prop.y+rnd(-.4,.4),t:.9});this.msg("¡Cascotes caen del techo!");}
      if(out==="reward")this.dropPropReward(prop.x,prop.y); else if(out==="splinters")this.splinters(prop.x,prop.y); }
    if(destructive && this.cell(x,y)===7) this.map[Math.floor(y)*MAP+Math.floor(x)]=0;
    if(destructive) this.breakCover(Math.floor(y)*MAP+Math.floor(x));
  }

  /** Destrozo: trozos, aserrín/polvo según material. */
  shatter(x:number,y:number,z:number,deco:string) {
    const m=propMaterial(deco);
    const chunk=m==="wood"?"#6b4a2a":m==="bone"?"#e8dfc8":m==="plant"?"#3f6a2a":"#5a5058";
    const fine=m==="wood"?"#c9a46a":m==="bone"?"#b8ae98":m==="plant"?"#8aa04a":"#9f9290";
    for(let i=0;i<10;i++)this.parts.push({x,y,z:z+.3,vx:rnd(-3.5,3.5),vy:rnd(-3.5,3.5),vz:rnd(2,5),life:rnd(.9,1.8),color:chunk,size:rnd(.07,.13)});
    for(let i=0;i<22;i++)this.parts.push({x:x+rnd(-.2,.2),y:y+rnd(-.2,.2),z:z+rnd(.1,.5),vx:rnd(-1,1),vy:rnd(-1,1),vz:rnd(.2,1.5),life:rnd(.6,1.4),color:fine,size:rnd(.02,.05)});
    this.onSound("break");this.shake=Math.max(this.shake,.08);
  }
  detonateKeg(k: Pickup) {
    if(k.used)return; k.used=true;
    this.float("¡BARRIL DE PÓLVORA!","#ff9a2a");
    this.burst(k.x,k.y,.8,"#ff5a1a",40);this.burst(k.x,k.y,1.2,"#3a2a2a",25);
    this.score.gain("barrel"); this.explode(k.x,k.y,POWDER_KEG.radius,kegDamage(this.floor),false);
    this.shake=Math.max(this.shake,.6);this.alertNear(k.x,k.y,12);
    // Chain reaction: nearby kegs go off too.
    for(const o of this.pickups)if(!o.used&&o.deco==="powder"&&Math.hypot(o.x-k.x,o.y-k.y)<POWDER_KEG.radius*.8)this.detonateKeg(o);
  }
  isBench(p: Pickup) { return p.kind === "bench" || (p.kind === "decor" && p.deco === "bench"); }
  /** Lo único con lo que se interactúa: lo más cercano y delante del jugador. */
  focusPickup(): Pickup | null {
    const KINDS = ["shop","chest","trap","altar","portal","lore","sanctuary","note","pactstone","palimpsest","folio","mapfrag","cipherlock"];
    let best: Pickup | null = null, bs = Infinity;
    for (const p of this.pickups) {
      if (p.used) continue; const powder = p.deco === "powder";
      if (!(KINDS.includes(p.kind) || this.isBench(p) || powder)) continue; if (p.kind === "trap" && !p.armed) continue;
      const d = Math.hypot(p.x - this.px, p.y - this.py); if (d > (p.kind === 'portal' ? PORTAL.interactRadius : powder ? POWDER_KEG.reach : 1.4)) continue;
      if (p.kind === 'portal' && !this.los(this.px, this.py, p.x, p.y, this.pz + .5, this.floorHeight(p.x, p.y) + .5)) continue;
      const diff = Math.abs(((Math.atan2(p.y - this.py, p.x - this.px) - this.ang) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      if (d > .55 && diff > .95) continue; const sc = d + diff * .7; if (sc < bs) { bs = sc; best = p; }
    }
    return best;
  }
  focusList() { const p = this.focusPickup(); return p ? [p] : []; }
  /** Separa cofres, mercader, bancos, decoración y puertas para que no se solapen. */
  spreadPickups() {
    const big = (p: Pickup) => ["shop","chest","altar","pactstone","trap","sanctuary","note","lore","portal","palimpsest","cipherlock"].includes(p.kind) || this.isBench(p) || ["powder","fountain","healing_brazier"].includes(p.deco ?? "");
    const fixed = (p: Pickup) => ["portal","lore","shop","sanctuary","mapfrag"].includes(p.kind) || !!p.vault;
    const nearDoor = (x: number, y: number) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const cx = Math.floor(x) + dx, cy = Math.floor(y) + dy; if (cx < 0 || cy < 0 || cx >= MAP || cy >= MAP) continue; const c = this.map[cy * MAP + cx]; if ((c === 6 || c === 3) && Math.hypot(cx + .5 - x, cy + .5 - y) < 1.5) return true; } return false; };
    const rank = (p: Pickup) => fixed(p) ? 2 : big(p) ? 1 : 0; const placed: Pickup[] = [];
    for (const p of [...this.pickups].sort((a, b) => rank(b) - rank(a))) {
      if (p.used) continue;
      const minD = (q: Pickup) => p.kind === 'portal' || q.kind === 'portal' ? PORTAL.clearance : big(p) && big(q) ? 2 : (p.kind === "decor" || q.kind === "decor") ? .9 : .6;
      const ok = (x: number, y: number) => !this.solid(x, y, this.floorHeight(x, y)) && !nearDoor(x, y) && placed.every(q => Math.hypot(q.x - x, q.y - y) >= minD(q));
      if (fixed(p) || ok(p.x, p.y)) { placed.push(p); continue; }
      const room = this.rooms.find(r => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h); let done = false;
      if (room) for (let k = 0; k < 40 && !done; k++) { const x = room.x + rnd(.8, Math.max(.9, room.w - .8)), y = room.y + rnd(.8, Math.max(.9, room.h - .8)); if (ok(x, y)) { p.x = x; p.y = y; done = true; } }
      if (done || p.kind !== "decor") placed.push(p); else p.used = true;
    }
  }
  /** Mercader errante: muy de vez en cuando y sólo en una sala lejana sin otro mercader. */
  spawnWanderingMerchant() {
    if (this.merchantCd > 0) { this.msg("Se oyen fichas tintinear a lo lejos… pero nadie aparece."); return; }
    const shops = this.pickups.filter(p => p.kind === "shop" && !p.used);
    const far = this.rooms.filter(r => r !== this.restRoom && r !== this.bossRoom).map(r => ({ r, x: r.x + r.w / 2, y: r.y + r.h / 2 }))
      .filter(c => Math.hypot(c.x - this.px, c.y - this.py) > 16 && shops.every(s => Math.hypot(s.x - c.x, s.y - c.y) > 20) && !this.solid(c.x, c.y));
    if (!far.length) { this.msg("Se oyen fichas tintinear a lo lejos… pero nadie aparece."); return; }
    const c = pick(far); this.pickups.push({ x: c.x, y: c.y, kind: "shop", bob: 0 }); this.merchantCd = rnd(240, 360);
    const z = this.zones.find(z => c.x >= z.x && c.x < z.x + z.w && c.y >= z.y && c.y < z.y + z.h);
    this.msg(`Un mercader errante instala su farol lejos de aquí${z ? `: ${z.name}` : ""}.`);
  }
  /** Fin de nivel: méritos de portal, nivel y 100%; muestra el recuento. */
  finishFloor() {
    this.score.gain("portal"); this.score.gain("floor");
    const loot = ["item","gold","mat","food","water","ammo","key"];
    const checks = [
      { label: "Sin recibir daño", ok: this.floorDamage <= 0 },
      { label: "Todas las salas limpias", ok: [...this.combatZones].every(z => this.clearedZones.has(z)) },
      { label: "Todos los cofres abiertos", ok: !this.pickups.some(p => p.kind === "chest" && !p.used) },
      { label: "Todo el botín recogido", ok: !this.pickups.some(p => !p.used && loot.includes(p.kind)) },
      { label: "Todos los secretos", ok: this.mapDone && this.secretSeen.size > 0 },
      { label: "Buen tiempo", ok: this.score.floorT < 240 + this.floor * 60 },
    ];
    const met = checks.filter(c => c.ok).length;
    if (met === checks.length) this.score.gain("perfect"); else if (met >= 4) this.score.add("perfect", Math.round(SCORE.perfect * met / checks.length * .4));
    this.recapChecks = checks;
    const won = this.floor === 6; this.recap = this.score.recap(won ? "won" : "floor", this.floor);
    this.runFloors = [...this.runFloors.filter(f => f.floor !== this.floor), { floor: this.floor, region: this.region.name, score: this.recap.floorScore, grade: this.recap.grade, seconds: this.recap.seconds, kills: this.floorKills, checks: met, checksTotal: checks.length, highlights: this.recap.lines.filter(l => l.points > 0).slice(0, 3).map(l => `${l.label} +${l.points}`) }];
    this.chronicles.finish(won ? "won" : "transition", this.floor, this.time, "", this.extractionConditions);
    if (!won) try { this.onFloorEnd(); } catch { /* opcional */ }
    if (won) this.endRun("won");
    if (won) { localStorage.setItem("ars_anima_score_bonus", String(this.recap.bonus)); this.mode = "won"; } else this.mode = "recap";
    this.onUI();
  }
  continueFloor() {
    const b = this.recap?.bonus ?? 0; this.recap = null; { const sb = this.openSkills(); this.floor++; this.checkSkillUnlocks(sb); } this.chronicles.nextFloor(this.floor); this.extractionConditions = {}; this.genFloor(); this.gainXp(50);
    if (b > 0) { this.gold += b; this.msg(`Bono de calificación: +${b} fichas.`); }
    this.mode = "play"; this.saveRun(); this.onUI();
  }
  stealKeg(target?: Pickup) {
    const k=target ?? this.pickups.find(p=>!p.used&&p.deco==="powder"&&Math.hypot(p.x-this.px,p.y-this.py)<=POWDER_KEG.reach);
    if(!k)return false; k.used=true; const n=ri(POWDER_KEG.steal[0],POWDER_KEG.steal[1]); this.bombs+=n;
    this.float(`+${n} BOMBA${n>1?"S":""}`,"#ffb347");this.msg(`Vacías el barril de pólvora: +${n} bomba${n>1?"s":""} (X para lanzar).`);this.onSound("pickup");return true;
  }
  dropPropReward(x:number,y:number) {
    const r=Math.random();
    if(r<.1)this.pickups.push({x,y,kind:"item",item:Math.random()<.75?this.makeWeapon():this.makeArmor(),bob:0});
    else if(r<.45)this.pickups.push({x,y,kind:"gold",n:ri(3,8)*this.floor,bob:0});
    else if(r<.65)this.pickups.push({x,y,kind:"mat",mat:pick(this.region.mats??Object.keys(MATERIALS)),n:ri(1,2),bob:0});
    else if(r<.85)this.pickups.push({x,y,kind:pick(["food","water"] as const),bob:0});
    else this.pickups.push({x,y,kind:"ammo",bob:0});
    this.float("¡ALGO CAE DE LOS RESTOS!","#ffd34a");this.onSound("pickup");
  }
  /** Astillas: dañan y hacen sangrar brevemente a quien esté cerca, jugador o criatura. */
  splinters(x:number,y:number) {
    this.burst(x,y,.4,"#8a5a2a",22);this.onSound("break");this.shake=Math.max(this.shake,.15);
    if(!this.isSafe()&&Math.hypot(this.px-x,this.py-y)<SPLINTER.radius){this.hurtPlayer(SPLINTER.damage,"astillas");if(!this.isSafe())this.bleed=Math.max(this.bleed,SPLINTER.bleed);this.float("ASTILLAS · SANGRADO","#ff5050");}
    for(const e of this.enemies)if(!e.dead&&Math.hypot(e.x-x,e.y-y)<SPLINTER.radius){this.damageEnemy(e,4,1);e.bleed=Math.max(e.bleed,SPLINTER.bleed);}
  }
  breakCover(id: number) {
    if(!this.breakables.has(id) || this.map[id]!==10)return false;
    this.map[id]=0;this.breakables.delete(id);
    this.burst(id%MAP+.5,Math.floor(id/MAP)+.5,.6,"#9f9290",28);this.onSound("break");this.shake=Math.max(this.shake,.2);return true;
  }
  enemyBreach(e: Enemy, id: number) {
    if(this.map[id]!==6 || this.seals[id] || this.doorAnim[id]!==undefined || this.isSafe(e.x,e.y))return false;
    const x=id%MAP+.5,y=Math.floor(id/MAP)+.5;
    if(this.isSafe(x,y,.6) || !this.openDoor(x,y,4))return false;
    this.burst(x,y,.7,"#9f9290",25);this.shake=Math.max(this.shake,.25);
    this.msg("¡Una criatura revienta la puerta!");this.terror(2);return true;
  }
  prepareAmbushes() {
    if(this.region.id==="garden")return;
    const SOURCES=["techo","balcón","escombros","rincón oscuro","candelabro","ventana","pilar","puerta"];
    this.rooms.slice(1,-1).forEach((room,i)=>{
      const zone=this.zoneAt(room.x+room.w/2,room.y+room.h/2);
      const pool=this.enemies.filter(e=>!e.dead&&!e.miniBoss&&!e.ambush&&e.x>=room.x&&e.x<room.x+room.w&&e.y>=room.y&&e.y<room.y+room.h).sort((a,b)=>(a.kind==="vigia"?1:0)-(b.kind==="vigia"?1:0));
      const want=Math.min(pool.length,this.floor>=3?2:1);
      for(let k=0;k<want;k++){const e=pool[k];if(e)this.placeAmbusher(e,room,zone,SOURCES[(i*2+k+this.floor)%SOURCES.length]!,pool);}
    });
  }
  placeAmbusher(e: Enemy, room:{x:number;y:number;w:number;h:number}, zone:string, source:string, pool:Enemy[]) {
    let cover:number|undefined, door:number|undefined;
    if(["techo","candelabro"].includes(source)) {
      if(this.cell(e.x,e.y)!==0){const at=pool.find(a=>this.cell(a.x,a.y)===0);if(!at)return;e.x=at.x;e.y=at.y;}
      e.z=1.65;e.vz=0;
      if(source==="candelabro")this.pickups.push({x:e.x,y:e.y,z:1.8,kind:"decor",deco:"candle",bob:0});
    } else if(["balcón","ventana","pilar"].includes(source)) {
      let found=false;for(let y=room.y;y<room.y+room.h&&!found;y++)for(let x=room.x;x<room.x+room.w;x++)if(this.cell(x+.5,y+.5)===8&&this.canMoveActor(x+.5,y+.5,1.08,this.actorRadius(e),e)){e.x=x+.5;e.y=y+.5;e.z=1.08;found=true;break;}
      if(!found)source="rincón oscuro";
    } else if(source==="puerta") {
      // Hidden behind a closed, unsealed door of this room; it bursts through when the player is inside.
      for(const id of this.doors){if(this.seals[id]||this.map[id]!==6)continue;const x=id%MAP,y=Math.floor(id/MAP);if(x<room.x-1||x>room.x+room.w||y<room.y-1||y>room.y+room.h)continue;
        const ox=x<room.x?x-1:x>=room.x+room.w?x+1:x,oy=y<room.y?y-1:y>=room.y+room.h?y+1:y;
        if(ox===x&&oy===y)continue;if(this.cell(ox+.5,oy+.5)!==0||!this.canMoveActor(ox+.5,oy+.5,0,this.actorRadius(e),e))continue;
        e.x=ox+.5;e.y=oy+.5;e.z=0;door=id;break;}
      if(door===undefined)source="escombros";
    }
    if(source==="escombros")for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=Math.floor(e.x)+dx,y=Math.floor(e.y)+dy,id=y*MAP+x;if(x>room.x&&x<room.x+room.w-1&&y>room.y&&y<room.y+room.h-1&&this.map[id]===0&&!this.pickups.some(p=>p.kind!=="decor"&&Math.hypot(p.x-x-.5,p.y-y-.5)<1)&&!this.enemies.some(a=>a!==e&&Math.hypot(a.x-x-.5,a.y-y-.5)<1)){this.map[id]=10;this.breakables.add(id);cover=id;break;}}
    e.aware=false;e.ambush={source,stage:"hidden",timer:0,cover,door,room:zone};
  }
  updateAmbush(e: Enemy, dt:number) {
    const a=e.ambush;if(!a)return false;
    if(e.stagger>0 || (e.stun??0)>0 || e.hurt>0){e.ambushed=true;e.ambush=undefined;e.aware=true;return false;}
    const dist=Math.hypot(e.x-this.px,e.y-this.py),sameRoom=this.zoneAt(e.x,e.y)===this.zoneAt();
    if(this.isSafe())return true;
    if(a.stage==="hidden") {
      const visible=this.los(e.x,e.y,this.px,this.py,e.z+.2,this.pz+.5);
      if(a.door!==undefined){if(dist>5.5||this.zoneAt()!==a.room)return true;}
      else if(dist>4.5 || !sameRoom || (!visible&&a.cover===undefined))return true;
      const facing=Math.abs(Math.atan2(Math.sin(Math.atan2(e.y-this.py,e.x-this.px)-this.ang),Math.cos(Math.atan2(e.y-this.py,e.x-this.px)-this.ang)))<.7;
      if(a.door===undefined&&facing&&dist>2.3&&!e.aware)return true;
      a.stage="warning";a.timer=.75;e.tele=.75;
      this.msg(`Crujido en ${a.source}…`);this.onSound("event");this.burst(e.x,e.y,e.z+.2,"#d6b17b",6);return true;
    }
    a.timer-=dt;
    if(a.stage==="warning") {
      e.tele=Math.max(0,a.timer);if(a.timer>0)return true;
      if(a.cover!==undefined)this.breakCover(a.cover);
      if(a.door!==undefined&&this.map[a.door]===6)this.enemyBreach(e,a.door);
      const toE=Math.atan2(e.y-this.py,e.x-this.px),behind=Math.abs(Math.atan2(Math.sin(toE-this.ang),Math.cos(toE-this.ang)))>1.6;
      if(behind){this.screamer=.35;this.terror(5);this.float("¡DETRÁS DE TI!","#ff2a4a");}
      a.stage="strike";a.timer=.65;a.tx=this.px;a.ty=this.py;
      e.aware=true;e.ambushed=true;e.vz=e.z>.7?-3:4;
      this.terror(3);this.msg(`¡EMBOSCADA desde ${a.source}!`);return true;
    }
    const dx=(a.tx??e.x)-e.x,dy=(a.ty??e.y)-e.y,distance=Math.hypot(dx,dy),speed=Math.min(8,distance/Math.max(.05,a.timer+dt));
    const moved=this.sweepActor(e.x,e.y,e.z,dx/(distance||1)*speed*dt,dy/(distance||1)*speed*dt,this.actorRadius(e),e);e.x=moved.x;e.y=moved.y;
    e.vz-=16*dt;e.z=Math.max(this.floorHeight(e.x,e.y),e.z+e.vz*dt);
    if(a.timer<=0){
      if(Math.hypot(e.x-this.px,e.y-this.py)<1.7&&Math.abs(e.z-this.pz)<1&&this.los(e.x,e.y,this.px,this.py,e.z+.5,this.pz+.5))this.hurtPlayer(ENEMY_TYPES[e.kind].dmg*this.enemyDmg(e),"emboscada");
      e.ambush=undefined;e.tele=0;e.cd=1.2;this.burst(e.x,e.y,e.z,"#9f9290",12);
    }return true;
  }

  roomIntel() {
    // Flood through physically traversable volumes and doors whose requirements are met.
    const reachable=new Set<number>(),queue=[Math.floor(this.py)*MAP+Math.floor(this.px)];
    const state={keys:this.keys,kills:this.floorKills,hp:this.hp,hpMax:this.hpMax,level:this.level,bossDead:this.bossDead};
    for(let n=0;n<queue.length;n++){const id=queue[n];if(id===undefined||reachable.has(id)||id<0||id>=MAP*MAP)continue;const cell=this.map[id];
      if(![0,5,6,7,8,9].includes(cell))continue;
      if(cell===6&&this.seals[id]&&!sealSatisfied(this.seals[id],state))continue;
      reachable.add(id);const x=id%MAP,y=Math.floor(id/MAP);if(x>0)queue.push(id-1);if(x<MAP-1)queue.push(id+1);if(y>0)queue.push(id-MAP);if(y<MAP-1)queue.push(id+MAP);
    }
    return this.zones.map(zone=>{
      const inside=(p:{x:number;y:number})=>p.x>=zone.x&&p.x<zone.x+zone.w&&p.y>=zone.y&&p.y<zone.y+zone.h;
      const enemies=this.enemies.filter(e=>!e.dead&&inside(e)),loot=this.pickups.filter(p=>!p.used&&inside(p));
      const doors=[...this.doors].filter(id=>{const x=id%MAP,y=Math.floor(id/MAP);return x>=zone.x-1&&x<=zone.x+zone.w&&y>=zone.y-1&&y<=zone.y+zone.h&&(x<zone.x||x>=zone.x+zone.w||y<zone.y||y>=zone.y+zone.h);}).map(id=>({id,x:id%MAP,y:Math.floor(id/MAP),open:this.map[id]!==6,opening:this.doorAnim[id]!==undefined,blocked:!!this.seals[id]&&!sealSatisfied(this.seals[id],state),requirement:this.seals[id]?this.sealLabel(this.seals[id]):null}));
      let accessible=false;for(let y=zone.y;y<zone.y+zone.h&&!accessible;y++)for(let x=zone.x;x<zone.x+zone.w;x++)if(reachable.has(y*MAP+x)){accessible=true;break;}
      const bossRoom=!!this.bossRoom&&inside({x:this.bossRoom.x+.5,y:this.bossRoom.y+.5});
      const objectives:string[]=[];if(loot.some(p=>p.kind==="lore"))objectives.push(this.region.objective);if(this.contract&&!this.contract.done&&enemies.length)objectives.push(`${this.contract.name}: ${this.contract.kills}/${this.contract.goal}`);if(this.sideQuest&&!this.sideQuest.complete&&(this.sideQuest.kind==="kill"?enemies.length:this.sideQuest.kind==="chest"?loot.some(p=>p.kind==="chest"):this.sideQuest.kind==="collect"?loot.some(p=>p.kind==="mat"):false))objectives.push(`${this.sideQuest.title}: ${this.sideQuest.progress}/${this.sideQuest.count}`);
      return {...zone,accessible,visited:this.visitedZones.has(zone.name),cleared:this.clearedZones.has(zone.name),doors,enemies:enemies.length,ambushers:enemies.filter(e=>e.ambush).length,enemyKinds: [...new Set(enemies.filter(e=>!e.ambush||this.visitedZones.has(zone.name)).map(e=>e.kind))],chests:loot.filter(p=>p.kind==="chest").length,chestQuality:loot.filter(p=>p.kind==="chest").map(p=>p.quality??0),items:loot.filter(p=>p.kind==="item").length,qualities:loot.filter(p=>p.kind==="item").map(p=>p.item?.rarity??0),resources:loot.filter(p=>["mat","gold","food","water","ammo","key"].includes(p.kind)).length,shop:loot.some(p=>p.kind==="shop"),traps:loot.filter(p=>p.kind==="trap"&&p.armed).length,miniBoss:enemies.some(e=>e.miniBoss),boss:bossRoom?(this.bossDead?"derrotado":this.bossRequired?"obligatorio":"opcional"):null,objectives,alteration:this.alterationAt(zone.x+.5,zone.y+.5)?.name};
    });
  }

  mod(a: string) { return modD120(this.attrs[a] ?? (this.cls.raw as Record<string, number>)[a] ?? 60); }
  masteryForGrade() { return this.grado >= 9 ? 3 : this.grado >= 6 ? 2 : this.grado >= 3 ? 1 : 0; }
  soulState() { return this.cycles >= 100 ? "Culminación" : this.cycles >= 90 ? "Umbral" : this.cycles >= 70 ? "Armonía" : this.cycles >= 50 ? "Disonancia" : this.cycles >= 30 ? "Resonancia" : this.cycles >= 10 ? "Susurro" : "Silencio"; }
  has(s: string) { return this.skills.has(s); }
  hasP(s: string) { return this.pacts.some((p) => p.id === s); }
  hasE(s: string) { return this.epiph.some((p) => p.id === s); }

  msg(t: string) { if (this.log[0] !== t) this.onSound("notice"); this.log.unshift(t); this.log = this.log.slice(0, 6); }
  float(text: string, color = "#fff") { this.floats.push({ text, color, t: 1.2, x: rnd(-30, 30), y: rnd(-10, 10) }); }
  /** Anuncia la causa de cada pérdida de vida: nada le quita PV al jugador sin un aviso visible. */
  announceHurt(dmg: number, src: string) { this.track("damageTaken", Math.max(0, dmg), src); const c = damageCause(src); this.lastHurt = c.label; this.hurtCounts[c.label] = (this.hurtCounts[c.label] ?? 0) + 1; this.floats.push({ text: `-${Math.max(1, Math.round(dmg))} PV · ${c.label.toUpperCase()}`, color: c.color, t: 1, x: rnd(-12, 12), y: 0, hurt: true }); }
  /** Aviso espaciado para daño continuo (fuego, veneno, sangrado): recuerda la causa sin inundar la pantalla. */
  dotHurt(src: string, dt: number) { this.track("damageTaken", dt * (src === "fuego" ? 3 : src === "veneno" ? 1.5 : 1), src); const c = damageCause(src); this.lastHurt = c.label; const t = (this.dotMsgCd[src] ?? 0) - dt; if (t <= 0) { this.dotMsgCd[src] = 2.5; this.hurtCounts[c.label] = (this.hurtCounts[c.label] ?? 0) + 1; this.floats.push({ text: `-PV · ${c.label.toUpperCase()}`, color: c.color, t: 1, x: rnd(-12, 12), y: 0, hurt: true }); } else this.dotMsgCd[src] = t; }

  recalc() {
    const res = this.mod("RES"), agi = this.mod("AGI"), int = this.mod("INT"), vol = this.mod("VOL"), pre = this.mod("PRE");
    this.mastery = this.masteryForGrade();
    // Fórmulas d120 de Ars Anima, Edición 2. Los bonos de habilidades/pactos se aplican después.
    const lb = levelBonus(this.level);
    this.hpMax = Math.max(1, 20 + lb.hp + this.levelPerks.hp + res * 5 + this.grado * 3 + (this.has("piel") ? 15 : 0) - (this.hasP("sangre") && !isPariah(this.cls.id) ? 20 : 0));
    this.stamMax = Math.max(1, 6 + agi + res + lb.stam + this.levelPerks.stam);
    this.mhMax = Math.max(1, 8 + vol + pre); this.mh = Math.min(this.mh, this.mhMax);
    this.lumbreMax = Math.max(1, 4 + int + vol + this.mastery + (this.has("lumbre1") ? 3 : 0) + (["resonante", "hereje"].includes(this.cls.id) ? 2 : 0));
    this.def = Math.max(1, 10 + agi + (this.armor?.def ?? 0) + (["guardian", "guerrero"].includes(this.cls.id) ? 2 : 0));
    this.breakMax = Math.max(1, 6 + res * 2 + (this.armor?.def ?? 0));
    this.capacity = Math.max(1, 5 + res);
    this.dashes = 2 + (this.hasP("vacio") ? 1 : 0);
    this.hp = Math.min(this.hp, this.hpMax); this.stam = Math.min(this.stam, this.stamMax);
    this.breakValue = Math.min(this.breakValue, this.breakMax);
  }

  gainCycle(source = "Recuerdo") {
    if (this.cycles >= 100) return;
    this.cycles = Math.min(100, this.cycles + 1);
    this.lumbre = Math.min(this.lumbreMax, this.lumbre + d(2, 4));
    this.resonance = Math.min(3, this.resonance + 1);
    try { localStorage.setItem("ars_anima_cycles", String(this.cycles)); } catch { /* Local save is optional. */ }
    this.msg(`${source}: +1 Ciclo · ${this.soulState()}`);
    this.float("ECO DE OTRA VIDA", "#b58cff");
    this.onUI();
    if (this.cycles >= 10 && this.cycles % 10 === 0) this.offerEpiphany();
  }

  gainMT() {
    if (this.mtAwardedRun || this.grado >= 10) return;
    this.mtAwardedRun = true; this.mt++;
    this.msg(`Marca de Trascendencia ${this.mt}/3: un desafío dejó huella.`);
    if (this.mt >= 3) {
      this.mt = 0; this.grado = Math.min(10, this.grado + 1); this.sp++;
      this.recalc(); this.hp = Math.min(this.hpMax, this.hp + 3);
      this.float(`GRADO ${this.grado}: ${["", "Despertar", "Primer Dominio", "Expresión", "Refinamiento", "Firma", "Revelación", "Sinergia", "Maestría", "Umbral Personal", "Obra Viviente"][this.grado]}`, "#ffd34a");
    }
    try { localStorage.setItem("ars_anima_grado", String(this.grado)); localStorage.setItem("ars_anima_mt", String(this.mt)); } catch { /* Persistent progression is optional. */ }
    this.onUI();
  }

  activatePact() {
    if (this.activePact) { this.float("EL PACTO ANTERIOR SIGUE COBRANDO", "#b58cff"); return; }
    const target = this.nearestFacing(2.5, 1.35);
    const validFor = (x: Pact) => x.id === "sangre" ? !!target && target.stagger > 0 : x.id === "ceniza" ? this.burn > 0 || this.weather === 1 || this.weather === 2 : x.id === "vacio" ? this.pz > 0.25 || this.onWall : x.id === "hambre" ? this.food < 40 || this.hp < this.hpMax * .5 : x.id === "dados" ? this.combo >= 3 : !!this.pickups.find((k) => !k.used && ["chest", "altar"].includes(k.kind) && Math.hypot(k.x - this.px, k.y - this.py) < 2.6) || !!this.bossRoom && Math.hypot((this.bossRoom.x + this.bossRoom.w / 2) - this.px, (this.bossRoom.y + this.bossRoom.h / 2) - this.py) < 5;
    const p = [...this.pacts].reverse().find((x) => (this.pactCooldowns[x.id] ?? 0) <= 0 && validFor(x));
    if (!p) { const next = [...this.pacts].reverse().find((x) => (this.pactCooldowns[x.id] ?? 0) <= 0); this.float(next ? `NO SE CUMPLE: ${next.trigger}` : "NINGÚN PACTO DISPONIBLE", "#b58cff"); return; }
    const canPay = p.resource === "PV" ? this.hp > p.cost : p.resource === "AGU" ? this.stam >= p.cost : p.resource === "LUM" ? this.lumbre >= p.cost : this.food >= p.cost;
    if (!canPay) { this.float(`PRECIO INSUFICIENTE: ${p.price}`, "#ff7777"); return; }
    if (p.resource === "PV") this.hp -= p.cost; else if (p.resource === "AGU") this.stam -= p.cost; else if (p.resource === "LUM") this.lumbre -= p.cost; else this.food -= p.cost;
    this.score.gain("pact"); this.bumpSanity("pact"); this.activePact = { id: p.id, t: p.duration, hits: p.id === "ceniza" ? 3 : p.id === "dados" ? 3 : 1, failed: false };
    this.pactCooldowns[p.id] = p.cooldown; this.onSound("pact");
    if (p.id === "babel") for (const e of this.enemies) if (!e.dead) { e.hpMax *= 1.25; e.hp *= 1.25; }
    this.msg(`${p.name}: ${p.boon} · Precio pagado: ${p.price}.`);
    this.float("PACTO ACTIVADO", "#c58cff"); this.onUI();
  }


  // ---------- generación ----------
  makeWeapon(type?: string, rarity?: number, loot?: { variant?: string; affix?: AffixId }): Item {
    const raw = type ? WEAPONS.find((w) => w.type === type)! : pick(WEAPONS);
    const r = rarity ?? (() => { const x = ri(1, 100) + this.floor * 3; return x < 50 ? 0 : x < 75 ? 1 : x < 90 ? 2 : x < 98 ? 3 : 4; })();
    const keys = Object.keys(AFFIXES) as AffixId[];
    const affixes: AffixId[] = [];
    if (loot?.affix) affixes.push(loot.affix);
    for (let i = affixes.length; i < r; i++) { const a = pick(keys); if (!affixes.includes(a)) affixes.push(a); }
    // Botín de enemigo: variante fija de su tabla; si no, 45% de las armas salen con una variante al azar.
    const variant = loot?.variant ?? (Math.random() < 0.45 ? pick(variantsFor(raw)).id : undefined);
    const base = forgeBase(raw, variant);
    const name = weaponName(base.type, r, variant, pick(ALL_SUFFIXES));
    return { uid: UID++, kind: "weapon", name, rarity: r, base, magMax: base.magazine ?? 0, mag: base.magazine ?? 0, dmgMult: +(1 + r * 0.18 + rnd(-0.1, 0.15) + this.floor * 0.06).toFixed(2), crit: ri(0, 4 + r * 2), acc: ri(0, r), affixes };
  }
  /** Arma inicial de la clase: nivel bajo, sin variante ni inscripciones, estadísticas tiradas desde la base. */
  makeStarterWeapon(type: string): Item {
    const raw = (WEAPONS.find((w) => w.type === type) ?? PARIAH_WEAPONS.find((w) => w.type === type))!; const base = { ...raw }; const s = starterStats(base);
    return { uid: UID++, kind: "weapon", name: s.name, rarity: 0, base, magMax: base.magazine ?? 0, mag: base.magazine ?? 0, dmgMult: s.dmgMult, crit: s.crit, acc: 0, affixes: [] };
  }
  makeArmor(): Item { const r = ri(0, 3); return { uid: UID++, kind: "armor", name: pick(["Chaqueta acolchada", "Coraza de hueso", "Gabardina rúnica", "Malla del Hilo"]) + " " + RARITY[r], rarity: r, def: 1 + r + ri(0, 1) }; }

  start(cls: ClassDef, diff: string = "normal", resume = false, subclassId = "") {
    if (this.musicOn) { this.musicOn = false; this.onMusic(false); }
    readStats(); this.meleeStep = this.meleeHitStep = 0; this.meleeLast = -9;
    this.resumed = resume; this.barks = []; if (!resume) { this.runFloors = []; this.runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
    if (!resume) recordStat(this.runId, "start");
    this.chronicleAttempt++; this.chronicleZone = ""; this.extractionConditions = {};
    if (!resume) { const p = readPlayer(); this.chronicles.start(p.id, this.runName, cls.id, cls.name, diff, this.runId); }
    this.difficulty = getDifficulty(diff); this.adapt = 1; this.evadeMsgAt = -9; this.perfT = this.perfDmg = this.perfKills = 0;
    this.loadLegacy(); if (!resume) { this.legacy.runs++; this.saveLegacy(); }
    this.killStreak = 0; this.streakT = 0; this.sideQuest = null; this.merchantQuest = null; this.merchantTalks = 0; this.questHistory = []; this.journal = []; this.kills = 0; this.threat = 1; this.time = 0; this.combo = 0; this.comboT = 0; this.slot = 0; this.prev = {}; this.shopStock = [];
    this.aiming=false; this.aimT=this.aimBlend=this.chargeT=this.attackCd=this.swingT=this.hitGrace=0;
    this.levelPerks = { hp: 0, dmg: 0, stam: 0 };
    this.cls = cls; this.subclassId = subclasses(cls.id).some(s => s.id === subclassId) ? subclassId : ""; this.classRewards = []; this.attrs = rollAttributes(cls.raw as Record<string, number>); this.attrPoints = 0; this.palim = loadPalimpsest(); { const pb = runBonuses(this.palim); for (const [a, v] of Object.entries(pb.attrs)) this.attrs[a as keyof typeof this.attrs] = (this.attrs[a as keyof typeof this.attrs] ?? 0) + (v ?? 0); this.palimMemento = pb.memento; this.attrPoints += pb.extraPoints; if (pb.extraPoints && !resume) this.savePalim(consumeTabula(this.palim)); } this.fatigue = 0; this.needEpisodeT = 30; this.needBlur = 0; this.sitting = false; this.vendorTalkCd = 0; this.mirrorBuff = null; this.streakMax = 0; this.floor = 1; this.level = 1; this.xp = 0; this.xpNext = xpForLevel(1); this.xpLog = {}; this.floorDamageXp = 0; this.sp = 1; this.gold = 30;
    this.grado = Math.max(1, Math.min(10, Number(localStorage.getItem("ars_anima_grado") || 1))); this.mt = Math.max(0, Math.min(2, Number(localStorage.getItem("ars_anima_mt") || 0))); this.mtAwardedRun = false; this.cycles = Math.max(0, Math.min(100, Number(localStorage.getItem("ars_anima_cycles") || 0))); this.resonance = 0;
    this.breakValue = 0; this.playerStagger = this.breakDelay = this.parryT = this.parryCd = this.reloadT = 0; this.activePact = null; this.pactCooldowns = {}; this.pactBaneT = 0; this.epiphanyLastStand = false; this.detectionRadius = 10;
    this.skills.clear(); this.pacts = PACTS.filter(pc => this.palim.pacts.includes(pc.id)); this.epiph = []; this.bag = []; this.mats = { tela: 1, hierba: 1, chatarra: 2 };
    this.cons = { venda: 1, antidoto: 1, racion: 1, agua: 1, tonico: 0, espejo: 0 };
    this.melee = this.makeStarterWeapon(cls.melee); this.ranged = this.makeStarterWeapon(cls.ranged);
    this.armor = { uid: UID++, kind: "armor", name: "Chaqueta acolchada", rarity: 0, def: 2 };
    this.food = 100; this.thirst = 100; this.ammo = 60 + (cls.id === "tecnomante" ? 12 : 0); this.bombs = cls.id === "ingeniero" ? 3 : 1; this.keys = 0; this.wounds = {}; this.burn = this.poison = this.bleed = 0;
    this.anima = Number(localStorage.getItem("ars_anima_meta") || 0);
    this.pickupAnimation = newPickupAnimation();
    this.pariah = PX.newPariahRun(); if (isPariah(cls.id)) { this.armor = null; this.xpNext = pariahXp(this.xpNext); this.ranged.mag = 0; }
    this.recalc(); this.hp = this.hpMax; this.stam = this.stamMax; this.mh = this.mhMax; this.lumbre = this.lumbreMax;
    this.melee.mag = this.melee.magMax = 0;
    this.score.reset(); this.recap = null; this.merchantCd = 90; this.needWarn = { food: 100, thirst: 100 };
    this.genFloor(); this.mode = "play"; this.msg("La tinta respira. La salida no será gratuita.");
    if (!resume) this.resetSkillRun();
    if (!resume) { const sb = Number(localStorage.getItem("ars_anima_score_bonus") || 0); if (sb > 0) { this.gold += sb; localStorage.removeItem("ars_anima_score_bonus"); this.msg(`Bono por tu calificación anterior: +${sb} fichas.`); } }
  }

  /** Guarda la run en curso (personaje, inventario, puntuación); el piso se regenera al reanudar. */
  saveRun() {
    if (this.mode === "title" || this.mode === "dead" || this.mode === "won") return;
    this.chronicles.syncTime(this.time); this.chronicles.persist();
    const f: Record<string, unknown> = {}; for (const k of RUN_FIELDS) f[k] = (this as unknown as Record<string, unknown>)[k]; f.pos = { x: this.px, y: this.py, ang: this.ang }; f.floorState = captureFloor(this as never);
    const save: RunSave = { v: 1, savedAt: Date.now(), name: this.runName, cls: this.cls.id, clsName: this.cls.name, diff: this.difficulty.id,
      skills: [...this.skills], score: this.score.dump(), fields: JSON.parse(JSON.stringify(f)), floors: this.runFloors, uidFloor: UID };
    (save.fields as Record<string, unknown>).runId = this.runId; writeRunSave(save);
    try { this.onSave(); } catch { /* opcional */ }
  }
  resumeRun(s: RunSave) {
    const cls = CLASSES.find(c => c.id === s.cls) ?? CLASSES[0];
    this.runFloors = [...(s.floors ?? [])]; this.runId = String((s.fields as Record<string, unknown>).runId ?? Date.now()); this.runName = s.name;
    UID = Math.max(UID, s.uidFloor ?? 1) + 1000;
    this.chronicles.restore(this.runId); this.chronicleAttempt = Math.max(0,...(this.chronicles.run?.events.map(e => Number(e.id.split(":")[0]) || 0) ?? []));
    this.start(cls, s.diff, true, String(s.fields.subclassId ?? ""));
    if (!this.chronicles.run) { const p = readPlayer(); this.chronicles.start(p.id, s.name, cls.id, cls.name, s.diff, this.runId); }
    const me = this as unknown as Record<string, unknown>;
    for (const k of RUN_FIELDS) if (k in s.fields) me[k] = s.fields[k];
    this.skills = new Set(s.skills ?? []); this.score.load(s.score);
    const hp = this.hp, stam = this.stam, mh = this.mh, lum = this.lumbre; this.recalc(); this.hp = Math.min(hp, this.hpMax); this.stam = stam; this.mh = mh; this.lumbre = lum;
    this.genFloor(true);
    this.score.load(s.score);
    const fsOk = applyFloor(this as never, s.fields.floorState as FloorState | undefined);
    this.ensurePortal();
    const ps = s.fields.pos as { x: number; y: number; ang: number } | undefined;
    if (ps && Number.isFinite(ps.x) && Number.isFinite(ps.y) && !this.solid(ps.x, ps.y)) { this.px = ps.x; this.py = ps.y; this.ang = Number(ps.ang) || this.ang; this.pz = this.floorHeight(); }
    this.mode = "play"; this.msg(`Reanudas la run en el nivel ${this.floor}: ${this.region.name}${fsOk ? " — progreso del piso restaurado" : ""}.`); this.onUI();
  }
  /** Fin definitivo de la run (muerte o victoria): historial local, tabla global y borrar guardado. */
  endRun(outcome: "death" | "won") {
    this.chronicles.finish(outcome === "won" ? "won" : /colapso/i.test(this.deathCause) ? "collapse" : "death", this.floor, this.time, this.deathCause);
    clearRunSave();
    const r: RunRecord = { id: this.runId || String(Date.now()), name: this.runName, clsName: this.cls.name, diff: this.difficulty.id, score: this.score.total,
      floor: this.floor, region: this.region.name, level: this.level, kills: this.kills, seconds: Math.round(this.time), outcome,
      cause: outcome === "won" ? "Completó el juego" : (this.deathCause || "Causa desconocida"), floors: this.runFloors, endedAt: Date.now() };
    pushHistory(r); try { this.onRunEnd(r); } catch { /* la tabla es opcional */ }
  }
  /** Frase breve sobre la cabeza del enemigo (presentación). */
  bark(e: Enemy, ev: BarkEvent) {
    const rule = BARK_RULES[ev]; if (ev !== "death" && e.dead) return;
    if ((e.barkCd ?? 0) > this.time && ev !== "death" && ev !== "flee") return;
    if (Math.random() > rule.chance) return;
    if (Math.hypot(e.x - this.px, e.y - this.py) > 12) return;
    this.barks = this.barks.filter(b => b.e !== e);
    if (this.barks.length >= BARK_MAX_ACTIVE) { if (ev === "hit" || ev === "hurt") return; this.barks.shift(); }
    this.barks.push({ e, ev, text: barkLine(e.kind, ev), t: BARK_SECONDS }); e.barkCd = this.time + Math.max(rule.cooldown, 1.2);
  }

  /** Semilla del piso: el mismo piso se reconstruye igual al reanudar (también en otro dispositivo). */
  floorSeed = 0; pos: { x: number; y: number; ang: number } | null = null;
  genFloor(keepSeed = false) {
    if (!keepSeed || !this.floorSeed) this.floorSeed = (Math.random() * 2 ** 31) >>> 0 || 1;
    const real = Math.random; let a = this.floorSeed >>> 0;
    Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    try { this.genFloorInner(); } finally { Math.random = real; }
    this.enemies.forEach((e, i) => { (e as { oid?: number }).oid = i; }); this.pickups.forEach((p, i) => { (p as { oid?: number }).oid = i; });
  }
  genFloorInner() {
    this.score.newFloor(); this.floorDamage = 0; this.mapDone = false; this.secretSeen.clear(); this.needSpread = true;
    this.visitedZones.clear();this.clearedZones.clear();this.combatZones.clear();this.doors.clear();this.breakables.clear();
    this.legacy.maxFloor = Math.max(this.legacy.maxFloor, this.floor); this.legacy.maxLevel = Math.max(this.legacy.maxLevel, this.level); this.saveLegacy();
    this.restRoom=null;this.restHealed=false;this.restInside=false;
    this.floorDamageXp = 0; this.seals = {}; this.doorAnim = {}; this.doorSpd = {}; this.floorKills = 0; this.raid = null; this.denial = null; this.fear = this.visionT = this.horrorCd = this.screamer = 0; this.bossPulseT = 8; this.bossRequired = regionForFloor(this.floor).id !== "garden"; this.exp = { noteRead: false, unlocked: false, hasMap: false, extracted: false }; this.lairHint = null; this.guideT = 0; this.guideCd = 0; this.collapse = null; this.hazards = [];
    this.region = regionForFloor(this.floor); this.regionCollected = false; this.sanctuaryT = 90;
    this.lookPendingX = this.lookPendingY = 0;
    this.vx = this.vy = this.vz = this.pz = this.pitch = this.chargeT = this.attackCd = this.swingT = this.dashT = this.dashCd = this.slideT = this.stampede = this.wallT = this.slowmo = 0; this.crouching = false; this.swapStacks = this.swapT = 0;
    this.shieldEnemy = null; this.shieldT = 0; this.parts = []; this.flyers = []; this.gibs = []; this.puddles = []; this.marks = []; this.floats = []; this.hurtCounts = {}; this.deathCause = ""; this.lastHurt = ""; this.challenge = null; this.contract = this.region.id === "garden" ? null : { name: `Purga en ${this.region.name}`, goal: 6 + this.floor * 2, kills: 0, t: 270, done: false }; this.darkness = 0; this.eventName = ""; this.eventLeft = 0; this.eventT = 35; this.weather = this.region.weather; this.weatherT = 50; this.wind = { x: 0, y: 0 };
    this.bossRoom=null; this.misreads = 0; this.arena = null;
    const m = this.map; m.fill(1);
    const rooms: { x: number; y: number; w: number; h: number }[] = [];
    for (let i = 0; i < 60 && rooms.length < this.region.rooms; i++) {
      const w = ri(this.region.min, this.region.max), h = ri(this.region.min, this.region.max), x = ri(1, MAP - w - 2), y = ri(1, MAP - h - 2);
      if (rooms.some((r) => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y)) continue;
      rooms.push({ x, y, w, h });
    }
    if (rooms.length < 3) rooms.splice(0, rooms.length, { x: 2, y: 2, w: 7, h: 7 }, { x: 14, y: 14, w: 7, h: 7 }, { x: 28, y: 28, w: 8, h: 8 });
    const carve = (x: number, y: number) => { if (x > 0 && y > 0 && x < MAP - 1 && y < MAP - 1) m[y * MAP + x] = 0; };
    rooms.forEach((r) => { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) carve(x, y); });
    for (let i = 1; i < rooms.length; i++) {
      const a = rooms[i - 1], b = rooms[i];
      let x = Math.floor(a.x + a.w / 2), y = Math.floor(a.y + a.h / 2);
      const tx = Math.floor(b.x + b.w / 2), ty = Math.floor(b.y + b.h / 2);
      while (x !== tx) { carve(x, y); carve(x, y + 1); x += Math.sign(tx - x); }
      while (y !== ty) { carve(x, y); carve(x + 1, y); y += Math.sign(ty - y); }
    }
    // Cornisas y plataformas elevadas: hay que saltar para ganar altura; los pilares sirven de cobertura.
    rooms.forEach((r, i) => { if (this.region.pillars && i > 0 && r.w >= 7 && r.h >= 7) {
      m[(r.y + 2) * MAP + r.x + 2] = 2; m[(r.y + r.h - 3) * MAP + r.x + r.w - 3] = 2;
      if (r.w >= 8 && r.h >= 8) for (let py = r.y + Math.floor(r.h / 2) - 1; py <= r.y + Math.floor(r.h / 2); py++) for (let px = r.x + Math.floor(r.w / 2) - 1; px <= r.x + Math.floor(r.w / 2); px++) m[py * MAP + px] = 5;
    } });
    // Profundidad: escalones (media altura) junto a cornisas, plataformas sueltas y pilares.
    rooms.forEach((r, i) => { if (i === 0 || r.w < 5 || r.h < 5) return;
      const n = ri(1, 3);
      for (let k = 0; k < n; k++) {
        const x = ri(r.x + 1, r.x + r.w - 3), y = ri(r.y + 1, r.y + r.h - 3);
        const hz = Math.random() < 0.5; const len = ri(2, 3);
        for (let q = 0; q < len; q++) { const cx = hz ? x + q : x, cy = hz ? y : y + q; if (cx < r.x + r.w - 1 && cy < r.y + r.h - 1) m[cy * MAP + cx] = q === 0 ? 7 : 5; }
      }
      if (Math.random() < 0.6) { const x = ri(r.x + 1, r.x + r.w - 2), y = ri(r.y + 1, r.y + r.h - 2); if (m[y * MAP + x] === 0) m[y * MAP + x] = 2; }
    });
    // Raised galleries have solid top surfaces, stair access and a beam opening.
    rooms.forEach((r,i)=>{ if(i===0) return; const x=r.x+1,y=r.y+1;
      for(let q=0;q<3;q++) m[y*MAP+x+q]=q===0?7:q===1?5:8;
      if(r.h>=6) { m[(y+1)*MAP+x+2]=8; m[(y+2)*MAP+x+2]=9; }
    });
    // Plataformeo: cornisas escalonadas con huecos para doble salto, columnas gemelas para saltar entre paredes
    // y conductos bajos para pasar agachado o deslizándote. Nunca cruzan la sala entera: el laberinto sigue abierto.
    rooms.forEach((r,i)=>{ if(i===0||r.w<5||r.h<5) return; const free=(x:number,y:number)=>m[y*MAP+x]===0;
      if(Math.random()<0.85){ // muro bajo con conducto para arrastrarse
        const y=r.y+Math.floor(r.h/2), x0=r.x+2, x1=r.x+r.w-3, duct=ri(x0,x1);
        for(let x=x0;x<=x1;x++) if(free(x,y)) m[y*MAP+x]=x===duct?11:1;
      }
      if(Math.random()<0.8){ // cornisas altas separadas: salto + doble salto
        const y=r.y+r.h-2, x=r.x+1; if(free(x,y)) m[y*MAP+x]=7;
        for(let q=1;q<r.w-2;q++){ const cx=x+q; if(!free(cx,y)) continue; m[y*MAP+cx]=q%3===0?0:q%3===1?5:8; }
      }
      if(Math.random()<0.7){ // columnas gemelas para salto en pared
        const x=ri(r.x+2,r.x+r.w-4), y=r.y+2; if(free(x,y)&&free(x+2,y)&&free(x+1,y)){ m[y*MAP+x]=1; m[y*MAP+x+2]=1; m[y*MAP+x+1]=5; if(free(x+1,y-1)) m[(y-1)*MAP+x+1]=8; }
      }
    });
    // Puertas: aberturas de 1-2 celdas en el perímetro de cada sala.
    rooms.forEach((r, i) => { if (i === 0) return;
      const edge: [number, number][] = [];
      for (let x = r.x; x < r.x + r.w; x++) { edge.push([x, r.y - 1, 1], [x, r.y + r.h, 1]); }
      for (let y = r.y; y < r.y + r.h; y++) { edge.push([r.x - 1, y, MAP], [r.x + r.w, y, MAP]); }
      const wall = (i: number) => i >= 0 && i < m.length && m[i] !== 0 && m[i] !== 6;
      const gaps: number[][] = [];
      for (const [x, y, st] of edge as [number, number, number][]) { if (x <= 1 || y <= 1 || x >= MAP - 2 || y >= MAP - 2) continue; const id = y * MAP + x; if (m[id] !== 0) continue;
        // solo huecos de 1-2 celdas flanqueados por muro (pasillos), nunca salas fusionadas
        if (wall(id - st) && wall(id + st)) gaps.push([id]);
        else if (wall(id - st) && m[id + st] === 0 && wall(id + 2 * st)) gaps.push([id, id + st]); }
      for (const g of gaps) if (Math.random() < 0.75) for (const id of g) m[id] = 6;
    });
    // muro decorado
    for (let i = 0; i < m.length; i++) if (m[i] === 1 && Math.random() < 0.15) m[i] = 4;
    // sala secreta: detrás de un muro marcado
    const sr = rooms[rooms.length - 2];
    this.pickups = []; this.enemies = []; this.projs = []; this.debris = []; this.explosions = [];
    this.secretSpot = null;
    if (sr) {
      for (let tries = 0; tries < 40; tries++) {
        const sx = sr.x + sr.w; const sy = sr.y + ri(1, sr.h - 2);
        if (sx + 4 < MAP - 1) {
          m[sy * MAP + sx] = 3; for (let y = sy - 1; y <= sy + 1; y++) for (let x = sx + 1; x <= sx + 3; x++) carve(x, y);
          this.pickups.push({ x: sx + 2.5, y: sy + 0.5, kind: "item", item: this.makeWeapon(undefined, 3), bob: 0 });
          this.pickups.push({ x: sx + 3.3, y: sy + 0.5, kind: "gold", n: 80, bob: 0 });
          this.secretSpot = { x: sx, y: sy }; break;
        }
      }
    }
    const r0 = rooms[0]; this.px = r0.x + 1.5; this.py = r0.y + 1.5; this.safeX = this.px; this.safeY = this.py; this.pz = 0; this.vz = 0; this.ang = 0.6;
    this.rooms = rooms; this.restRoom = r0;
    const kinds = regionEnemies(this.floor);
    const ZN = ["Vestíbulo", "Cripta", "Biblioteca", "Capilla", "Forja", "Osario", "Galería", "Claustro", "Archivo", "Bóveda", "Mercado", "Torre"];
    const used = new Set<string>();
    this.zones = rooms.map((r, i) => { let n = i === 0 ? "Refugio del Mercader" : i === rooms.length - 1 ? (this.region.id === "garden" ? "Umbral del alba" : "Sala del Guardián") : pick(ZN); let k = 2; const base = n; while (used.has(n)) n = `${base} ${k++}`; used.add(n); return { ...r, name: n }; });
    this.alteredZones = this.region.id === "garden" ? [] : rooms.slice(1,-1).filter((_,i)=>i===0 || Math.random()<.25).map((r,i)=>({...r,effect:ALTERATIONS[(i+this.floor-1)%ALTERATIONS.length]}));
    const DECO = ["small_pillar", "vegetation", "crack", "flowerpot", "target", "plant", "litter", "hole", "fire", "tree", "dead_tree", "rocks", "pebbles", "skeleton", "leaves", "crate", "leaves", "skeleton", "crate"];
    rooms.forEach((r,roomIndex) => {const n=ri(7,11);for(let k=0;k<n;k++){const side=ri(0,3),x=side===0?r.x+.55:side===1?r.x+r.w-.55:r.x+rnd(.6,r.w-.6),y=side===2?r.y+.55:side===3?r.y+r.h-.55:r.y+rnd(.6,r.h-.6);if(this.solid(x,y,this.floorHeight(x,y)))continue;const deco=DECO[(k+roomIndex)%DECO.length];this.pickups.push({x,y,kind:"decor",deco,used:false,bob:rnd(0,6)});}
      if(roomIndex>0&&r.w>=6&&r.h>=6&&roomIndex%2===1){const fx=r.x+r.w/2+.5,fy=r.y+r.h-1.5;if(!this.solid(fx,fy,this.floorHeight(fx,fy)))this.pickups.push({x:fx,y:fy,kind:"decor",deco:"fountain",bob:0});}
      if(roomIndex>0&&roomIndex<rooms.length-1&&Math.random()<.55){const n=ri(1,2);for(let q=0;q<n;q++){const kx=r.x+rnd(1.2,r.w-1.2),ky=r.y+rnd(1.2,r.h-1.2);if(!this.solid(kx,ky,this.floorHeight(kx,ky)))this.pickups.push({x:kx,y:ky,kind:"decor",deco:"powder",bob:0});}}
      if(roomIndex===0){this.pickups.push({x:r.x+1.5,y:r.y+r.h-1.2,kind:"decor",deco:"bench",bob:0},{x:r.x+r.w-1.5,y:r.y+1.5,kind:"decor",deco:"healing_brazier",bob:0},{x:r.x+1.5,y:r.y+1.1,kind:"decor",deco:"target",bob:0});}
    });
    rooms.forEach((r, i) => {
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      if (i === 0) { this.pickups.push({ x: cx, y: cy, kind: "shop", bob: 0 }); if (this.region.id === "garden") this.pickups.push({ x: cx + 1, y: cy, kind: "sanctuary", bob: 0 }); return; }
      if (i === rooms.length - 1) { this.bossRoom = this.region.id === "garden" ? null : r; this.pickups.push({ x: r.x + 1.5, y: r.y + 1.5, kind: "lore", bob: 0 }); m[(r.y+1)*MAP+r.x+1]=0; if (this.region.id === "garden") this.pickups.push({ x: cx, y: cy, kind: "portal", bob: 0 }); return; }
      const n = ri(1, 1 + Math.min(2, Math.ceil(this.floor / 2)));
      for (let k = 0; k < n && kinds.length; k++) this.tacticalSpawn(pick(kinds), r);
      if (Math.random() < 0.55) this.pickups.push({ x: r.x + rnd(1, r.w - 1), y: r.y + rnd(1, r.h - 1), kind: "chest", quality:Math.min(4,Math.floor(this.floor/2)+ri(0,1)), locked: Math.random() < 0.4, bob: 0 });
      if (Math.random() < 0.6) this.pickups.push({ x: r.x + rnd(1, r.w - 1), y: r.y + rnd(1, r.h - 1), kind: "trap", armed: true, bob: 0 });
      if (Math.random() < 0.5) this.pickups.push({ x: r.x + rnd(1, r.w - 1), y: r.y + rnd(1, r.h - 1), kind: "mat", mat: pick(Object.keys(MATERIALS)), n: ri(1, 2), bob: 0 });
      if (Math.random() < 0.7) this.pickups.push({ x: cx, y: cy, kind: pick(["food", "water"] as const), bob: 0 });
      if (Math.random() < .3) this.pickups.push({ x: cx + .8, y: cy, kind: 'item', item: { uid: UID++, kind: 'consumable', name: 'venda', id: 'venda', rarity: 0 }, bob: 0 });
      if (Math.random() < .18) this.pickups.push({ x: cx - .8, y: cy, kind: 'item', item: { uid: UID++, kind: 'consumable', name: 'espejo', id: 'espejo', rarity: 1 }, bob: 0 });
      if (i === 2 || i === (Math.floor(rooms.length / 2) === 2 ? 3 : Math.floor(rooms.length / 2))) this.pickups.push({ x: cx, y: cy, kind: "altar", bob: 0 });
      if (i === 2) this.pickups.push({ x: cx + 0.5, y: cy, kind: "key", bob: 0 });
    });
    for (const e of this.enemies) if (this.solid(e.x, e.y, e.z)) { for (let k = 0; k < 40; k++) { const nx = Math.floor(e.x) + ri(-3, 3) + 0.5, ny = Math.floor(e.y) + ri(-3, 3) + 0.5; if (!this.solid(nx, ny)) { e.x = nx; e.y = ny; break; } } }
    for (const p of this.pickups) { if (this.solid(p.x, p.y)) { const r = rooms.find(r => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h); if (r) { p.x = r.x + 1.5; p.y = r.y + 1.5; } } if (p.kind === "mat") p.mat = pick(this.region.mats); }
    this.bossSpawned = false; this.bossDead = false;
    if (!this.bossRequired && this.bossRoom) {m[(this.bossRoom.y+2)*MAP+this.bossRoom.x+1]=0;this.pickups.push({x:this.bossRoom.x+1.5,y:this.bossRoom.y+2.5,kind:"portal",bob:0});}
    // Gate groups share one seal, including both leaves of wider doors.
    const ids=Array.from(m.keys()).filter(i=>m[i]===6); const seen=new Set<number>(); let gate=0;
    for(const first of ids) { if(seen.has(first)) continue; const group:number[]=[],stack=[first]; while(stack.length) { const id=stack.pop(); if(id===undefined||seen.has(id)||m[id]!==6) continue; seen.add(id);group.push(id);stack.push(id-1,id+1,id-MAP,id+MAP); }
      if(gate>=2) continue; const code=String(ri(100,999)); const seal:DoorSeal=gate++===0?{kind:"key",value:1,group}:{kind:"code",value:0,code,group}; for(const id of group)this.seals[id]=seal;
      this.pickups.push({x:r0.x+2.5,y:r0.y+1.5,kind:seal.kind==="key"?"key":"note",text:`Nota del cerrajero: combinación ${code}.`,code,bob:0});
    }
    // EXPEDITION: guarantee a code document + sealed mechanism that yields the map fragment.
    if (this.bossRequired && !Object.values(this.seals).some(sl => sl.kind === "code")) { const mids = rooms.slice(1, -1).filter(q => q !== this.restRoom); const lockRoom = mids[Math.floor(mids.length / 2)] ?? rooms[1]; const noteRoom = mids[0] ?? rooms[0]; if (lockRoom && noteRoom) { const code = String(ri(100, 999)); this.pickups.push({ x: lockRoom.x + lockRoom.w / 2, y: lockRoom.y + 1.3, kind: "cipherlock", code, bob: 0 }, { x: noteRoom.x + 1.5, y: noteRoom.y + noteRoom.h - 1.5, kind: "note", text: `Registro del archivero: el relicario sellado se abre con ${code}.`, code, bob: 0 }); } }
    if (this.bossRequired && rooms.length > 3) { const ante = rooms[rooms.length - 2]; if (ante && ante !== this.restRoom) { const zone = this.zones.find(z => z.x === ante.x && z.y === ante.y); if (zone) zone.name = "Antesala de la guarida"; for (let k = 0; k < 2; k++) this.pickups.push({ x: ante.x + rnd(1, ante.w - 1), y: ante.y + rnd(1, ante.h - 1), kind: "trap", armed: true, bob: 0 }); this.pickups.push({ x: ante.x + ante.w - 1.5, y: ante.y + 1.5, kind: "chest", quality: Math.min(4, Math.floor(this.floor / 2) + 1), locked: true, bob: 0 }, { x: ante.x + 1.5, y: ante.y + 1.5, kind: "food", bob: 0 }, { x: ante.x + 2.2, y: ante.y + 1.5, kind: "ammo", bob: 0 }); const kinds = regionEnemies(this.floor); for (let k = 0; k < 1 + Math.min(3, Math.floor(this.floor / 2)) && kinds.length; k++) this.tacticalSpawn(pick(kinds), ante); } }
    // PALIMPSESTOS: optional book (until owned), then folios; extra benches for rest and research.
    { const mids = rooms.slice(1, -1).filter(q => q !== this.restRoom); const r = mids[ri(0, Math.max(0, mids.length - 1))];
      if (r) { const x = r.x + rnd(1.2, r.w - 1.2), y = r.y + rnd(1.2, r.h - 1.2);
        if (!this.palim.hasBook) this.pickups.push({ x, y, kind: "palimpsest", bob: 0 });
        else if (nextUnfound(this.palim, this.floor) && Math.random() < .7) this.pickups.push({ x, y, kind: "folio", bob: 0 }); }
      for (const q of [mids[1], mids[Math.max(2, mids.length - 2)]].filter((q, i, a): q is typeof mids[number] => !!q && a.indexOf(q) === i)) { const bx = q.x + 1.4, by = q.y + q.h - 1.3; if (!this.solid(bx, by)) this.pickups.push({ x: bx, y: by, kind: "decor", deco: "bench", bob: 0 }); } }
    // Optional sealed vaults never block the main journey.
    const vault=rooms[1]; if(vault && vault.x+vault.w+3<MAP-1) { const x=vault.x+vault.w,y=vault.y+1; if(this.cell(x,y)!==0 && this.cell(x+1,y)!==0 && this.cell(x+2,y)!==0) { m[y*MAP+x]=6;m[y*MAP+x+1]=0;m[y*MAP+x+2]=0; const variants:DoorSeal[]=[{kind:"kills",value:3},{kind:"health",value:.5},{kind:"level",value:2},{kind:"boss",value:1}]; this.seals[y*MAP+x]=variants[(this.floor-1)%4]; this.pickups.push({x:x+2.5,y:y+.5,kind:"chest",bob:0}); } }
    this.forbiddenDoor = -1; this.forbiddenDoors = []; this.forbiddenIds = new Set(); this.forbiddenScaled = false;
    for (const S of [5, 4, 3]) { if (this.forbiddenDoor >= 0) break; const need = forbiddenZoneLevel(this.floor);
      const solidAll = (x0:number,y0:number,w:number,h:number) => { if (x0 < 1 || y0 < 1 || x0+w >= MAP-1 || y0+h >= MAP-1) return false; for (let y=y0;y<y0+h;y++) for (let x=x0;x<x0+w;x++) if (m[y*MAP+x]===0) return false; return true; };
      outer: for (const r of rooms.slice(1, -1).filter(r => r !== this.restRoom)) for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]] as const) {
        const cx = dx ? (dx > 0 ? r.x + r.w : r.x - 1) : r.x + Math.floor(r.w/2), cy = dy ? (dy > 0 ? r.y + r.h : r.y - 1) : r.y + Math.floor(r.h/2);
        const zx = dx > 0 ? cx + 2 : dx < 0 ? cx - 1 - S : cx - 2, zy = dy > 0 ? cy + 2 : dy < 0 ? cy - 1 - S : cy - 2;
        if (!solidAll(zx-1, zy-1, S+2, S+2) || m[cy*MAP+cx]===0 || m[(cy+dy)*MAP+cx+dx]===0) continue;
        m[cy*MAP+cx] = 6; m[(cy+dy)*MAP+cx+dx] = 0;
        for (let y=zy;y<zy+S;y++) for (let x=zx;x<zx+S;x++) m[y*MAP+x] = 0;
        this.seals[cy*MAP+cx] = { kind: "level", value: need }; this.forbiddenDoor = cy*MAP+cx; this.forbiddenDoors = [cy*MAP+cx];
        // Segunda ruta real: un pasillo excavado desde la zona hasta otra sala, también sellado por nivel.
        { const inR = (x:number,y:number,q:{x:number;y:number;w:number;h:number}) => x>=q.x&&x<q.x+q.w&&y>=q.y&&y<q.y+q.h, zr = { x: zx, y: zy, w: S, h: S };
          const prev = new Map<number, number>(), dist = new Map<number, number>(), queue: number[] = [];
          for (let y = zy - 1; y <= zy + S; y++) for (let x = zx - 1; x <= zx + S; x++) { if (inR(x,y,zr) || (x!==zx-1&&x!==zx+S&&y!==zy-1&&y!==zy+S) || ((x===zx-1||x===zx+S)&&(y===zy-1||y===zy+S))) continue; const id = y*MAP+x; if (m[id] === 1 && Math.hypot(x-cx, y-cy) > 3) { queue.push(id); dist.set(id, 0); prev.set(id, -1); } }
          let goal = -1;
          while (queue.length && goal < 0) { const c = queue.shift()!, x = c % MAP, y = Math.floor(c / MAP), d = dist.get(c)!;
            const nbs = [[x+1,y],[x-1,y],[x,y+1],[x,y-1]] as const, floors = nbs.filter(([a,b]) => m[b*MAP+a] === 0 && !inR(a,b,zr));
            if (floors.length) { const q = rooms.find(q => q !== r && q !== this.restRoom && floors.every(([a,b]) => inR(a,b,q))); if (q && d > 0) goal = c; continue; }
            if (d >= 16) continue;
            for (const [a,b] of nbs) { const id = b*MAP+a; if (a < 1 || b < 1 || a >= MAP-1 || b >= MAP-1 || m[id] !== 1 || dist.has(id)) continue; dist.set(id, d+1); prev.set(id, c); queue.push(id); } }
          if (goal >= 0) { m[goal] = 6; this.seals[goal] = { kind: "level", value: need }; this.forbiddenDoors.push(goal); for (let c = prev.get(goal)!; c >= 0; c = prev.get(c)!) m[c] = 0; } }
        this.zones.push({ x: zx, y: zy, w: S, h: S, name: `Zona Prohibida · Nv ${need}` });
        this.pickups.push({ x: zx + S/2, y: zy + S/2, kind: "chest", quality: Math.min(4, Math.floor(this.floor/2) + 2), bob: 0 });
        const kinds = regionEnemies(this.floor);
        for (let i = 0; i < FORBIDDEN.enemies && kinds.length; i++) { const before = this.enemies.length; this.spawn(pick(kinds), zx + 1 + (i % 3) * 1.5, zy + 1.5 + Math.floor(i / 3) * 2); const e = this.enemies[before]; if (e) { e.hp = e.hpMax = Math.round(e.hpMax * forbiddenHpMult(this.rating, need, FORBIDDEN.hpMult)); e.lvl = forbiddenEnemyLevel(this.rating, need, FORBIDDEN.extraLevels); e.elite ??= "BLINDADO"; this.forbiddenIds.add(e.id); } }
        break outer;
      } }
    if(this.secretSpot)this.zones.push({x:this.secretSpot.x+1,y:this.secretSpot.y-1,w:3,h:3,name:"Cámara secreta"});
    if(vault) {const p=this.pickups.find(p=>p.kind==="chest"&&Math.floor(p.x)===vault.x+vault.w+2&&Math.floor(p.y)===vault.y+1);if(p)this.zones.push({x:vault.x+vault.w+1,y:vault.y+1,w:2,h:1,name:"Bóveda sellada"});}
    // Sello de pacto en el suelo de una sala intermedia.
    { const mids = rooms.slice(1, -1), half = Math.floor(mids.length / 2), picks = mids.length > 1 ? [mids[0], mids[half === 0 ? 1 : half]] : [mids[0], mids[0]];
      for (const r of picks) if (r) for (let k = 0; k < 30; k++) { const x = r.x + rnd(1.2, r.w - 1.2), y = r.y + rnd(1.2, r.h - 1.2); if (!this.solid(x, y, this.floorHeight(x, y)) && this.pickups.every(o => o.kind !== "pactstone" || Math.hypot(o.x - x, o.y - y) > 1)) { this.pickups.push({ x, y, kind: "pactstone", bob: 0 }); break; } } }
    this.placeVaults(rooms);
    for(let id=0;id<m.length;id++)if(m[id]===6)this.doors.add(id);
    if((this.region.id==="babel"||this.region.id==="pits")&&rooms[4]&&rooms.length>5){const before=this.enemies.length;this.tacticalSpawn("obispo",rooms[4]);const e=this.enemies[before];if(e){e.miniBoss=true;e.elite=undefined;}}if(this.region.id!=="garden"&&rooms[2]&&rooms.length>3){const r=rooms[2];const before=this.enemies.length;this.tacticalSpawn("carcelero",r);const e=this.enemies[before];if(e){e.miniBoss=true;e.elite="BLINDADO";e.hp=e.hpMax=Math.round(e.hpMax*1.5);e.brk=e.brkMax=e.brkMax*1.5;}}
    this.prepareAmbushes();
    for(const e of this.enemies)this.combatZones.add(this.zoneAt(e.x,e.y));
    this.visitedZones.add(this.zoneAt());
    this.prepareScenery();
    this.msg(`PISO ${this.floor}: ${this.region.name}`); this.msg(this.region.desc);
  }
  rooms: { x: number; y: number; w: number; h: number }[] = [];
  bossRoom: { x: number; y: number; w: number; h: number } | null = null;
  secretSpot: { x: number; y: number } | null = null;

  threat = 1; evoPulse = 0; evoTraits: string[] = [];
  threatNow() { return threatLevel(this.floor, this.kills, this.level); }
  enemyDmg(e?: Enemy) { const evo = evolution(e?.lvl ?? this.threat); return (e?.tyrant ? FEUD.tyrantDmg : 1) * (e?.misread ? MISREAD.dmgMult : 1) * this.chal.dmg * floorPressure(this.floor).damage * evo.damage * (e?.traits?.includes("furia") && e.hp < e.hpMax * .35 ? 1.25 : 1); }
  /** Living enemies grow when threat rises: more HP, new traits, partial heal. */
  updateThreat() {
    const th = this.threatNow();
    if (th < this.threat) { this.threat = th; return; }
    if (th === this.threat) return;
    const gained = newTraits(this.threat, th); this.threat = th; const evo = evolution(th);
    for (const e of this.enemies) { if (e.dead) continue; const prev = evolution(e.lvl ?? 1); const k = evo.hp / prev.hp; e.hpMax *= k; e.hp = Math.min(e.hpMax, e.hp * k + e.hpMax * .1); e.def += evo.def - prev.def; e.lvl = th; e.traits = evo.traits; }
    this.evoPulse = 2.6; this.evoTraits = gained.map((t) => TRAIT_LABEL[t]);
    this.float(`LOS ENEMIGOS EVOLUCIONAN · AMENAZA ${th}`, "#ff5a2a"); for (const t of this.evoTraits) this.msg(`Nueva habilidad enemiga: ${t}`);
    this.onSound("event");
  }
  /** Extra moves granted by evolution traits. */
  enemyTricks(e: Enemy, dist: number, ux: number, uy: number, dt: number, ranged: boolean) {
    if (!e.traits?.length || e.tele > 0 || (e.stun ?? 0) > 0 || (e.downT ?? 0) > 0) return;
    e.trickCd = (e.trickCd ?? 3) - dt; if (e.trickCd > 0) return;
    if (e.traits.includes("embestida") && !ranged && dist > 2.2 && dist < 6) { e.kx = ux * 9; e.ky = uy * 9; e.trickCd = rnd(3.5, 5.5); this.burst(e.x, e.y, .3, "#ff5a2a", 8); return; }
    if (e.traits.includes("disparo") && !ranged && dist > 3 && dist < 9) {
      const a = Math.atan2(uy, ux), n = e.traits.includes("eco") ? 3 : 1;
      for (let i = 0; i < n; i++) { const b = a + (n > 1 ? (i - 1) * .2 : 0); this.projs.push({ x: e.x, y: e.y, z: e.z + .6, dz: (this.pz - e.z) / (dist / 6 || 1), dx: Math.cos(b) * 6, dy: Math.sin(b) * 6, life: 2, dmg: ENEMY_TYPES[e.kind].dmg * .6 * this.enemyDmg(e), friendly: false, ownerId: e.id, color: "#ff8a5a" }); }
      e.trickCd = rnd(4, 6.5); return;
    }
    e.trickCd = rnd(2, 4);
  }

  spawn(kind: EnemyKind, x: number, y: number, elite?: string) {
    if(this.isSafe(x,y,.28))return;
    // Tope de enemigos vivos (nivel y cerca del jugador) para que el juego no se sature; el jefe siempre aparece.
    if (kind !== "librero") { const alive = this.enemies.filter(e => !e.dead); if (alive.length >= enemyCap(this.floor).level || alive.filter(e => Math.hypot(e.x - x, e.y - y) < 9).length >= enemyCap(this.floor).nearby) return; }
    if (this.solid(x,y,this.floorHeight(x,y))) { const r = this.rooms.find(r => x >= r.x && x < r.x+r.w && y >= r.y && y < r.y+r.h); if (r) { x = r.x+1.5; y = r.y+1.5; } else return; }
    if(!this.canOccupy(x,y,this.floorHeight(x,y),.28)) {const r=this.rooms.find(r=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h);let found=false;if(r)for(let cy=r.y;cy<r.y+r.h&&!found;cy++)for(let cx=r.x;cx<r.x+r.w;cx++)if(this.canOccupy(cx+.5,cy+.5,this.floorHeight(cx+.5,cy+.5),.28)){x=cx+.5;y=cy+.5;found=true;break;}if(!found)return;}
    const t = ENEMY_TYPES[kind];
    const scale = floorPressure(this.floor).hp;
    const el = elite ?? (Math.random() < floorPressure(this.floor).eliteChance && kind !== "librero" ? pick(ELITE_AFFIXES) : undefined);
    const evo = evolution(this.threat);
    let hp = t.hp * scale * evo.hp * (el ? 1.6 : 1) * (this.hasP("babel") ? 1.25 : 1);
    let brk = t.brk * (el === "BLINDADO" ? 2 : 1);
    if (kind === "librero") { hp *= 1 + this.floor * 0.2; brk *= 1; }
    this.enemies.push({ id: UID++, kind, x, y, z: this.floorHeight(x,y), vz: 0, hp: hp*this.chal.hp*(this.alterationAt(x,y)?.enemyHp??1), hpMax: hp*this.chal.hp*(this.alterationAt(x,y)?.enemyHp??1), variant:this.alterationAt(x,y)?.id, def: t.def + Math.floor(this.floor / 2) + evo.def + (evo.traits.includes("coraza") ? 2 : 0), lvl: this.threat, traits: evo.traits, trickCd: rnd(2, 5), brk, brkMax: brk, stagger: 0, cd: rnd(0.5, 2), tele: 0, hurt: 0, elite: el, kx: 0, ky: 0, burn: 0, poison: 0, bleed: 0, dead: false, state: 0, t: rnd(0, 6), phase: 1, aware: kind === "librero", face: rnd(0, Math.PI * 2), notice: 0 });
    const spawned = this.enemies[this.enemies.length - 1];
    if (spawned) { spawned.role = rollEnemyRole(t.pattern, Math.random()); spawned.cloudCd = rnd(4, 7); }
  }

  cell(x: number, y: number) { if (x < 0 || y < 0 || x >= MAP || y >= MAP) return 1; return this.map[Math.floor(y) * MAP + Math.floor(x)]; }
  doorAnim: Record<number, number> = {}; doorSpd: Record<number, number> = {};
  floorHeight(x = this.px, y = this.py) { const c = this.cell(x, y); return c === 5 ? 0.72 : c === 7 ? 0.36 : c === 8 ? 1.08 : 0; }
  solid(x: number, y: number, z = 0, height = BODY_HEIGHT) { if (x < 0 || y < 0 || x >= MAP || y >= MAP) return true; const c=this.cell(x,y), volume=cellVolume(c); if(!volume)return false; const bottom=c===6 ? (this.doorAnim[Math.floor(y)*MAP+Math.floor(x)]??0)*2.4 : volume[0]; return z < volume[1]-.001 && z+height > bottom+.001; }
  /** Abre una puerta (y su hoja gemela contigua) con animación. */
  openDoor(x: number, y: number, speed = 0.55) {
    const id=Math.floor(y)*MAP+Math.floor(x); const seal=this.seals[id];
    if(seal) { const state={keys:this.keys,kills:this.floorKills,hp:this.hp,hpMax:this.hpMax,level:this.level,bossDead:this.bossDead}; if(!sealSatisfied(seal,state)) { this.msg(this.sealLabel(seal)); return false; } if(seal.kind==="key")this.keys--; this.releaseSeal(id); }
    const st = [[Math.floor(x), Math.floor(y)]]; let any = false;
    while (st.length) { const [cx, cy] = st.pop()!; const i = cy * MAP + cx; if (this.map[i] !== 6 || this.doorAnim[i] !== undefined) continue; this.doorAnim[i] = 0; this.doorSpd[i] = speed; any = true; st.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]); }
    if (any) { if (speed > 1) this.track("brokenDoors", 1, "fuerza bruta"); else if (!this.enemies.some(e => !e.dead && Math.hypot(e.x-x,e.y-y) < 4)) this.track("quietDoors", 1, "abrir sin enemigos dentro del radio de ruido"); this.onSound(speed > 1 ? "break" : "portal"); this.alertNear(x, y, speed > 1 ? 10 : 4); }
    return any;
  }
  /** Reventar una puerta: se abre de golpe, aturde 3 s y empuja a quien esté detrás. */
  breachDoor(x: number, y: number) {
    if (this.cell(x, y) !== 6) return false;
    const cx = Math.floor(x) + 0.5, cy = Math.floor(y) + 0.5;
    if(this.seals[Math.floor(y)*MAP+Math.floor(x)]) { this.msg("El sello resiste golpes. "+this.sealLabel(this.seals[Math.floor(y)*MAP+Math.floor(x)])); return false; }
    if(!this.openDoor(cx, cy, 4))return false; this.shake = 0.3; this.burst(cx, cy, 0.6, "#8a5a2a", 24); this.float("¡PUERTA REVENTADA!", "#ffb347");
    for (const e of this.enemies) { if (e.dead || e.kind === "librero") continue; const d = Math.hypot(e.x - cx, e.y - cy); if (d > 3) continue;
      const a = Math.atan2(e.y - this.py, e.x - this.px); e.kx = Math.cos(a) * 9; e.ky = Math.sin(a) * 9; e.vz = 3; e.stun = 3; e.tele = 0; e.aware = true; this.damageEnemy(e, 4, 3); this.float("ATURDIDO 3s", "#7ad8ff"); }
    return true;
  }
  /** Busca una puerta cerrada a lo largo de la mirada. */
  doorAhead(range: number) { for (let d = 0.3; d <= range; d += 0.2) { const x = this.px + Math.cos(this.ang) * d, y = this.py + Math.sin(this.ang) * d, c = this.cell(x, y); if (c === 6) return this.doorAnim[Math.floor(y) * MAP + Math.floor(x)] === undefined ? { x, y } : null; if (c !== 0 && c !== 5 && c !== 7) return null; } return null; }
  /** Ruido de arma: la mayoría delata tu posición. */
  weaponNoise(w: Item) { const t = w.base!.type; const n = ["DAGA", "ARCO", "BALLESTA"].includes(t) ? 2.5 : w.base!.ranged ? (t === "FOCO" ? 7 : 15) : 5; this.alertNear(this.px, this.py, n * (this.sneaking ? 0.6 : 1)); }

  // ---------- combate ----------
  roll20() { return ri(1, 20) + this.mod("PER") + this.mod("SUE") + (this.hasE("suerte") ? 1 : 0); }
  attackEnemy(e: Enemy, w: Item, mult = 1, opts: { charged?: boolean; noRoll?: boolean; precision?: boolean; brkBonus?: number } = {}) {
    if(e.dead || !canUseWeapon(w, this.level)) return false;
    mult *= wearDamage(w);
    const toP = Math.atan2(this.py - e.y, this.px - e.x);
    const backDiff = Math.abs((((toP - (e.face ?? 0)) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
    const ranged = !!w.base!.ranged;
    const open = (e.opening ?? 0) > 0;
    const sit = open ? "ABERTURA ×2" : !e.aware && backDiff > 1.9 && !ranged ? "ASESINATO" : !ranged && (this.dashT > 0 || this.lastDashT < 0.35) ? "CRÍTICO EN DASH" : !ranged && this.pz > this.floorHeight() + 0.25 ? "CRÍTICO AÉREO" : ranged && opts.precision ? "DISPARO PRECISO" : !e.aware ? "SORPRESA" : "";
    if (sit) { opts = { ...opts, noRoll: true }; this.float(sit, open ? "#7affc1" : "#ffd34a"); if (open) { mult *= OPENING.mult; e.opening = 0; this.score.gain("opening"); } if (sit === "ASESINATO") { mult *= 1.5; this.legacy.backstabs++; this.saveLegacy(); } }
    const nat = ri(1, 20);
    const critMin = this.hasP("dados") ? (this.activePact?.id === "dados" ? 16 : 18) : (this.activePact?.id === "dados" ? 16 : 20);
    const fumbleMax = this.hasP("dados") ? 3 : this.activePact?.id === "dados" ? 3 : 1;
    const attrMod = w.base!.ranged ? this.mod("PER") : this.mod("FUE");
    const total = nat + attrMod + this.mod("SUE") + (w.acc ?? 0) + 2 + (this.hasE("suerte") ? 1 : 0);
    const cm = classMods(this.cls.id, this.level); const critChance = (w.crit ?? 0) + cm.crit + (this.has("critico") ? 8 : 0) + (this.cls.id === "duelista" ? 10 : 0);
    if (!opts.noRoll && nat <= fumbleMax) {
      this.float("¡FALLO CRÍTICO!", "#ff4b4b"); this.stam = Math.max(0, this.stam - (this.activePact?.id === "dados" ? 4 : 2)); if (this.activePact?.id === "dados") this.activePact = null; this.shake = 0.25; this.attackCd += 0.4; this.combo = 0; return false;
    }
    if (!opts.noRoll && total < e.def && e.stagger <= 0) { this.float("FALLO", "#888"); return false; }
    if (isPariah(this.cls.id) && w.base!.type === "PUÑOS") return PX.strike(this, e, w, mult, sit);
    const crit = (!!sit && sit !== "SORPRESA") || nat >= critMin || Math.random() * 100 < critChance;
    let dmg = d(w.base!.dice[0], w.base!.dice[1]) + Math.max(0, attrMod) * 2 + 3;
    dmg *= this.skillMul("damage") * (w.dmgMult ?? 1) * mult * (this.alterationAt()?.damage??1) * this.levelDamage() * this.needFx().damage * this.buff().damage;
    if (!w.base!.ranged && this.has("filo1")) dmg *= 1.15;
    if (w.base!.ranged && this.cls.id === "cazador") dmg *= 1.25;
    if (this.cls.id === "guerrero" && !w.base!.ranged) dmg *= 1.12;
    if (this.activePact?.id === "sangre") dmg *= 1.65;
    if (this.hasP("sangre")) dmg *= 1.35 * (this.has("pacto") ? 1.15 : 1);
    if (this.has("cazador_cabezas") && (e.elite || e.kind === "librero")) dmg *= 1.1;
    dmg *= cm.damage * (w.base!.ranged ? cm.ranged : cm.melee);
    if (this.wounds.BRAZO) dmg *= 0.8;
    if (e.stagger > 0) dmg *= 1.5;
    if (this.swapT > 0 && this.swapStacks > 0) { dmg *= swapDamageMult(this.swapStacks); if (swapStaggers(this.swapStacks)) e.stagger = Math.max(e.stagger, .45); }
    this.sinceHit = 0;
    const aff = w.affixes ?? [];
    if (aff.includes("DADO_LOCO")) { const r = ri(1, 6); if (r === 6) { dmg *= 3; this.float("DADO: 6!", "#ffd34a"); } else if (r === 1) dmg *= 0.5; }
    if (crit) { dmg *= cm.critDmg; this.critFlash = 0.15; this.float(`CRÍTICO ${Math.round(dmg)}`, "#ffd34a"); if (this.hasE("sangria")) this.heal(4); if (this.cls.id === "hereje") this.lumbre = Math.min(this.lumbreMax, this.lumbre + 1); }
    if (this.activePact?.id === "hambre") this.heal(dmg * 0.25);
    if (this.activePact?.id === "ceniza" && this.activePact.hits > 0) { e.burn = Math.max(e.burn, 5); this.activePact.hits--; }
    if (["sangre", "hambre"].includes(this.activePact?.id ?? "")) { if (this.activePact) this.activePact.hits--; if (this.activePact && this.activePact.hits <= 0) this.activePact = null; }
    if (this.activePact?.id === "dados" && crit) { this.activePact.hits--; if (this.activePact.hits <= 0) this.activePact = null; }
    let brk = w.base!.breakB + (opts.brkBonus ?? 0) + (aff.includes("EBURNEA") ? 3 : 0);
    if (crit) brk += Math.ceil(e.brkMax * 0.5);
    if (["guardian", "guerrero"].includes(this.cls.id)) brk *= 1.4;
    if (this.cls.id === "guerrero") brk += 2;
    if (this.buff().lifesteal) this.heal(dmg * this.buff().lifesteal);
    this.track("hits", 1, `${w.name}${crit ? " · crítico" : ""}`, { critical: crit, ranged, aerial: sit === "CRÍTICO AÉREO", dash: sit === "CRÍTICO EN DASH", weapon: w.base.type }); e.chronicleAmbush = sit === "ASESINATO" || sit === "SORPRESA";
    this.combo++; if (this.combo % 5 === 0) this.onSound("combo"); this.track("comboRecord", this.combo, "ataques consecutivos"); if (this.combo % 5 === 0) this.track("combos", 1, "cinco ataques consecutivos"); if (this.combo % 5 === 0) this.score.gain("attackCombo", Math.min(4, this.combo / 5)); if (this.score.mechHit(this.time)) this.track("combos", 1, "tres mecánicas distintas en tres segundos", { complex: true }); this.comboT = 3 + (this.cls.id === "duelista" ? 1.5 : 0); this.gainXp(2 + Math.min(6, Math.floor(this.combo/3)), "combo");
    this.damageEnemy(e, dmg, brk, { melee: !ranged, critical: crit, style: meleeStyle(w.base.type) });
    if (aff.includes("SANGRANTE")) e.bleed = 4;
    if (aff.includes("INCANDESCENTE") || this.hasP("ceniza") || this.activePact?.id === "ceniza") e.burn = 4;
    if (aff.includes("TOXICA")) e.poison = 6;
    if (aff.includes("VORAZ")) this.heal(dmg * 0.15);
    if (this.hasP("hambre")) this.heal(dmg * 0.1);
    if (aff.includes("INESTABLE") && Math.random() < 0.1) this.explode(e.x, e.y, 1.8, dmg * 0.6, true);
    if (aff.includes("ENCADENADA")) { const o = this.enemies.find((o) => o !== e && !o.dead && Math.hypot(o.x - e.x, o.y - e.y) < 3); if (o) { this.damageEnemy(o, dmg * 0.5, 1); this.burst(o.x, o.y, 0.5, "#7ad8ff", 8); } }
    return true;
  }

  // Roles de escuadra: escudo, sanador, manada, artillería, bruja, gancho y tambor.
  squadAct(e: Enemy, pat: string, dist: number, ux: number, uy: number, spd: number, move: (vx: number, vy: number) => void) {
    const allies = this.enemies.filter((o) => o !== e && !o.dead);
    if (pat === "caster" || pat === "gunner" || pat === "witch" || pat === "drummer") {
      const want = dist < 4.5 ? -1 : dist > 8 ? 1 : 0; move(ux * spd * want - uy * spd * 0.5 * Math.sin(e.t), uy * spd * want + ux * spd * 0.5 * Math.sin(e.t));
    }
    if (pat === "caster" && e.state !== 7 && Math.random() < 0.01) {
      const hurt = allies.filter((o) => Math.hypot(o.x - e.x, o.y - e.y) < SQUAD.healRadius && o.hp < o.hpMax * 0.7).sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0];
      if (hurt) { hurt.hp = Math.min(hurt.hpMax, hurt.hp + hurt.hpMax * SQUAD.healShare); this.burst(hurt.x, hurt.y, 0.8, "#5f5", 14); this.float("El hereje cura a un aliado", "#7f7"); }
    }
    if (pat === "witch" && dist < 3 && Math.random() < 0.03) { const a = rnd(0, Math.PI * 2), bx = this.px + Math.cos(a) * 6, by = this.py + Math.sin(a) * 6; if (this.canMoveActor(bx, by, this.floorHeight(bx, by), this.actorRadius(e), e)) { this.burst(e.x, e.y, 0.6, "#ff2a6a", 14); e.x = bx; e.y = by; this.burn = Math.max(this.burn, 2); this.float("MALDICIÓN CARMESÍ", "#ff2a6a"); } }
    if (pat === "pounce" && e.cd <= 0 && dist > 2 && dist < 6 && e.z === this.floorHeight(e.x, e.y)) { e.vz = 6; e.kx = ux * 11; e.ky = uy * 11; e.cd = rnd(2.2, 3.2); this.float("¡SALTA!", "#f66"); this.onSound("event"); }
    if (pat === "hook") {
      if (e.tele > 0) { /* gancho en curso */ }
      else if (e.cd <= 0 && dist > 3 && dist < 7) { e.tele = 0.7; this.float("¡GANCHO!", "#5ff"); e.cd = rnd(3.5, 5); }
      else if (dist > 1.1) move(ux * spd, uy * spd);
    }
    if (pat === "drummer" && e.cd <= 0) {
      e.cd = 4.5; const r = drumRoll(ri(1, 6)); this.onSound("event");
      if (r === "fail") this.float("TAHÚR: MALA TIRADA", "#aaa");
      else { for (const o of allies) if (Math.hypot(o.x - e.x, o.y - e.y) < SQUAD.drumRadius) { o.buff = SQUAD.drumSeconds; if (r === "jackpot") o.hp = Math.min(o.hpMax, o.hp + o.hpMax * 0.15); this.burst(o.x, o.y, 0.9, "#ffd34a", 6); } this.float(r === "jackpot" ? "¡SEIS! FRENESÍ Y CURA" : "DADOS: FRENESÍ ALIADO", "#ffd34a"); }
    }
    if (pat === "flanker" && dist > 1.2) { const bx = this.px - Math.cos(this.ang) * 1.3 - e.x, by = this.py - Math.sin(this.ang) * 1.3 - e.y, engaged = allies.some((o) => o.aware && Math.hypot(o.x - this.px, o.y - this.py) < 3); const b = Math.hypot(bx, by) || 1; move(bx / b * spd * (engaged ? 1.3 : 1), by / b * spd * (engaged ? 1.3 : 1)); }
    if (pat === "zealot" && e.hp < e.hpMax * SQUAD.zealotHp && e.state !== 8) { e.state = 8; e.tele = 0; e.cd = 9; this.float("¡EL FANÁTICO SE INMOLA!", "#ff5a2a"); this.onSound("event"); setTimeout(() => { if (e.dead) return; this.burst(e.x, e.y, 0.6, "#ff5a2a", 24); this.shake = 0.35; if (Math.hypot(this.px - e.x, this.py - e.y) < SQUAD.zealotRadius) this.hurtPlayer(ENEMY_TYPES[e.kind].dmg * 2.2, "inmolación"); for (const o of allies) if (Math.hypot(o.x - e.x, o.y - e.y) < 6) { o.buff = SQUAD.drumSeconds; o.hp = Math.min(o.hpMax, o.hp + o.hpMax * 0.2); } this.killEnemy(e); }, 900); }
    if (pat === "zealot" && e.state === 8) move(ux * spd * 1.6, uy * spd * 1.6);
    if (pat === "screamer") { if (dist < 5) move(-ux * spd, -uy * spd); else if (dist > 9) move(ux * spd, uy * spd);
      if (e.cd <= 0 && dist < 11) { e.cd = rnd(6, 8); this.float("¡CHILLIDO! Todo el piso te oye", "#c58aff"); this.onSound("event"); this.shake = 0.4; this.burst(e.x, e.y, 1, "#c58aff", 18); for (const o of this.enemies) if (!o.dead && Math.hypot(o.x - e.x, o.y - e.y) < SQUAD.screamRadius) { o.aware = true; o.buff = SQUAD.screamSeconds; } if (dist < 6) { this.hurtPlayer(ENEMY_TYPES[e.kind].dmg, "chillido"); this.vx *= 0.2; this.vy *= 0.2; } } }
    if (pat === "sniper") { const want = dist < 7 ? -1 : dist > SQUAD.sniperRange - 2 ? 1 : 0; move(ux * spd * want - uy * spd * 0.3 * Math.sin(e.t * 0.7), uy * spd * want + ux * spd * 0.3 * Math.sin(e.t * 0.7)); }
    if (pat === "bomber") { const want = dist < 5 ? -1 : dist > 8 ? 1 : 0; move(ux * spd * want, uy * spd * want);
      if (e.cd <= 0 && Math.random() < 0.006) { const hurt = allies.find((o) => o.hp < o.hpMax * 0.5 && Math.hypot(o.x - e.x, o.y - e.y) < 6); if (hurt) { hurt.hp = Math.min(hurt.hpMax, hurt.hp + hurt.hpMax * 0.3); hurt.burn = 0; hurt.poison = 0; this.burst(hurt.x, hurt.y, 0.8, "#7f5", 12); this.float("El alquimista lanza un tónico", "#7f5"); e.cd = 2; } } }
    if (pat === "bishop" && e.cd <= 0 && e.state !== 2 && Math.random() < 0.004) { const minions = this.enemies.filter((o) => !o.dead && (o.kind === "fanatico" || o.kind === "sombra")).length; if (minions < SQUAD.summonMax) { this.spawn("fanatico", e.x + 1, e.y); this.spawn("sombra", e.x - 1, e.y); this.float("EL OBISPO CONVOCA A SUS FIELES", "#ffd34a"); this.burst(e.x, e.y, 1, "#ffd34a", 20); e.cd = 3; } }
    if (pat === "bishop") { const want = dist < 4 ? -1 : dist > 7 ? 1 : 0; move(ux * spd * want - uy * spd * 0.6 * Math.sin(e.t * 0.5), uy * spd * want + ux * spd * 0.6 * Math.sin(e.t * 0.5)); }
    if (pat === "webber" || pat === "engineer" || pat === "siren") { const lo = pat === "siren" ? 6 : 4.5, hi = pat === "siren" ? 10 : 8; const want = dist < lo ? -1 : dist > hi ? 1 : 0; move(ux * spd * want - uy * spd * 0.5 * Math.sin(e.t * 1.3), uy * spd * want + ux * spd * 0.5 * Math.sin(e.t * 1.3)); }
    if (pat === "engineer" && e.cd <= 0) { const mech = allies.filter((o) => SQUAD.mechanical.includes(o.kind) && Math.hypot(o.x - e.x, o.y - e.y) < 7); if (mech.length) { for (const o of mech) { o.hp = Math.min(o.hpMax, o.hp + o.hpMax * 0.2); o.cd = Math.min(o.cd, 0.2); o.buff = 3; this.burst(o.x, o.y, 0.9, "#ffb347", 8); } this.float("EL RELOJERO SOBRECARGA SUS MÁQUINAS", "#ffb347"); this.onSound("event"); } e.cd = rnd(5, 6.5); }
    if (pat === "banner") { if (dist > 3) move(ux * spd * 0.6, uy * spd * 0.6); if (e.cd <= 0) { e.cd = 3; for (const o of allies) if (Math.hypot(o.x - e.x, o.y - e.y) < SQUAD.bannerRadius) { o.hp = Math.min(o.hpMax, o.hp + o.hpMax * 0.06); o.aware = true; } this.burst(e.x, e.y, 1.6, "#ffd34a", 6); } }
    if (pat === "spore" && e.cd <= 0 && dist < SQUAD.sporeRadius + 1) { e.cd = rnd(3.5, 4.5); this.burst(e.x, e.y, 0.5, "#bdf24a", 22); if (dist < SQUAD.sporeRadius) { this.poison = Math.max(this.poison, 5); this.float("ESPORAS: envenenado", "#bdf24a"); } }
    if (pat === "mimic" && e.cd <= 0 && Math.random() < 0.01) { const hurt = allies.filter((o) => o.kind !== "librero" && !o.miniBoss && o.hp < o.hpMax * 0.6 && Math.hypot(o.x - e.x, o.y - e.y) < 9).sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0]; if (hurt) { const hx = hurt.x, hy = hurt.y; hurt.x = e.x; hurt.y = e.y; e.x = hx; e.y = hy; hurt.hp = Math.min(hurt.hpMax, hurt.hp + hurt.hpMax * 0.25); this.burst(hx, hy, 0.8, "#7ff", 14); this.burst(hurt.x, hurt.y, 0.8, "#7ff", 14); this.float("EL DOBLE INTERCAMBIA LUGAR CON UN ALIADO", "#7ff"); e.cd = 4; } }
    if (pat === "guard" && dist > 1.1) { const ward = allies.find((o) => ["caster", "drummer", "witch", "gunner"].includes(ENEMY_TYPES[o.kind].pattern) && Math.hypot(o.x - e.x, o.y - e.y) < 6); if (ward && dist > 2.5) { const mx = (ward.x + this.px) / 2 - e.x, my = (ward.y + this.py) / 2 - e.y; move(mx * spd, my * spd); } }
  }
  damageEnemy(e: Enemy, dmg: number, brk: number, hit: FragmentHit = {}) {
    if (e.dead) return; e.lastMelee = !!hit.melee;
    if (dmg > 0) { this.skillEvent("damage", dmg); const ls = this.skillMul("lifesteal"); if (ls) this.heal(dmg * ls); }
    dmg *= downedBonus((e.downT ?? 0) > 0);
    if ((e.elite === "ESPEJADO" || e.kind === "espejo") && Math.random() < 0.2) { this.hurtPlayer(dmg * 0.3, "reflejo"); this.float("ESPEJADO", "#9cf"); }
    { const shield = (e.kind === "soldado" || e.kind === "caballero") && e.stagger <= 0 && shieldBlocks(e.face ?? 0, e.x, e.y, this.px, this.py); const guarded = e.kind !== "soldado" && this.enemies.some((o) => o !== e && !o.dead && o.aware && ((o.kind === "soldado" || o.kind === "caballero") && Math.hypot(o.x - e.x, o.y - e.y) < SQUAD.guardRadius || o.kind === "behemoth" && Math.hypot(o.x - e.x, o.y - e.y) < SQUAD.bulwarkRadius || o.kind === "portaestandarte" && Math.hypot(o.x - e.x, o.y - e.y) < SQUAD.bannerRadius)); dmg *= squadDamageFactor({ shield, guarded, drummed: (e.buff ?? 0) > 0 }); if (shield && e.kind === "caballero" && Math.hypot(this.px - e.x, this.py - e.y) < 2 && Math.random() < 0.35) { this.hurtPlayer(ENEMY_TYPES.caballero.dmg * 0.7, "contraataque"); this.float("¡CONTRAATAQUE DEL CABALLERO!", "#c58aff"); } if (shield) { this.float("¡BLOQUEO CON ESCUDO! Flanquéalo", "#9ab"); this.burst(e.x, e.y, 0.7, "#ccd", 8); brk *= 0.4; } }
    if (!e.aware || dmg > 0) this.alertAllies(e); e.aware = true; this.onSound("hit", hit.style ?? (hit.critical ? "crit" : "ranged")); this.onSound("enemy", e.kind); this.track("damageDealt", Math.min(e.hp, Math.max(0, dmg)), ENEMY_TYPES[e.kind].name); e.hp -= dmg; if (e.hp > 0) this.bark(e, "hit");
    this.dmgNums.push(makeDmgNum(e.x, e.y, e.z + .9, dmg, e.hpMax, !!hit.critical)); this.dmgNums = this.dmgNums.slice(-DMG_NUM.max);
    if (e.hp > 0 && e.hp <= e.hpMax * EXPOSE.hpShare && !e.exposedOnce && e.kind !== "librero") { e.exposed = EXPOSE.seconds; e.exposedOnce = true; this.float("¡EXPUESTO! [E] robar · patada final", "#ff7ad9"); } e.hurt = 0.15; e.brk -= brk*(e.variant==="ash"?1.25:1);
    this.burst(e.x, e.y, 0.6, "#c4121e", 6);
    if (e.brk <= 0 && e.stagger <= 0) { this.onSound("break"); e.stagger = 3; e.brk = 0; this.float("¡TAMBALEANDO! [F] remate [G] escudo · patada", "#ff7ad9"); }
    // golpeado y en pie: puede replegarse unos pasos (más probable con racha de muertes)
    if (e.hp > 0 && e.stagger <= 0 && (e.retreatCd ?? 0) <= 0 && e.kind !== "librero" && !e.miniBoss && Math.random() < retreatChance(this.killStreak, HEAVY.includes(e.kind)) * this.chal.evade) {
      e.retreatT = rnd(RETREAT.seconds[0], RETREAT.seconds[1]); e.retreatA = Math.atan2(e.y - this.py, e.x - this.px) + rnd(-0.5, 0.5);
      e.retreatCd = rnd(RETREAT.cooldown[0], RETREAT.cooldown[1]); e.tele = 0; e.cd = Math.max(e.cd, e.retreatT * 0.8);
      e.retreatMax = e.retreatT; this.bark(e, "flee"); if (this.retreatCue.sound) this.onSound("retreat"); if (this.retreatCue.visual && this.time - (this.retreatMsgAt ?? -9) > 1.2) { this.retreatMsgAt = this.time; this.float(`${ENEMY_TYPES[e.kind].name.toUpperCase()} SE REPLIEGA · ¡PERSÍGUELO!`, "#7ad8ff"); }
    }
    const fragment = fragmentImpact(dmg, e.hpMax, e.hp, hit);
    if (fragment !== 'none') this.fragmentEnemy(e, fragment === 'burst', hit.style);
    if (e.hp <= 0) { this.killEnemy(e); if (e.shattered) e.hurt = 0; }
  }

  killEnemy(e: Enemy, glory = false) {
    if (e.dead) return; PX.noteUnlock(this, e.lastMelee ? "meleeKill" : "otherKill");
    if (this.shieldEnemy === e) { this.shieldEnemy = null; this.shieldT = 0; }
    e.grabbed = false;
    recordStat(this.runId, "kill");
    if (e.kind === "golem") { e.dead = true; this.spawn("espectro", e.x + .6, e.y); this.spawn("espectro", e.x - .6, e.y); e.dead = false; this.float("EL GÓLEM SE DESHOJA EN ESPECTROS", "#e8c98a"); this.burst(e.x, e.y, .8, "#e8c98a", 26); }
    if (e.kind === "portador") { this.burst(e.x, e.y, .6, "#bdf24a", 30); if (Math.hypot(this.px - e.x, this.py - e.y) < SQUAD.sporeRadius) { this.poison = Math.max(this.poison, 8); this.float("¡ESTALLIDO DE ESPORAS!", "#bdf24a"); } }
    if (e.kind === "portaestandarte") { for (const o of this.enemies) if (o !== e && !o.dead && Math.hypot(o.x - e.x, o.y - e.y) < SQUAD.bannerRadius) o.stagger = Math.max(o.stagger, 1.2); this.float("¡CAE EL ESTANDARTE! Sus aliados vacilan", "#ffd34a"); }
    this.track("kills", 1, ENEMY_TYPES[e.kind].name, { unharmed: this.chronicles.run?.floorDamage === 0, ambush: !!e.chronicleAmbush, riposte: !!e.chronicleRiposte }, `kill-${e.id}`); if (glory) this.track("executions", 1, "remate de un enemigo expuesto", {}, `execution-${e.id}`);
    this.skillEvent("kills"); this.onSound("kill", e.kind); e.dead = true; e.hurt = .4; this.bark(e, "death"); this.kills++; this.score.gain("kill", e.miniBoss ? 3 : 1); if (this.streakT > 0) this.score.gain("killCombo", Math.min(5, this.killStreak)); this.perfKills++; this.adapt = adaptOnKill(this.adapt, this.hp, this.hpMax); this.floorKills++; this.legacy.kills++; this.killStreak = this.streakT > 0 ? this.killStreak + 1 : 1; this.streakT = this.streakMax = frenzyWindow(this.killStreak); if (this.killStreak > 1) { const f = this.frenzyFx(); this.float(`RACHA x${this.killStreak} · FRENESÍ +${Math.round((f.move - 1) * 100)}% vel`, "#ffd34a"); } this.alertAllies(e); this.questEvent("kill");
    this.bumpSanity("kill");
    for (const o of this.enemies) { if (o === e || o.dead || Math.hypot(o.x - e.x, o.y - e.y) > REGEN.radius) continue; const h = regenHeal(o.kind, o.hp, o.hpMax, Math.random()); if (h > 0) { o.hp += h; this.burst(o.x, o.y, .8, "#63e08a", 14); this.float(`${ENEMY_TYPES[o.kind].name} SE REGENERA +${h}`, "#63e08a"); } }
    const t = ENEMY_TYPES[e.kind];
    const gx = (glory ? (this.has("carnicero") ? 3 : 2) : 1);
    this.gainXp(Math.round((t.hp / 2 + (e.elite ? 25 : 0) + (e.miniBoss?50:0)) * (e.ambushed?1.25:1) * gx * this.xpMult()), "enemigos");
    this.burst(e.x, e.y, 0.6, "#5c0a12", 20);
    if (e.elite === "EXPLOSIVO") this.explode(e.x, e.y, 2.5, 18, false);
    if (e.role === "kamikaze") { e.role = undefined; this.explode(e.x, e.y, ROLES.kamikazeRadius * .8, 12, true); }
    if (this.challenge) this.challenge.kills++;
    if (this.contract && !this.contract.done) this.contract.kills++;
    if ((canUseWeapon(this.melee, this.level) && this.melee.affixes?.includes("SEGADORA")) || (canUseWeapon(this.ranged, this.level) && this.ranged.affixes?.includes("SEGADORA"))) { if (this.canCarry(.15)) this.ammo += 3; this.stam = this.stamMax; }
    const gm = (this.hasP("babel") ? 1.5 : 1) * (this.activePact?.id === "babel" ? 1.6 : 1);
    const lootFrom = this.pickups.length;
    if (Math.random() < (this.killStreak > 1 ? 1 : 0.6) * gm) this.pickups.push({ x: e.x, y: e.y, kind: "gold", n: Math.round(ri(3, 10) * this.floor * gm * this.chipMult()), bob: 0 });
    { const lr = rollEnemyLoot(e.kind, !!e.elite, gm); if (lr) this.pickups.push({ x: e.x + 0.3, y: e.y, kind: "item", item: this.makeWeapon(lr.type, undefined, lr), bob: 0 }); }
    if (Math.random() < (e.elite ? 0.2 : 0.04) * gm) this.pickups.push({ x: e.x + 0.3, y: e.y + .3, kind: "item", item: this.makeArmor(), bob: 0 });
    if (Math.random() < (this.has("recolector") ? 0.7 : 0.4)) this.pickups.push({ x: e.x - 0.3, y: e.y, kind: "mat", mat: pick(Object.keys(MATERIALS)), n: 1, bob: 0 });
    if (Math.random() < .45) this.pickups.push({ x: e.x + .5, y: e.y + .5, kind: pick(['food', 'water'] as const), bob: 0 });
    if (Math.random() < .25) this.pickups.push({ x: e.x - .5, y: e.y + .5, kind: 'item', item: { uid: UID++, kind: 'consumable', name: 'venda', id: 'venda', rarity: 0 }, bob: 0 });
    if (Math.random() < .08) this.pickups.push({ x: e.x, y: e.y + .7, kind: 'item', item: { uid: UID++, kind: 'consumable', name: 'espejo', id: 'espejo', rarity: 1 }, bob: 0 });
    if (isPariah(this.cls.id)) this.pariahLoot(lootFrom);
    if (e.kind === "librero") {
      recordBoss(this.runId, { floor: this.floor, difficulty: this.difficulty.id, seconds: this.bossFight.seconds, damage: this.bossFight.damage, score: Math.round(this.score.total) });
      this.track("bosses", 1, this.region.boss, {}, `boss-${e.id}`); this.bossDead = true; this.openArena(); this.score.gain("boss"); this.gainMT(); this.msg(`${this.region.boss} CAE. Se abre el portal del refugio.`);
      this.gloom = Math.max(this.gloom, .55); if (this.bossRequired) this.startCollapse(); else { const at = this.collapsePortalSpot(); this.pickups.push({ x: at.x, y: at.y, kind: "portal", bob: 0 }); }
      this.pickups.push({ x: e.x + 1, y: e.y, kind: "item", item: this.makeWeapon(undefined, 4), bob: 0 });
      this.anima += 30; localStorage.setItem("ars_anima_meta", String(this.anima));
    }
    if(e.miniBoss){this.pickups.push({x:e.x,y:e.y,kind:"item",item:this.makeWeapon(undefined,rewardRarity("miniBoss",this.floor)),bob:0});this.msg("MINIJEFE DERROTADO · botín de calidad");}
    const zone=this.zoneAt(e.x,e.y);
    if(this.combatZones.has(zone)&&!this.clearedZones.has(zone)&&!this.enemies.some(a=>!a.dead&&this.zoneAt(a.x,a.y)===zone)) {this.clearedZones.add(zone);this.gainXp(25*this.floor, "zonas");this.msg(`${zone} despejada · +${25*this.floor} EXP`);}
    this.legacy.maxLevel=Math.max(this.legacy.maxLevel,this.level);this.saveLegacy();
  }

  xpLog: Partial<Record<XpSource, number>> = {};
  floorDamageXp = 0;
  xpFrac = 0;
  gainXp(n: number, src: XpSource = "otros") {
    const v = Math.round(n*(this.alterationAt()?.xp??1)); this.xp += v; this.xpLog[src] = (this.xpLog[src] ?? 0) + v;
    while (this.xp >= this.xpNext) {
      this.onSound("level"); this.xp -= this.xpNext; { const sb = this.openSkills(); this.level++; this.checkSkillUnlocks(sb); } this.score.gain("levelUp"); this.xpNext = isPariah(this.cls.id) ? pariahXp(xpForLevel(this.level)) : xpForLevel(this.level); this.grantClassRewards(); if (this.level === forbiddenZoneLevel(this.floor) && this.forbiddenDoor >= 0) { this.msg("La Zona Prohibida se ha abierto a tu paso: nuevas rutas y enemigos más fuertes."); this.float("ZONA PROHIBIDA DESBLOQUEADA", "#ff5a7a"); } this.sp++; this.attrPoints += ATTR_UP.perLevel; if (isPariah(this.cls.id)) for (const a of growthAttrs(this.level)) if ((this.attrs[a] ?? 0) < ATTR_UP.max) this.attrs[a] = (this.attrs[a] ?? 0) + 1; 
      this.recalc(); this.hp = this.hpMax; this.float(`NIVEL ${this.level}`, "#7affc1"); this.msg(`Subes a nivel ${this.level}. +1 punto de habilidad y +1 de atributo.`);
      this.legacy.maxLevel=Math.max(this.legacy.maxLevel,this.level);this.saveLegacy();this.onUI();
      if (this.level % 3 === 0) this.offerPact(); else this.offerLevelPerk();
    }
  }

  openUp(e: Enemy) { e.opening = OPENING.seconds; e.cd = Math.max(e.cd, OPENING.seconds); this.float("¡FALLÓ! CONTRAATACA · DAÑO ×2", "#7affc1"); this.onSound("parry"); }
  heal(n: number) { this.hp = Math.min(this.hpMax, this.hp + n); }

  hurtPlayer(dmg: number, src: string, crit = false, from?: { x: number; y: number }, hitZ?: number) {
    if(this.isSafe())return; this.skillEvent("hurt"); dmg *= (isPariah(this.cls.id) ? PX.takenFactor(this, from, hitZ) : 1) * this.skillMul("taken") * this.subclassFx().taken * classMods(this.cls.id, this.level).taken * inkFactor(this.inked) * (1 - this.buff().armor) * mementoFactor(this.palimMemento, this.hp, this.hpMax); this.sitting = false;
    { const f = from ?? this.enemies.filter(e=>!e.dead&&e.aware&&Math.hypot(e.x-this.px,e.y-this.py)<4).sort((a,b)=>Math.hypot(a.x-this.px,a.y-this.py)-Math.hypot(b.x-this.px,b.y-this.py))[0];
      { const src = this.enemies.filter(e => !e.dead && Math.hypot(e.x - f?.x, e.y - f?.y) < 1.6)[0]; if (src && dmg > 0) this.bark(src, "hurt"); }
      if (f && Math.hypot(f.x-this.px,f.y-this.py)>.05) { this.hitDirs.push({ a: Math.atan2(f.y-this.py,f.x-this.px), t: 1.2 }); this.hitDirs=this.hitDirs.slice(-6); } }
    if (this.dashT > 0) { if (this.time - this.lastDefT > .6) { this.lastDefT = this.time; this.track("dodges", 1, "dash durante el impacto enemigo"); this.score.gain("defense"); } this.float("ESQUIVA", "#7ad8ff"); return; }
    this.perfDmg += dmg; this.adapt = adaptOnHurt(this.adapt, dmg, this.hpMax, this.hp - dmg);
    if (this.shieldEnemy && src !== "veneno" && src !== "fuego") { this.shieldEnemy.hp -= dmg; this.float("ESCUDO DE CARNE", "#ff9"); if (this.shieldEnemy.hp <= 0) { this.killEnemy(this.shieldEnemy); this.shieldEnemy = null; } return; }
    const hostileHit = !["veneno", "fuego", "hambre", "sed", "escombros", "reflejo", "astillas"].includes(src.toLowerCase());
    if (hostileHit && this.hitGrace > 0) return;
    if (hostileHit && isPariah(this.cls.id)) { this.pariah.impulse = 0;
      // Instinto Paria: el parry perfecto devuelve proyectiles a su origen con el sistema de proyectiles existente.
      if (isPariah(this.cls.id) && src === "proyectil" && this.parryT > 0 && this.playerStagger <= 0 && from) { const a = Math.atan2(from.y - this.py, from.x - this.px); this.projs.push({ x: this.px + Math.cos(a) * .4, y: this.py + Math.sin(a) * .4, z: this.pz + .55, dx: Math.cos(a) * 18, dy: Math.sin(a) * 18, life: 1.2, dmg, friendly: true, color: "#ffe18b", sprite: "bullet", size: .1 }); this.parryT = 0; this.onSound("parry"); this.float("PARRY · PROYECTIL DEVUELTO", "#ffe18b"); this.track("parries", 1, "proyectil devuelto"); return; } }
    // Parry: una ventana breve y deliberada. El éxito niega el golpe y devuelve un riposte ×2.
    if (hostileHit && this.parryT > 0 && this.playerStagger <= 0) {
      const e = this.nearestFacing(3.4, 1.5) ?? this.enemies.filter((x) => !x.dead && Math.hypot(x.x - this.px, x.y - this.py) < 2.7).sort((a,b) => Math.hypot(a.x-this.px,a.y-this.py)-Math.hypot(b.x-this.px,b.y-this.py))[0];
      if (e) {
        this.track("parries", 1, "parry en la ventana perfecta"); this.track("counters", 1, "riposte después del parry"); this.parryT = 0; this.onSound("parry"); this.float("PARRY PERFECTO · RIPOSTE ×2", "#ffe18b"); this.shake = Math.max(this.shake, .22);
        e.brk = Math.max(0, e.brk - 2); e.stagger = Math.max(e.stagger, 1.25); if (isPariah(this.cls.id) && Math.random() < PARIAH.parry.stunChance) { e.stagger = Math.max(e.stagger, 1.25 + PARIAH.parry.stunSec); e.cd = Math.max(e.cd, PARIAH.parry.stunSec); this.float("PARALIZADO", "#ffe18b"); }
        e.chronicleRiposte = true; this.attackEnemy(e, this.melee, 2 * (this.onRhythm("PARRY") ? RHYTHM.reflect : 1), { noRoll: true, brkBonus: this.has("parry_maestro") ? 4 : 2 });
        e.chronicleRiposte = false; if (this.hasE("espejo")) this.lumbre = Math.min(this.lumbreMax, this.lumbre + 1);
        if (this.has("sangre_frio")) this.slowmo = Math.max(this.slowmo, .6);
        return;
      }
      if (src === "proyectil") { this.parryT = 0; this.onSound("parry"); this.float("PROYECTIL DESVIADO", "#7ad8ff"); return; }
    }
    // Bloqueo perfecto: alzar la guardia justo antes del golpe reduce el daño y lo refleja multiplicado.
    if (hostileHit && this.blocking && this.perfectBlockT > 0 && this.playerStagger <= 0) {
      const e = this.nearestFacing(3.6, 1.6) ?? this.enemies.filter((x) => !x.dead && Math.hypot(x.x - this.px, x.y - this.py) < 3).sort((a,b) => Math.hypot(a.x-this.px,a.y-this.py)-Math.hypot(b.x-this.px,b.y-this.py))[0];
      const taken = Math.max(0, Math.round(dmg * PERFECT_BLOCK.taken));
      this.track("parries", 1, "bloqueo perfecto"); if (e) this.track("counters", 1, "reflejo tras bloqueo perfecto"); this.perfectBlockT = 0; this.score.gain("defense"); this.onSound("parry"); this.shake = Math.max(this.shake, .2);
      if (e) { const back = Math.max(1, Math.round(dmg * PERFECT_BLOCK.reflect * (this.onRhythm("REFLEJO") ? RHYTHM.reflect : 1))); e.chronicleRiposte = true; e.stagger = Math.max(e.stagger, .9); this.damageEnemy(e, back, 3); e.chronicleRiposte = false; this.float(`BLOQUEO PERFECTO · REFLEJA ${back}`, "#ffe18b"); }
      else this.float("BLOQUEO PERFECTO", "#ffe18b");
      if (src === "proyectil" || taken <= 0) return;
      this.hp -= taken; this.score.damage(taken); this.floorDamage += taken; this.hurtFlash = .12; if (hostileHit) this.hitGrace = .18; this.announceHurt(taken, src); return;
    }
    const canGuard = hostileHit && this.blocking && this.stam >= 1 && this.playerStagger <= 0;
    if (canGuard) {
      this.stam = Math.max(0, this.stam - 1.5);
      const reduction = Math.min(dmg * .82, 2 + (this.armor?.def ?? 0) * .8 + (this.has("guardia") ? 3 : 0) + (["guardian", "guerrero"].includes(this.cls.id) ? 2 : 0));
      dmg = Math.max(1, dmg - reduction); this.onSound("block"); this.float("BLOQUEO", "#9bc8e8");
    }
    const red = Math.max(0, (this.armor?.def ?? 0) * 0.6);
    dmg = Math.max(1, dmg - red);
    if(hostileHit)this.hitGrace=.18;
    if (this.arena) this.bossFight.damage += dmg;
    if (isPariah(this.cls.id) && hostileHit) dmg = PX.deferPain(this, dmg, from);
    this.onSound("hurt"); this.hp -= dmg; this.score.damage(dmg); this.floorDamage += dmg; if (hostileHit && this.hp > 0) { const dx = damageXp(dmg, this.floorDamageXp); if (dx > 0) { this.floorDamageXp += dx; this.xpFrac = (this.xpFrac ?? 0) + dx; if (this.xpFrac >= 1) { const w = Math.floor(this.xpFrac); this.xpFrac -= w; this.gainXp(w, "danio"); } } } this.hurtFlash = 0.3; this.shake = Math.max(this.shake, 0.15); this.combo = Math.max(0, this.combo - 3); this.announceHurt(dmg, src);
    if (hostileHit) {
      const breakImpact = Math.max(1, Math.ceil(dmg * (canGuard ? (this.has("guardia") ? .08 : .16) : .28)));
      this.breakValue = Math.min(this.breakMax, this.breakValue + breakImpact); this.breakDelay = 2.1;
      if (this.breakValue >= this.breakMax && this.playerStagger <= 0) {
        this.playerStagger = 1.05; this.breakValue = Math.floor(this.breakMax * .5); this.blocking = false;
        this.float("TU POSTURA SE ROMPE", "#ff6e83"); this.shake = Math.max(this.shake, .28);
      }
    }
    if (!(isPariah(this.cls.id) && PX.maybeWound(this, crit, hostileHit)) && (crit || Math.random() < 0.08)) {
      const part = pick(BODY_PARTS); this.track("wounds", 1, part); this.wounds[part] = 25; this.msg(`Herida en ${part}`); this.float(`HERIDA: ${part}`, "#ff5050");
      if (part === "TORSO") this.bleed = 8;
    }
    // Último acto de la Epifanía: el precio se paga al evitar la caída, no después.
    if (this.hp <= 0 && this.hasE("umbral") && !this.epiphanyLastStand && this.lumbre >= 3 && this.resonance >= 1) {
      this.hp = 1; this.lumbre -= 3; this.resonance--; this.mh = Math.max(1, this.mh - 4); this.epiphanyLastStand = true; this.float("UMBRAL · TODAVÍA NO", "#d2b1ff"); return;
    }
    if (hostileHit && (crit || this.wounds.CABEZA || this.hp < this.hpMax*.25)) this.terror(crit ? 4 : 2);
    if (this.hp <= 0) this.die();
  }

  die() {
    if (this.mode === "dead" || this.mode === "won") return;
    this.mode = "dead"; this.anima += this.floor * 10 + this.level * 3;
    this.deathCause = this.lastHurt; if (this.lastHurt) this.msg(`Causa de la caída: ${this.lastHurt}.`);
    this.score.add("death", -PENALTY.death); this.recap = this.score.recap("death", this.floor); this.recapChecks = []; localStorage.setItem("ars_anima_score_bonus", String(this.recap.bonus));
    localStorage.setItem("ars_anima_meta", String(this.anima)); this.endRun("death"); this.onUI();
  }

  /** Frenazo: polvo con su propio azar para no alterar la simulación. */
  fxSeed = 1;
  stopFx() { const rnd = () => (this.fxSeed = (this.fxSeed * 16807) % 2147483647) / 2147483647;
    for (const p of motionBurst('stop', this.px, this.py, this.pz, this.groundKind(this.px, this.py), this.vx, this.vy, { quality: .8, rnd })) this.parts.push({ ...p, soft: p.size > .03 }); }
  /** Dust/pebbles for movement events (presentation only). */
  motionFx(ev: MotionEvent, impact = 4) {
    const rnd = ev === 'dash' || ev === 'airjump' ? () => (this.fxSeed = (this.fxSeed * 16807) % 2147483647) / 2147483647 : undefined;
    const parts = motionBurst(ev, this.px, this.py, this.pz, this.groundKind(this.px, this.py), this.vx, this.vy, { impact, quality: .8, rnd });
    for (const p of parts) this.parts.push({ ...p, soft: p.size > .03 });
  }
  /** Ground pound: ring of rocks and a rolling dust wave. */
  poundFx(rad: number) {
    const z = this.floorHeight();
    for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2, s = rnd(2.5, 5) * rad / 2.6; this.parts.push({ x: this.px, y: this.py, z: z + .03, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rnd(.2, .8), life: rnd(.5, .9), color: ["#8f8577", "#a49885", "#6b5a3e"][i % 3]!, size: rnd(.05, .09), soft: true }); }
    for (let i = 0; i < 14; i++) { const a = rnd(0, Math.PI * 2), s = rnd(1, 3.5); this.parts.push({ x: this.px, y: this.py, z: z + .05, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rnd(3, 6), life: rnd(.7, 1.2), color: ["#4a443c", "#5d564c", "#3a2f22"][i % 3]!, size: rnd(.025, .045) }); }
  }
  /** Chips and dust kicked out of a wall at (x,y,z); `back` is the angle pointing away from the wall. */
  wallChips(x: number, y: number, z: number, back: number, n = 8, seeded = false) {
    const rnd = seeded ? (a: number, b: number) => a + ((this.fxSeed = (this.fxSeed * 16807) % 2147483647) / 2147483647) * (b - a) : (a: number, b: number) => a + Math.random() * (b - a);
    const col = this.region.id === "garden" ? ["#6a6a5a", "#8a8a74"] : ["#7d7366", "#a49885", "#5d564c"];
    for (let i = 0; i < n; i++) { const a = back + rnd(-1, 1), s = rnd(1, 3.2); this.parts.push({ x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rnd(.5, 2.5), life: rnd(.5, 1), color: col[i % col.length]!, size: rnd(.015, .03) }); }
    for (let i = 0; i < Math.ceil(n / 2); i++) { const a = back + rnd(-.6, .6); this.parts.push({ x, y, z, vx: Math.cos(a) * .6, vy: Math.sin(a) * .6, vz: rnd(.1, .4), life: rnd(.6, 1.1), color: "#b1aaa0", size: rnd(.04, .07), soft: true }); }
  }
  /** Melee swing that meets masonry: sparks, chips and a scuff mark on the wall face. */
  meleeWallFx(cos: number, sin: number, range: number) {
    for (let d = .3; d <= range + .2; d += .1) { const x = this.px + cos * d, y = this.py + sin * d; if (this.solid(x, y, this.pz + .5)) { const hx = this.px + cos * (d - .08), hy = this.py + sin * (d - .08), z = this.pz + .5 + rnd(-.1, .1); this.wallChips(hx, hy, z, Math.atan2(-sin, -cos), 12); for (let i = 0; i < 5; i++) this.parts.push({ x: hx, y: hy, z, vx: -cos * rnd(1, 3) + rnd(-1, 1), vy: -sin * rnd(1, 3) + rnd(-1, 1), vz: rnd(1, 3), life: rnd(.15, .35), color: "#ffd88a", size: .012 }); this.marks.push({ x: hx, y: hy, z, t: BULLET_MARKS.seconds * .6 }); this.shake = Math.max(this.shake, .1); return; } }
  }
  /** A body killed by a blast flies, bounces off walls/floor/ceiling and bursts into pieces. */
  throwEnemy(e: Enemy, bx: number, by: number, r: number) {
    if (e.shattered) return;
    const key = `enemy:${e.kind}`; const img = this.frame(e.kind, "hurt", 0) ?? this.sprites[e.kind] ?? this.sprites[ENEMY_TYPES[e.kind].sprite];
    if (!img) return; this.fxImages.set(key, img); const v = launchFrom(bx, by, e.x, e.y, r);
    this.flyers.push({ x: e.x, y: e.y, z: e.z, ...v, rot: 0, vr: rnd(-9, 9), t: 0, bounces: 0, scale: ENEMY_TYPES[e.kind].scale, key, kind: "enemy" }); e.hurt = 0;
  }
  /** Decorative props caught in a blast are thrown instead of shattering on the spot. */
  blastProps(x: number, y: number, r: number) {
    for (const pk of this.pickups) { if (pk.used || pk.kind !== "decor" || pk.deco === "powder" || pk.deco === "fountain" || !pk.deco || !this.sprites[pk.deco] || Math.hypot(pk.x - x, pk.y - y) >= r || propBreakOutcome(pk.deco, 0) === "none") continue;
      pk.used = true; const out = propBreakOutcome(pk.deco, Math.random()); if (out === "reward") this.dropPropReward(pk.x, pk.y); else if (out === "splinters") this.splinters(pk.x, pk.y);
      this.flyProp(pk.deco, pk.x, pk.y, x, y, r); }
    this.scenicProps = this.scenicProps.filter(sp => { if (LIGHTS[sp.deco] || !this.sprites[sp.deco] || Math.hypot(sp.x - x, sp.y - y) >= r) return true; this.flyProp(sp.deco, sp.x, sp.y, x, y, r); return false; });
  }
  flyProp(deco: string, px: number, py: number, bx: number, by: number, r: number) {
    const key = `prop:${deco}`; const img = this.sprites[deco]; if (!img) return; this.fxImages.set(key, img);
    this.flyers.push({ x: px, y: py, z: this.floorHeight(px, py), ...launchFrom(bx, by, px, py, r), rot: 0, vr: rnd(-7, 7), t: 0, bounces: 0, scale: Math.min(1, PROP_SCALE[deco] ?? .4), key, kind: "prop" });
  }
  fxImages = new Map<string, HTMLImageElement | HTMLCanvasElement>();
  fragmentSerial = 0;
  fragmentCanvas?: HTMLCanvasElement;
  cutEnemyFrame(e: Enemy, image: SpriteImage | undefined) {
    if (!image || !e.spriteCuts?.length) return image;
    e.cutFrames ??= new WeakMap();
    const cached = e.cutFrames.get(image); if (cached) return cached;
    const result = damagedSprite(image, e.spriteCuts); e.cutFrames.set(image, result); return result;
  }
  /** Actual sprite chips; no extra damage, dice, loot or collision bodies. */
  fragmentEnemy(e: Enemy, burst: boolean, style = 'cut') {
    const base = this.frame(e.kind, 'hurt', 0) ?? this.sprites[ENEMY_TYPES[e.kind].sprite];
    const image = this.cutEnemyFrame(e, base); if (!image) return;
    e.fragmentHits = (e.fragmentHits ?? 0) + 1;
    const random = fragmentRandom(e.id * 65537 + e.fragmentHits * 97);
    const scale = ENEMY_TYPES[e.kind].scale;
    const cuts: Cut[] = [];
    if (burst) {
      const n = FRAGMENT.burstGrid;
      for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) cuts.push({ u: col / n, v: row / n, uw: 1 / n, vh: 1 / n, round: false });
    } else { const cut = chipCut(image, random, style === 'smash' || style === 'punch'); if (cut) cuts.push(cut); }
    for (const cut of cuts) {
      const sprite = cropFragment(image, cut, burst); if (!sprite) continue;
      const key = `fragment:${++this.fragmentSerial}`; this.fxImages.set(key, sprite);
      const piece = fragmentMotion(e.x, e.y, e.z, scale, cut, key, Math.atan2(e.y - this.py, e.x - this.px), burst, random);
      // Match each crop's original horizontal placement before scattering.
      const offset = (cut.u + cut.uw / 2 - .5) * scale * image.width / image.height;
      piece.x -= Math.sin(this.ang) * offset; piece.y += Math.cos(this.ang) * offset;
      this.gibs.push(piece);
    }
    if (burst) { e.shattered = true; this.onSound('break'); }
    else if (cuts.length) { e.spriteCuts = [...(e.spriteCuts ?? []), ...cuts].slice(-FRAGMENT.maxCuts); e.cutFrames = new WeakMap(); }
    this.gibs = this.gibs.slice(-GIB.max);
  }
  /** Flyers, gibs, fountain spray, puddles and ceiling drips. */
  updateWorldFx(dt: number) {
    const solid = (x: number, y: number, z: number) => this.solid(x, y, z);
    for (const f of this.flyers) { const hit = stepFlyer(f, dt, solid, this.floorHeight(f.x, f.y)); if (hit) { this.wallChips(f.x, f.y, f.z + .2, rnd(0, Math.PI * 2), 4); if (f.kind === "enemy" && Math.random() < .6) this.burst(f.x, f.y, f.z + .3, "#7a0614", 4); } }
    for (const f of this.flyers) if (flyerDone(f)) { this.gibs.push(...shatterFlyer(f)); this.burst(f.x, f.y, f.z + .3, f.kind === "enemy" ? "#a00a1e" : "#9f9290", 10); this.onSound("break"); }
    this.flyers = this.flyers.filter(f => !flyerDone(f));
    for (const g of this.gibs) stepGib(g, dt, solid, this.floorHeight(g.x, g.y));
    this.gibs = this.gibs.filter(g => g.life > 0).slice(-GIB.max);
    const fragmentKeys = new Set(this.gibs.map(g => g.key));
    for (const key of this.fxImages.keys()) if (key.startsWith('fragment:') && !fragmentKeys.has(key)) this.fxImages.delete(key);
    for (const pd of this.puddles) pd.t -= dt; this.puddles = this.puddles.filter(pd => pd.t > 0);
    this.fxAcc += dt * FOUNTAIN.rate;
    const fountains = this.pickups.filter(p => p.kind === "decor" && p.deco === "fountain" && !p.used && Math.hypot(p.x - this.px, p.y - this.py) < 14);
    while (this.fxAcc >= 1) { this.fxAcc -= 1; for (const f of fountains) this.parts.push(fountainDrop(f.x, f.y, this.floorHeight(f.x, f.y))); }
    this.dripAcc += dt * dripRate(this.region.id, this.weather === 2);
    while (this.dripAcc >= 1) { this.dripAcc -= 1; const d = drip(this.px, this.py, 2.4, this.region.id); if (!this.solid(d.x, d.y, 1)) this.parts.push({ ...d, drop: true }); }
  }
  /** Lights that cast sprite shadows: scenic lights, fire props, explosions and the player's lantern. */
  shadowLights(): ShadowLight[] {
    const out: ShadowLight[] = [{ x: this.px, y: this.py, radius: 6, strength: this.darkness ? 1 : .55 }];
    for (const p of this.scenicProps) { const l = LIGHTS[p.deco]; if (l) out.push({ x: p.x, y: p.y, radius: l.radius * 1.4, strength: 1 }); }
    for (const p of this.pickups) if (p.kind === "decor" && !p.used && (p.deco === "fire" || p.deco === "healing_brazier")) out.push({ x: p.x, y: p.y, radius: 4.5, strength: 1.1 });
    for (const fx of this.explosions) out.push({ x: fx.x, y: fx.y, radius: 7, strength: 2 });
    return out;
  }

  explode(x: number, y: number, r: number, dmg: number, friendly: boolean) {
    this.explosions.push({ x, y, z: this.floorHeight(x, y), t: 0 });
    this.environmentImpact(x,y,.3,true);
    this.onSound("explosion"); this.burst(x, y, 0.5, "#ff9a2a", 30); this.burst(x, y, 0.5, "#ffe08a", 15); this.shake = 0.35;
    for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - x, e.y - y) < r) { this.damageEnemy(e, dmg, 6); const a = Math.atan2(e.y - y, e.x - x); this.launch(e, a, 6); e.vz = 4; if (e.dead) this.throwEnemy(e, x, y, r); }
    this.blastProps(x, y, r);
    if (!friendly || Math.hypot(this.px - x, this.py - y) < r * 0.6) if (Math.hypot(this.px - x, this.py - y) < r) { this.hurtPlayer(dmg * (friendly ? 0.3 : 1), "explosión"); this.burn = 3; }
  }

  burst(x: number, y: number, z: number, color: string, n: number) {
    for (let i = 0; i < n; i++) this.parts.push({ x, y, z, vx: rnd(-3, 3), vy: rnd(-3, 3), vz: rnd(1, 5), life: rnd(0.3, 0.9), color, size: rnd(0.04, 0.1) });
  }

  /** Reddish pixel impact shaped by the weapon: cuts streak sideways, smashes splash, thrusts jet forward. */
  meleeFx(x: number, y: number, z: number, style: MeleeStyle, ang: number, n = 14) {
    const reds = ["#ff2a3a", "#c4102a", "#ff5a4a", "#7a0614"], pick = () => reds[ri(0, reds.length - 1)];
    const px = -Math.sin(ang), py = Math.cos(ang), fx = Math.cos(ang), fy = Math.sin(ang);
    for (let i = 0; i < n; i++) {
      let vx: number, vy: number, vz: number;
      if (style === "cut") { const s = rnd(-1, 1); vx = px * s * 4 + fx * rnd(0, 1.5); vy = py * s * 4 + fy * rnd(0, 1.5); vz = rnd(0.5, 3); }
      else if (style === "pierce") { const sp = rnd(3, 6); vx = fx * sp + px * rnd(-.6, .6); vy = fy * sp + py * rnd(-.6, .6); vz = rnd(0, 1.5); }
      else if (style === "smash") { const a = rnd(0, Math.PI * 2), sp = rnd(2, 5); vx = Math.cos(a) * sp; vy = Math.sin(a) * sp; vz = rnd(2, 6); }
      else { const a = ang + rnd(-1.2, 1.2), sp = rnd(1.5, 3.5); vx = Math.cos(a) * sp; vy = Math.sin(a) * sp; vz = rnd(1, 3.5); }
      this.parts.push({ x: x + rnd(-.08, .08), y: y + rnd(-.08, .08), z: z + rnd(-.15, .25), vx, vy, vz, life: rnd(.35, .9), color: pick(), size: rnd(.025, .06) });
    }
    // a few slow drops that keep falling down the enemy sprite
    for (let i = 0; i < 5; i++) this.parts.push({ x: x + rnd(-.12, .12), y: y + rnd(-.12, .12), z: z + rnd(0, .4), vx: rnd(-.2, .2), vy: rnd(-.2, .2), vz: rnd(-.5, .3), life: rnd(.8, 1.5), color: "#a00a1e", size: rnd(.02, .035) });
  }

  /** Brillo breve en forma de arco que dibuja el área real que daña el golpe cuerpo a cuerpo. */
  meleeArcGlow(shape: string, range: number, cone: number, width: number, charged: boolean) {
    const col = charged ? ["#ffe9a8", "#ffd34a"] : ["#fff4d6", "#ffc98a"], z = this.pz + .5;
    if (shape === "thrust") { for (let i = 0; i < 12; i++) { const r = .35 + (range - .35) * i / 11; for (const s of [-1, 1]) { const ox = -Math.sin(this.ang) * width * s, oy = Math.cos(this.ang) * width * s; this.arcFx.push({ x: this.px + Math.cos(this.ang) * r + ox, y: this.py + Math.sin(this.ang) * r + oy, z, vx: 0, vy: 0, vz: 0, life: .16, color: col[i % 2]!, size: .03 }); } } return; }
    const half = shape === "circle" ? Math.PI : cone, n = shape === "circle" ? 32 : 18;
    for (let i = 0; i <= n; i++) { const a = this.ang - half + 2 * half * i / n; for (const rr of [range, range * .55]) this.arcFx.push({ x: this.px + Math.cos(a) * rr, y: this.py + Math.sin(a) * rr, z: z + (rr === range ? 0 : .05), vx: Math.cos(a) * .25, vy: Math.sin(a) * .25, vz: 0, life: .14 + (i / n) * .08, color: col[i % 2]!, size: rr === range ? .04 : .025 }); }
  }

  /** Small black bullet hole on a wall. */
  bulletMark(x: number, y: number, z: number) {
    this.marks.push({ x, y, z, t: BULLET_MARKS.seconds });
    this.wallChips(x, y, z, Math.atan2(this.py - y, this.px - x), 5);
    if (this.marks.length > BULLET_MARKS.max) this.marks.shift();
  }

  nearestFacing(range: number, cone = 0.6, aimed = false) {
    let best: Enemy | null = null, bd = 1e9;
    for (const e of this.enemies) {
      if (e.dead || e.grabbed) continue;
      const dx = e.x - this.px, dy = e.y - this.py, dist = Math.hypot(dx, dy);
      if (dist > range || (!aimed && Math.abs(e.z-this.pz) > (range>3?3:1.3))) continue;
      if (aimed && Math.abs(Math.atan2(e.z + .5 - (this.pz + .5), dist) - this.pitch) > Math.atan2(.6, dist) + .035) continue;
      let da = Math.atan2(dy, dx) - this.ang; da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) < cone && dist < bd && this.los(this.px, this.py, e.x, e.y,this.pz+.5,e.z+.5)) { bd = dist; best = e; }
    }
    return best;
  }
  los(x0: number, y0: number, x1: number, y1: number, z0 = .5, z1 = .5) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 4);
    for (let i = 1; i < n; i++) if (this.solid(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n,z0+(z1-z0)*i/n,.02)) return false;
    return true;
  }

  // ---------- elecciones ----------
  levelDamage() { return this.subclassFx().damage * levelBonus(this.level).damage * (1 + this.levelPerks.dmg * 0.08); }
  offerLevelPerk() {
    this.choice = { title: `NIVEL ${this.level} · ELIGE TU CRECIMIENTO`, options: [
      { name: "Carne endurecida", desc: "+6 PV máximos", apply: () => { this.levelPerks.hp += 6; this.recalc(); this.hp = this.hpMax; } },
      { name: "Filo hambriento", desc: "+8% de daño en todos tus ataques", apply: () => { this.levelPerks.dmg++; } },
      { name: "Aliento largo", desc: "+2 de aguante máximo", apply: () => { this.levelPerks.stam += 2; this.recalc(); } },
    ] };
    this.mode = "choice"; this.onUI();
  }
  offerPact() {
    const opts = [...PACTS].filter((p) => !this.hasP(p.id)).sort(() => Math.random() - 0.5).slice(0, 3);
    if (!opts.length) return;
    this.choice = { title: "UN PACTO SUSURRA", options: [...opts.map((p) => ({ name: p.name, desc: `${p.principle} Activador: ${p.trigger} Precio: ${p.price}. Beneficio: ${p.boon}. Condición: ${p.bane}. Ruptura: ${p.rupture}`, apply: () => { this.pacts.push(p); this.track("pacts", 1, `sellar ${p.name}`, {}, `pact-${p.id}`); this.score.gain("pact"); this.recalc(); } })), { name: "Rechazar", desc: "Seguir sin deudas", apply: () => {} }] };
    this.mode = "choice"; this.onUI();
  }
  offerEpiphany() {
    const opts = [...EPIPHANIES].filter((p) => !this.hasE(p.id) && this.cycles >= p.requiredCycles && (p.rank <= 2 || (p.rank === 3 && this.grado >= 6) || (p.rank === 4 && this.grado >= 9))).sort(() => Math.random() - 0.5).slice(0, 3);
    if (!opts.length) return;
    this.choice = { title: `EPIFANÍA · RANGO ${Math.min(...opts.map((p) => p.rank))}`, options: opts.map((p) => ({ name: p.name, desc: `Rango ${p.rank} · ${p.desc} Origen: ${p.source}. Activador: ${p.activation}. Precio: ${p.cost}. Límite: ${p.limit}`, apply: () => { this.epiph.push(p); } })) };
    this.mode = "choice"; this.onUI();
  }
  choose(i: number) { const c = this.choice; this.choice = null; this.mode = "play"; c?.options[i]?.apply(); this.onUI(); }
  vendorLines = [
    "«Bienvenido, viajero. La tinta cobra, yo solo cobro en fichas.»",
    "«He visto a muchos entrar con tu mirada. Pocos vuelven a comprar vendas.»",
    "«Los enemigos se avisan entre sí. Si hieres a uno, que no haya testigos.»",
    "«Cuando un monstruo falla el golpe, queda abierto. Ahí es donde se gana.»",
    "«Mata sin pausa y sentirás la sangre correr más rápido. Detente, y se enfría.»",
    "«¿Ves esa banca? Siéntate. La lumbre se recupera mejor en reposo.»",
    "«Come y bebe donde nadie te vea. Con la tripa vacía la vista se nubla.»",
    "«Los espejos velados prometen poder... pero te roban la luz.»",
    "«Babel no tiene salida, solo pisos más hondos. Y mejores clientes.»",
  ];
  vendorDialogue(greet = true) {
    const line = greet ? this.vendorLines[0] : pick(this.vendorLines.slice(1));
    const revelation = nextIdentityRevelation(this.level, this.legacy.identitySeen);
    if (revelation) { this.legacy.identitySeen.push(revelation.id); this.saveLegacy(); }
    const mq = this.merchantQuest; const qline = mq ? (mq.complete ? "«Lo has hecho. Ven, te pagaré.»" : `Encargo: ${mq.title} · ${mq.progress}/${mq.count}`) : undefined;
    this.choice = { title: `MERCADER DE BABEL — ${line}`, dialogue: [revelation?.text, qline].filter(Boolean).join("\n\n") || undefined, options: [
      { name: "Comerciar", desc: "Ver su mercancía.", apply: () => { this.makeShop(); this.menuTab = "tienda"; this.mode = "menu"; this.onUI(); } },
      { name: "Conversar junto a su farol", desc: this.vendorTalkCd > 0 ? `Charlar (su farol se recarga en ${Math.ceil(this.vendorTalkCd)}s).` : `Charlar · recupera ${LUMBRE_REGEN.talk} de lumbre.`, apply: () => { if (this.vendorTalkCd <= 0) { this.merchantTalks++; this.restoreLumbre(LUMBRE_REGEN.talk); this.vendorTalkCd = LUMBRE_REGEN.talkCooldown; this.float(`+${LUMBRE_REGEN.talk} LUMBRE`, "#ffcf7a"); } this.vendorDialogue(false); } },
      ...skillOptions(this.cls?.id ?? "").filter(sk => unlockOf(sk.id).kind === "merchant" && !this.skillRun.bought.includes(sk.id)).map(sk => ({ name: `Aprender ${sk.name}`, desc: `${sk.desc} · ${unlockOf(sk.id).n} fichas (tienes ${this.gold}).`, apply: () => { this.buySkill(sk.id); this.vendorDialogue(false); } })),
      { name: "Preguntar por la torre", desc: "Escuchar un consejo.", apply: () => { this.merchantTalks++; this.vendorDialogue(false); } },
      ...(this.merchantQuest?.complete ? [{ name: "Entregar encargo", desc: this.merchantQuest.rewardKind === "gold" ? `Cobrar ${this.merchantQuest.gold} fichas.` : "Recibir un arma acorde a tu nivel.", apply: () => { this.claimMerchantQuest(); this.vendorDialogue(false); } }]
        : this.merchantQuest ? [] : this.merchantTalks >= MERCHANT_TALKS ? [{ name: "«¿Tienes algún encargo?»", desc: "Ya confía en ti. Pídele trabajo.", apply: () => { this.merchantQuest = createMerchantQuest(this.rating, this.floor, this.region.name, this.enemies.filter(x => !x.dead).length, this.pickups.filter(x => x.kind === "chest" && !x.used).length, Math.random()); this.msg(`Encargo: ${this.merchantQuest.story}`); this.vendorDialogue(false); } }]
        : [{ name: "Charlar un rato más", desc: `Confianza ${this.merchantTalks}/${MERCHANT_TALKS}.`, apply: () => { this.merchantTalks++; this.vendorDialogue(false); } }]),
      { name: "Despedirse", desc: "«Que la tinta no te nombre.»", apply: () => {} },
    ] };
    this.mode = "choice"; this.onUI();
  }

  // ---------- acciones UI ----------
  learn(id: string) {
    const s = SKILLS.find((k) => k.id === id)!;
    if (this.has(id) || this.sp < s.cost || (s.req && !this.has(s.req))) return;
    this.sp -= s.cost; this.score.gain("skill"); this.skills.add(id); this.recalc();
  }
  canCraft(id: string) { const r = RECIPES.find(x => x.id === id); if (!r) return false; const n = this.cls.id === 'alquimista' ? 2 : 1; const added = (id === 'municion' ? .6 : SUPPLY_WEIGHT[id] ?? 1) * n - Object.values(r.needs).reduce((a, b) => a + b * .25, 0); return this.canCarry(added) && Object.entries(r.needs).every(([k, v]) => (this.mats[k] ?? 0) >= v); }
  craft(id: string) {
    if (!this.canCraft(id)) return; const r = RECIPES.find((x) => x.id === id); if (!r) return;
    Object.entries(r.needs).forEach(([k, v]) => (this.mats[k] -= v));
    const n = this.cls.id === "alquimista" ? 2 : 1;
    if (id === "bomba") this.bombs += n; else if (id === "municion") this.ammo += 12 * n; else if (id === "ganzua") this.keys += n;
    else this.cons[id] = (this.cons[id] ?? 0) + n;
    this.questEvent("craft"); this.onSound("craft");
    this.msg(`Fabricas: ${r.name}${n > 1 ? " x2" : ""}`);
  }
  use(id: string) {
    if ((this.cons[id] ?? 0) <= 0) return; this.cons[id]--; this.onSound(/agua|bebi|vino|tonic|elix|poci/.test(id)?"drink":/venda|band/.test(id)?"bandage":/espejo/.test(id)?"mirror":"eat"); this.track("used", 1, id); if (id === "racion") this.track("food", 1, "una ración"); if (id === "agua") this.track("drinks", 1, "agua"); if (["venda", "racion", "antidoto"].includes(id)) this.track("heals", 1, id); this.score.add("itemUse", -PENALTY.itemUse);
    const cm = isPariah(this.cls.id) ? PARIAH.consumable : 1; if (id === "racion") PX.noteUnlock(this, "food"); if (id === "agua" || id === "tonico") PX.noteUnlock(this, "drink");
    if (id === "venda") { this.wounds = {}; this.bleed = 0; this.heal(8 * cm); }
    if (id === "antidoto") this.poison = 0;
    if (id === "racion") { this.food = Math.min(100, this.food + 45 * cm); this.heal(10 * cm); }
    if (id === "agua") this.thirst = Math.min(100, this.thirst + 50 * cm);
    if (id === "tonico") this.lumbre = Math.min(this.lumbreMax, this.lumbre + 4 * cm);
    if ((id === "racion" || id === "agua") && !this.enemiesNear(10)) { this.restoreLumbre(LUMBRE_REGEN.eat); this.fatigue = Math.max(0, this.fatigue - 25); this.float(`COMIDA EN CALMA · +${LUMBRE_REGEN.eat} LUMBRE`, "#ffcf7a"); }
    if (id === "espejo") { const b = mirrorPick(Math.random()); this.mirrorBuff = { id: b, t: MIRROR.seconds }; this.onSound("pact"); this.float(`ESPEJO: ${MIRROR_BUFFS[b].name} · ${MIRROR_BUFFS[b].desc}`, "#c9e6ff"); this.msg(`El espejo te devuelve otro rostro: ${MIRROR_BUFFS[b].desc}. La vista se oscurece.`); }
  }
  equip(uid: number) {
    const it = this.bag.find((b) => b.uid === uid); if (!it) return;
    if (isPariah(this.cls.id) && (it.kind === "armor" || it.kind === "weapon")) { if (it.kind === "weapon" && it.base) PX.throwWeapon(this, it); else { this.msg("P.A.R.I.A.H no puede vestir armaduras: su cuerpo es su única defensa."); this.onUI(); } return; }
    if (!canUseWeapon(it, this.level)) { this.msg(`No puedes utilizar ${it.name}: requiere nivel ${weaponLevel(it)}.`); this.onUI(); return; }
    this.bag = this.bag.filter((b) => b.uid !== uid);
    if (it.kind === "armor") { if (this.armor) this.bag.push(this.armor); this.armor = it; }
    else if (it.base!.ranged) { this.bag.push(this.ranged); if (it.mag === undefined) { it.magMax = it.base!.magazine ?? 0; it.mag = it.magMax; } this.ranged = it; this.slot = 1; }
    else { this.bag.push(this.melee); this.melee = it; this.slot = 0; }
    this.recalc();
  }
  sell(uid: number) { const it = this.bag.find((b) => b.uid === uid); if (!it) return; this.gold += sellPrice(it); this.onSound("shopSell"); this.score.gain("sell", 1 + it.rarity); this.bag = this.bag.filter((b) => b.uid !== uid); }
  shopStock: { name: string; price: number; weight: number; buy: () => void }[] = [];
  makeShop() {
    const w = this.makeWeapon(); const a = this.makeArmor();
    this.shopStock = [
      { name: `${w.name} (${RARITY[w.rarity]})`, price: itemPrice(w), weight: itemWeight(w), buy: () => { this.bag.push(w); this.foundWeapon(w); } },
      { name: a.name, price: itemPrice(a), weight: itemWeight(a), buy: () => this.bag.push(a) },
      { name: "Munición x15", price: 15, weight: 0.75, buy: () => (this.ammo += 15) },
      { name: "Venda", price: 12, weight: 0.5, buy: () => this.cons.venda++ },
      { name: "Ración", price: 10, weight: 1, buy: () => this.cons.racion++ },
      { name: "Agua hervida", price: 8, weight: 1.5, buy: () => this.cons.agua++ },
      { name: "Bomba de tinta", price: 25, weight: 2, buy: () => this.bombs++ },
      { name: "Llave de hueso", price: 60, weight: 0.2, buy: () => this.keys++ },
      { name: "Espejo velado (buff aleatorio, oscurece la vista)", price: 70, weight: 2, buy: () => { this.cons.espejo = (this.cons.espejo ?? 0) + 1; } },
    ];
    for (let n = 0; n < 3; n++) this.shopStock.push(
      { name: 'Venda', price: 12, weight: .5, buy: () => this.cons.venda++ },
      { name: 'Ración', price: 10, weight: 1, buy: () => this.cons.racion++ },
      { name: 'Agua hervida', price: 8, weight: 1.5, buy: () => this.cons.agua++ });
    this.shopStock.push({ name: 'Espejo velado', price: 70, weight: 2, buy: () => this.cons.espejo = (this.cons.espejo ?? 0) + 1 });
  }
  buy(i: number) { const s = this.shopStock[i]; if (!s) return; if (this.gold < s.price) { this.onSound("shopDeny"); this.msg('Fichas insuficientes.'); return; } if (!this.canCarry(s.weight)) { this.onSound("shopDeny"); this.msg('Mochila llena: libera capacidad antes de comprar.'); return; } this.gold -= s.price; this.onSound("shopBuy"); this.score.spend(s.price); s.buy(); this.shopStock.splice(i, 1); }

  beginReload() {
    if (!canUseWeapon(this.ranged, this.level)) return;
    if(this.denial?.action === "reload") { this.float("RECARGA SELLADA", "#b58cff"); return; }
    if (this.slot !== 1 || !this.ranged.base?.ranged || !this.ranged.magMax || this.reloadT > 0) return;
    if (this.ranged.base.type === "RUINAS") { this.float("LOS ESCOMBROS SALEN DE LA RUPTURA (B)", "#d9b27a"); return; }
    if ((this.ranged.mag ?? 0) >= this.ranged.magMax) { this.float("CARGADOR COMPLETO", "#8ed8ad"); return; }
    if (this.ammo <= 0) { this.float("SIN RESERVA", "#ff7777"); return; }
    const speed = (this.cls.id === "tecnomante" ? .75 : this.cls.id === "ingeniero" ? .8 : 1) * (this.has("recarga") ? .8 : 1);
    this.reloadT = (this.ranged.base.reloadTime ?? 1.2) * speed; this.reloadProgress = this.reloadT;
    this.onSound("reload", this.ranged.base.type); this.float("RECARGANDO…", "#b8d2e8");
  }
  finishReload() {
    const w = this.ranged; if (!w.base?.magazine || !canUseWeapon(w, this.level)) return;
    const missing = Math.max(0, (w.magMax ?? w.base.magazine) - (w.mag ?? 0));
    const amount = Math.min(missing, this.ammo); w.mag = (w.mag ?? 0) + amount; this.ammo -= amount;
    this.float(`+${amount} · ${w.mag}/${w.magMax}`, "#a3e4c3"); this.onUI();
  }

  // ---------- update ----------
  lookPendingX = 0; lookPendingY = 0;
  prev: Partial<Input> = {};
  stepAcc = 0; prevSpeed = 0; wallFxT = 0;
  /** Máximo de partículas vivas (menor en móvil). */
  partCap = typeof navigator !== "undefined" && /Android|iPhone|iPad/i.test(navigator.userAgent) ? 220 : 400;
  update(dtRaw: number, inp: Input) {
    if (!Number.isFinite(this.px + this.py + this.pz + this.vx + this.vy + this.vz + this.ang) ) { this.sanitize(); }
    { const sp = Math.hypot(this.vx, this.vy), dtS = Math.min(dtRaw, .05); if (this.mode === "play" && sp > 1 && Math.abs(this.pz - this.floorHeight(this.px, this.py)) < .05 && this.slideT <= 0) { this.stepAcc += sp * dtS; if (this.stepAcc > 1.6) { this.stepAcc = 0; this.onSound("step"); } } }
    if (this.mode !== "play") { this.prev = { ...inp }; return; }
    let dt = Math.min(dtRaw, 0.05);
    this.updateRest();
    this.updateHorror(dt);
    this.updateCollapse(dt);
    if (this.gloom > 0) this.gloom = Math.max(0, this.gloom - dt * .045);
    this.portalMsgT = Math.max(0, this.portalMsgT - dt);
    this.ensurePortal();
    if (this.mode === "play") { const pt = this.pickups.find(k => k.kind === "portal" && !k.used && Math.hypot(k.x - this.px, k.y - this.py) < PORTAL.enterRadius && Math.abs(this.pz - this.floorHeight(k.x,k.y)) < PORTAL.height && this.los(this.px,this.py,k.x,k.y,this.pz+.5,this.floorHeight(k.x,k.y)+.5)); if (pt) this.usePortal(pt, true); }
    if (this.mode !== 'play') { this.prev = { ...inp }; return; }
    inp={...inp}; if(this.denial?.action === "dash")inp.dash=false; if(this.denial?.action === "magic") {inp.nova=false;inp.pact=false;if(this.slot===1 && this.ranged.base?.type==="FOCO")inp.attack=false;}
    if (this.slowmo > 0) { this.slowmo -= dt; }
    const edt = this.slowmo > 0 ? dt * 0.4 : dt; // enemigos ralentizados
    this.time += dt; if (Math.floor(this.time / 10) > Math.floor((this.time - dt) / 10)) this.chronicles.syncTime(this.time);
    if (this.mode === "play" && (this.perfT += dt) >= PERF.window) { const d = performanceDelta(this.perfDmg, this.hpMax, this.perfKills), before = this.adapt; this.adapt = clampAdapt(this.adapt + d); if (this.adapt > before + .01) this.float("EL RETO SE ENDURECE", "#ff5a2a"); else if (this.adapt < before - .01) this.float("EL RETO SE SUAVIZA", "#7affc1"); this.perfT = this.perfDmg = this.perfKills = 0; }
    const pressed = (k: keyof Input) => inp[k] && !this.prev[k];
    this.parryT = Math.max(0, this.parryT - dt); this.parryCd = Math.max(0, this.parryCd - dt);
    this.hitGrace=Math.max(0,this.hitGrace-dt);
    this.playerStagger = Math.max(0, this.playerStagger - dt); this.breakDelay = Math.max(0, this.breakDelay - dt);
    if (this.breakDelay <= 0 && this.breakValue > 0) this.breakValue = Math.max(0, this.breakValue - dt * 1.8);
    for (const id of Object.keys(this.pactCooldowns)) this.pactCooldowns[id] = Math.max(0, (this.pactCooldowns[id] ?? 0) - dt);
    if (this.activePact) { this.activePact.t -= dt; if (this.activePact.t <= 0) { const expired = isPariah(this.cls.id) ? "" : this.activePact.id; this.activePact = null; if (expired === "sangre") { this.bleed = Math.max(this.bleed, 5); this.float("DEUDA DE SANGRE", "#ff5269"); } if (expired === "ceniza") { this.thirst = Math.max(0, this.thirst - 12); this.float("DEUDA DE CENIZA", "#ff9955"); } if (expired === "vacio") { this.darkness = Math.max(this.darkness, .18); this.pactBaneT = 5; } if (expired === "hambre") this.food = Math.max(0, this.food - 10); } }
    if (this.pactBaneT > 0) { this.pactBaneT = Math.max(0, this.pactBaneT - dt); if (this.pactBaneT === 0 && this.eventName !== "GRITO EN LA OSCURIDAD") this.darkness = 0; }
    if (pressed("pact")) this.activatePact();
    if (pressed("skill")) { if (isPariah(this.cls.id)) PX.startRupture(this); else this.useClassSkill(); }
    if (this.skillBuffT > 0) this.skillBuffT -= dt; this.skillEvent("time", dt);
    { const was = this.blocking; this.blocking = !!inp.block && this.stam > 0 && this.playerStagger <= 0; if (this.blocking && !was) this.perfectBlockT = PERFECT_BLOCK.window; this.perfectBlockT = Math.max(0, this.perfectBlockT - dt); if (!this.blocking) this.perfectBlockT = 0; }
    if (pressed("parry") && this.parryCd <= 0 && this.playerStagger <= 0 && this.stam >= 2) { this.stam -= 2; this.parryT = .24 * (isPariah(this.cls.id) ? PARIAH.parry.window : 1); this.parryCd = .58; }
    if (pressed("reload")) this.beginReload();
    if (this.reloadT > 0) { this.reloadT = Math.max(0, this.reloadT - dt); if (this.reloadT <= 0) this.finishReload(); }
    // mirar
    this.lookPendingX += inp.lookX; this.lookPendingY += inp.lookY;
    const lookEase = smoothFactor(40, dt), lx = this.lookPendingX * lookEase, ly = this.lookPendingY * lookEase;
    this.ang = Math.atan2(Math.sin(this.ang + lx), Math.cos(this.ang + lx)); this.pitch = clampPitch(this.pitch + ly);
    this.lookPendingX -= lx; this.lookPendingY -= ly;
    const cos = Math.cos(this.ang), sin = Math.sin(this.ang);
    const grounded = this.pz <= this.floorHeight() + 0.001;
    // movimiento
    this.sneaking = inp.sneak; this.lastDashT += dt;
    { const was = this.aiming; this.aiming = this.slot === 1 && inp.alternate && this.reloadT <= 0 && this.playerStagger <= 0; if (this.aiming && !was) this.onSound("aim", this.ranged?.base?.type); }
    this.aimBlend += ((this.aiming?1:0)-this.aimBlend)*smoothFactor(16,dt);
    { const prevAim = this.aimT, moving = Math.abs(inp.mx) > .35 || Math.abs(inp.my) > .35, still = !moving && Math.hypot(this.vx,this.vy) < .6 && Math.abs(lx)+Math.abs(ly) < .05;
      // Carga del disparo: tolera pequeños ajustes de mira y caminar lento; solo se pierde al saltar/dash o al girar bruscamente.
      this.aimT = this.aiming && grounded && !inp.jump && !inp.dash && this.dashT<=0 && this.slot===1 ? (moving ? 0 : still ? Math.min(1,this.aimT+dt*this.frenzyFx().charge) : Math.max(0, this.aimT - dt * .6)) : 0;
      const rt = this.ranged?.base?.type ?? "";
      if (this.aimT > prevAim && Math.floor(this.aimT * 5) > Math.floor(prevAim * 5) && this.aimT < 1) this.onSound("chargeTick", `${rt}|${this.aimT.toFixed(2)}`);
      if (this.aimT >= 1 && prevAim < 1) { this.onSound("chargeReady", rt); this.float("DISPARO CARGADO", "#ffd34a"); } }
    this.stillT = grounded && !inp.mx && !inp.my && Math.hypot(this.vx, this.vy) < 0.4 ? this.stillT + dt : 0;
    this.detectionRadius = (inp.sneak || this.crouching) && this.has("paso_silente") ? 4.5 : this.crouching ? 5 : inp.sneak ? 6 : inp.sprint ? 12 : 9;
    let speed = this.moveSpeed(inp);
    this.unstickPlayer(dt, !!(inp.mx || inp.my));
    if (this.sitting) { if (inp.mx || inp.my || inp.jump || inp.attack || inp.dash) { this.sitting = false; this.float("TE LEVANTAS", "#c9c3d6"); } else speed = 0; }
    if (inp.sprint && (inp.mx || inp.my)) this.stam = Math.max(0, this.stam - dt * STAMINA.sprintPerSec);
    else if (!this.blocking) this.stam = Math.min(this.stamMax, this.stam + dt * 2.2 * classMods(this.cls.id, this.level).stamRegen * (this.temp < 30 ? 0.6 : 1)*(this.alterationAt()?.regen??1));
    const wx = cos * inp.my - sin * inp.mx * -1, wy = sin * inp.my + cos * inp.mx;
    // Vistas externas: el stick/teclas se mueven según la pantalla (cámara), no según la mira.
    const vb = this.camera.mode !== "fp" ? this.viewBasis : null;
    const fx = vb ? vb.fx * inp.my + vb.rx * inp.mx : cos * inp.my + -sin * inp.mx, fy = vb ? vb.fy * inp.my + vb.ry * inp.mx : sin * inp.my + cos * inp.mx;
    void wx; void wy;
    const accel = grounded ? (isPariah(this.cls.id) ? 5 : 12) : 5;
    const moveEase = smoothFactor(accel, dt), moveLength = Math.max(1, Math.hypot(inp.mx, inp.my));
    if (!(this.pariah.impulseT > 0)) { this.vx += (fx / moveLength * speed - this.vx) * moveEase;
    this.vy += (fy / moveLength * speed - this.vy) * moveEase; }
    if (isPariah(this.cls.id)) PX.updateImpulse(this, dt, inp, pressed as (k: string) => boolean, grounded, (inp.mx || inp.my) ? fx : 0, (inp.mx || inp.my) ? fy : 0);
    // dash
    this.dashCd -= dt;
    if (!isPariah(this.cls.id) && pressed("dash") && this.dashCd <= 0 && (this.stam >= STAMINA.dash || this.hasP("vacio") || this.activePact?.id === "vacio" || this.cls.id === "acrobata")) { this.lastDashT = 0; this.score.mech("dash", this.time);
      const dx = (inp.mx || inp.my) ? fx : cos, dy = (inp.mx || inp.my) ? fy : sin, l = Math.hypot(dx, dy) || 1;
      this.onSound("dash"); this.motionFx("dash", 6); const dashB = this.onRhythm("IMPULSO") ? RHYTHM.dash : 1; this.vx = dx / l * DASH.speed * dashB; this.vy = dy / l * DASH.speed * dashB; this.dashT = this.activePact?.id === "vacio" ? .28 : DASH.time; this.dashCd = 0.35;
      if (!(this.hasP("vacio") || this.activePact?.id === "vacio" || this.cls.id === "acrobata")) this.stam -= STAMINA.dash;
      if (this.has("tiempo")) this.slowmo = 0.8;
      if (inp.sprint && this.has("estampida") || (inp.sprint && this.chargeT > 0.3)) this.stampede = 0.5;
    }
    if (this.dashT > 0) this.dashT -= dt;
    // estampida: embestida que derriba
    if (this.stampede > 0) {
      this.stampede -= dt; this.vx = cos * 13; this.vy = sin * 13;
      for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - this.px, e.y - this.py) < 1.1) { this.damageEnemy(e, 10 + this.mod("FUE") * 3, 8); e.kx = cos * 10; e.ky = sin * 10; e.vz = 5; this.shake = 0.3; this.float("¡EMBESTIDA!", "#ffb14a"); this.stampede = 0; }
    }
    // slide (suelo) / ground pound (aire)
    if (pressed("slide")) {
      if (grounded && Math.hypot(this.vx, this.vy) > 2.5) { this.slideT = 0.6; this.motionFx('slide'); this.slideHits.clear(); const l = Math.hypot(this.vx, this.vy); this.vx = this.vx / l * 11; this.vy = this.vy / l * 11; if (this.burn > 0) { this.burn = 0; this.float("FUEGO APAGADO", "#9cf"); } }
      else if (grounded) { this.crouching = !this.crouching; this.float(this.crouching ? "AGACHADO" : "DE PIE", "#c9c3d6"); }
      else this.startPound();
    }
    if (pressed("pound") && !grounded) this.startPound();
    if (this.crouching && (pressed("jump") || pressed("dash") || (inp.sprint && (inp.mx || inp.my)))) this.crouching = false;
    // Never stand up (or end a slide) inside a crawl duct: stay low and tell the player why.
    if (!this.crouching && (this.slideT <= 0 || this.slideT - dt <= 0) && !this.canOccupy(this.px, this.py, this.pz, BODY_RADIUS, BODY_HEIGHT) && this.canOccupy(this.px, this.py, this.pz, BODY_RADIUS, LOW_PROFILE.height)) { this.crouching = true; if (this.time - this.ductMsgT > 3) { this.ductMsgT = this.time; this.float("CONDUCTO · sigue agachado para pasar", "#c9c3d6"); } }
    if (!this.lowProfile && grounded && this.time - this.ductMsgT > 4) { const fx = Math.floor(this.px + Math.cos(this.ang) * 1.2), fy = Math.floor(this.py + Math.sin(this.ang) * 1.2); if (this.cell(fx + .5, fy + .5) === 11) { this.ductMsgT = this.time; this.float("▼ CONDUCTO BAJO · agáchate (C) o barre para pasar", "#ff9a3a"); } }
    if (this.slideT > 0) { this.slideT -= dt; this.vx *= 0.985; this.vy *= 0.985; const sl = Math.hypot(this.vx, this.vy) || 1; for (const e of this.enemies) if (!e.dead && !e.grabbed && !this.slideHits.has(e.id) && Math.hypot(e.x - this.px, e.y - this.py) < this.actorRadius(e) + BODY_RADIUS + .35 && Math.abs(e.z - this.pz) < .5) { this.slideHits.add(e.id); e.kx += this.vx / sl * 6; e.ky += this.vy / sl * 6; this.knockDown(e, "BARRIDA"); this.damageEnemy(e, 4, 3); } }
    // viento
    {const sp=Math.hypot(this.vx,this.vy);if(grounded&&this.dustT>1.8&&sp<1)this.stopFx();this.dustT=grounded?sp:0;}
    this.stepFxT-=dt;if(this.stepFxT<=0&&grounded&&Math.hypot(this.vx,this.vy)>1.5){this.stepFxT=this.slideT>0?.07:inp.sprint?STEP_INTERVAL*.8:STEP_INTERVAL*1.4;this.motionFx(this.slideT>0?'slide':'step');}
    const wIn = Math.min(1, Math.hypot(inp.mx || 0, inp.my || 0)); const wK = grounded ? (wIn > 0.15 || this.sitting ? 0 : 0.05) : 0.1; const wvx = this.wind.x * wK, wvy = this.wind.y * wK;
    // colisión y detección de pared
    const r = BODY_RADIUS; const moved=this.sweepActor(this.px,this.py,this.pz,(this.vx+wvx)*dt,(this.vy+wvy)*dt); this.px=moved.x;this.py=moved.y;if(moved.z>this.pz&&this.vz<=0){this.pz=moved.z;this.vz=0;}
    // contacto con pared
    this.onWall = false;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.solid(this.px + ox * (r + 0.08), this.py + oy * (r + 0.08), this.pz)) { this.onWall = true; this.wallNx = -ox; this.wallNy = -oy; }

    { const sp = Math.hypot(this.vx, this.vy), airborne = this.pz > this.floorHeight(this.px, this.py) + .05;
      if (this.onWall && this.prevSpeed > 5 && sp < this.prevSpeed * .5) { this.wallChips(this.px - this.wallNx * .3, this.py - this.wallNy * .3, this.pz + .5, Math.atan2(this.wallNy, this.wallNx), 14, true); this.onSound("rubble"); }
      this.wallFxT -= dt; if (this.onWall && airborne && this.wallFxT <= 0 && (sp > .5 || Math.abs(this.vz) > .5)) { this.wallFxT = .09; this.wallChips(this.px - this.wallNx * .3, this.py - this.wallNy * .3, this.pz + .3, Math.atan2(this.wallNy, this.wallNx), 3, true); }
      this.prevSpeed = sp; }
    // salto, doble salto, salto en pared, escalada
    const maxAir = 1 + (this.has("salto") ? 1 : 0) + (this.cls.id === "acrobata" ? 1 : 0);
    if (grounded) { this.jumps = 0; }
    if (pressed("jump")) { this.score.mech("salto", this.time); }
    if (pressed("jump")) {
      if (grounded || this.slideT > 0) { this.motionFx('jump'); this.onSound("jump"); this.questEvent("jump"); const tired = this.stam < STAMINA.jump; this.vz = (tired ? 4.6 : JUMP.ground) * (isPariah(this.cls.id) ? PX.jumpFactor(this) : 1); this.stam = Math.max(0, this.stam - STAMINA.jump); if (tired) this.float("SIN AGUANTE", "#9cf"); this.slideT = 0; }
      else if (this.onWall && this.stam >= STAMINA.wallJump) { this.stam -= STAMINA.wallJump; this.onSound("jump"); this.wallChips(this.px - this.wallNx * .3, this.py - this.wallNy * .3, this.pz + .4, Math.atan2(this.wallNy, this.wallNx), 12, true); this.questEvent("jump"); this.vz = 6.8; this.vx = this.wallNx * 7 + cos * 3; this.vy = this.wallNy * 7 + sin * 3; this.float("SALTO EN PARED", "#7ad8ff"); if (this.hasE("rebote")) this.dashCd = 0; this.jumps = Math.max(0, this.jumps - 1); }
      else if (this.jumps < maxAir && this.stam >= STAMINA.airJump) { this.stam -= STAMINA.airJump; this.onSound("jump"); this.motionFx("airjump", 5); this.questEvent("jump"); this.vz = JUMP.air * (isPariah(this.cls.id) ? PX.jumpFactor(this) : 1); this.jumps++; this.burst(this.px + cos * 0.3, this.py + sin * 0.3, this.pz, "#ff7ad9", 6); }
    }
    // gravedad, deslizamiento en pared, wall-run y escalada
    let g = JUMP.gravity*(this.alterationAt()?.gravity??1);
    this.wallT = 0;
    if (!grounded && this.onWall) {
      if (inp.my > 0.3 && inp.sprint && this.stam > 0) { this.vz = Math.max(this.vz, this.has("paredes") ? 3.1 : 2.4); this.stam -= dt * (this.has("paredes") ? 1.7 : 2.5); this.wallT = 2; } // escalar
      else if (Math.hypot(this.vx, this.vy) > 3) { g = this.has("paredes") ? 4 : 6; this.wallT = 1; } // carrera en pared
      else if (this.vz < 0) { this.vz = Math.max(this.vz, -1.5); this.wallT = 1; } // deslizar en pared
    }
    this.vz -= g * dt; const nextZ=this.pz+this.vz*dt; if(this.vz>0 && ((this.cell(this.px,this.py)===9 && nextZ+this.bodyH()>=.9)||(this.cell(this.px,this.py)===11 && nextZ+this.bodyH()>=.42))) {this.vz=0;} else this.pz=nextZ;
    { const c = clampCeiling(this.pz, this.bodyH()); if (c.hit) { this.pz = c.z; if (this.vz > 0) { const hard = this.vz; this.vz = 0; if (hard > 1.5 && this.time - (this.ceilFxT ?? -9) > .35) { this.ceilFxT = this.time; const top = this.pz + this.bodyH() + .05; const fr = () => (this.fxSeed = (this.fxSeed * 16807) % 2147483647) / 2147483647; for (let k = 0; k < 22; k++) { const a = fr() * Math.PI * 2, sp = .4 + fr() * 1.6, dust = k % 3 === 0; this.parts.push({ x: this.px + Math.cos(a) * .15, y: this.py + Math.sin(a) * .15, z: top, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: dust ? .2 : -fr() * 1.5, life: dust ? 1 + fr() * .6 : .5 + fr() * .5, color: dust ? "#8f877c" : k % 2 ? "#6e6458" : "#4f463d", size: dust ? .07 + fr() * .05 : .025 + fr() * .025 }); } this.onSound("bonk"); this.shake = Math.max(this.shake, .12); } if (this.time - this.ceilMsgT > 2) { this.ceilMsgT = this.time; this.float("¡TECHO!", "#c9c3d6"); } } } }
    // Safety net: never end up inside a wall or outside the map; return to the last safe spot.
    if (this.px < 1 || this.py < 1 || this.px >= MAP - 1 || this.py >= MAP - 1 || this.cell(this.px, this.py) === 1 || this.cell(this.px, this.py) === 4 || !this.canOccupy(this.px, this.py, this.pz, BODY_RADIUS * .6, LOW_PROFILE.height)) {
      this.px = this.safeX; this.py = this.safeY; this.pz = Math.max(this.pz, this.floorHeight()); this.vx = this.vy = 0; if (this.time - this.ceilMsgT > 2) { this.ceilMsgT = this.time; this.float("POSICIÓN CORREGIDA", "#c9c3d6"); }
    } else if (this.canOccupy(this.px, this.py, this.pz, BODY_RADIUS, this.bodyH())) { this.safeX = this.px; this.safeY = this.py; }
    this.playerUnstick(dt, inp.mx, inp.my);
    const floorZ = this.floorHeight();
    if (this.pz <= floorZ) {
      if (this.vz < -3) this.motionFx('land', -this.vz);
      if (this.vz < -9) this.landImpact(-this.vz);
      this.pz = floorZ; this.vz = 0; this.pounding = false;
    }
    // pisar enemigos al caer
    if (this.vz < -3) for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - this.px, e.y - this.py) < 0.7 && this.pz < 1.2 && this.pz > 0.3) { this.damageEnemy(e, 8, 6); e.stagger = Math.max(e.stagger, 1); this.vz = 7; this.jumps = 0; this.float("¡PISADO!", "#ffd34a"); this.landImpact(10); }
    // ataques
    this.attackCd -= dt; this.swingT = Math.max(0, this.swingT - dt);
    this.sinceHit += dt; if (this.swapT > 0) { this.swapT -= dt; if (this.swapT <= 0) this.swapStacks = 0; }
    if (pressed("swap")) { this.slot = 1 - this.slot; this.onSwap(); }
    const w = this.slot === 0 ? this.melee : this.ranged;
    const usable = canUseWeapon(w, this.level);
    if (!usable) { this.chargeT = 0; this.aimT = 0; if (pressed("attack") || pressed("alternate")) this.msg(`Arma sellada: requiere nivel ${weaponLevel(w)}.`); }
    const rateMult = (isPariah(this.cls.id) ? 1 / (1 + Math.min(PARIAH.tempCap, PX.parox(this).atk + PX.euph(this).atk)) : 1) * (this.hasE("frenesi") ? 1 - Math.min(0.5, Math.floor(this.combo / 10) * 0.2) : 1) * this.frenzyFx().rate * this.buff().rate;
    if (pressed("swap")) { this.chargeT=0; this.aimT=0; }
    if (usable && !w.base.ranged) {
      const mode=meleeMode(w.base,true);
      if (inp.alternate && this.attackCd<=0 && this.playerStagger<=0) { if (this.stam >= STAMINA.charged) this.chargeT=Math.min(mode.charge,this.chargeT+dt*this.frenzyFx().charge); else if (pressed("alternate")) this.float("SIN AGUANTE PARA CARGAR","#9cf"); }
      if (!inp.alternate && this.prev.alternate || pressed("attack")) {
        const alternate=!inp.alternate && this.prev.alternate && this.chargeT>=mode.charge-.001;
        if (this.attackCd<=0 && this.playerStagger<=0) {
          const m=meleeMode(w.base,alternate);
          if(alternate)this.stam=Math.max(0,this.stam-STAMINA.charged);
          this.onSound(alternate ? "charged" : "swing", w.base.type); this.score.mech(alternate ? "cargar" : "golpe", this.time); this.attackAlternate=alternate; const beatMul=this.onRhythm("MINI CRÍTICO")?RHYTHM.meleeCrit:1;
          const mst=meleeStyle(w.base.type);
          let cs:ComboStep|null=null,fin=false;
          if(!alternate){const step=nextComboStep(mst,this.meleeStep,this.time-this.meleeLast);this.meleeStep=step;this.meleeLast=this.time;cs=comboStep(mst,step);fin=isFinisher(mst,step);}
          else this.meleeStep=0;
          const chainSpeed=cs?comboSwingMult(this.meleeStep,fin):1;
          this.attackCd=m.cooldown*rateMult*chainSpeed; this.swingMax=Math.min(.65,m.cooldown*chainSpeed); this.swingT=this.swingMax;
          const slipped=this.useWeapon(w,alternate?WEAR.chargedUse:WEAR.meleeUse);
          if(cs&&!slipped){this.vx+=cos*cs.lunge;this.vy+=sin*cs.lunge;}
          const targets=slipped?[]:this.enemies.filter(e=>!e.dead&&!e.grabbed&&Math.abs(e.z-this.pz)<1.3&&meleeContains(w.base,alternate,e.x-this.px,e.y-this.py,this.ang)&&this.los(this.px,this.py,e.x,e.y,this.pz+.5,e.z+.5)).sort((a,b)=>Math.hypot(a.x-this.px,a.y-this.py)-Math.hypot(b.x-this.px,b.y-this.py));
          this.weaponNoise(w);
          {const st=meleeStyle(w.base.type);for(let i=0;i<8;i++){const t=st==="pierce"?0:(i/7-.5)*1.4*(this.attackAlternate?-1:1),r=st==="pierce"?.5+i*.12:m.range*.6;const aa=this.ang+t;this.parts.push({x:this.px+Math.cos(aa)*r,y:this.py+Math.sin(aa)*r,z:this.pz+.55+(st==="smash"?.3-i*.06:0),vx:Math.cos(aa)*.6,vy:Math.sin(aa)*.6,vz:rnd(-.6,.4),life:.18+i*.025,color:i%2?"#ff3a4a":"#b8102a",size:.035});}}
          this.meleeArcGlow(m.shape, m.range, m.cone, m.width, alternate);
          if(!targets.length){if(this.combo>=5)this.score.add("comboBreak",-PENALTY.comboBreak);this.combo=0;this.environmentImpact(this.px+cos*m.range,this.py+sin*m.range,this.pz+.5,alternate);this.meleeWallFx(cos,sin,m.range);const dr=this.doorAhead(m.range);if(dr)this.breachDoor(dr.x,dr.y);}
          const fx=CHAINS[mst].finisher;
          let hitList=targets.slice(0,m.targets+(fin?(fx==="sweep"?3:fx==="slam"?4:fx==="thrust"?2:0):0));
          if(fin&&fx==="slam"&&!slipped){const cx=this.px+cos*m.range*.8,cy=this.py+sin*m.range*.8;for(const o of this.enemies)if(!o.dead&&!o.grabbed&&!hitList.includes(o)&&Math.hypot(o.x-cx,o.y-cy)<1.8&&Math.abs(o.z-this.pz)<1.3)hitList.push(o);}
          let connected = false;
          for(const e of hitList) if(this.attackEnemy(e,w,beatMul*m.damage*(cs?cs.dmg:1)*(alternate&&this.has("carga")?1.5:1),{brkBonus:alternate?5:(cs?.brk??0)})) {
            connected = true;
            const a=Math.atan2(e.y-this.py,e.x-this.px);
            if(cs&&!fin){ // golpe de cadena: sujeta/arrastra al enemigo delante del jugador
              const hx=this.px+cos*HOLD_DIST,hy=this.py+sin*HOLD_DIST,dx=hx-e.x,dy=hy-e.y,dl=Math.hypot(dx,dy)||1,sp=Math.min(-cs.push*1.6,dl*7);
              e.kx=dx/dl*sp;e.ky=dy/dl*sp;if(cs.lift>0)e.vz=Math.max(e.vz,cs.lift);
              this.meleeFx(e.x,e.y,e.z+.6,mst,a,12+this.meleeStep*3);
            } else if(cs&&fin){ // remate: empuje según el arma
              const pa=fx==="sweep"?a+(this.meleeStep%2?.6:-.6):fx==="thrust"?this.ang:a;
              this.launch(e,pa,cs.push);e.vz=Math.max(e.vz,cs.lift);
              if(fx==="slam"||fx==="uppercut")this.knockDown(e,cs.label);
              this.meleeFx(e.x,e.y,e.z+.6,mst,pa,30);
            } else {this.launch(e,a,alternate?7:2.5);this.meleeFx(e.x,e.y,e.z+.6,mst,a,24);}
          }
          if(cs && connected && this.meleeStep > 1 && this.meleeHitStep === this.meleeStep - 1) recordStat(this.runId, "combo");
          this.meleeHitStep = cs && connected ? this.meleeStep : 0;
          if(cs&&!fin&&hitList.length&&this.meleeStep>1)this.float(`${cs.label} ×${this.meleeStep}`,"#ffd27a");
          if(fin){this.shake=Math.max(this.shake,fx==="slam"?.35:.25);this.slowmo=Math.max(this.slowmo,.12);this.float(`¡${CHAINS[mst].finisherLabel}!`,"#ff7ad9");this.attackCd+=.12;}
          if(alternate){this.shake=.2;this.float("ATAQUE CARGADO","#ff7ad9");}
        }
        this.chargeT=0;
      }
    } else if (usable && inp.attack && this.attackCd<=0 && this.reloadT<=0 && this.playerStagger<=0) {
      if(w.base.ammo && (w.mag??0)<=0) {if(pressed("attack"))this.float(w.base.type === "RUINAS" ? "SIN ESCOMBROS · usa RUPTURA (B)" : "CARGADOR VACÍO · RECARGAR","#f88");}
      else if(w.base.type==="FOCO" && this.lumbre<1){if(pressed("attack"))this.float("SIN LUMBRE","#b5f");}
      else {
        const precision=aimedReady(this.aiming,this.aimT), mult=(precision?1.2:1)*(this.onRhythm("MINI CRÍTICO")?RHYTHM.shotCrit:1);
        this.track("shots", 1, w.name); this.onSound(precision ? "shotCharged" : "shot", w.base.type);this.score.mech("disparo", this.time);this.attackCd=w.base.rate*rateMult*(precision?1.3:1);this.swingMax=.12;this.swingT=.12;this.shake=Math.max(this.shake,.06);
        if(w.base.ammo)w.mag=Math.max(0,(w.mag??0)-1);else this.lumbre-=.5;
        this.weaponNoise(w);const dr=this.doorAhead(Math.min(8,w.base.range));if(dr)this.breachDoor(dr.x,dr.y);
        const prof=rangedProfile(w.base.type,w.base.pellets??1);
        this.attackCd*=prof.cooldownMult;
        if(!this.useWeapon(w,WEAR.shotUse)){
        { const pb = this.projs.length; this.fireVolley(w,prof,mult,precision); if (w.base.type === "RUINAS") PX.decorateRubble(this, pb); }
        if(prof.burst>1)this.burstQueue={w,prof,mult,precision,left:prof.burst-1,t:prof.burstGap};}
        this.muzzle=.06;
        this.aimT=0;
      }
    }
    // nova
    if (pressed("nova") && this.has("nova") && this.lumbre >= 3) { this.lumbre -= 3; this.explode(this.px, this.py, 3.2, 22 + this.mod("INT") * 4, true); this.burst(this.px, this.py, 0.5, "#b45bff", 40); }
    if (pressed("bomb") && this.bombs > 0) { this.bombs--; this.projs.push({ x: this.px, y: this.py, z: 0.7 + this.pz, dx: cos * 9, dy: sin * 9, life: 0.9, dmg: 30, friendly: true, color: "#ffb14a", bomb: true }); }
    // interacciones con enemigos tambaleantes: remate / escudo / patada
    const stag = this.enemies.find((e) => !e.dead && !e.grabbed && e !== this.shieldEnemy && e.stagger > 0 && Math.hypot(e.x - this.px, e.y - this.py) < 2.2);
    if (pressed("finisher") && stag) this.gloryKill(stag);
    if (pressed("grab") && stag && !this.shieldEnemy && stag.kind !== "librero") { this.shieldEnemy = stag; stag.grabbed = true; this.shieldT = this.hasE("escudo") ? 8 : 4; this.float("¡ESCUDO HUMANO!", "#ff9"); }
    else if (pressed("grab") && this.shieldEnemy) this.throwShield();
    if (pressed("kick")) {
      const dr = this.doorAhead(1.6); if (dr) this.breachDoor(dr.x, dr.y);
      const ex = this.exposedNear();
      const e = ex ? null : this.nearestFacing(1.8, 0.9);
      if (ex) this.execute(ex, "kick");
      const e2 = e ?? (ex ? null : this.nearestFacing(2.1, 1.0));
      if (e2) { const kb = this.onRhythm("PATADA") , a = this.ang, push = (e2.stagger > 0 ? KICK.pushStaggered : KICK.push) * (kb ? RHYTHM.kickPush : 1); this.damageEnemy(e2, Math.round(kickDamage(this.mod("FUE")) * (kb ? RHYTHM.kickDmg : 1)), KICK.brk, { melee: true, style: "punch" }); this.launch(e2, a, push); e2.vz = 3; this.knockDown(e2, "PATADA"); this.meleeFx(e2.x, e2.y, e2.z + .35, "punch", a, 12); this.shake = Math.max(this.shake, .15); this.onSound("swing"); }
      else if (!ex && !dr) this.onSound("swing");
    }
    if (this.shieldEnemy && (this.shieldEnemy.dead || this.shieldEnemy.hp <= 0 || !this.enemies.includes(this.shieldEnemy))) { const e = this.shieldEnemy; this.shieldEnemy = null; this.shieldT = 0; e.grabbed = false; if (!e.dead && this.enemies.includes(e)) this.killEnemy(e); }
    for (const e of this.enemies) if (e.grabbed && e !== this.shieldEnemy) e.grabbed = false;
    if (this.shieldEnemy) { this.shieldT -= dt; const e = this.shieldEnemy; e.x = this.px + cos * 0.8; e.y = this.py + sin * 0.8; e.z = this.pz; if (this.shieldT <= 0) { e.grabbed = false; this.shieldEnemy = null; this.float("EL ESCUDO CAE", "#ff9"); this.killEnemy(e); } }
    // interactuar
    if (pressed("interact")) {
      // E sobre un enemigo aturdido (sin objeto delante): escudo humano.
      if (stag && !this.shieldEnemy && stag.kind !== "librero" && !this.focusPickup()) { this.shieldEnemy = stag; stag.grabbed = true; this.shieldT = this.hasE("escudo") ? 8 : 4; this.float("¡ESCUDO HUMANO!", "#ff9"); }
      else this.interact();
    }
    this.guideTick(dt);
    // combo decay
    this.comboT -= dt; if (this.comboT <= 0) { if (this.combo >= 5) this.score.add("comboBreak", -PENALTY.comboBreak); this.combo = 0; }
    if (this.streakT > 0) { this.streakT -= dt; if (this.streakT <= 0) { if (this.killStreak >= 3) this.score.add("comboBreak", -PENALTY.comboBreak); this.killStreak = 0; } }
    if(this.burstQueue && !canUseWeapon(this.burstQueue.w, this.level)) this.burstQueue = null;
    if(this.burstQueue){const b=this.burstQueue;b.t-=dt;if(b.t<=0){const ok=!b.w.base?.ammo||(b.w.mag??0)>0;if(ok&&this.reloadT<=0){if(b.w.base?.ammo)b.w.mag=Math.max(0,(b.w.mag??0)-1);this.onSound("shot");this.fireVolley(b.w,b.prof,b.mult,b.precision);this.muzzle=.05;this.shake=Math.max(this.shake,.05);}b.left--;b.t=b.prof.burstGap;if(b.left<=0||!ok)this.burstQueue=null;}}
    this.updateSanity(dt); this.updateThreat(); this.evoPulse = Math.max(0, this.evoPulse - dt);
    this.updateEnemies(edt);
    this.updateProjs(dt);
    this.updateWorld(dt);
    this.updateSurvival(dt);
    this.pickupAnimation.t = Math.max(0, this.pickupAnimation.t - dt);
    if (isPariah(this.cls.id)) PX.update(this, dt, inp, grounded);
    // partículas
    for (const h of this.hitDirs) h.t -= dt; this.hitDirs = this.hitDirs.filter(h => h.t > 0);
    for (const b of this.barks) b.t -= dt; this.barks = this.barks.filter(b => b.t > 0);
    this.dmgNums = stepDmgNums(this.dmgNums, dt);
    const landed: Particle[] = [];
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= (p.soft ? 1.5 : 9) * dt; if (p.soft) { p.vx *= Math.exp(-3 * dt); p.vy *= Math.exp(-3 * dt); p.size += dt * .05; } p.life -= dt; const fl = (p.water || p.drop) ? this.floorHeight(p.x, p.y) : 0; if (p.z < fl) { if (p.water || p.drop) { p.life = 0; landed.push(p); continue; } p.z = 0; p.vz *= -0.3; p.vx *= 0.6; p.vy *= 0.6; } }
    for (const p of landed) { if (p.water) addPuddle(this.puddles, p.x, p.y); if (Math.random() < .5 || p.drop) this.parts.push(...splash(p.x, p.y, this.floorHeight(p.x, p.y), p.color)); }
    this.updateWorldFx(dt);
    this.parts = this.parts.filter((p) => p.life > 0).slice(-this.partCap);
    for (const p of this.arcFx) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; } this.arcFx = this.arcFx.filter(p => p.life > 0).slice(-200);
    for (const m of this.marks) m.t -= dt; this.marks = this.marks.filter((m) => m.t > 0);
    this.floats.forEach((f) => (f.t -= dt)); this.floats = this.floats.filter((f) => f.t > 0);
    this.shake = Math.max(0, this.shake - dt); this.hurtFlash = Math.max(0, this.hurtFlash - dt); this.critFlash = Math.max(0, this.critFlash - dt); this.muzzle = Math.max(0, this.muzzle - dt);
    this.screamer = Math.max(0, this.screamer - dt);
    this.prev = { ...inp };
  }
  pounding = false; muzzle = 0; lastWeapon: Item | null = null;
  /** Estado de P.A.R.I.A.H en la partida activa (sólo se usa con esa clase). */
  pariah: PX.PariahRun = PX.newPariahRun();
  pickupAnimation = newPickupAnimation();

  /** Cámaras pequeñas cerradas con llave o combinación; la llave o la nota quedan en la sala más alejada. */
  placeVaults(rooms: { x: number; y: number; w: number; h: number }[]) {
    const m = this.map, S = 3; this.vaultDoors = new Set();
    const solidAll = (x0:number,y0:number,w:number,h:number) => { if (x0 < 1 || y0 < 1 || x0+w >= MAP-1 || y0+h >= MAP-1) return false; for (let y=y0;y<y0+h;y++) for (let x=x0;x<x0+w;x++) if (m[y*MAP+x]!==1 && m[y*MAP+x]!==4) return false; return true; };
    const mid = (r: { x: number; y: number; w: number; h: number }) => [r.x + r.w / 2, r.y + r.h / 2];
    const cands = rooms.slice(1, -1).filter(r => r !== this.restRoom);
    let made = 0;
    for (const r of cands.sort(() => Math.random() - .5)) { if (made >= 2) break;
      for (const [dx,dy] of ([[1,0],[-1,0],[0,1],[0,-1]] as const)) {
        const cx = dx ? (dx > 0 ? r.x + r.w : r.x - 1) : r.x + Math.floor(r.w/2), cy = dy ? (dy > 0 ? r.y + r.h : r.y - 1) : r.y + Math.floor(r.h/2);
        const zx = dx > 0 ? cx + 2 : dx < 0 ? cx - 1 - S : cx - 1, zy = dy > 0 ? cy + 2 : dy < 0 ? cy - 1 - S : cy - 1;
        if (!solidAll(zx-1, zy-1, S+2, S+2) || m[cy*MAP+cx]===0 || m[(cy+dy)*MAP+cx+dx]===0) continue;
        const door = cy*MAP+cx; m[door] = 6; m[(cy+dy)*MAP+cx+dx] = 0;
        for (let y=zy;y<zy+S;y++) for (let x=zx;x<zx+S;x++) m[y*MAP+x] = 0;
        const [vx, vy] = [zx + S/2, zy + S/2];
        const far = [...rooms.slice(0, -1)].sort((a, b) => Math.hypot(mid(b)[0]-vx, mid(b)[1]-vy) - Math.hypot(mid(a)[0]-vx, mid(a)[1]-vy))[0] ?? rooms[0];
        const spot = { x: far.x + rnd(1, far.w - 1), y: far.y + rnd(1, far.h - 1) };
        if (made === 0) { this.seals[door] = { kind: "key", value: 1, group: [door] }; this.pickups.push({ ...spot, kind: "key", bob: 0 }); }
        else { const code = String(ri(100, 999)); this.seals[door] = { kind: "code", value: 0, code, group: [door] }; this.pickups.push({ ...spot, kind: "note", text: `Nota arrancada: «La cámara del tesoro se abre con ${code}».`, code, bob: 0 }); }
        this.vaultDoors.add(door);
        this.pickups.push({ x: vx, y: vy, kind: "chest", quality: Math.min(4, Math.floor(this.floor / 2) + 3), vault: true, bob: 0 });
        this.zones.push({ x: zx, y: zy, w: S, h: S, name: made === 0 ? "Cámara del tesoro · llave" : "Cámara del tesoro · código" });
        made++; break;
      }
    }
  }
  startPound() { if (this.pounding) return; this.onSound("pound"); this.poundZ = this.pz; this.vz = -22; this.pounding = true; this.score.mech("machacar", this.time); this.crouching = false; this.float("¡MACHACAR!", "#ffd34a"); }
  onSwap() {
    const inCombat = this.enemies.some(e => !e.dead && e.aware && Math.hypot(e.x - this.px, e.y - this.py) < 10);
    const n = nextSwapStacks(this.swapStacks, this.sinceHit, inCombat);
    this.sinceHit = 99;
    if (n > 0) { this.swapStacks = n; this.swapT = SWAP.stackTime; this.stam = Math.min(this.stamMax, this.stam + SWAP.stamRefund); this.float(`ALTERNANCIA ×${n} · +${Math.round((swapDamageMult(n) - 1) * 100)}% daño${swapStaggers(n) ? " · aturde" : ""}`, "#7affc1"); }
    else if (this.swapStacks) { this.swapStacks = 0; this.swapT = 0; }
  }
  /** Sello de pacto en el suelo: un pacto concreto con su beneficio, su precio y su activador. */
  offerPactStone() {
    const p = [...PACTS].filter(x => !this.hasP(x.id)).sort(() => Math.random() - .5)[0];
    if (!p) { this.msg("El sello calla: ya cargas todos los pactos."); return; }
    this.choice = { title: `SELLO DE PACTO · ${p.name}`, dialogue: `${p.principle}`, options: [
      { name: "Aceptar el pacto", desc: `PRO: ${p.boon}. CONTRA: ${p.bane} · Precio: ${p.price}. ACTIVACIÓN: ${p.trigger}`, apply: () => { this.pacts.push(p); this.track("pacts", 1, `sellar ${p.name}`, {}, `pact-${p.id}`); this.score.gain("pact"); this.recalc(); this.onSound("pact"); this.msg(`Pacto sellado: ${p.name}. Actívalo cuando se cumpla: ${p.trigger}`); } },
      { name: "Romper el sello", desc: "Rechazarlo. Recibes un poco de lumbre.", apply: () => { this.lumbre = Math.min(this.lumbreMax, this.lumbre + 1); } },
    ] };
    this.mode = "choice"; this.onUI();
  }
  landImpact(v: number) {
    this.onSound("land");
    const pb = this.pounding && this.onRhythm("MACHACAR") ? 1 : 0;
    const rad = (this.pounding ? 2.6 : 1.4) * (this.has("pisoton") ? 1.8 : 1) * (pb ? RHYTHM.poundRadius : 1);
    const dmg = (pb ? RHYTHM.poundDmg : 1) * (this.pounding ? 14 + Math.min(20, Math.max(0, this.poundZ - this.pz) * 8) : 4) * (this.has("pisoton") ? 2 : 1) + v * 0.5;
    this.shake = 0.3; this.burst(this.px, this.py, 0, "#c9c3d6", 18); if (this.pounding) this.poundFx(rad);
    let hit = 0;
    for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - this.px, e.y - this.py) < rad) { this.damageEnemy(e, dmg, 6); e.vz = 4; const a = Math.atan2(e.y - this.py, e.x - this.px); this.launch(e, a, 5); hit++; }
    if (hit && this.hasE("meteoro")) this.lumbre = Math.min(this.lumbreMax, this.lumbre + hit);
    if (hit) this.float(`IMPACTO x${hit}`, "#ffd34a");
  }

  gloryKill(e: Enemy) {
    const moves = ["DESGARRA LA TINTA", "PISOTÓN FINAL", "LE ARRANCAS EL ENGRANAJE", "CABEZAZO RÚNICO", "EMPALAMIENTO", "LO PARTES EN DOS"];
    const mv = pick(moves);
    this.float(`REMATE: ${mv}`, "#ff3355"); this.shake = 0.4; this.critFlash = 0.25; this.slowmo = 0.35;
    if (e.kind === "librero") { this.damageEnemy(e, e.hpMax * 0.2, 0); e.stagger = 0; e.brk = e.brkMax; return; }
    this.killEnemy(e, true);
    const m = this.has("carnicero") ? 2 : 1;
    this.heal(8 * m); if (this.canCarry(.2 * m)) this.ammo += 4 * m; this.resonance = Math.min(3, this.resonance + 1); this.stam = this.stamMax;
    this.pickups.push({ x: e.x, y: e.y, kind: "mat", mat: pick(["carne", "hueso", "tela", "polvora"]), n: m, bob: 0 });
    if (this.hasE("ecos")) this.explode(e.x, e.y, 2.5, 15, true);
  }
  guideT = 0; guideCd = 0;
  /** Pistas leves si el jugador tarda: señala el fragmento de mapa y luego la guarida del jefe. */
  guideTick(dt: number) {
    if (!this.bossRequired || this.bossDead || this.collapse) return;
    this.guideT += dt; this.guideCd -= dt;
    if (this.guideT < GUIDE.first || this.guideCd > 0) return;
    this.guideCd = GUIDE.every;
    const frag = this.exp.hasMap ? null : this.pickups.find(p => p.kind === "mapfrag" && !p.used);
    const b = this.bossRoom; const tx = frag ? frag.x : b ? b.x + b.w / 2 : null, ty = frag ? frag.y : b ? b.y + b.h / 2 : null;
    if (tx === null || ty === null) return;
    const dir = compassWord(Math.atan2(ty - this.py, tx - this.px) - this.ang), dist = Math.round(Math.hypot(tx - this.px, ty - this.py));
    if (frag) this.msg(`Una corriente fría sopla ${dir}… el fragmento de mapa está a unos ${dist} pasos.`);
    else { this.msg(`Ecos graves resuenan ${dir}: la guarida está a unos ${dist} pasos.`); if (b) this.lairHint = { x: b.x + b.w / 2, y: b.y + b.h / 2, r: Math.max(2.5, (this.lairHint?.r ?? 6) - 1) }; }
    this.float(frag ? "PISTA: MAPA " + dir.toUpperCase() : "PISTA: GUARIDA " + dir.toUpperCase(), "#c9b27a");
  }
  throwShield() {
    const e = this.shieldEnemy; if (!e) return; e.grabbed = false; this.shieldEnemy = null;
    this.launch(e, this.ang, 14); e.vz = 3; e.state = 9; this.float("¡LANZADO!", "#ff9");
  }

  exposedNear() { return this.enemies.find(e=>!e.dead&&(e.exposed??0)>0&&Math.hypot(e.x-this.px,e.y-this.py)<2); }
  /** Ejecución de un enemigo expuesto: patada = munición + vida; robo = equipo + algo de munición y vida. */
  execute(e: Enemy, how: "kick" | "rob") {
    e.exposed = 0; this.score.gain("glory"); this.shake = .35; this.critFlash = .2; this.slowmo = .3; this.burst(e.x, e.y, .6, "#c4121e", 25);
    const a = this.ang; this.launch(e, a, 12); e.vz = 3;
    this.killEnemy(e, true);
    if (how === "kick") { if (this.canCarry(EXPOSE.kickAmmo * .05)) this.ammo += EXPOSE.kickAmmo; this.heal(EXPOSE.kickHeal); this.float(`PATADA FINAL · +${EXPOSE.kickAmmo} munición +${EXPOSE.kickHeal} PV`, "#ff3355"); }
    else { const it = Math.random() < 0.7 ? this.makeWeapon(undefined, ri(1, 3)) : this.makeArmor(); this.pickups.push({ x: this.px, y: this.py, kind: "item", item: it, bob: 0 }); if (this.canCarry(EXPOSE.robAmmo * .05)) this.ammo += EXPOSE.robAmmo; this.heal(EXPOSE.robHeal); this.legacy.steals++; this.saveLegacy(); this.float(`LE ARRANCAS: ${it.name}`, "#ffd34a"); }
    this.onSound("kill");
  }
  interact() {
    { const ex = this.focusPickup() ? null : this.exposedNear(); if (ex) { this.execute(ex, "rob"); return; } }
    for (const e of this.enemies) {
      if (this.focusPickup() || e.dead || e.aware || e.stolen || Math.hypot(e.x - this.px, e.y - this.py) > 1.5) continue;
      const diff = Math.abs((((Math.atan2(this.py - e.y, this.px - e.x) - (e.face ?? 0)) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      if (diff < 1.9) continue;
      const roll = ri(1, 20) + this.mod("AGI") + this.legacy.lockLvl + (this.sneaking ? 3 : 0);
      e.stolen = true;
      if (roll >= 12) { const it = Math.random() < 0.7 ? this.makeWeapon(undefined, ri(1, 3)) : this.makeArmor(); this.pickups.push({ x: this.px, y: this.py, kind: "item", item: it, bob: 0 }); this.gold += ri(5, 15) * this.floor; this.legacy.steals++; this.lockXp(1); this.msg(`Robas a la criatura (${roll} vs 12): ${it.name}`); this.onSound("pickup"); }
      else { e.aware = true; this.msg(`Te descubre al robar (${roll} vs 12).`); this.float("¡TE HAN VISTO!", "#ff3355"); }
      return;
    }
    for (const p of this.focusList()) {
      if (p.deco === "powder") { if (isPariah(this.cls.id)) PX.throwKeg(this, p, POWDER_KEG.radius, kegDamage(this.floor)); else this.stealKeg(p); return; }
      if (p.kind === "cipherlock") { const code = p.code ?? ""; const alts = [code, String((Number(code)+137)%900+100), String((Number(code)+281)%900+100)].sort(() => Math.random() - .5); this.choice = { title: "RELICARIO SELLADO · introduce la combinación", options: alts.map(answer => ({ name: answer, desc: "Girar los tres diales", apply: () => { if (answer === code) { p.used = true; this.exp.unlocked = true; this.exp.noteRead = true; this.track("mechanisms", 1, "combinación correcta del relicario"); this.onSound("portal"); this.msg("El relicario se abre."); this.spawnMapFragment(p.x, p.y + .6); } else { this.alertNear(p.x, p.y, 10); this.terror(2); this.msg("Combinación incorrecta: el relicario muerde."); this.hurtPlayer(3, "mecanismo"); } } })) }; this.mode = "choice"; this.onUI(); return; }
      if (p.kind === "mapfrag") { p.used = true; this.onSound("map"); this.track("maps", 1, "recoger fragmento de mapa"); this.exp.hasMap = true; this.exp.unlocked = true; this.exp.noteRead = true; const b = this.bossRoom; if (b) { const a = rnd(0, Math.PI * 2), off = rnd(1, 3); this.lairHint = { x: b.x + b.w / 2 + Math.cos(a) * off, y: b.y + b.h / 2 + Math.sin(a) * off, r: 5 }; } this.journal.push({ name: "Fragmento de mapa", text: "Un trozo de plano marca, de forma aproximada, la guarida del guardián.", icon: "map" }); this.onSound("pickup"); this.float("GUARIDA MARCADA EN EL MAPA", "#ffd34a"); this.msg("El fragmento revela la zona aproximada de la guarida (círculo dorado en el minimapa)."); return; }
      if (p.kind === "palimpsest") { p.used = true; this.onSound("book"); this.savePalim(pickBook(this.palim, this.floor)); this.onSound("pickup"); this.float("PALIMPSESTOS · un libro que no debería existir", "#7ad8ff"); this.msg("Recoges un libro antiguo. Sus páginas cambian al mirarlas. Siéntate en una banca y abre la mochila para investigarlo."); this.onUI(); return; }
      if (p.kind === "folio") { p.used = true; const r = pickFolio(this.palim, this.floor); this.savePalim(r.state); this.onSound("pickup"); this.float(r.doc ? `FOLIO: ${r.doc.title}` : "Folio en blanco", "#7ad8ff"); this.msg(r.doc ? `Un folio suelto se cose solo al libro: «${r.doc.title}».` : "El folio está en blanco."); return; }
      if (p.kind === "note") { p.used=true; this.track("documents", 1, "nota del cerrajero"); this.exp.noteRead=true; this.journal.push({name:"Nota del cerrajero",text:p.text,icon:"book"}); this.msg(p.text); this.choice={title:p.text,options:[{name:"Guardar nota",desc:"La combinación queda en el diario.",apply:()=>{}}]};this.mode="choice";this.onUI();return; }
      if (p.kind === "lore") { p.used = true; this.track("objectives", 1, this.region.item); this.regionCollected = true; this.journal.push({ name: this.region.item, text: this.region.desc, icon: this.region.icon }); this.gainCycle(this.region.item); this.onSound("pickup"); this.msg(`Recuperas: ${this.region.item}`); this.onUI(); return; }
      if (p.kind === "sanctuary") { p.used = true; this.fatigue = 0; this.hp = this.hpMax; this.mh = this.mhMax; this.food = this.thirst = 100; this.poison = this.burn = this.bleed = 0; this.wounds = {}; this.lumbre = this.lumbreMax; this.onSound("level"); this.msg("La última rosa ofrece refugio. Amanecer se acerca."); return; }
      if (p.kind === "chest" && p.locked) {
        if (this.keys > 0) { this.keys--; p.locked = false; this.msg("Usas una llave de hueso."); }
        else { const f = this.forceRoll(12); this.lockXp(f.ok ? 2 : 1); if (f.ok) { p.locked = false; this.legacy.picks++; this.track("locks", 1, "cerradura de cofre forzada"); this.msg(`Fuerzas la cerradura (${f.total} vs CD 12).`); } else { this.msg(`La ganzúa resbala (${f.total} vs 12): salta una aguja y hace ruido.`); this.hurtPlayer(5, "cerradura"); if (Math.random() < 0.4) this.poison = Math.max(this.poison, 3); this.alertNear(p.x, p.y, 9); return; } }
      }
      if (p.kind === "chest") { this.onSound("chest", p.vault ? "vault" : "chest"); p.used = true; this.track("chests", 1, p.vault ? "cofre de cámara" : "cofre"); this.questEvent("chest"); this.score.gain("chest"); if (p.vault) this.score.gain("secretRoom"); const n = ri(1, 3); for (let i = 0; i < n; i++) this.pickups.push({ x: p.x + rnd(-0.4, 0.4), y: p.y + rnd(-0.4, 0.4), kind: i===0?"item":pick(["item", "gold", "mat", "ammo"] as const), item: this.makeWeapon(undefined,p.quality), mat: pick(Object.keys(MATERIALS)), n: ri(5, 25), bob: 0 }); this.msg("Abres el cofre."); if (p.vault) { this.pickups.push({ x: p.x, y: p.y + .3, kind: "item", item: Math.random() < .5 ? this.makeArmor() : this.makeWeapon(undefined, 4), bob: 0 }); this.float("¡TESORO DE CÁMARA!", "#ffd34a"); } if (!p.vault && Math.random() < 0.25) { this.pickups.push({ x: p.x + .5, y: p.y, kind: 'item', item: { uid: UID++, kind: 'consumable', id: 'espejo', name: 'espejo', rarity: 1 }, bob: 0 }); this.msg("Dentro hay un espejo velado."); this.float("+ ESPEJO VELADO", "#c9e6ff"); } if (!p.vault && Math.random() < 0.15) { this.msg("¡Era un mímico!"); this.spawn("amalgama", p.x, p.y, "VELOZ"); } return; }
      if (p.kind === "shop") { this.onSound("merchant"); PX.noteUnlock(this, "merchant"); this.vendorDialogue(); return; }
      if (this.isBench(p)) { this.sitting = !this.sitting; this.onSound("sit"); if (this.sitting) { this.track("rests", 1, "sentarse en una banca"); PX.noteUnlock(this, "bench"); } this.vx = this.vy = 0; this.float(this.sitting ? "TE SIENTAS · la lumbre se aviva" : "TE LEVANTAS", "#ffcf7a"); return; }
      if (p.kind === "trap" && p.armed) {
        const r = this.roll20() + this.mod("PER") + (this.cls.id === "cazador" ? 4 : 0);
        const r2 = r + this.legacy.lockLvl; this.lockXp(r2 >= 14 ? 2 : 1); if (this.has("trampero") || r2 >= 14) { p.armed = false; p.used = true; this.track("mechanisms", 1, "desarmar trampa sin activarla"); this.pickups.push({ x: p.x, y: p.y, kind: 'mat', mat: 'chatarra', n: 2, bob: 0 }, { x: p.x + .4, y: p.y, kind: 'mat', mat: 'polvora', n: 1, bob: 0 }); this.msg(`Desarmas la trampa (${r2} vs CD 14). +chatarra +pólvora`); }
        else { this.hurtPlayer(8, "trampa"); this.msg(`Fallas al desarmar (${r2} vs CD 14).`); this.alertNear(p.x, p.y, 7); }
        return;
      }
      if (p.kind === "altar") { p.used = true; this.offerPact(); return; }
      if (p.kind === "pactstone") { p.used = true; this.offerPactStone(); return; }
      if (p.kind === "portal") { this.usePortal(p, false); return; }
    }
    // muro secreto / puertas
    const fx = this.px + Math.cos(this.ang) * 0.9, fy = this.py + Math.sin(this.ang) * 0.9;
    if (this.cell(fx, fy) === 6) { const id=Math.floor(fy)*MAP+Math.floor(fx),seal=this.seals[id];
      if(seal?.kind==="code") { const code=seal.code ?? ""; const alternatives=[code,String((Number(code)+137)%900+100),String((Number(code)+281)%900+100)].sort(()=>Math.random()-.5); this.choice={title:"CERRADURA DE TRES CIFRAS",options:alternatives.map(answer=>({name:answer,desc:"Girar el mecanismo",apply:()=>{this.solveCode(id,answer);}}))};this.mode="choice";this.onUI();return; }
      if(this.vaultDoors.has(id) && seal?.kind==="key" && this.keys===0) { this.msg("Cámara del tesoro: necesitas una llave de hueso. Está lejos de aquí."); return; }
      if(seal?.kind==="key" && this.keys===0) { const roll=this.forceRoll(16);this.lockXp(roll.ok?3:1); if(roll.ok) {this.releaseSeal(id);this.legacy.picks++;} else {this.hurtPlayer(6,"cerradura");this.alertNear(fx,fy,12);this.msg("El sello dispara una aguja. Puedes intentarlo otra vez.");return;} }
      if (this.openDoor(fx, fy)) this.msg("La puerta cruje y se abre."); return; }
    if (this.cell(fx, fy) === 3) {
      if (this.keys > 0) { this.keys--; this.map[Math.floor(fy) * MAP + Math.floor(fx)] = 0; this.track("routes", 1, "pasaje secreto de llave"); this.msg("La llave de hueso abre un pasaje secreto."); this.score.gain("secretDoor"); this.burst(fx, fy, 0.5, "#ffd34a", 30); }
      else { const f = this.forceRoll(15); this.lockXp(f.ok ? 3 : 1);
        if (f.ok) { this.map[Math.floor(fy) * MAP + Math.floor(fx)] = 0; this.track("routes", 1, "mecanismo secreto forzado"); this.track("locks", 1, "mecanismo secreto"); this.legacy.picks++; this.msg(`Fuerzas el mecanismo sin llave (${f.total} vs CD 15).`); this.burst(fx, fy, 0.5, "#ffd34a", 20); }
        else { this.msg(`El mecanismo se traba (${f.total} vs 15): derrumbe y estruendo.`); this.hurtPlayer(7, "mecanismo"); this.shake = 0.4; this.alertNear(fx, fy, 12); } }
    }
  }

  inked = 0;
  feudT = 40;
  /** Evento: dos enemigos de distinta especie se enfrentan; el ganador asciende a Tirano. */
  updateFeuds(dt: number) {
    this.feudT -= dt; if (this.feudT > 0 || this.isSafe()) return;
    this.feudT = rnd(FEUD.every[0], FEUD.every[1]);
    const pair = pickFeud(this.enemies.map(e => Object.assign(e, { boss: e.kind === "librero" })), this.px, this.py); if (!pair) return;
    const [a, b] = pair; a.rival = b.id; b.rival = a.id;
    this.float("⚔ DOS ENEMIGOS SE ENFRENTAN", "#ffb04a"); this.msg(`⚔ ${ENEMY_TYPES[a.kind].name} y ${ENEMY_TYPES[b.kind].name} se disputan el territorio: el que gane ascenderá a TIRANO.`);
  }
  /** Mueve y hace golpear a un enemigo contra su rival. Devuelve true si consumió el turno. */
  feudStep(e: Enemy, dt: number) {
    if (e.rival === undefined) return false;
    const r = this.enemies.find(o => o.id === e.rival);
    if (!r || r.dead || r.rival !== e.id || e.aware) { e.rival = undefined; return false; }
    const dx = r.x - e.x, dy = r.y - e.y, d = Math.hypot(dx, dy) || 1; e.face = Math.atan2(dy, dx);
    if (d > FEUD.reach) { const v = ENEMY_TYPES[e.kind].speed * .8 * dt, nx = e.x + dx / d * v, ny = e.y + dy / d * v; if (this.canMoveActor(nx, ny, e.z, this.actorRadius(e), e, e.x, e.y)) { e.x = nx; e.y = ny; } return true; }
    if (e.cd > 0) { e.cd -= dt; return true; }
    e.cd = FEUD.cd * (e.tyrant ? .8 : 1); r.hp -= r.hpMax * FEUD.hitFrac * (e.tyrant ? FEUD.tyrantDmg : 1); r.hurt = .2; this.burst(r.x, r.y, .5, "#c4121e", 6);
    if (r.hp <= 0) { r.rival = undefined; this.killEnemy(r); if (ascend(e)) { if (!e.elite) e.elite = "TIRANO"; this.shake = Math.max(this.shake, .3); this.onSound("terror"); this.float(`👑 ASCENSO DEL TIRANO · ${ENEMY_TYPES[e.kind].name}`, "#ff3355"); this.msg(`👑 ${ENEMY_TYPES[e.kind].name} devoró a su rival y ascendió a TIRANO: más vida y más daño. Te ha olido.`); } }
    return true;
  }
  updateEnemies(dt: number) {
    this.updateFlow(dt); this.updateFeuds(dt);
    if (this.inked > 0) { this.inked -= dt; const k = Math.pow(0.08, dt); this.vx *= k; this.vy *= k; }
    for (const e of this.enemies) {
      if (e.dead) { e.hurt = Math.max(0,e.hurt-dt); continue; }
      if (e.netSkip) continue;
      const t = ENEMY_TYPES[e.kind];
      e.teleMax = e.tele > 0 ? Math.max(e.teleMax ?? 0, e.tele) : 0;
      e.t += dt; e.hurt = Math.max(0, e.hurt - dt);
      // estados alterados enemigos
      if (e.burn > 0) { e.burn -= dt; e.hp -= 3 * dt; if (Math.random() < 0.3) this.burst(e.x, e.y, 0.6, "#ff7a2a", 1); }
      if (e.poison > 0) { e.poison -= dt; e.hp -= 2 * dt; }
      if (e.bleed > 0) { e.bleed -= dt; e.hp -= 2.5 * dt; }
      if (e.hp <= 0) { this.killEnemy(e); continue; }
      if ((e.exposed ?? 0) > 0) { e.exposed = Math.max(0, (e.exposed ?? 0) - dt); if (e.exposed === 0 && !e.dead) { this.score.add("missedExecution", -PENALTY.missedExecution); this.float("EJECUCIÓN PERDIDA", "#ff7a7a"); } }
      if(this.updateAmbush(e,dt))continue;
      e.breachCd=Math.max(0,(e.breachCd??0)-dt);
      // física
      e.vz -= 16 * dt; e.z = Math.max(this.floorHeight(e.x,e.y), e.z + e.vz * dt); if (e.z === this.floorHeight(e.x,e.y)) e.vz = Math.max(0, e.vz);
      // Atrapado dentro de geometría o de otro cuerpo: sal o teletransporta a una zona libre.
      if (!e.ambush && !this.canOccupy(e.x, e.y, e.z, this.actorRadius(e))) { e.embedT = (e.embedT ?? 0) + dt; if (e.embedT > .25) this.unstickEnemy(e); } else e.embedT = 0;
      if (Math.abs(e.kx) + Math.abs(e.ky) > 0.1) this.updateKnockback(e, dt);
      else if (e.state === 9) { e.state = 0; e.chain = 0; e.chainHit = undefined; }
      if (e.grabbed) continue;
      if ((e.downT ?? 0) > 0) { e.downT = Math.max(0, (e.downT ?? 0) - dt); e.tele = 0; if (e.downT === 0) e.cd = Math.max(e.cd, .4); continue; }
      if (e.aware && !e.wasAware) { e.alertT = .55; e.cd = Math.max(e.cd, .45); } e.wasAware = !!e.aware;
      if ((e.alertT ?? 0) > 0) { e.alertT = Math.max(0, (e.alertT ?? 0) - dt); e.face = Math.atan2(this.py - e.y, this.px - e.x); continue; }
      if ((e.stun ?? 0) > 0) { e.stun = Math.max(0,(e.stun??0)-dt); continue; }
      if (e.stagger > 0) { e.stagger -= dt; if (e.stagger <= 0) e.brk = e.brkMax; continue; }
      e.retreatCd = Math.max(0, (e.retreatCd ?? 0) - dt);
      const dx = this.px - e.x, dy = this.py - e.y, dist = Math.hypot(dx, dy);
      if (!e.aware && this.feudStep(e, dt)) continue;
      if (!e.aware) {
        // patrulla ajena al jugador
        e.face = (e.face ?? 0) + Math.sin(e.t * 0.4) * dt * 0.5;
        const pv = 0.45 * dt, nx = e.x + Math.cos(e.face) * pv, ny = e.y + Math.sin(e.face) * pv;
        if (!this.canMoveActor(nx, ny,e.z,this.actorRadius(e),e,e.x,e.y)) e.face += rnd(1.5, 3); else { e.x = nx; e.y = ny; }
        if (dist < this.detectionRadius && this.los(e.x, e.y, this.px, this.py,e.z+.5,this.pz+.5)) {
          const diff = Math.abs((((Math.atan2(dy, dx) - e.face) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
          const front = diff < 1.1 ? 1 : diff < 1.9 ? 0.4 : 0.1;
          const near = 1 - dist / this.detectionRadius;
          e.notice = (e.notice ?? 0) + dt * near * near * front * (this.sneaking ? 1.6 : 5) * (this.stillT > 0.5 ? 0.4 : 1);
          if (e.notice >= 1) { e.aware = true; this.onSound("enemy", e.kind); this.float("¡TE HAN VISTO!", "#ff3355"); this.onSound("hit"); this.bark(e, "detect"); }
        } else e.notice = Math.max(0, (e.notice ?? 0) - dt * 0.25);
        continue;
      }
      if (e.tele <= 0) { e.face = Math.atan2(dy, dx); e.atkA = e.face; }
      if (dist > Math.max(14, e.kind === "librero" ? 10 : 0) && !this.collapse && !e.misread) continue;
      const seen = !this.isSafe() && this.los(e.x, e.y, this.px, this.py,e.z+.5,this.pz+.5);
      let spd = (e.tyrant ? FEUD.tyrantSpeed : 1) * t.speed * (e.variant==="echo"?1.35:1) * (e.elite === "VELOZ" ? 1.6 : 1) * (this.slowmo > 0 ? 0.5 : 1);
      if (e.kind === "librero" && e.hp < e.hpMax * 0.5 && e.phase === 1) { e.phase = 2; this.msg("EL LIBRERO ENTRA EN FASE 2: invoca y embiste"); this.spawn("sombra", e.x + 1, e.y); this.spawn("espectro", e.x - 1, e.y); }
      spd *= evolution(e.lvl ?? 1).speed * (e.traits?.includes("furia") && e.hp < e.hpMax * .35 ? 1.4 : 1);
      if (e.kind === "librero" && e.phase === 2) spd *= 1.3; if (e.misread) { e.aware = true; spd *= MISREAD.speedMult;
        if (dist > 4 && e.hp < e.hpMax) e.hp = Math.min(e.hpMax, e.hp + e.hpMax * MISREAD.regenPerSec * dt);
        e.misreadT = dist > MISREAD.farDist ? (e.misreadT ?? 0) + dt : 0;
        if ((e.misreadT ?? 0) > MISREAD.catchUpAfter && !this.isSafe()) { e.misreadT = 0;
          const r = this.rooms.filter(r => r !== this.restRoom && !this.isSafe(r.x + r.w / 2, r.y + r.h / 2) && !this.solid(r.x + r.w / 2, r.y + r.h / 2)).map(r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })).filter(c => Math.hypot(c.x - this.px, c.y - this.py) > 4).sort((a, b) => Math.hypot(a.x - this.px, a.y - this.py) - Math.hypot(b.x - this.px, b.y - this.py))[0];
          if (r) { this.burst(e.x, e.y, .6, "#2a1a3a", 16); e.x = r.x; e.y = r.y; e.z = this.floorHeight(r.x, r.y); this.burst(e.x, e.y, .6, "#2a1a3a", 16); this.float("LA LECTURA ERRÓNEA TE ALCANZA", "#ff3355"); } } } if (this.collapse) { e.aware = true; spd *= 1.18 + Math.random() * .17; if (Math.random() < dt * 1.5) { e.detourT = .25; e.detourA = Math.atan2(dy, dx) + rnd(-1, 1); } } if ((e.buff ?? 0) > 0) { e.buff = (e.buff ?? 0) - dt; spd *= SQUAD.drumSpeed; } if (e.kind === "bestia") spd *= packSpeed(this.enemies.filter((o) => o !== e && !o.dead && o.kind === "bestia" && Math.hypot(o.x - e.x, o.y - e.y) < 5).length);
      const move = (vx: number, vy: number, force = false) => { if (e.evading && !force) return; const distance=Math.hypot(vx,vy),nx=e.x+vx/(distance||1)*.85,ny=e.y+vy/(distance||1)*.85,id=Math.floor(ny)*MAP+Math.floor(nx);if(!this.isSafe()&&(e.breachCd??0)<=0){if(this.cell(nx,ny)===6&&this.enemyBreach(e,id))e.breachCd=2;if(this.cell(nx,ny)===10&&this.breakCover(id))e.breachCd=2;}if((e.detourT??0)>0){e.detourT=(e.detourT??0)-dt;const a=e.detourA??0;vx=Math.cos(a)*distance;vy=Math.sin(a)*distance;}const ox=e.x,oy=e.y;const moved=this.sweepActor(e.x,e.y,e.z,vx*dt,vy*dt,this.actorRadius(e),e);e.x=moved.x;e.y=moved.y;if(moved.z>e.z&&e.vz<=0)e.z=moved.z;const want=distance*dt;if(want>.002&&Math.hypot(e.x-ox,e.y-oy)<want*.25){e.stuckT=(e.stuckT??0)+dt;if(e.stuckT>.28){e.stuckT=0;e.stuckN=(e.stuckN??0)+1;e.flowT=1.6;if(e.stuckN>=2&&e.vz===0&&Math.abs(e.z-this.floorHeight(e.x,e.y))<.05&&(e.unstuckJumps??0)<3){e.vz=6;e.unstuckJumps=(e.unstuckJumps??0)+1;}if(e.stuckN>=4){this.unstickEnemy(e);return;}if(e.evadeT)e.evadeA=(e.evadeA??0)+Math.PI*(Math.random()<.5?.5:-.5);e.detourT=rnd(.3,.6)*(e.stuckN>2?1.6:1);e.detourA=Math.atan2(vy,vx)+(Math.random()<.5?1:-1)*rnd(1.2,1.9);}}else {e.stuckT=Math.max(0,(e.stuckT??0)-dt*2);if(Math.hypot(e.x-ox,e.y-oy)>want*.7){e.stuckN=Math.max(0,(e.stuckN??0)-dt);if(e.stuckN===0)e.unstuckJumps=0;}}if(moved.hit && e.vz===0 && ["jumper","blink","charger","boss"].includes(t.pattern))e.vz=6; };
      e.cd -= dt; if (e.opening) { e.opening = Math.max(0, e.opening - dt); e.cd = Math.max(e.cd, e.opening); }
      const pat = t.pattern;
      const ux = dx / (dist || 1), uy = dy / (dist || 1);
      if(!seen&&!this.isSafe()&&dist<14&&e.tele<=0&&!["sniper","bishop","engineer","banner"].includes(t.pattern)){const [hx,hy]=this.navDir(e);move(hx*spd*.85,hy*spd*.85);}
      // patrón de movimiento
      e.evading = this.updateEvade(e, seen, dist, ux, uy, dt);
      if (e.evading) { const a = e.evadeA ?? 0; move(Math.cos(a) * spd * EVADE.speedMult, Math.sin(a) * spd * EVADE.speedMult, true); }
      // repliegue tras ser golpeado: retrocede unos pasos alejándose del jugador
      if (!e.evading && (e.retreatT ?? 0) > 0) { e.retreatT = (e.retreatT ?? 0) - dt; const a = e.retreatA ?? Math.atan2(e.y - this.py, e.x - this.px); move(Math.cos(a) * spd * RETREAT.speedMult, Math.sin(a) * spd * RETREAT.speedMult, true); }
      if (seen) {
        if (pat === "ranged") { const want = dist < 4 ? -1 : dist > 7 ? 1 : 0; move(ux * spd * want - uy * spd * Math.sin(e.t), uy * spd * want + ux * spd * Math.sin(e.t)); }
        else if (pat === "charger" && e.state === 1) { move(e.kx === 0 ? e.ky * 0 + Math.cos(e.phase) * 0 : 0, 0); }
        else if (pat === "blink" && e.cd < 0.2 && dist > 3 && Math.random() < 0.02) { const a = rnd(0, Math.PI * 2); const bx = this.px + Math.cos(a) * 2, by = this.py + Math.sin(a) * 2; if (this.canMoveActor(bx,by,this.floorHeight(bx,by),this.actorRadius(e),e)) { this.burst(e.x, e.y, 0.5, "#9cf", 12); e.x = bx; e.y = by; } }
        else if (["screamer","sniper","bomber","bishop","flanker","webber","engineer","siren"].includes(pat)) { /* movimiento propio en squadAct */ }
        else if (dist > 1.1 && e.tele <= 0) { const ring = dist > 2.6 ? 1.1 : 0, ra = e.id * 2.39996, [hx, hy] = this.navDir(e, this.px + Math.cos(ra) * ring, this.py + Math.sin(ra) * ring); const strafe = dist < 3 ? Math.sin(e.t * 2 + e.id) * 0.35 : 0; move((hx - hy * strafe) * spd, (hy + hx * strafe) * spd); }
        this.squadAct(e, pat, dist, ux, uy, spd, move);
        this.enemyTricks(e, dist, ux, uy, dt, ["ranged","caster","gunner","witch","sniper","bomber","bishop","boss"].includes(pat));
        if ((pat === "jumper" || pat === "boss") && e.z === this.floorHeight(e.x,e.y) && Math.random() < dt * 0.5) { e.vz = 7; e.state = 5; }
        if (e.state === 5 && e.z === this.floorHeight(e.x,e.y) && e.vz === 0) { e.state = 0; if (dist < 2.5) this.hurtPlayer(t.dmg, "salto"); this.shake = 0.25; this.burst(e.x, e.y, 0, "#888", 12); }
        if (Math.random() < dt * 0.3 && e.z === this.floorHeight(e.x,e.y) && pat !== "boss") e.vz = 4.5; // saltitos
      }
      // roles extra: kamikazes, tiradores con armas, lanzabombas y nubes de jefe
      if ((e.downT ?? 0) <= 0 && e.stagger <= 0 && !((e.stun ?? 0) > 0) && !this.isSafe()) {
        if (e.role === "kamikaze") {
          if (e.fuse !== undefined) { e.fuse -= dt; if (Math.random() < dt * 20) this.burst(e.x, e.y, e.z + .7, "#ff5a1a", 2);
            if (e.fuse <= 0) { e.role = undefined; e.fuse = undefined; this.explode(e.x, e.y, ROLES.kamikazeRadius, t.dmg * ROLES.kamikazeDmg * this.enemyDmg(e), false); this.damageEnemy(e, e.hp + 999, 0); continue; } }
          else if (seen) { move(ux * spd * ROLES.kamikazeSpeed, uy * spd * ROLES.kamikazeSpeed, true); if (dist < ROLES.kamikazeTrigger) { e.fuse = ROLES.kamikazeFuse; this.float("¡VA A ESTALLAR! · aléjate", "#ff6a2a"); this.onSound("event"); } }
        }
        if (e.role === "gunner" || e.role === "lobber") {
          if (e.role === "gunner") { e.gunCd = (e.gunCd ?? rnd(1, 2)) - dt;
            if (seen && dist < ROLES.gunRange && e.gunCd <= 0 && !(e.burstLeft)) { e.gunCd = rnd(ROLES.gunCd[0], ROLES.gunCd[1]); e.burstLeft = ri(2, 4); e.burstT = .35; this.float("¡TE APUNTA CON UN ARMA!", "#ffd27a"); }
            if ((e.burstLeft ?? 0) > 0) { e.burstT = (e.burstT ?? 0) - dt; if (e.burstT <= 0) { e.burstT = .14; e.burstLeft!--; if (this.los(e.x, e.y, this.px, this.py, e.z + .6, this.pz + .5)) { const lt = dist / ROLES.gunSpeed, a = Math.atan2(dy + this.vy * lt * .6, dx + this.vx * lt * .6) + rnd(-.07, .07); this.projs.push({ x: e.x, y: e.y, z: e.z + 0.6, dz: (this.pz - e.z) / (dist / ROLES.gunSpeed || 1), dx: Math.cos(a) * ROLES.gunSpeed, dy: Math.sin(a) * ROLES.gunSpeed, life: 1.4, dmg: t.dmg * ROLES.gunDmg * this.enemyDmg(e), friendly: false, ownerId: e.id, color: "#ffd27a", sprite: "bullet" }); this.onSound("shot"); } } }
          } else { e.lobCd = (e.lobCd ?? rnd(1.5, 3)) - dt;
            if (seen && dist > 2.5 && dist < 11 && e.lobCd <= 0) { e.lobCd = rnd(ROLES.lobCd[0], ROLES.lobCd[1]); this.lobBomb(e, t.dmg * ROLES.lobDmg * this.enemyDmg(e)); } }
        }
        if ((e.miniBoss || pat === "boss" || pat === "bishop") && seen) { e.cloudCd = (e.cloudCd ?? 6) - dt; if (e.cloudCd <= 0) { e.cloudCd = rnd(ROLES.cloudCd[0], ROLES.cloudCd[1]) * (e.hp < e.hpMax * .5 ? .7 : 1); this.bulletCloud(e, t.dmg * this.enemyDmg(e)); } }
      }
      // ataques con telegráfo
      if (e.tele > 0) {
        e.tele -= dt;
        if (e.tele <= 0) {
          if (pat === "ranged" || pat === "caster" || pat === "gunner" || pat === "witch" || (pat === "boss" && e.state === 2)) {
            const n = pat === "boss" ? (e.phase === 2 ? 12 : 8) : pat === "gunner" ? 3 : e.variant==="moon"||e.traits?.includes("eco")?3:1;
            const clear = pat === "boss" || this.los(e.x, e.y, this.px, this.py, e.z + .6, this.pz + .5); if (!clear) e.cd = Math.min(e.cd, .4);
            const lt = dist / 7 * .7, aim = Math.atan2(dy + this.vy * lt, dx + this.vx * lt);
            for (let i = 0; i < (clear ? n : 0); i++) { const a = aim + (pat==="boss" ? (i / n) * Math.PI * 2 : n>1?(i-1)*.18:0); this.projs.push({ x: e.x, y: e.y, z: e.z+0.6, dz: (this.pz-e.z)/(dist/7 || 1), dx: Math.cos(a) * 7, dy: Math.sin(a) * 7, life: 2.5, dmg: t.dmg * this.enemyDmg(e), friendly: false, ownerId: e.id, color: e.elite === "VENENOSO" || pat === "caster" ? "#5f5" : pat === "witch" ? "#ff2a6a" : pat === "gunner" ? "#ffb347" : "#f43" }); }
          } else if (pat === "sniper") {
            if (this.los(e.x, e.y, this.px, this.py, e.z + .5, this.pz + .5)) { const a = Math.atan2(dy, dx); this.projs.push({ x: e.x, y: e.y, z: e.z + 0.6, dz: (this.pz - e.z) / (dist / 15 || 1), dx: Math.cos(a) * 15, dy: Math.sin(a) * 15, life: 1.5, dmg: t.dmg * this.enemyDmg(e) * (this.enemies.some((o) => !o.dead && o.kind === "behemoth" && Math.hypot(o.x - this.px, o.y - this.py) < 3) ? 1.4 : 1), friendly: false, ownerId: e.id, color: "#5ff" }); this.onSound("event"); }
          } else if (pat === "bomber") {
            this.lobBomb(e, t.dmg * this.enemyDmg(e)); if (Math.random() < .4) this.lobBomb(e, t.dmg * this.enemyDmg(e) * .7, 1.2);
          } else if (pat === "bishop") {
            const n = e.hp < e.hpMax * 0.5 ? 14 : 9, base = Math.atan2(dy, dx) + (e.phase % 2) * Math.PI / n; e.phase++;
            for (let i = 0; i < n; i++) { const a = base + (i / n) * Math.PI * 2; this.projs.push({ x: e.x, y: e.y, z: e.z + 0.7, dz: 0, dx: Math.cos(a) * 5.5, dy: Math.sin(a) * 5.5, life: 3, dmg: t.dmg * this.enemyDmg(e), friendly: false, ownerId: e.id, color: "#ffd34a" }); }
          } else if (pat === "brute") {
            this.shake = 0.5; this.burst(e.x, e.y, 0, "#a86", 22); this.onSound("event");
            if (dist < SQUAD.slamRadius && this.pz - this.floorHeight(this.px, this.py) < 0.3) { this.hurtPlayer(t.dmg * this.enemyDmg(e), "golpe sísmico"); this.vx += ux * 8; this.vy += uy * 8; this.float("¡GOLPE SÍSMICO! Salta para evitarlo", "#fa6"); } else if (dist < SQUAD.slamRadius + 1.5) this.openUp(e);
          } else if (pat === "webber") {
            if (this.los(e.x, e.y, this.px, this.py, e.z + .5, this.pz + .5) && dist < 10) { this.inked = SQUAD.inkSeconds; this.hurtPlayer(t.dmg, "tinta"); this.float("¡ATRAPADO EN TINTA! Recibes más daño", "#8a7aff"); this.burst(this.px, this.py, 0.4, "#2a2040", 16); }
          } else if (pat === "siren") {
            if (dist < 12) { this.vx += ux * SQUAD.songPull; this.vy += uy * SQUAD.songPull; this.float("EL CANTO DE LA SIRENA TE ARRASTRA", "#5ff"); for (const o of this.enemies) if (!o.dead && (o.kind === "ahogado" || o.kind === "sanguijuela") && Math.hypot(o.x - e.x, o.y - e.y) < 10) o.buff = 4; }
          } else if (pat === "hook") {
            if (this.los(e.x, e.y, this.px, this.py, e.z + .5, this.pz + .5)) { this.vx -= ux * SQUAD.hookPull; this.vy -= uy * SQUAD.hookPull; this.hurtPlayer(4, "gancho"); this.float("¡TE ARRASTRA EL GANCHO!", "#5ff"); this.shake = 0.25; }
          } else if (pat === "charger" || (pat === "boss" && e.state === 3)) {
            e.kx = ux * 12; e.ky = uy * 12; e.state = 0;
          } else if (meleeReachesBody({ dist, attackerRadius: this.actorRadius(e), reach: playerHitbox(this.lowProfile).reach - .44, angleOff: Math.atan2(Math.sin(Math.atan2(dy, dx) - (e.atkA ?? 0)), Math.cos(Math.atan2(dy, dx) - (e.atkA ?? 0))), halfArc: .8, low: this.lowProfile }) && Math.abs(e.z-this.pz)<.9 && this.los(e.x, e.y, this.px, this.py, e.z + .5, this.pz + .5)) {
            const nat = ri(1, 20);
            if (nat === 1) { e.stagger = 1.2; this.openUp(e); }
            else if (nat + 3 - playerHitbox(this.lowProfile).rollPenalty >= this.def || nat === 20) {
              { if (pat === "leech") { const gain = t.dmg * (this.poison > 0 ? SQUAD.leechPoison : 1); e.hp = Math.min(e.hpMax, e.hp + gain); const ally = this.enemies.find((o) => o !== e && !o.dead && Math.hypot(o.x - e.x, o.y - e.y) < 5); if (ally) ally.hp = Math.min(ally.hpMax, ally.hp + gain); this.float(this.poison > 0 ? "LA SANGUIJUELA SE ATIBORRA DE VENENO" : "TE DRENA LA SANGRE", "#c4121e"); }
              if (this.dashT > 0) this.openUp(e);
              const back = pat === "flanker" && backstab(this.ang, e.x, e.y, this.px, this.py); if (back) this.float("¡POR LA ESPALDA!", "#f44"); this.hurtPlayer(t.dmg * (nat === 20 ? 2 : 1) * (back ? SQUAD.flankBonus : 1) * this.enemyDmg(e), t.name, nat === 20, { x: e.x, y: e.y }, isPariah(this.cls.id) ? this.pz + rnd(.25, .7) : undefined); }
              if (nat === 20) this.float("CRÍTICO ENEMIGO", "#f33");
              if (e.traits?.includes("garra")) this.bleed = Math.max(this.bleed, 3); if (e.elite === "ÍGNEO") this.burn = 4; if (e.elite === "VENENOSO") this.poison = 8; if (e.elite === "VAMPÍRICO") e.hp = Math.min(e.hpMax, e.hp + t.dmg);
            } else this.openUp(e);
          }
        }
      } else if (e.cd <= 0 && seen) {
        if ((pat === "ranged" || pat === "caster" || pat === "gunner" || pat === "witch") && dist < 10) { e.tele = pat === "gunner" ? 0.8 : 0.5; e.cd = pat === "gunner" ? rnd(2.2, 3) : rnd(1.4, 2.4); }
        else if (pat === "sniper" && dist < SQUAD.sniperRange) { e.tele = 1.3; e.cd = rnd(3, 4.2); this.float("¡UN BALLESTERO TE APUNTA!", "#5ff"); }
        else if (pat === "bomber" && dist < 10 && dist > 2.5) { e.tele = 0.7; e.cd = rnd(2.6, 3.6); }
        else if (pat === "bishop" && dist < 11) { e.tele = 0.9; e.cd = e.hp < e.hpMax * 0.5 ? 1.8 : 2.6; }
        else if (pat === "brute" && dist < 3) { e.tele = 0.9; e.cd = rnd(2.4, 3.2); this.float("EL BEHEMOTH ALZA LOS PUÑOS", "#fa6"); }
        else if ((pat === "webber" && dist < 9) || (pat === "siren" && dist < 12)) { e.tele = pat === "siren" ? 1.1 : 0.7; e.cd = pat === "siren" ? rnd(5, 6.5) : rnd(3.5, 4.5); if (pat === "siren") this.float("LA SIRENA ENTONA SU CANTO", "#5ff"); }
        else if (pat === "engineer" || pat === "webber" || pat === "siren" || pat === "banner") { /* soporte */ }
        else if (pat === "screamer" || pat === "brute" || pat === "sniper" || pat === "bomber" || pat === "bishop") { /* esperan su momento */ }
        else if (pat === "hook" || pat === "drummer") { /* gestionado en squadAct */ }
        else if (pat === "charger" && dist < 7 && dist > 2) { e.tele = 0.6; e.cd = 3; }
        else if (pat === "boss") { e.state = pick([2, 3, 2]); e.tele = 0.7; e.cd = e.phase === 2 ? 1.6 : 2.4; }
        else if (dist < 1.7 && Math.abs(e.z-this.pz)<1) { e.atkA = Math.atan2(dy, dx); e.tele = 0.45; e.cd = rnd(1, 1.6); }
      }
      // contacto en carga
      if (Math.hypot(e.kx, e.ky) > 8 && dist < 0.9 && e.state !== 9) { this.hurtPlayer(t.dmg * 1.2, "embestida"); e.kx = e.ky = 0; }
    }
    this.separateActors();
    // jefe
    if (!this.bossSpawned && this.bossRoom) {
      const b = this.bossRoom;
      const insideLair = this.px > b.x && this.px < b.x + b.w && this.py > b.y && this.py < b.y + b.h;
      if (insideLair && !lairOpen(this.exp)) { this.lairWarnT -= dt; if (this.lairWarnT <= 0) { this.lairWarnT = 6; this.float("LA GUARIDA DUERME · falta el fragmento de mapa", "#b58cff"); this.msg("Sin el fragmento de mapa, el guardián no responde. Busca el documento con el código."); } }
      else if (insideLair) { this.bossSpawned = true; this.onSound("boss"); this.spawn("librero", b.x + b.w / 2, b.y + b.h / 2, undefined); this.sealArena(b); this.msg(`¡JEFE: ${this.region.boss}!`); this.onSound("event"); this.shake = 0.6; }
    }
    this.updateArena(dt);
    this.enemies = this.enemies.filter((e) => !e.dead || e.hurt > 0);
  }


  /** Empuja a un enemigo; cerca de una pared el golpe lo estampa contra ella. */
  launch(e: Enemy, a: number, speed: number) {
    speed = Math.max(IMPACT.flyMin, speed);
    const r = this.actorRadius(e); let wall = false;
    for (let d = r + .1; d <= IMPACT.wallNear; d += .2) if (!this.canOccupy(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, e.z, r)) { wall = true; break; }
    if (wall) speed = Math.max(speed * IMPACT.wallNearPush, IMPACT.flyMin + 1.5);
    e.kx = Math.cos(a) * speed; e.ky = Math.sin(a) * speed;
    if (speed >= IMPACT.flyMin) { e.state = 9; e.chain = 0; e.chainHit = new Set([e.id]); }
  }
  updateKnockback(e: Enemy, dt: number) {
    const sp = Math.hypot(e.kx, e.ky), depth = e.chain ?? 0, r = this.actorRadius(e);
    const x0 = e.x, y0 = e.y;
    // Walls constrain the sweep; bodies are resolved below as impacts, not blockers.
    const moved = this.sweep(e.x, e.y, e.z, e.kx * dt, e.ky * dt, r); e.x = moved.x; e.y = moved.y;
    if (moved.hit) {
      if (sp > IMPACT.flyMin * .8) {
        this.damageEnemy(e, wallSlamDamage(sp, depth), 6); this.environmentImpact(e.x, e.y, e.z + .5); this.shake = Math.max(this.shake, .12);
        this.float(depth ? "¡REBOTA EN LA PARED!" : "¡CONTRA LA PARED!", "#ffb14a");
        const bx = this.canOccupy(e.x + Math.sign(e.kx) * .08, e.y, e.z, r) ? 1 : -1, by = this.canOccupy(e.x, e.y + Math.sign(e.ky) * .08, e.z, r) ? 1 : -1;
        const ns = wallBounceSpeed(sp, depth), k = ns / (sp || 1); e.kx *= bx * k; e.ky *= by * k; e.chain = depth + 1;
        if (ns < 2 || e.chain > IMPACT.maxDepth) { e.kx = e.ky = 0; e.state = 0; }
      } else { e.kx = e.ky = 0; e.state = 0; }
    }
    if (e.state === 9 && sp > 2) for (const o of this.enemies) {
      if (o === e || o.dead || o.grabbed || e.chainHit?.has(o.id) || segmentContact(x0, y0, e.z, e.x, e.y, e.z, o.x, o.y, o.z, r + this.actorRadius(o), BODY_HEIGHT) === null) continue;
      (e.chainHit ??= new Set([e.id])).add(o.id);
      const dmg = bodyDamage(sp, depth); this.damageEnemy(o, dmg, 5); this.damageEnemy(e, dmg * .5, 2); this.float("¡CHOQUE!", "#ffd34a");
      const a = Math.atan2(o.y - e.y, o.x - e.x);
      const pass = transferSpeed(sp, depth);
      if (depth < IMPACT.maxDepth) { o.kx = Math.cos(a) * pass; o.ky = Math.sin(a) * pass; o.state = 9; o.chain = depth + 1; o.chainHit = new Set(e.chainHit); }
      else { o.kx += Math.cos(a) * pass * .4; o.ky += Math.sin(a) * pass * .4; }
      e.kx *= -IMPACT.strikerKeep; e.ky *= -IMPACT.strikerKeep; e.chain = depth + 1;
      if (e.chain > IMPACT.maxDepth) e.state = 0;
      break;
    }
    e.kx *= Math.exp(-5 * dt); e.ky *= Math.exp(-5 * dt);
    if (Math.hypot(e.kx, e.ky) < 1.5 && e.state === 9) { e.state = 0; e.chain = 0; e.chainHit = undefined; }
  }
  /** Saca a un enemigo atrapado: celda libre cercana o, si no hay, otra zona transitable del mapa. */
  /** Jugador empujando contra un borde elevado sin avanzar: primero sube el escalón si es bajo, si sigue atrapado se recoloca en el suelo libre más cercano. */
  pushT = 0; pushX = 0; pushY = 0;
  playerUnstick(dt: number, mx: number, my: number) {
    if (Math.hypot(mx || 0, my || 0) < .3 || this.mode !== "play" || this.vz !== 0 || Math.abs(this.pz - this.floorHeight()) > .02) { this.pushT = 0; this.pushX = this.px; this.pushY = this.py; return; }
    if (Math.hypot(this.px - this.pushX, this.py - this.pushY) > .25) { this.pushT = 0; this.pushX = this.px; this.pushY = this.py; return; }
    this.pushT += dt; if (this.pushT < 2) return;
    this.pushT = 0; const h = this.bodyH();
    // Sólo actúa ante desniveles (escalones/plataformas), nunca contra paredes normales.
    const ahead = this.floorHeight(this.px + Math.cos(this.ang) * .6, this.py + Math.sin(this.ang) * .6), here = this.floorHeight();
    if (ahead <= this.pz + .05 && here === 0) return;
    for (const d of [.7, 1.1]) for (const t of [0, .5, -.5]) {
      const a = this.ang + t, x = this.px + Math.cos(a) * d, y = this.py + Math.sin(a) * d, z = this.floorHeight(x, y);
      if (z <= this.pz + .8 && this.canOccupy(x, y, z, BODY_RADIUS, h)) { this.px = x; this.py = y; this.pz = Math.max(this.pz, z); this.vz = 0; this.pushX = x; this.pushY = y; return; }
    }
    const cx = Math.floor(this.px), cy = Math.floor(this.py);
    for (let rad = 1; rad <= 3; rad++) for (let oy = -rad; oy <= rad; oy++) for (let ox = -rad; ox <= rad; ox++) {
      if (Math.max(Math.abs(ox), Math.abs(oy)) !== rad) continue;
      const x = cx + ox + .5, y = cy + oy + .5, z = this.floorHeight(x, y);
      if (z === 0 && this.canOccupy(x, y, 0, BODY_RADIUS, h) && this.los(this.px, this.py, x, y, this.pz + .5, .5)) { this.px = x; this.py = y; this.pz = 0; this.vz = 0; this.pushX = x; this.pushY = y; this.float("LIBERADO", "#c9c3d6"); return; }
    }
  }
  unstickEnemy(e: Enemy) {
    const r = this.actorRadius(e), ok = (x: number, y: number) => { const z = this.floorHeight(x, y); return !this.isSafe(x, y, r) && this.canMoveActor(x, y, z, r, e) ? z : null; };
    const cx = Math.floor(e.x), cy = Math.floor(e.y);
    for (let rad = 0; rad <= 6; rad++) for (let oy = -rad; oy <= rad; oy++) for (let ox = -rad; ox <= rad; ox++) {
      if (Math.max(Math.abs(ox), Math.abs(oy)) !== rad) continue;
      const x = cx + ox + .5, y = cy + oy + .5, z = ok(x, y);
      if (z !== null) { e.x = x; e.y = y; e.z = z; e.kx = e.ky = 0; e.stuckN = 0; e.stuckT = 0; e.embedT = 0; e.unstuckJumps = 0; e.detourT = 0; return true; }
    }
    for (let tries = 0; tries < 200; tries++) {
      const room = pick(this.rooms); if (!room) break;
      const x = room.x + rnd(1, Math.max(1.1, room.w - 1)), y = room.y + rnd(1, Math.max(1.1, room.h - 1)), z = ok(x, y);
      if (z !== null && Math.hypot(x - this.px, y - this.py) > 4) { this.burst(e.x, e.y, .5, "#8a5cff", 6); e.x = x; e.y = y; e.z = z; e.kx = e.ky = 0; e.stuckN = 0; e.embedT = 0; e.unstuckJumps = 0; this.burst(x, y, .5, "#8a5cff", 6); return true; }
    }
    return false;
  }
  knockDown(e: Enemy, label: string) {
    if (e.kind === "librero" || e.miniBoss || HEAVY.includes(e.kind)) { e.stagger = Math.max(e.stagger, .5); e.tele = 0; this.float(`${label} · ¡TAMBALEA!`, "#ffd34a"); return; }
    const cancelled = e.tele > 0; e.tele = 0; e.downT = KNOCKDOWN_SECONDS; e.cd = Math.max(e.cd, KNOCKDOWN_SECONDS + .3); e.aware = true; e.wasAware = true; e.alertT = 0;
    this.float(cancelled ? `${label} · ATAQUE CANCELADO` : `${label} · ¡AL SUELO!`, "#ffb14a"); this.shake = Math.max(this.shake, .12); this.burst(e.x, e.y, .1, "#a49885", 8);
  }
  /** Gasta durabilidad; devuelve true si el uso falla (resbalón o encasquillado). */
  useWeapon(w: Item, amount: number) {
    ensureWear(w);
    const fail = Math.random() < failChance(w);
    const change = applyWear(w, amount);
    if (change === "worn") { this.float(`${w.name} SE DESGASTA · repárala en Crafteo`, "#ffb347"); this.msg(`${w.name} está desgastada: menos daño y puede fallar.`); }
    if (change === "broken") { this.float(`¡${w.name} ROTA!`, "#ff4a3a"); this.msg(`${w.name} está rota: daño muy reducido y falla a menudo. Repárala en Crafteo o con el mercader.`); this.onSound("break"); }
    if (fail) { this.float(w.base?.ranged ? "¡ENCASQUILLADA!" : "¡EL GOLPE RESBALA!", "#f88"); this.burst(this.px + Math.cos(this.ang) * .6, this.py + Math.sin(this.ang) * .6, this.pz + .5, "#999", 6); }
    return fail;
  }
  /** Busca un arma propia (equipada o en mochila). */
  ownItem(uid: number) { return [this.melee, this.ranged, this.armor, ...this.bag].find(it => it?.uid === uid) ?? null; }
  /** Herrería: reparar, subir nivel o añadir efecto, pagando materiales o oro (mercader). */
  smith(uid: number, action: "repair" | "upgrade" | "enchant", pay: "mats" | "gold", affix?: AffixId) {
    const it = this.ownItem(uid); if (!it || it.kind !== "weapon") return false;
    ensureWear(it);
    const cost = action === "repair" ? repairCost(it) : action === "upgrade" ? upgradeCost(it) : enchantCost(it);
    const gold = action === "repair" ? repairGold(it) : action === "upgrade" ? upgradeGold(it) : enchantGold(it);
    if (action === "repair" && !Object.keys(cost).length) return false;
    if (action === "upgrade" && !canUpgrade(it)) return false;
    if (action === "enchant" && (!canEnchant(it) || !affix || it.affixes?.includes(affix))) return false;
    if (pay === "gold") { if (!this.shopStock.length || this.gold < gold) return false; this.gold -= gold; this.score.spend(gold); }
    else if (!payCost(this.mats, cost)) return false;
    this.onSound("craft"); if (action === "repair") { repair(it); this.msg(`${it.name} reparada.`); }
    else if (action === "upgrade") { upgrade(it); this.msg(`${it.name} sube a +${it.wlvl}.`); }
    else { enchant(it, affix!); this.msg(`${it.name} gana ${affix}.`); }
    this.onSound("pickup"); this.recalc(); this.saveRun(); return true;
  }
  /** Lanza una bomba en parábola hacia arriba que cae sobre el jugador. */
  lobBomb(e: Enemy, dmg: number, spread = 0) {
    const tx = this.px + this.vx * .5 + rnd(-spread, spread), ty = this.py + this.vy * .5 + rnd(-spread, spread);
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
    const T = Math.max(.55, Math.min(1.05, d / 8)), z0 = e.z + .9, tz = this.floorHeight(tx, ty);
    this.projs.push({ x: e.x, y: e.y, z: z0, dx: dx / T, dy: dy / T, dz: (tz - z0) / T + .5 * ROLES.gravity * T, life: T + 1.5, dmg, friendly: false, ownerId: e.id, color: "#ff8a2a", bomb: true, lob: true, sprite: "orb" });
    this.float("¡BOMBA AL AIRE!", "#ff8a2a");
  }
  /** Nube de proyectiles con patrón aleatorio que rebota por la sala. */
  bulletCloud(e: Enemy, dmg: number) {
    this.onSound("cloud");
    const shots = cloudPattern(Math.random, e.hp < e.hpMax * .5);
    const colors = ["#ff3a7a", "#ffd34a", "#7ad8ff", "#c35bff", "#7affc1"], col = colors[ri(0, colors.length - 1)];
    for (const s of shots) {
      const r = .6 + s.ring;
      this.projs.push({ x: e.x + Math.cos(s.a) * r * .3, y: e.y + Math.sin(s.a) * r * .3, z: e.z + .4 + s.h, dx: Math.cos(s.a) * s.speed, dy: Math.sin(s.a) * s.speed, dz: s.dz, life: ROLES.cloudLife, dmg: dmg * ROLES.cloudDmg, friendly: false, ownerId: e.id, color: col, cloud: true, bounces: ROLES.cloudBounces });
    }
    this.float(`¡NUBE DE PROYECTILES · ${shots.length}!`, col); this.shake = Math.max(this.shake, .25); this.onSound("event"); this.burst(e.x, e.y, e.z + .8, col, 24);
  }
  fireVolley(w: Item, prof: RangedProfile, mult: number, precision: boolean) {
    if (!canUseWeapon(w, this.level)) return;
    const tremor = this.sanityFx?.fx === "tremor" ? .09 : 0, range = shotRange(w.base.range);
    const steady = this.crouching ? .6 : 1;
    const jitter = ((this.aiming ? .001 : .006) + (prof.pellets === 1 ? prof.spread * (this.aiming ? .2 : .5) : 0)) * steady;
    const assist = this.assistTarget(range);
    const baseAng = assist ? assist.ang : this.ang, basePitch = assist ? assist.pitch : this.pitch;
    for (const off of volleyOffsets(prof, this.aiming)) {
      const a = baseAng + off + (Math.random() - .5) * (prof.pellets > 1 ? (this.aiming ? .04 : .07) * steady : jitter) + (Math.random() - .5) * tremor * 2;
      const pitch = basePitch + (Math.random() - .5) * (tremor + (prof.pellets > 1 ? .07 : 0));
      const spd = prof.speed * (prof.pellets > 1 ? .9 + Math.random() * .2 : 1);
      this.projs.push({ x: this.px, y: this.py, z: .5 + this.pz - (this.crouching ? .22 : 0), dz: Math.sin(pitch) * spd, dx: Math.cos(a) * Math.cos(pitch) * spd, dy: Math.sin(a) * Math.cos(pitch) * spd, life: range / spd, dmg: 0, friendly: true, color: w.base.color, pierce: prof.pierce || this.has("eco") || this.cls.id === "resonante", weapon: w, attackMult: mult * prof.damageMult, precision, hitIds: new Set(), sprite: prof.sprite, size: prof.size, bounces: Math.max(RICOCHET.bounces, prof.bounces), wave: prof.wave, falloff: prof.falloff, ox: this.px, oy: this.py, range });
    }
  }
  /** Repara estado inválido (NaN/infinitos) que puede dejar una muerte o explosión y que congelaba la partida. */
  stuckT = 0; stuckX = 0; stuckY = 0;
  /** Si el jugador intenta moverse y no avanza ~0.7 s, lo libera hacia el hueco libre más cercano. */
  unstickPlayer(dt: number, wantsMove: boolean) {
    if (!wantsMove || this.sitting || this.shieldEnemy && this.shieldEnemy.dead) { this.stuckT = 0; this.stuckX = this.px; this.stuckY = this.py; if (this.shieldEnemy?.dead) { this.shieldEnemy.grabbed = false; this.shieldEnemy = null; } return; }
    if (Math.hypot(this.px - this.stuckX, this.py - this.stuckY) > .08) { this.stuckT = 0; this.stuckX = this.px; this.stuckY = this.py; return; }
    this.stuckT += dt; if (this.stuckT < .7) return;
    this.stuckT = 0;
    if (this.canMoveActor(this.px, this.py, this.pz, BODY_RADIUS)) { const probes = [0, 1, 2, 3, 4, 5, 6, 7].filter(k => { const a = k / 8 * Math.PI * 2; return this.canMoveActor(this.px + Math.cos(a) * .12, this.py + Math.sin(a) * .12, this.pz, BODY_RADIUS); }).length; if (probes > 0) return; }
    for (let r = .15; r <= 2; r += .15) for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, x = this.px + Math.cos(a) * r, y = this.py + Math.sin(a) * r, z = Math.max(this.pz, this.floorHeight(x, y));
      if (this.canMoveActor(x, y, z, BODY_RADIUS)) { this.px = x; this.py = y; this.pz = z; this.vx = this.vy = 0; this.stuckX = x; this.stuckY = y; return; } }
  }
  sanitize() {
    const ok = (n: unknown) => typeof n === "number" && Number.isFinite(n);
    if (!ok(this.px) || !ok(this.py)) { this.px = this.safeX; this.py = this.safeY; }
    for (const k of ["pz", "vx", "vy", "vz", "pitch", "shake", "slowmo", "attackCd", "swingT", "chargeT", "aimT"] as const) if (!ok(this[k])) (this as Record<string, unknown>)[k] = 0;
    if (!ok(this.ang)) this.ang = 0;
    if (!ok(this.hp)) this.hp = 1;
    this.enemies = this.enemies.filter(e => ok(e.x) && ok(e.y)); for (const e of this.enemies) if (e.z !== undefined && !ok(e.z)) e.z = 0;
    for (const e of this.enemies) { if (e.kx !== undefined && !ok(e.kx)) e.kx = 0; if (e.ky !== undefined && !ok(e.ky)) e.ky = 0; if (e.vz !== undefined && !ok(e.vz)) e.vz = 0; }
    this.projs = this.projs.filter(p => ok(p.x) && ok(p.y));
    if (this.parts.some(p => !ok(p.x) || !ok(p.y))) this.parts = this.parts.filter(p => ok(p.x) && ok(p.y));
  }
  /** Disparo levemente asistido en pantallas táctiles: el enemigo visible más cercano dentro de un cono estrecho hacia donde mira el jugador. */
  touchAssist = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  /** Las cámaras externas (no primera persona) siempre tienen apuntado asistido leve. */
  get aimAssistOn() { return this.touchAssist || this.camera.mode !== "fp"; }
  assistTarget(range = 14, wide = this.camera.mode !== "fp" ? 1.35 : 1): { e: Enemy; ang: number; pitch: number } | null {
    if (!this.aimAssistOn) return null;
    let best: { e: Enemy; ang: number; pitch: number } | null = null, bestScore = Infinity;
    for (const e of this.enemies) {
      if (e.dead || e.grabbed) continue;
      const dx = e.x - this.px, dy = e.y - this.py, d = Math.hypot(dx, dy); if (d > range || d < .3) continue;
      const ang = Math.atan2(dy, dx), off = Math.abs(Math.atan2(Math.sin(ang - this.ang), Math.cos(ang - this.ang)));
      if (off > (d < 3 ? .42 : .24) * wide) continue;
      if (!this.los(this.px, this.py, e.x, e.y, this.pz + .5, e.z + .5)) continue;
      const score = off * 6 + d * .15; if (score < bestScore) { bestScore = score; best = { e, ang, pitch: Math.atan2(e.z + .45 - (this.pz + .5), d) }; }
    }
    return best;
  }
  waves: { x: number; y: number; z: number; t: number; r: number }[] = [];
  shockwave(p: Proj, skip?: Enemy) {
    const r = p.wave || 1.5; this.burst(p.x, p.y, p.z, "#d77aff", 22); this.shake = Math.max(this.shake, .15); this.waves.push({ x: p.x, y: p.y, z: p.z, t: 0, r });
    for (const o of this.enemies) if (!o.dead && o !== skip && Math.hypot(o.x - p.x, o.y - p.y) < r && Math.abs(o.z + .5 - p.z) < 1.2) { this.attackEnemy(o, p.weapon ?? this.ranged, (p.attackMult ?? 1) * .5, { noRoll: true }); const a = Math.atan2(o.y - p.y, o.x - p.x); this.launch(o, a, 5); }
  }
  updateSanity(dt: number) {
    if (this.lastHp && this.hp < this.lastHp - .5) this.bumpSanity("hurt"); this.lastHp = this.hp;
    if (this.pacts.length > this.lastPactCount) this.bumpSanity("pact"); this.lastPactCount = this.pacts.length;
    for (const ph of this.phantoms) ph.t -= dt;
    this.phantoms = this.phantoms.filter((ph) => ph.t > 0 && Math.hypot(ph.x - this.px, ph.y - this.py) > 2.6);
    for (const w of this.waves) w.t += dt; this.waves = this.waves.filter((w) => w.t < .45);
    if (this.sanityFx) { this.sanityFx.t -= dt; if (this.sanityFx.fx === "shake" && Math.random() < dt * 3) this.shake = Math.max(this.shake, .18); if (this.sanityFx.t <= 0) this.sanityFx = null; return; }
    if (this.isSafe()) return;
    this.sanityRollT -= dt; if (this.sanityRollT > 0) return; this.sanityRollT = 1;
    try { localStorage.setItem("ars_anima_sanity", this.sanity.toFixed(2)); } catch { /* storage unavailable */ }
    if (Math.random() >= sanityChance(this.sanity)) return;
    const fx = SANITY_FX[Math.floor(Math.random() * SANITY_FX.length)];
    this.sanityFx = { fx, t: 4 + Math.random() * 5 };
    if (fx === "vision") {
      const kinds = Object.keys(this.sprites).filter((k) => ENEMY_TYPES[k]);
      for (let i = 0; i < 1 + Math.floor(Math.random() * 3); i++) {
        const a = this.ang + (Math.random() - .5) * 1.1, d = 4 + Math.random() * 5, x = this.px + Math.cos(a) * d, y = this.py + Math.sin(a) * d;
        if (kinds.length && !this.solid(x, y, .1) && this.los(this.px, this.py, x, y, this.pz + .5, .5)) this.phantoms.push({ x, y, kind: kinds[Math.floor(Math.random() * kinds.length)], t: 12 });
      }
    }
  }
  updateProjs(dt: number) {
    for (const fx of this.explosions) fx.t += dt;
    this.explosions = this.explosions.filter(fx => fx.t < EXPLOSION_DURATION);
    for (const p of this.projs) {
      p.hitIds ??= new Set();
      p.bounces ??= RICOCHET.bounces;
      if (p.friendly && p.weapon && !canUseWeapon(p.weapon, this.level)) { p.life = 0; continue; }
      if(!p.friendly && this.isSafe(p.x,p.y)) {p.life=0;continue;}
      const x0 = p.x, y0 = p.y, z0 = p.z;
      p.life -= dt; p.z += (p.dz ?? 0)*dt; const moved=this.sweep(p.x,p.y,p.z,p.dx*dt,p.dy*dt,.025);p.x=moved.x;p.y=moved.y;
      if (p.lob) p.dz = (p.dz ?? 0) - ROLES.gravity * dt; else if (p.bomb) { p.z -= dt * 1.2; }
      if (p.cloud) { // nube de jefe: rebota contra suelo, techo y paredes
        const fh = this.floorHeight(p.x, p.y);
        if (p.z < fh + .08) { p.z = fh + .08; p.dz = Math.abs(p.dz ?? 0); }
        if (p.z > ROLES.ceiling) { p.z = ROLES.ceiling; p.dz = -Math.abs(p.dz ?? 0); }
        if (moved.hit || this.solid(p.x, p.y, p.z, .02)) {
          const hx = this.solid(x0 + p.dx * dt, y0, p.z, .02), hy = this.solid(x0, y0 + p.dy * dt, p.z, .02);
          if (hx || !hy) p.dx = -p.dx; if (hy || !hx) p.dy = -p.dy; p.x = x0; p.y = y0;
          p.bounces = (p.bounces ?? 1) - 1; if (p.bounces < 0) p.life = 0; continue;
        }
      }
      if (p.sprite === "orb" && Math.random() < .6 && Math.hypot(p.x - this.px, p.y - this.py) > 1.6) this.parts.push({ x: p.x, y: p.y, z: p.z, vx: (Math.random() - .5), vy: (Math.random() - .5), vz: .5, life: .35, color: Math.random() < .5 ? "#d77aff" : "#ff7ad9", size: .02 });
      // Check the entire travelled volume before wall/bounce responses, not only the endpoint.
      const steps = Math.max(1, Math.ceil(Math.hypot(p.x - x0, p.y - y0, p.z - z0) / .08));
      let hitKeg = false;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, x = x0 + (p.x - x0) * t, y = y0 + (p.y - y0) * t, z = z0 + (p.z - z0) * t;
        if (this.solid(x, y, z, .02)) break;
        // An ordinary shot is absorbed by the first body, before reaching a barrel behind it.
        if (!p.bomb && !p.pierce && (p.friendly
          ? this.enemies.some(e => !e.dead && !e.grabbed && !p.hitIds?.has(e.id) && Math.abs(e.z + .5 - z) < .75 && Math.hypot(e.x - x, e.y - y) < this.actorRadius(e) + .2 + (p.size ?? 0) * .4)
          : projectileHitsPlayer(this.lowProfile, this.pz, z, Math.hypot(this.px - x, this.py - y), Math.min(.08, (p.size ?? .1) * .4)))) break;
        const keg = this.pickups.find(k => !k.used && k.kind === "decor" && k.deco === "powder" && Math.hypot(k.x - x, k.y - y) < .45 && z >= this.floorHeight(k.x, k.y) && z <= this.floorHeight(k.x, k.y) + .8);
        if (keg) { p.x = x; p.y = y; p.z = z; this.detonateKeg(keg); p.life = 0; hitKeg = true; break; }
      }
      if (hitKeg) continue;
      const floorHit = !p.bomb && !p.cloud && p.z < this.floorHeight(p.x, p.y) + .02;
      const ceilingHit = !p.bomb && !p.cloud && p.z > ROLES.ceiling;
      if (moved.hit || floorHit || ceilingHit || this.solid(p.x, p.y,p.z,.02) || (p.bomb && p.z <= (p.lob ? this.floorHeight(p.x, p.y) : 0))) {
        if (p.bomb) this.explode(p.x - p.dx * dt, p.y - p.dy * dt, p.blast ?? (p.friendly ? 2.8 : ROLES.lobRadius), p.dmg, p.friendly);
        else if ((p.bounces ?? 0) > 0) {
          if ((floorHit || ceilingHit) && !moved.hit) { p.dz = (ceilingHit ? -1 : 1) * Math.abs(p.dz ?? 0) * RICOCHET.restitution; p.z = ceilingHit ? ROLES.ceiling - .02 : this.floorHeight(p.x, p.y) + .04; }
          else { const hx = this.solid(x0 + p.dx * dt, y0, p.z, .02), hy = this.solid(x0, y0 + p.dy * dt, p.z, .02); if (hx || !hy) p.dx *= -RICOCHET.restitution; if (hy || !hx) p.dy *= -RICOCHET.restitution; p.x = x0; p.y = y0; }
          p.bounces -= 1; p.dmg *= RICOCHET.damageKeep; p.attackMult = (p.attackMult ?? 1) * RICOCHET.damageKeep; this.burst(p.x, p.y, p.z, "#ffcf7a", 2); continue;
        } else { if (p.wave) this.shockwave(p); this.burst(p.x - p.dx * dt, p.y - p.dy * dt, p.z, p.color, 5); this.environmentImpact(p.x,p.y,p.z); if (p.friendly && !p.wave && (p.sprite === "bullet" || p.sprite === "pellet")) this.bulletMark(p.x - p.dx * dt * .5, p.y - p.dy * dt * .5, p.z); }
        p.life = 0; continue;
      }
      // Swept segment test so fast shots cannot tunnel through bodies between frames.
      const sx = p.x - x0, sy = p.y - y0, l2 = sx * sx + sy * sy || 1e-6;
      const segDist = (ex: number, ey: number) => { const t = Math.max(0, Math.min(1, ((ex - x0) * sx + (ey - y0) * sy) / l2)); return Math.hypot(x0 + sx * t - ex, y0 + sy * t - ey); };
      if (p.friendly) {
        for (const e of [...this.enemies].sort((a,b) => Math.hypot(a.x-x0,a.y-y0)-Math.hypot(b.x-x0,b.y-y0))) if (!e.dead && !e.grabbed && segmentContact(x0,y0,z0,p.x,p.y,p.z,e.x,e.y,e.z+.5,this.actorRadius(e)+.2+(p.size ?? 0)*.4,.75) !== null) {
          if (p.bomb) { this.explode(p.x, p.y, p.blast ?? 2.8, p.dmg, true); p.life = 0; break; }
          if(p.hitIds?.has(e.id))continue; p.hitIds?.add(e.id);
          const fall = p.falloff ? falloffMult(Math.hypot(p.x - (p.ox ?? p.x), p.y - (p.oy ?? p.y)), p.range ?? 8) : 1;
          if (p.weapon) this.attackEnemy(e, p.weapon, (p.attackMult ?? 1) * fall, {precision:p.precision});
          else this.damageEnemy(e, p.dmg, 3);
          const sp = Math.hypot(p.dx, p.dy) || 1, push = p.sprite === "arrow" ? 2.2 : p.sprite === "pellet" ? 1.4 * fall : p.sprite === "orb" ? 3 : .8; e.kx += p.dx / sp * push; e.ky += p.dy / sp * push;
          if (p.wave) this.shockwave(p, e); else this.meleeFx(p.x, p.y, p.z, "pierce", Math.atan2(p.dy, p.dx), 5);
          if (!p.pierce) { if (p.bounces > 0) { p.bounces--; this.onSound("ricochet"); p.dx *= -RICOCHET.restitution; p.dy *= -RICOCHET.restitution; p.dmg *= RICOCHET.damageKeep; p.attackMult = (p.attackMult ?? 1) * RICOCHET.damageKeep; p.x = x0; p.y = y0; p.z = z0; } else p.life = 0; break; }
        }
      } else {
        const victim = [...this.enemies].filter(e => !e.dead && !e.grabbed && e.id !== p.ownerId && !p.hitIds.has(e.id) && segmentContact(x0,y0,z0,p.x,p.y,p.z,e.x,e.y,e.z+.5,this.actorRadius(e)+.15,.7) !== null).sort((a,b) => Math.hypot(a.x-x0,a.y-y0)-Math.hypot(b.x-x0,b.y-y0))[0];
        if (victim && segDist(this.px,this.py) > BODY_RADIUS) { p.hitIds.add(victim.id); if (p.bomb) { this.explode(p.x,p.y,ROLES.lobRadius,p.dmg,false); p.life=0; } else { this.damageEnemy(victim,p.dmg,3); if (p.bounces > 0) { p.bounces--; this.onSound("ricochet"); p.dx *= -RICOCHET.restitution; p.dy *= -RICOCHET.restitution; p.dmg *= RICOCHET.damageKeep; p.x=x0; p.y=y0; p.z=z0; } else p.life=0; } continue; }
        if (this.shieldEnemy && segDist(this.shieldEnemy.x, this.shieldEnemy.y) < 0.5) { this.shieldEnemy.hp -= p.dmg; p.life = 0; if (this.shieldEnemy.hp <= 0) this.killEnemy(this.shieldEnemy); continue; }
        if (sweptProjectileHits(this.lowProfile, this.pz, this.bodyH(), x0, y0, z0, p.x, p.y, p.z, this.px, this.py, Math.min(.08, (p.size ?? .1) * .4))) { if (p.bomb) this.explode(p.x, p.y, ROLES.lobRadius, p.dmg, false); else this.hurtPlayer(p.dmg, p.cloud ? "nube de proyectiles" : "proyectil", false, { x: p.x - p.dx, y: p.y - p.dy }, p.z); if (p.color === "#5f5") this.poison = 6; p.life = 0; }
      }
    }
    this.projs = this.projs.filter((p) => p.life > 0);
  }

  updateWorld(dt: number) {
    if (!this.visitedZones.has(this.zoneAt()) && this.zoneAt() !== 'Pasadizo') {
      this.track('rooms', 1, this.zoneAt(), {}, `room-${this.zoneAt()}`);

    }
    if (this.chronicleZone && this.chronicleZone !== this.zoneAt() && this.enemies.some(e => !e.dead && !e.aware && this.zoneAt(e.x,e.y) === this.chronicleZone) && !this.enemies.some(e => e.aware && this.zoneAt(e.x,e.y) === this.chronicleZone)) this.track('evaded', 1, 'abandonar una sala con enemigos sin ser detectado', {}, `evaded-${this.chronicleZone}`);
    this.chronicleZone = this.zoneAt();
    this.visitedZones.add(this.zoneAt());
    this.updateRest();
    if(this.raid) { this.raid.timer-=dt; if(this.raid.timer<=0) { const raid=this.raid;let spawned=0;const kinds=regionEnemies(this.floor);for(let i=0;i<4+Math.min(4,this.floor);i++)if(kinds.length && this.enemies.filter(e=>!e.dead).length<60 && this.tacticalSpawn(pick(kinds),raid.room,2.5))spawned++; raid.wave++;raid.remaining--;raid.timer=7;this.msg(`RAID · oleada ${raid.wave}/3 · ${spawned} criaturas`);this.onSound("event");if(raid.remaining<=0)this.raid=null; } }
    if (this.region.id === "garden") { this.sanctuaryT = Math.max(0, this.sanctuaryT - dt); if (this.sanctuaryT === 0 && this.weather !== 2) { this.weather = 2; this.pickups.forEach(p => { if (p.kind === "sanctuary") p.used = true; }); this.msg("AMANECER: el refugio desaparece entre la niebla."); } }
    if (this.needSpread) { this.needSpread = false; this.spreadPickups(); }
    if (!this.mapDone) { const main = this.zones.filter(z => !/secreta|Bóveda/.test(z.name)); if (main.length && main.filter(z => this.visitedZones.has(z.name)).length >= main.length * .9) { this.mapDone = true; this.track("maps", 1, "completar el mapa", {}, "map-complete"); this.score.gain("map"); this.float("¡MAPA COMPLETO!", "#ffd34a"); } }
    { const z = this.zoneAt(); if (/secreta|Bóveda/.test(z) && !this.secretSeen.has(z)) { this.secretSeen.add(z); this.track("secrets", 1, z, {}, `secret-${z}`); this.score.gain("secret"); this.float("¡SECRETO DESCUBIERTO!", "#ffd34a"); } }
    const near0 = this.focusPickup(); const near = near0 && near0.deco !== "powder" ? near0 : null;
    this.interactionPrompt = near ? ({ note:"Leer documento (contiene un código)", cipherlock: "Relicario sellado · introducir combinación", mapfrag: "Recoger fragmento de mapa", palimpsest: "Inspeccionar libro antiguo (PALIMPSESTOS · opcional)", folio: "Recoger folio suelto (PALIMPSESTOS)", portal: this.collapse ? `EXTRAER · ${Math.ceil(this.collapse.t)}s` : "Cruzar el umbral", shop: "Hablar con el mercader", chest: near.locked ? (this.keys > 0 ? "Abrir con llave" : `Forzar cerradura (CD 12 · ganzúa ${this.legacy.lockLvl})`) : "Abrir cofre", trap: "Desarmar trampa", altar: "Escuchar pacto", pactstone: "Leer sello de pacto (pro · contra · activación)", lore: this.region.item, sanctuary: "Descansar junto a la rosa" }[near.kind] ?? (this.isBench(near) ? (this.sitting ? "Levantarse" : "Sentarse en la banca (recupera lumbre)") : "")) : "";
    if (this.exposedNear()) this.interactionPrompt = "Enemigo expuesto: E robar equipo · patada final";
    if (!this.interactionPrompt && near0?.deco === "powder") this.interactionPrompt = "Robar pólvora (bombas)";
    { const fx = this.px + Math.cos(this.ang) * 0.9, fy = this.py + Math.sin(this.ang) * 0.9, fc = this.cell(fx, fy);
      if (!this.interactionPrompt && fc === 6) this.interactionPrompt = this.seals[Math.floor(fy)*MAP+Math.floor(fx)] ? this.sealLabel(this.seals[Math.floor(fy)*MAP+Math.floor(fx)]) : "Abrir puerta · o golpéala para reventarla";
      if (!this.interactionPrompt && fc !== 6) { const f2x = this.px + Math.cos(this.ang) * 1.8, f2y = this.py + Math.sin(this.ang) * 1.8; if (this.cell(f2x, f2y) === 6) this.interactionPrompt = this.seals[Math.floor(f2y)*MAP+Math.floor(f2x)] ? `Puerta sellada · ${this.sealLabel(this.seals[Math.floor(f2y)*MAP+Math.floor(f2x)])}` : "Puerta cerca · acércate y pulsa E, o golpéala para reventarla"; }
      if (!this.interactionPrompt && fc === 3) this.interactionPrompt = this.keys > 0 ? "Usar llave de hueso" : `Forzar mecanismo (CD 15 · riesgo)`;
      const back = this.enemies.find(e => !e.dead && !e.aware && !e.stolen && Math.hypot(e.x - this.px, e.y - this.py) < 1.5);
      if (back) this.interactionPrompt = "Robar equipo (por la espalda)"; }
    // pickups
    for (const p of this.pickups) {
      p.bob += dt;
      if (p.used) continue;
      const dist = Math.hypot(p.x - this.px, p.y - this.py);
      if (p.kind === "trap" && p.armed && dist < 0.5 && this.pz < 0.2) { p.armed = false; p.used = true; this.hurtPlayer(10 + this.floor * 2, "trampa"); this.msg("¡Trampa de púas! (salta sobre las marcas rojas o desármalas con E)"); this.wounds.PIERNA = 20; }
      if (Math.abs(this.pz-this.floorHeight(p.x,p.y))<.8 && dist < 0.7 && ["item", "mat", "gold", "food", "water", "ammo", "key"].includes(p.kind)) {
        const weight = p.kind === 'item' && p.item ? itemWeight(p.item) : p.kind === 'mat' ? (p.n ?? 1) * (this.has('recolector') ? 2 : 1) * .25 : p.kind === 'food' ? 1 : p.kind === 'water' ? 1.5 : p.kind === 'ammo' ? .5 : p.kind === 'key' ? .2 : 0;
        if (!this.canCarry(weight)) { this.interactionPrompt = `Mochila llena · ${CARRY_LIMIT} de capacidad`; continue; }
        this.pickupAnimation = { t: PICKUP_DURATION, sprite: p.kind === "item" ? "relic" : p.kind };
        this.onSound("pickup"); p.used = true; this.track("items", 1, p.item?.name ?? p.kind); if (["mat","gold","ammo"].includes(p.kind)) this.track("resources", p.n ?? (p.kind === "ammo" ? 10 : 1), p.mat ?? p.kind); if (p.kind === "gold") this.score.gain("gold", 1 + Math.floor((p.n ?? 5) / 10)); else this.score.gain("pickup");
        if (p.kind === "item" && p.item) { if (p.item.kind === 'consumable') { const id = p.item.id ?? p.item.name; this.cons[id] = (this.cons[id] ?? 0) + (p.item.qty ?? 1); } else { this.bag.push(p.item); if (p.item.kind === 'weapon') { this.foundWeapon(p.item); this.onSound(p.item.rarity >= 3 ? "lootEpic" : p.item.rarity >= 1 ? "lootRare" : "loot"); } } this.float(`${p.item.name}`, ["#c9c3d6", "#5aa7ff", "#ffd34a", "#c35bff", "#ff6a2a"][p.item.rarity]); }
        if (p.kind === "mat") { this.onSound("resource", p.mat); this.questEvent("collect"); const n = (p.n ?? 1) * (this.has("recolector") ? 2 : 1); this.mats[p.mat!] = (this.mats[p.mat!] ?? 0) + n; this.float(`+${n} ${MATERIALS[p.mat!]}`, "#9f9"); }
        if (p.kind === "gold") { this.onSound("coin"); this.gold += p.n ?? 5; this.float(`+${p.n} fichas`, "#ffd34a"); }
        if (p.kind === "food") { this.onSound("resource", "food"); this.cons.racion++; this.float("+Ración", "#fc8"); }
        if (p.kind === "water") { this.onSound("resource", "water"); this.cons.agua++; this.float("+Agua", "#8cf"); }
        if (p.kind === "ammo") { this.ammo += 10; this.float("+10 munición", "#fc8"); }
        if (p.kind === "key") { this.keys++; this.float("+Llave de hueso — busca el muro dorado", "#ffd34a"); }
      }
    }
    this.pickups = this.pickups.filter((p) => !p.used || p.kind === "chest" || p.kind === "trap" || p.kind === "altar");
    // clima
    this.weatherT -= dt;
    if (this.weatherT <= 0 && this.region.id !== "garden") {
      this.weather = Math.random() < 0.35 ? 0 : ri(1, WEATHERS.length - 1); this.weatherT = rnd(35, 60);
      const a = rnd(0, Math.PI * 2), s = this.weather === 3 ? 2.2 : this.weather === 5 ? 1.6 : 0;
      this.wind = { x: Math.cos(a) * s, y: Math.sin(a) * s };
      if (this.weather) this.msg(`Clima: ${WEATHERS[this.weather]}`);
    }
    if (!this.isSafe() && this.weather === 2 && this.cls.id !== "alquimista" && Math.random() < dt * 0.15) { this.poison = Math.max(this.poison, 3); }
    if (this.weather === 3 && Math.random() < dt * 0.2) { const a = rnd(0, Math.PI * 2); this.wind = { x: Math.cos(a) * 2.2, y: Math.sin(a) * 2.2 }; }
    // eventos aleatorios
    this.eventT -= dt;
    if (this.eventT <= 0 && !this.isSafe()) { this.eventT = rnd(30, 55); this.triggerEvent(); }
    if (this.eventLeft > 0) { this.eventLeft -= dt; if (this.eventLeft <= 0) { this.eventName = ""; this.darkness = 0; } }
    if (!this.isSafe() && this.eventName === "GRITO EN LA OSCURIDAD") { this.mh = Math.max(0, this.mh - dt * 1.4); if (Math.random() < dt * (this.mh < this.mhMax * .3 ? .55 : .25)) { this.terror(3); this.shake = 0.3; } }
    if (this.eventName === "TEMBLOR") this.shake = Math.max(this.shake, 0.08);
    // escombros
    if ((this.eventName === "DERRUMBE" || this.eventName === "TEMBLOR") && Math.random() < dt * 2) {
      const x = this.px + rnd(-4, 4), y = this.py + rnd(-4, 4); if (!this.solid(x, y)) this.debris.push({ x, y, t: 1.2 });
    }
    for (const d of this.debris) { const previousT = d.t; d.t -= dt; const box = playerHitbox(this.crouching || this.slideT > 0); if (fallingRubbleHits(d, previousT, { x: this.px, y: this.py, z: this.pz, height: box.height, radius: box.radius }, this.floorHeight(d.x, d.y))) { d.hit = true; this.hurtPlayer(9, "escombros"); } if (d.t <= 0) { this.onSound("rubble"); this.burst(d.x, d.y, 0.2, "#777", 10); if (!d.hit && Math.hypot(d.x - this.px, d.y - this.py) < 0.8 && this.dashT <= 0) this.hurtPlayer(9, "escombros"); for (const e of this.enemies) if (Math.hypot(d.x - e.x, d.y - e.y) < 0.8) this.damageEnemy(e, 15, 5); } }
    this.debris = this.debris.filter((d) => d.t > 0);
    // reto
    if (this.challenge) {
      this.challenge.t -= dt;
      if (this.challenge.kills >= this.challenge.goal) { this.msg(`¡Reto superado! ${this.challenge.name}`); this.track("objectives", 1, "misión cumplida"); this.score.gain("mission"); this.gainXp(80, "retos"); this.pickups.push({ x: this.px + Math.cos(this.ang), y: this.py + Math.sin(this.ang), kind: "item", item: this.makeWeapon(undefined, ri(2, 3)), bob: 0 }); this.challenge = null; }
      else if (this.challenge.t <= 0) { this.msg("Reto fallido."); this.track("objectiveFails", 1, "objetivo expirado"); this.score.add("missionFail", -PENALTY.missionFail); this.challenge = null; }
    }
  }

  triggerEvent() {
    if (this.region.id === "garden" || this.isSafe()) return;
    this.onSound("event"); const ev = pick(EVENTS); this.eventName = ev; this.eventLeft = 15; this.msg(`EVENTO: ${ev}`);
    if (ev === "RAID DE LOS DESHILADOS" && !this.collapse) {
      this.beginRaid();
      this.challenge = { goal: 8, kills: 0, t: 30, name: "Resiste la invasión" };
    } else if (ev === "DADOS ETERNOS") { this.challenge = { goal: 3, kills: 0, t: 15, name: "Mata 3 en 15s" }; }
    else if (ev === "MAREA DE AETHRYON") { this.lumbre = this.lumbreMax; this.float("LUMBRE RESTAURADA", "#b5f"); }
    else if (ev === "GRITO EN LA OSCURIDAD") { this.darkness = 0.75; this.terror(4); }
    else if (ev === "COFRE ERRANTE") { const x = this.px + Math.cos(this.ang) * 2, y = this.py + Math.sin(this.ang) * 2; if (!this.solid(x, y)) this.pickups.push({ x, y, kind: "chest", bob: 0 }); }
    else if (ev === "MERCADER ERRANTE") this.spawnWanderingMerchant();
  }

  updateSurvival(dt: number) {
    for (const k in this.doorAnim) { const i = +k; this.doorAnim[i] += dt * (this.doorSpd[i] ?? 0.55); if (this.doorAnim[i] >= 1) { this.map[i] = 0; delete this.doorAnim[i]; delete this.doorSpd[i]; } }
    const classResist = this.cls.id === "peregrino" ? .72 : isPariah(this.cls.id) ? PARIAH.needs : 1;
    const hungerRate = (this.has("recolector") ? 0.6 : 1) * (this.hasP("hambre") && !isPariah(this.cls.id) ? 2 : 1) * (this.weather === 5 ? 1.4 : 1) * classResist;
    const tTarget = [55, 72, 45, 32, 40, 86, 28][this.weather] ?? 50;
    this.temp += (tTarget - this.temp) * Math.min(1, dt * 0.08);
    if (this.contract && !this.contract.done) { this.contract.t -= dt; if (this.contract.kills >= this.contract.goal) { this.contract.done = true; this.track("objectives", 1, "misión cumplida"); this.score.gain("mission"); this.msg(`CONTRATO CUMPLIDO: ${this.contract.name}`); this.gold += 60 * this.floor; this.gainXp(120 * this.floor); this.onSound("pickup"); } else if (this.contract.t <= 0) { this.msg("Contrato expirado."); this.track("objectiveFails", 1, "objetivo expirado"); this.score.add("missionFail", -PENALTY.missionFail); this.contract = null; } }
    const thirstRate = (this.alterationAt()?.id==="ash"?1.5:1)*(this.temp > 75 ? 1.5 : 1) * (this.hasP("ceniza") && !isPariah(this.cls.id) ? 2 : 1) * (this.weather === 5 || this.weather === 1 ? 1.5 : 1) * classResist;
    this.food = Math.max(0, this.food - dt * NEEDS.foodPerSec * hungerRate);
    this.thirst = Math.max(0, this.thirst - dt * NEEDS.thirstPerSec * thirstRate);
    // sin ser molesto: con comida/sed altas regeneras, a 0 pierdes poco a poco pero nunca mata
    if (this.food > 60 && this.thirst > 60) this.heal(dt * 0.6);
    this.vendorTalkCd = Math.max(0, this.vendorTalkCd - dt);
    if (this.mirrorBuff) { this.mirrorBuff.t -= dt; if (this.mirrorBuff.t <= 0) { this.mirrorBuff = null; this.float("EL REFLEJO SE DESVANECE", "#c9e6ff"); } }
    const safe = this.isSafe();
    if (this.sitting) { this.restoreLumbre(dt * LUMBRE_REGEN.bench); this.fatigue = Math.max(0, this.fatigue - dt * 20); }
    else if (safe && this.stillT > 1.5) { this.restoreLumbre(dt * LUMBRE_REGEN.still); this.fatigue = Math.max(0, this.fatigue - dt * 6); }
    else if (!safe) this.fatigue = Math.min(NEEDS.fatigueLimit, this.fatigue + dt * NEEDS.fatiguePerSec);
    const need = this.needFx();
    this.needBlur = Math.max(0, this.needBlur - dt);
    if (need.active && !safe) { this.needEpisodeT -= dt; if (this.needEpisodeT <= 0) { this.needEpisodeT = rnd(NEEDS.episodeEvery[0], NEEDS.episodeEvery[1]); this.needBlur = NEEDS.episodeLength; this.float(this.fatigue >= NEEDS.fatigueLimit ? "AGOTADO · busca una banca" : "HAMBRE Y SED · la vista se nubla", "#c9a26a"); } }
    else this.needEpisodeT = Math.max(this.needEpisodeT, 8);
    for (const [k, v, name, fix] of [["food", this.food, "HAMBRE", "come una ración"], ["thirst", this.thirst, "SED", "bebe agua"]] as const) {
      const prev = this.needWarn[k];
      for (const th of [40, 20, 0]) if (prev > th && v <= th) { const txt = th === 0 ? `¡${name} TOTAL! Te mueves y golpeas más débil · ${fix}` : th === 20 ? `${name} SEVERA · ${fix} pronto` : `Empiezas a tener ${name.toLowerCase()} · ${fix}`; this.float(txt, th === 0 ? "#ff5a4a" : "#ffb347"); this.msg(txt); }
      this.needWarn[k] = v;
    }
    if (this.mode === "play") this.score.tick(dt, this.food, this.thirst);
    this.merchantCd = Math.max(0, this.merchantCd - dt);
    if (this.burn > 0) { this.burn -= dt; if(!this.isSafe()){ this.hp -= dt * 3; this.dotHurt("fuego", dt); } if (this.hp <= 0) this.die(); }
    if (this.poison > 0) { this.poison -= dt; if(!this.isSafe()){ this.hp = Math.max(1, this.hp - dt * 1.5); this.dotHurt("veneno", dt); } }
    if (this.bleed > 0) { this.bleed -= dt; if(!this.isSafe()){ this.hp = Math.max(1, this.hp - dt * 1); this.dotHurt("sangrado", dt); } }
    for (const k of Object.keys(this.wounds)) { this.wounds[k] -= dt; if (this.wounds[k] <= 0) delete this.wounds[k]; }
    // Lumbre no se regenera por tiempo ni por una poción común: memoria, emoción, oasis y reliquias la alimentan.
  }

  // ---------- render ----------
  loadTex(img: HTMLImageElement): Uint32Array {
    const c = document.createElement("canvas"); c.width = TEX; c.height = TEX; const x = c.getContext("2d")!;
    x.drawImage(img, 0, 0, img.width / 2, img.height / 2, 0, 0, TEX, TEX);
    return new Uint32Array(x.getImageData(0, 0, TEX, TEX).data.buffer.slice(0));
  }

  sway = { phase: 0, amount: 0 };
  swayLast = 0;
  camera: CameraSettings = loadCamera();
  worldReticle: { x:number; y:number; enemy:boolean } | null = null;
  /** Ejes de la cámara 3D en el suelo (adelante/derecha de la pantalla). */
  viewBasis: { fx:number; fy:number; rx:number; ry:number } | null = null;
  setCamera(c: Partial<CameraSettings>) { this.camera = { ...this.camera, ...c }; saveCamera(this.camera); }
  /** Jugador real mientras la cámara está desplazada (tercera persona). */
  camPlayer: { x: number; y: number; z: number; ang: number; camAng: number } | null = null;
  /** Fotograma del sprite del jugador según acción, dirección (cuerpo vs cámara) y mira. */
  /** Velocidad de marcha según entrada y estado (también la usa la predicción multijugador). */
  moveSpeed(inp: Pick<Input, "sprint" | "sneak">) {
    return this.skillMul("speed") * 3.6 * (inp.sprint && this.stam > 0 ? SPRINT_MULT : 1) * (inp.sneak ? .48 : 1) * (this.crouching ? .45 : 1) * (this.blocking ? .6 : 1) * (this.playerStagger > 0 ? .55 : 1) * (this.wounds.PIERNA ? 0.8 : 1) * (this.hasE("pies") ? 1.2 : 1) * this.frenzyFx().move * this.needFx().move * this.buff().move * classMods(this.cls.id, this.level).speed * this.subclassFx().speed * (isPariah(this.cls?.id) ? PX.moveFactor(this) : 1);
  }
  playerFrame(camAng: number) {
    if (!playerAtlas()) return null;
    const speed = Math.hypot(this.vx, this.vy), ranged = this.slot === 1;
    const action = pickAction({ speed, sprinting: speed > 3, dashing: this.dashT > 0, crouching: this.crouching, sliding: this.slideT > 0, swinging: this.swingT > 0, heavy: this.attackAlternate, ranged, aiming: this.aiming, airborne: this.pz > this.floorHeight() + .25, pounding: this.pounding });
    const facing = bodyFacing(this.ang, this.vx, this.vy, action), dir = spriteDir(facing, camAng);
    const cell = atlasCell(action, dir, this.time, speed);
    const forward = this.vx * Math.cos(facing) + this.vy * Math.sin(facing);
    const mo = spriteMotion(this.time, speed, forward, this.pitch); return { img: composeFrame(cell, mo, cell.flip), action, dir, tilt: mo.tiltX };
  }
  lastPlayerPose = { action: "idle", dir: "N" };
  render(ctx: CanvasRenderingContext2D) {
    const mode = this.camera.mode;
    if (mode === "top" || mode === "iso") { this.renderTop(ctx, mode === "iso"); return; }
    if (mode === "fp" || this.mode !== "play") { this.camPlayer = null; this.renderScene(ctx); return; }
    const s = { px: this.px, py: this.py, pz: this.pz, ang: this.ang, pitch: this.pitch };
    const dirX = Math.cos(this.ang), dirY = Math.sin(this.ang), dist = this.camera.distance;
    const front = mode === "front", lift = front ? .15 : .35, side = front ? 0 : .35;
    const tx = front ? dirX * dist : -dirX * dist - dirY * side, ty = front ? dirY * dist : -dirY * dist + dirX * side;
    let cx = s.px, cy = s.py; const camZ = .5 + s.pz + lift; const len = Math.hypot(tx, ty), steps = Math.ceil(len / .05);
    for (let i = 1; i <= steps; i++) { const nx = s.px + tx * i / steps, ny = s.py + ty * i / steps; if (this.solid(nx, ny, camZ - .3, .4) || this.solid(nx + .15, ny, camZ - .3, .4) || this.solid(nx - .15, ny, camZ - .3, .4) || this.solid(nx, ny + .15, camZ - .3, .4) || this.solid(nx, ny - .15, camZ - .3, .4)) break; cx = nx; cy = ny; }
    const camAng = front ? this.ang + Math.PI : this.ang;
    this.camPlayer = { x: s.px, y: s.py, z: s.pz + this.floorHeight(s.px, s.py) * 0, ang: s.ang, camAng };
    this.px = cx; this.py = cy; this.pz = s.pz + lift; this.ang = camAng; if (front) this.pitch = -s.pitch * .5;
    try { this.renderScene(ctx); } finally { this.px = s.px; this.py = s.py; this.pz = s.pz; this.ang = s.ang; this.pitch = s.pitch; this.camPlayer = null; }
  }
  /** Vista cenital / isométrica: plano 2D del nivel con los sprites de pie. */
  renderTop(ctx: CanvasRenderingContext2D, iso: boolean) {
    this.enemyLabels = []; this.barkLabels = []; this.gfxCam = null;
    const z = topZoom(this.camera.distance) * (iso ? .8 : 1), cx = W / 2, cy = H / 2 + (iso ? 10 : 0), rot = iso ? Math.PI / 4 : 0, sy = iso ? .55 : 1;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const toScreen = (x: number, y: number) => { const dx = (x - this.px) * z, dy = (y - this.py) * z; return { x: cx + dx * cr - dy * sr, y: cy + (dx * sr + dy * cr) * sy }; };
    const fogC = this.region.fog, fl = this.region.floor;
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.fillStyle = `rgb(${fogC[0] * .4},${fogC[1] * .4},${fogC[2] * .4})`; ctx.fillRect(0, 0, W, H);
    const R = Math.ceil(Math.hypot(W, H) / z / (iso ? .55 : 1)) + 2;
    const x0 = Math.max(0, Math.floor(this.px - R)), x1 = Math.min(MAP, Math.ceil(this.px + R)), y0 = Math.max(0, Math.floor(this.py - R)), y1 = Math.min(MAP, Math.ceil(this.py + R));
    ctx.setTransform(cr * z, sr * z * sy, -sr * z, cr * z * sy, cx - (this.px * cr - this.py * sr) * z, cy - (this.px * sr + this.py * cr) * z * sy);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const c = this.map[y * MAP + x], vol = cellVolume(c);
      if (vol && vol[0] === 0 && vol[1] >= 2) continue;
      const k = ((x + y) & 1) ? 1 : .86; const h = vol ? .7 : 1;
      ctx.fillStyle = c === 6 ? "#7a5a3a" : c === 11 ? "#5a3a20" : `rgb(${fl[0] * k * h | 0},${fl[1] * k * h | 0},${fl[2] * k * h | 0})`; ctx.fillRect(x, y, 1.02, 1.02);
    }
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const vol = cellVolume(this.map[y * MAP + x]); if (!vol || vol[0] !== 0 || vol[1] < 2) continue;
      const open = (ox: number, oy: number) => { const v = cellVolume(this.cell(x + ox, y + oy)); return !v || v[0] !== 0 || v[1] < 2; };
      if (!(open(1, 0) || open(-1, 0) || open(0, 1) || open(0, -1) || open(1, 1) || open(-1, -1) || open(1, -1) || open(-1, 1))) continue;
      ctx.fillStyle = `rgb(${fogC[0] * .55 + 30 | 0},${fogC[1] * .5 + 22 | 0},${fogC[2] * .5 + 22 | 0})`; ctx.fillRect(x, y, 1.02, 1.02);
      ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(x, y + .82, 1.02, .2); }
    if (this.arena) for (const r of this.arena.rubble) { ctx.fillStyle = `rgba(255,60,40,${.25 + .25 * Math.sin(this.time * 20)})`; ctx.beginPath(); ctx.arc(r.x, r.y, BOSS_ARENA.rubbleRadius, 0, 7); ctx.fill(); }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    type T = { y: number; draw: () => void }; const list: T[] = [];
    const upright = (img: CanvasImageSource | null | undefined, wx: number, wy: number, wz: number, hWorld: number, aspect: number, alpha = 1) => { if (!img) return; const p = toScreen(wx, wy); const h = hWorld * z * 1.5 * LEGIBILITY.overheadScale, w = h * aspect; if (p.x < -w || p.x > W + w || p.y < -h || p.y > H + h) return;
      list.push({ y: p.y, draw: () => { ctx.globalAlpha = .3; ctx.fillStyle = "#000"; ctx.beginPath(); ctx.ellipse(p.x, p.y, w * .35, w * .14, 0, 0, 7); ctx.fill(); ctx.globalAlpha = alpha; ctx.drawImage(img, p.x - w / 2, p.y - h - wz * z, w, h); ctx.globalAlpha = 1; } }); };
    for (const pk of this.pickups) { if (pk.used) continue; const p = toScreen(pk.x, pk.y); list.push({ y: p.y, draw: () => { ctx.fillStyle = pk.kind === "portal" ? "#7ad8ff" : pk.kind === "gold" ? "#ffd34a" : pk.kind === "chest" ? "#d79a4a" : pk.kind === "decor" ? "#6a5a4a" : "#e8d6b8"; ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); } }); }
    for (const e of this.enemies) { if (e.dead || e.ambush?.stage === "hidden") continue; const t = ENEMY_TYPES[e.kind]; const img = this.frame(e.kind, e.tele > 0 ? "attack" : e.aware ? "alert" : "idle", (this.time * 6) % 12) ?? this.sprites[e.kind] ?? this.sprites[t.sprite];
      if (img) upright(legible(img, enemyRim(e)), e.x, e.y, e.z, t.scale, img.width / img.height, e.hurt > 0 ? .6 : 1);
      const p = toScreen(e.x, e.y); const h = t.scale * z * 1.5 * LEGIBILITY.overheadScale; this.enemyLabels.push({ x: p.x, y: p.y - h - 4, w: Math.max(14, h * .5), depth: 1, hp: Math.max(0, e.hp / e.hpMax), brk: Math.max(0, e.brk / e.brkMax), name: "", state: "", elite: !!e.elite, boss: e.kind === "librero", miniBoss: !!e.miniBoss, tele: e.tele > 0, retreat: false, alert: false, notice: false }); }
    const pf = this.playerFrame(iso ? -3 * Math.PI / 4 : -Math.PI / 2); if (pf) this.lastPlayerPose = { action: pf.action, dir: pf.dir };
    if (pf?.img) upright(legible(pf.img, RIM.self, true), this.px, this.py, this.pz, PLAYER_SPRITE_SCALE * pf.img.height / CELL_H, pf.img.width / pf.img.height);
    else { const p = toScreen(this.px, this.py); list.push({ y: p.y, draw: () => { ctx.fillStyle = "#7ad8ff"; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, 7); ctx.fill(); } }); }
    for (const r of this.remotes) { if (r.state === "gone" || r.state === "extracted") continue; const img = remoteFrame(r, iso ? -3 * Math.PI / 4 : -Math.PI / 2, this.time + r.x * .37, this.floorHeight(r.x, r.y)); if (img) upright(legible(img, r.color, true), r.x, r.y, r.z, PLAYER_SPRITE_SCALE * img.height / CELL_H, img.width / img.height, r.state === "dead" ? .35 : 1);
      const p = toScreen(r.x, r.y); this.enemyLabels.push({ x: p.x, y: p.y - z * 1.6 * LEGIBILITY.overheadScale - 4, w: 18, depth: 1, hp: Math.max(0, r.hp / Math.max(1, r.hpMax)), brk: 0, name: this.remoteName(r), state: this.remoteLabel(r), elite: false, boss: false, miniBoss: false, tele: false, retreat: false, alert: false, notice: false, ally: r.color }); }
    for (const m of this.netMarks) { if (m.used) continue; const p = toScreen(m.x, m.y); list.push({ y: p.y, draw: () => { ctx.fillStyle = m.color; ctx.beginPath(); ctx.arc(p.x, p.y - 2, 3 + Math.sin(this.time * 4), 0, 7); ctx.fill(); } }); this.enemyLabels.push({ x: p.x, y: p.y - 10, w: 0, depth: 1, hp: 0, brk: 0, name: m.label, state: "", elite: true, boss: false, miniBoss: false, tele: false, retreat: false, alert: false, notice: false, ally: m.color }); }
    for (const pr of this.projs) { const p = toScreen(pr.x, pr.y); list.push({ y: p.y, draw: () => { ctx.fillStyle = pr.color; ctx.fillRect(p.x - 1, p.y - 1 - pr.z * z * .8, 2, 2); } }); }
    list.sort((a, b) => a.y - b.y).forEach(i => i.draw());
    // mira: línea hacia donde apunta
    { const p = toScreen(this.px, this.py), a = toScreen(this.px + Math.cos(this.ang) * 2.2, this.py + Math.sin(this.ang) * 2.2); ctx.strokeStyle = "rgba(255,51,85,.8)"; ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.moveTo(p.x, p.y - 6); ctx.lineTo(a.x, a.y - 6); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = "#ff3355"; ctx.fillRect(a.x - 1, a.y - 7, 3, 3); }
    if (this.hurtFlash > 0) { ctx.fillStyle = `rgba(200,0,20,${this.hurtFlash * .6})`; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }
  renderScene(ctx: CanvasRenderingContext2D) {
    this.enemyLabels = [];
    const gD = this.gDepth, gI = this.gInfo; this.sDepth.fill(Infinity);
    if (!this.buf) { this.buf = ctx.createImageData(W, H); this.buf32 = new Uint32Array(this.buf.data.buffer); }
    const b = this.buf32!;
    const swDt = Math.min(.1, Math.max(0, this.time - this.swayLast)); this.swayLast = this.time;
    const sw = stepWalkSway(this.sway, swDt, Math.hypot(this.vx, this.vy), this.pz <= .02 && this.slideT <= 0 && this.dashT <= 0);
    const shakeX = (Math.random() - 0.5) * this.shake * 14 + sw.x, shakeY = (Math.random() - 0.5) * this.shake * 14 + sw.y;
    const horizon = H / 2 + shakeY + (this.slideT > 0 ? 12 : 0);
    const screenY = (z: number, depth: number) => projectHeight(z, eye, depth, H, this.pitch) + horizon - H / 2;
    const eye = 0.5 + this.pz - (this.slideT > 0 ? 0.25 : 0) - (this.crouching ? 0.22 : 0) + Math.sin(this.time * 9) * 0.015 * Math.min(1, Math.hypot(this.vx, this.vy) / 3);
    const atmosphere=this.sceneryAt();
    const fogDist = (this.weather === 4 ? 7 : this.weather === 5 ? 6 : this.weather === 6 || this.darkness ? 6 : this.hasP("vacio") && !isPariah(this.cls.id) ? 9 : 14) * (isPariah(this.cls.id) ? PARIAH.view.depth : 1);
    const altered=this.alterationAt();
    const fogC = altered?.fog ?? (this.weather === 5 ? [150, 90, 40] : this.weather === 2 ? [40, 90, 30] : this.weather === 4 ? [70, 70, 90] : this.region.fog);
    const dirX = Math.cos(this.ang), dirY = Math.sin(this.ang), fovK = 0.8 * (isPariah(this.cls?.id) && !this.camPlayer ? PARIAH.view.fov : 1), plX = -dirY * fovK, plY = dirX * fovK;
    const tex = this.regionTextures[this.region.id] ?? this.tex, tex2 = this.tex2;
    const tileThemes = Array.from(this.scenicRooms, room => sceneryTheme(this.region.id,room,this.floor));
    const tilePulse = Float64Array.from(this.scenicRooms, (_,tile) => .92+.08*Math.sin(this.time*3+tile*.13));
    const wetFloor = this.weather === 2 ? 1.2 : 1;
    const mapArr = this.map;
    for (let y=0;y<H;y++) this.rowRays[y]=verticalRay(y-horizon+H/2,H,this.pitch);
    // suelo y techo (raycast por fila)
    for (let y = 0; y < H; y++) {
      const rayZ = this.rowRays[y];
      const isFloor = rayZ < 0;
      const rowDist = Math.max(.001, (isFloor ? -eye : Math.max(.1, 2.4-eye)) / rayZ);
      const fog = Math.min(1, rowDist / fogDist);
      if (fog === 1) { b.fill(0xff000000 | (fogC[2]<<16) | (fogC[1]<<8) | fogC[0], y*W, (y+1)*W); gD.fill(1e4, y*W, (y+1)*W); for (let x = 0; x < W; x++) { const gi=(y*W+x)*4; gI[gi]=NRM.SKY; gI[gi+1]=MAT.NONE; gI[gi+2]=0; gI[gi+3]=0; } continue; }
      const stepX = rowDist * (plX * 2) / W, stepY = rowDist * (plY * 2) / W;
      let fx = this.px + rowDist * (dirX - plX), fy = this.py + rowDist * (dirY - plY);
      for (let x = 0; x < W; x++) {
        const cx = fx - Math.floor(fx), cy = fy - Math.floor(fy);
        let r: number, g: number, bl: number, gm: number = MAT.STONE, gw = this.weather === 2 ? 90 : 0, ge = 0;
        if (isFloor) {
          const checker = ((Math.floor(fx) + Math.floor(fy)) & 1) ? 1 : 0.8;
          const grout = cx < 0.04 || cy < 0.04 ? 0.5 : 1;
          const wet = wetFloor;
          r = this.region.floor[0] * checker * grout; g = this.region.floor[1] * checker * grout * wet; bl = this.region.floor[2] * checker * grout;
          const gk=this.groundKindFast(fx,fy),ground=this.groundTextures[gk];gm=gk===0?MAT.ORGANIC:gk===1?MAT.EARTH:gk===2?MAT.STONE:MAT.STONE;if(ground){const c=ground[(Math.floor(cy*128)&127)*128+(Math.floor(cx*128)&127)];r=(c&255)*.8;g=((c>>8)&255)*.8*wet;bl=((c>>16)&255)*.8;}
        } else {
          const beam = cx < 0.08 || cy < 0.08 ? 1.6 : 1;
          if (beam > 1) gm = MAT.WOOD; gw = 0;
          r = this.region.ceiling[0] * beam; g = this.region.ceiling[1] * beam; bl = this.region.ceiling[2] * beam;
        }
        // luz de jugador
        const tile=Math.floor(fy)*MAP+Math.floor(fx),valid=fx>=0&&fy>=0&&fx<MAP&&fy<MAP;
        if(valid){
          const room=this.scenicRooms[tile],theme=tileThemes[tile],li=tile*3;
          const pulse=tilePulse[tile];
          r=r*.9+theme.tint[0]*.1+this.scenicLight[li]*pulse;
          g=g*.9+theme.tint[1]*.1+this.scenicLight[li+1]*pulse;
          bl=bl*.9+theme.tint[2]*.1+this.scenicLight[li+2]*pulse;
          if(isFloor){
            const puddle=puddleAt(fx,fy,MAP);
            if(puddle&&room>=0){gm=theme.wet>.4?MAT.WATER:MAT.POLISHED;gw=Math.max(gw,Math.round(theme.wet*255));const wet=theme.wet*(.28+.16*Math.sin(fx*19+fy*12+this.time*2));
              r=r*(1-wet)+theme.tint[0]*wet+this.scenicLight[li]*wet;
              g=g*(1-wet)+theme.tint[1]*wet+this.scenicLight[li+1]*wet;
              bl=bl*(1-wet)+theme.tint[2]*wet+this.scenicLight[li+2]*wet;
            }
            const rim=cx<.12||cy<.12;
            if(rim&&(this.cell(Math.floor(fx)-1,fy)===1||this.cell(fx,Math.floor(fy)-1)===1)){r*=.74;g*=.74;bl*=.74;}
          }
        }
        const light = Math.max(0, 1 - rowDist / 7) * 0.8;
        r += r * light; g += g * light; bl += bl * light;
        if (isFloor && valid) { const fc = mapArr[tile]; if (fc === 5 || fc === 7) { ge = 90; r += fc === 5 ? 18 : 9; g += 10; bl += fc === 5 ? 26 : 12; } }
        r = r * (1 - fog) + fogC[0] * fog; g = g * (1 - fog) + fogC[1] * fog; bl = bl * (1 - fog) + fogC[2] * fog;
        b[y * W + x] = 0xff000000 | (Math.min(255, bl) << 16) | (Math.min(255, g) << 8) | Math.min(255, r);
        { const pi = y * W + x, gi = pi * 4; gD[pi] = rowDist; gI[gi] = isFloor ? NRM.UP : NRM.DOWN; gI[gi+1] = gm; gI[gi+2] = ge; gI[gi+3] = gw; }
        fx += stepX; fy += stepY;
      }
    }
    // Volumetric DDA: front faces, raised tops and overhead lintels, with pixel depth.
    this.depthPixels.fill(Infinity);
    for(let x=0;x<W;x++) {
      const camX=2*x/W-1,rdx=dirX+plX*camX,rdy=dirY+plY*camX;
      let mx=Math.floor(this.px),my=Math.floor(this.py); const ddx=Math.abs(1/rdx),ddy=Math.abs(1/rdy),sx=rdx<0?-1:1,sy=rdy<0?-1:1;
      let sdx=(rdx<0?this.px-mx:mx+1-this.px)*ddx,sdy=(rdy<0?this.py-my:my+1-this.py)*ddy;
      this.zbuf[x]=Infinity;
      for(let step=0;step<90;step++) {
        let side=0,entry=0;
        if(step>0) { if(sdx<sdy) {entry=sdx;sdx+=ddx;mx+=sx;} else {entry=sdy;sdy+=ddy;my+=sy;side=1;} }
        const exit=Math.min(sdx,sdy),cell=this.cell(mx+.5,my+.5),volume=cellVolume(cell);if(!volume)continue;
        const idx=my*MAP+mx,lo=cell===6?(this.doorAnim[idx]??0)*2.4:volume[0],hi=volume[1];
        if(lo>=hi)continue;
        for(let y=0;y<H;y++) { const rayZ=this.rowRays[y];let distance=Infinity,cap=false;
          if(entry>.01) {const z=eye+rayZ*entry;if(z>=lo&&z<=hi)distance=entry;}
          if(rayZ!==0) {const min=Math.max(.01,entry),dlo=(lo-eye)/rayZ,dhi=(hi-eye)/rayZ;if(dlo>min&&dlo<=exit&&dlo<distance){distance=dlo;cap=true;}if(dhi>min&&dhi<=exit&&dhi<distance){distance=dhi;cap=true;}}
          const pixel=y*W+x;if(!Number.isFinite(distance)||distance>=this.depthPixels[pixel])continue;
          this.depthPixels[pixel]=distance;
          { const gi=pixel*4; gD[pixel]=distance; gI[gi]=cap?(Math.abs(eye+rayZ*distance-hi)<Math.abs(eye+rayZ*distance-lo)?NRM.UP:NRM.DOWN):side===0?(rdx>0?NRM.NX:NRM.PX):(rdy>0?NRM.NY:NRM.PY); gI[gi+1]=cell===6?MAT.WOOD:cell===3?MAT.METAL:cell===10?MAT.EARTH:cell===5||cell===7?MAT.DECOR:MAT.STONE; gI[gi+2]=this.seals[idx]?60:0; gI[gi+3]=this.weather===2?70:0; }
          const hx=this.px+rdx*distance,hy=this.py+rdy*distance,z=eye+rayZ*distance;
          const tx=Math.floor((cap?hx:side===0?hy:hx)*TEX)&127,ty=Math.floor((cap?hy:z)*TEX)&127,c=tex?.[ty*TEX+tx]??0xff402030;
          let rr=c&255,gg=(c>>8)&255,bb=(c>>16)&255;
          if(cell===6){rr=92;gg=53;bb=32;if(tx%32<4||ty%40<5){rr=156;gg=125;bb=75;}if(this.seals[idx]){rr+=25;bb+=35;}}
          if(cell===3){rr+=70;gg+=40;bb*=.5;}
          if(cell===11){if(z<0.86){rr=212;gg=152;bb=54;}else{rr=rr*.6+88;gg=gg*.6+58;bb=bb*.6+26;}}

          const edge=cap&&(tx<5||ty<5)?1.4:1,shade=(cap?1.7:side?.8:1.15)*edge*(1+Math.max(0,1-distance/6)*.6),fog=Math.min(1,distance/fogDist);
          if(mx>=0&&my>=0&&mx<MAP&&my<MAP){const li=(my*MAP+mx)*3;rr+=this.scenicLight[li];gg+=this.scenicLight[li+1];bb+=this.scenicLight[li+2];}
          rr=rr*shade*(1-fog)+fogC[0]*fog;gg=gg*shade*(1-fog)+fogC[1]*fog;bb=bb*shade*(1-fog)+fogC[2]*fog;
          b[pixel]=0xff000000|(Math.min(255,bb)<<16)|(Math.min(255,gg)<<8)|Math.min(255,rr);
        }
        if(cell!==5&&cell!==7&&cell!==8&&cell!==9&&cell!==11&&!(cell===6&&this.doorAnim[idx]!==undefined)) {this.zbuf[x]=Math.max(.05,entry);break;}
      }
    }
    // posterización + dithering (Bayer 2x2)
    const bay = [0, 4, 6, 2];
    for (let i = 0; i < b.length; i++) {
      const c = b[i]; const dth = bay[((i % W) & 1) + (((i / W) | 0) & 1) * 2] - 3;
      const q = (v: number) => Math.min(255, Math.max(0, ((v + dth) >> 3) << 3));
      b[i] = 0xff000000 | (q((c >> 16) & 255) << 16) | (q((c >> 8) & 255) << 8) | q(c & 255);
    }
    ctx.putImageData(this.buf, 0, 0);
    this.gfxRowRays.set(this.rowRays);
    this.gfxCam = { px: this.px, py: this.py, eye, dirX, dirY, plX, plY, pitch: this.pitch, horizonOffset: horizon - H / 2, fogDist, fog: [fogC[0] / 255, fogC[1] / 255, fogC[2] / 255], region: this.region.id, time: this.time,
      shake: this.shake, hurt: Math.max(0, Math.min(1, this.hurtFlash)), crit: Math.max(0, Math.min(1, this.critFlash)), hpRatio: this.hpMax ? this.hp / this.hpMax : 1, darkness: this.darkness ? 1 : 0, aiming: this.aiming ? 1 : 0 };
    ctx.save(); ctx.translate(shakeX, 0);
    // sprites
    type S = { x: number; y: number; z: number; dist: number; draw: (sx: number, sy: number, size: number, dist: number) => void };
    const list: S[] = [];
    const inv = 1 / (plX * dirY - dirX * plY);
    const proj = (x: number, y: number) => {
      const dx = x - this.px, dy = y - this.py;
      const tX = inv * (dirY * dx - dirX * dy), tY = inv * (-plY * dx + plX * dy);
      return { sx: (W / 2) * (1 + tX / tY), depth: tY };
    };
    const drawImg = (img: HTMLImageElement | HTMLCanvasElement | undefined, sx: number, depth: number, z: number, scale: number, tint?: string, flash = false, sway = 0, alpha = 1, wMul = 1, actor = false) => {
      if (!img || depth < 0.15) return;
      const footY = screenY(z, depth), topY = screenY(z + scale, depth);
      const h = Math.max(.01, footY - topY), w = h * (img.width / img.height) * wMul;
      if (footY < 0 || topY > H || h > H * 100) return;
      const left = sx - w / 2;
      const x0 = Math.max(0, Math.floor(left)), x1 = Math.min(W, Math.ceil(left + w));
      if (x0 >= x1) return;
      const fog = Math.min(1, depth / fogDist);
      ctx.globalAlpha = alpha;
      const top=footY-h, bands = sway && h > 6 ? 5 : 1;
      for (let k = 0; k < bands; k++) {
        // Wind sway shears the sprite: upper bands shift more than the rooted base.
        const off = bands > 1 ? sway * w * (1 - (k + .5) / bands) ** 1.5 * 2 : 0, yA = top + h * k / bands, yB = top + h * (k + 1) / bands;
        const bx0 = Math.max(0, Math.floor(left + off)), bx1 = Math.min(W, Math.ceil(left + w + off));
        for (let x = bx0; x < bx1; x++) {
          const u = (x-left-off)/w*img.width; if (u < 0 || u >= img.width) continue; const yEnd = Math.min(H, Math.ceil(yB));
          for(let y=Math.max(0,Math.floor(yA));y<yEnd;) {if(this.depthPixels[y*W+x]<depth){y++;continue;}const start=y;while(y<yEnd&&this.depthPixels[y*W+x]>=depth){const si=y*W+x;if(depth<this.sDepth[si])this.sDepth[si]=depth;y++;}ctx.drawImage(img,u,(start-top)/h*img.height,Math.max(1,img.width/w),(y-start)/h*img.height,x,start,1,y-start);}
        }
      }
      ctx.globalAlpha = 1;
      const over = (col: string, alpha: number) => {
        const v = this.variant(img, col); ctx.globalAlpha = alpha;
        for (let x = x0; x < x1; x++) { if (this.zbuf[x] < depth || this.depthPixels[Math.floor(clamp(footY-h/2,0,H-1))*W+x]<depth) continue; const u = (x - left) / w * img.width; ctx.drawImage(v, u, 0, Math.max(1, img.width / w), img.height, x, footY - h, 1, h); }
        ctx.globalAlpha = 1;
      };
      if (tint) over(tint, 0.35 + Math.sin(this.time * 8) * 0.1);
      if (flash) over("#ffffff", 0.6);
      if (fog > 0.15) over(`rgb(${fogC[0]},${fogC[1]},${fogC[2]})`, actorFog(fog, actor));
      return { top: footY - h, foot: footY, w };
    };
    const blob = (sx: number, depth: number, z: number, size: number, color: string, glow = false) => {
      if (depth < 0.15) return; const xi = Math.floor(sx); if (xi < 0 || xi >= W || this.zbuf[xi] < depth) return;
      const s = Math.max(1, size * H / depth); const y = screenY(z, depth);
      if(this.depthPixels[Math.floor(clamp(y,0,H-1))*W+xi]<depth)return;
      if (glow) { ctx.globalAlpha = 0.3; ctx.fillStyle = color; ctx.fillRect(sx - s, y - s, s * 2, s * 2); ctx.globalAlpha = 1; }
      ctx.fillStyle = color; ctx.fillRect(sx - s / 2, y - s / 2, s, s);
    };
    const shadowLights = this.shadowLights();
    /** Silhouette cast on the floor (and the nearest wall) away from the strongest light. */
    const castSil = (img: HTMLImageElement | HTMLCanvasElement | undefined, x: number, y: number, z: number, scale: number, depth: number) => {
      if (!img || depth > 12) return; const sh = castShadow(x, y, shadowLights); if (!sh) return;
      const sil = this.variant(img, "#050307"), foot = proj(x, y), fy = screenY(z, foot.depth);
      const xi = Math.floor(clamp(foot.sx, 0, W - 1)); if (this.depthPixels[Math.floor(clamp(fy, 0, H - 1)) * W + xi] < depth - .05) return;
      let len = sh.len * scale, wallAt = -1;
      for (let d = .15; d < len; d += .1) if (this.solid(x + sh.dx * d, y + sh.dy * d, z + .3)) { wallAt = d; break; }
      const floorLen = wallAt > 0 ? wallAt : len, tip = proj(x + sh.dx * floorLen, y + sh.dy * floorLen);
      if (tip.depth > .2) {
        const ty = screenY(z, tip.depth), w = Math.max(1, scale * H / depth * img.width / img.height) * .9;
        ctx.save(); ctx.globalAlpha = sh.alpha; ctx.translate(foot.sx, fy); ctx.transform(w / img.width, 0, -(tip.sx - foot.sx) / img.height, -(ty - fy) / img.height, 0, 0);
        ctx.drawImage(sil, -img.width / 2, -img.height, img.width, img.height); ctx.restore();
      }
      if (wallAt > 0) { const wp = proj(x + sh.dx * (wallAt - .04), y + sh.dy * (wallAt - .04)); if (wp.depth > .2) drawImg(sil, wp.sx, wp.depth, z, scale * (1 + wallAt * .25), undefined, false, 0, sh.alpha * .55 * (1 - wallAt / Math.max(.1, len))); }
    };
    /** Additive glowing dot used for eyes, flames and weapon edges. */
    const glowDot = (x: number, y: number, depth: number, radius: number, color: string, a: number) => {
      const xi = Math.floor(x); if (xi < 0 || xi >= W || y < 0 || y >= H || this.zbuf[xi] < depth || this.depthPixels[Math.floor(y) * W + xi] < depth) return;
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = a; const g = ctx.createRadialGradient(x, y, 0, x, y, radius); g.addColorStop(0, color); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2); ctx.fillStyle = "#fff"; ctx.globalAlpha = a * .8; ctx.fillRect(x - .5, y - .5, 1, 1); ctx.restore();
    };
    /** Decorative sprite with flame flicker or vegetation sway applied. */
    const drawDeco = (deco: string, img: HTMLImageElement | HTMLCanvasElement, x: number, y: number, sx: number, depth: number, z: number, scale: number) => {
      castSil(img, x, y, z, scale, depth);
      if (FLAME_DECOS.has(deco)) { const fl = flameFlicker(this.time, x * 3 + y); drawImg(img, sx + fl.dx / depth, depth, z, scale * fl.scale, undefined, false, fl.dx * .01);
        if (deco === "fire" || deco === "healing_brazier") { const gy = screenY(z + scale * .55, depth); glowDot(sx, gy, depth - .01, Math.min(26, 18 * fl.bright / depth), deco === "fire" ? "rgba(255,140,40,.9)" : "rgba(110,240,170,.9)", .35 * fl.bright);
          if (fl.crackle || Math.random() < .08) this.parts.push({ x: x + rnd(-.05, .05), y: y + rnd(-.05, .05), z: z + scale * .6, vx: rnd(-.4, .4), vy: rnd(-.4, .4), vz: rnd(1.2, 2.4), life: rnd(.3, .6), color: deco === "fire" ? "#ffd27a" : "#b4ffd6", size: .01 }); }
      } else drawImg(img, sx, depth, z, scale, undefined, false, PLANT_DECOS.has(deco) ? swayAmount(this.time, x, y, deco, this.wind.x) : 0);
    };
    for(const sp of this.scenicProps){const p=proj(sp.x,sp.y);if(p.depth<.2||p.depth>fogDist+3)continue;
      const image=this.sprites[sp.deco]; if (!visibleBounds(p.sx,p.depth,image?.width??100,image?.height??100,PROP_SCALE[sp.deco]??1,W,H)) continue;
      list.push({x:sp.x,y:sp.y,z:0,dist:p.depth,draw:()=>{
        const z=this.floorHeight(sp.x,sp.y),scale=PROP_SCALE[sp.deco]??1,light=LIGHTS[sp.deco];
        const sy=screenY(z,p.depth),xi=Math.floor(clamp(p.sx,0,W-1));
        if(this.depthPixels[Math.floor(clamp(sy,0,H-1))*W+xi]>=p.depth){ctx.globalAlpha=.18;ctx.fillStyle='#080609';ctx.beginPath();ctx.ellipse(p.sx,sy,scale*14/p.depth,2/p.depth,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
        const simg=this.sprites[sp.deco]; if(simg) { if (LIGHTS[sp.deco]) { const fl = FLAME_DECOS.has(sp.deco) ? flameFlicker(this.time, sp.x * 3 + sp.y) : null; drawImg(simg,p.sx+(fl?fl.dx*.3/p.depth:0),p.depth,z,scale); } else drawDeco(sp.deco,simg,sp.x,sp.y,p.sx,p.depth,z,scale); }
        if(light){const gy=screenY(z+light.height,p.depth),color=`rgb(${light.color.join(',')})`;
          if(p.sx>=0&&p.sx<W&&gy>=0&&gy<H&&this.depthPixels[Math.floor(gy)*W+xi]>=p.depth){
            ctx.save();ctx.globalCompositeOperation='screen';const radius=Math.min(22,30/p.depth),gl=ctx.createRadialGradient(p.sx,gy,0,p.sx,gy,radius);gl.addColorStop(0,`rgba(${light.color.join(',')},.28)`);gl.addColorStop(1,`rgba(${light.color.join(',')},0)`);ctx.fillStyle=gl;ctx.fillRect(p.sx-radius,gy-radius,radius*2,radius*2);ctx.restore();
            blob(p.sx,p.depth,z+light.height,.016,color,true);
          }
          // Vertical, broken light streaks on reflective ground, depth-tested per pixel.
          const wet=this.sceneryAt(sp.x,sp.y).wet;
          for(let j=1;j<=7;j++){const ry=screenY(z-light.height*j/7,p.depth);if(ry<0||ry>=H||p.sx<0||p.sx>=W)continue;
            if(this.depthPixels[Math.floor(ry)*W+xi]<p.depth)continue;
            ctx.globalAlpha=wet*.12*(1-j/8);ctx.fillStyle=color;ctx.fillRect(p.sx+Math.sin(this.time*2+j)*1.3-4/p.depth,ry,8/p.depth,1);
          }ctx.globalAlpha=1;
        }
      }});
    }
    for (const e of this.enemies) {
      if (e.shattered) continue;
      if (e.dead && e.hurt <= 0) continue;
      const p = proj(e.x, e.y); if (p.depth < 0.15) continue;
      const source=this.sprites[e.kind]??this.sprites[ENEMY_TYPES[e.kind].sprite];
      if (!visibleBounds(p.sx,p.depth,(source?.width??100)+32,source?.height??100,ENEMY_TYPES[e.kind].scale,W,H,48)) continue;
      list.push({ x: e.x, y: e.y, z: e.z, dist: p.depth, draw: () => {
        const t = ENEMY_TYPES[e.kind];
        const tint = e.variant ? ALTERATIONS.find(a=>a.id===e.variant)?.tint : e.stagger > 0 ? "#ff3ad9" : e.elite === "ÍGNEO" ? "#ff6a00" : e.elite === "VENENOSO" ? "#3f3" : e.elite === "EXPLOSIVO" ? "#ffb000" : e.elite === "VELOZ" ? "#6cf" : e.elite === "BLINDADO" ? "#aaa" : e.elite === "VAMPÍRICO" ? "#f00" : e.elite === "ESPEJADO" ? "#fff" : e.kind === "espectro" ? "#7ad8ff" : e.kind === "vigia" ? "#d0703a" : undefined;
        const pose: Pose = e.dead ? "death" : (e.downT ?? 0) > 0 ? "down" : e.hurt > 0 || e.stagger > 0 ? "hurt" : e.tele > 0 ? "attack" : (e.alertT ?? 0) > 0 ? "alert" : e.ambush?.stage==="hidden" ? "idle" : !e.aware ? ((e.notice ?? 0) > .25 ? "idle" : "rest") : Math.hypot(e.x-this.px,e.y-this.py) < 12 ? "walk" : "idle";
        if (e.dead && e.hurt <= 0) return;
        const ev = this.enemyEvadeOffset(e), bob = (e.kind === "espectro" ? Math.sin(e.t*3)*.06 : 0) + ev.up;
        const clock = pose === "down" ? (1-Math.min(1,(e.downT??0)/KNOCKDOWN_SECONDS))*11 : pose === "alert" ? (1-Math.min(1,(e.alertT??0)/.55))*11 : pose === "rest" ? e.t*3%12 : pose === "attack" ? (1-Math.min(1,e.tele/Math.max(.2,e.teleMax??e.tele)))*11 : pose === "death" ? (1-Math.min(1,e.hurt/.4))*11 : e.t*(pose === "walk"?16+t.speed*4:9)%12;
        const ground=this.floorHeight(e.x,e.y),shadowY=screenY(ground,p.depth);
        if(this.depthPixels[Math.floor(clamp(shadowY,0,H-1))*W+Math.floor(clamp(p.sx,0,W-1))]>=p.depth) {ctx.globalAlpha=.22;ctx.fillStyle="#080609";ctx.beginPath();ctx.ellipse(p.sx,shadowY,20/p.depth,4/p.depth,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
        const cutFrame = this.cutEnemyFrame(e, this.frame(e.kind,pose,clock) ?? this.sprites[t.sprite]);
        if (!e.dead) castSil(cutFrame, e.x, e.y, ground, t.scale, p.depth);
        const r = drawImg(e.dead ? cutFrame : legible(cutFrame, enemyRim(e)),(ev.dx||ev.dy?proj(e.x+ev.dx,e.y+ev.dy).sx:p.sx),p.depth,e.z+bob,t.scale,tint,e.hurt>0 && !e.dead,0,1,1,!e.dead);
        { const gl = r && p.depth < 12 && e.ambush?.stage !== "hidden" ? enemyGlow(e, this.time) : null;
          if (gl && r) { const hh = r.foot - r.top, ey = r.top + hh * .2, ex = r.w * .07, rad = Math.max(2, Math.min(9, (gl.kind === "attack" ? 7 : 5) / p.depth * 2));
            glowDot(p.sx - ex, ey, p.depth - .02, rad, gl.color, gl.intensity); glowDot(p.sx + ex, ey, p.depth - .02, rad, gl.color, gl.intensity);
            if (gl.kind === "attack") glowDot(p.sx + r.w * .3, r.top + hh * .5, p.depth - .02, rad * 1.8, "rgba(255,90,40,.9)", gl.intensity * .8); } }
        if (!e.dead && e.tele > 0 && p.depth < 7) {
          const arm = this.frame(e.kind === "vigia"?"revolver":e.kind === "carcelero"?"hammer":"scythe","idle",0);
          if (arm) drawImg(arm,p.sx+10/p.depth*Math.sin(e.t*14),p.depth+.02,e.z+.2,t.scale*.5);
        }
        if (r && p.depth < 10 && e.ambush?.stage!=="hidden") {
          // barra de vida y break
          const bw = Math.min(40, r.w * 0.6); const bx = p.sx - bw / 2, by = r.top - 4;
          if (this.zbuf[Math.floor(clamp(p.sx, 0, W - 1))] >= p.depth) {
            // Crisp labels/bars are drawn by GameView on a high-resolution overlay from these entries.
            { const same = this.enemies.filter(o => !o.dead && o.kind === e.kind); const n = same.filter(o => o.id <= e.id).length;
              const nm = `${ENEMY_TYPES[e.kind].name}${e.role ? " · " + ROLE_LABEL[e.role] : ""}${e.variant ? " · " + e.variant : ""}${e.elite ? " · " + e.elite : ""} #${n}/${same.length}`;
              const st = (e.retreatT ?? 0) > 0 ? `se aleja ${(e.retreatT ?? 0).toFixed(1)}s` : e.tele > 0 ? `¡golpe ${e.tele.toFixed(1)}s!` : !e.aware ? "sin alertar" : e.cd > 0 ? `ataca ${e.cd.toFixed(1)}s` : "listo";
              this.enemyLabels.push({ x: p.sx, y: by, w: bw, depth: p.depth, hp: Math.max(0, e.hp / e.hpMax), brk: Math.max(0, e.brk / e.brkMax), name: p.depth < 7 ? (e.misread ? "LECTURA ERRÓNEA" : nm) : "", state: p.depth < 7 ? st : "", elite: !!e.elite, boss: e.kind === "librero", miniBoss: !!e.miniBoss, tele: e.tele > 0, retreat: (e.retreatT ?? 0) > 0, alert: (e.alertT ?? 0) > 0, notice: !e.aware && (e.notice ?? 0) > .25 }); }
            if ((e.retreatT ?? 0) > 0 && this.retreatCue.visual) { const rc = this.retreatCue; ctx.save(); ctx.globalAlpha = Math.min(1, .25 + .75 * rc.intensity); const k = (e.retreatT ?? 0) / Math.max(.1, e.retreatMax ?? 1); const blink = Math.floor(this.time * 10) % 2 === 0; ctx.fillStyle = blink ? "#7ad8ff" : "#e8f8ff"; ctx.font = `bold ${Math.round(9 * rc.size)}px monospace`; ctx.textAlign = "center"; ctx.fillText("«»", p.sx, by - 5); const bh = Math.max(1, Math.round(2 * rc.size)); ctx.fillStyle = "#0a2a3a"; ctx.fillRect(bx, by + 3, bw, bh); ctx.fillStyle = "#7ad8ff"; ctx.fillRect(bx, by + 3, bw * k, bh); ctx.restore(); }
            
          }
        }
      } });
    }
    for (const h of this.hazards) { const p = proj(h.x, h.y); if (p.depth < .2 || p.depth > 16) continue; list.push({ x: h.x, y: h.y, z: 0, dist: p.depth, draw: () => { const k = 1 - h.t / h.max, z = this.floorHeight(h.x, h.y); blob(p.sx, p.depth, z + .01, .25 + k * .55, Math.floor(this.time * 12) % 2 ? "#ff2a2a" : "#ffb347", true); blob(p.sx, p.depth, z + (1 - k) * 2.6, .16, "#5a4a3c"); blob(p.sx + 3 / p.depth, p.depth, z + (1 - k) * 2.6 + .1, .09, "#3a2e26"); } }); }
    for (const pk of this.pickups) {
      if (pk.used && pk.kind !== "chest") { if (pk.kind !== "trap") continue; }
      const p = proj(pk.x, pk.y); if (p.depth < 0.15) continue;
      const source=this.sprites[pk.deco??pk.kind];
      if (!visibleBounds(p.sx,p.depth,(source?.width??100)+32,source?.height??100,pk.kind==="decor"?(PROP_SCALE[pk.deco??""]??1):1,W,H)) continue;
      if (pk.kind === "decor") { list.push({ x: pk.x, y: pk.y, z: 0, dist: p.depth, draw: () => {
        const dk = pk.deco ?? "book";
        if (this.sprites[dk]) { const z=this.floorHeight(pk.x,pk.y),scale=PROP_SCALE[dk]??.2;drawDeco(dk,this.sprites[dk]!,pk.x,pk.y,p.sx,p.depth,z,scale);if(dk==="fire"||dk==="healing_brazier")for(let i=0;i<3;i++)blob(p.sx+Math.sin(pk.bob*4+i)*3/p.depth,p.depth,z+scale*.7+((pk.bob*.4+i*.1)%.3),.015,dk==="fire"?"#ffb347":"#75e3b0",true); return; }
        if (dk === "candle") { blob(p.sx, p.depth, (pk.z??0)+0.08, 0.05, "#d8c8a8"); blob(p.sx, p.depth, (pk.z??0)+0.17 + Math.sin(this.time * 9 + pk.bob) * 0.01, 0.03, "#ffb347", true); }
        else if (dk === "bones") { blob(p.sx - 4 / p.depth, p.depth, 0.03, 0.06, "#cfc6b0"); blob(p.sx + 3 / p.depth, p.depth, 0.05, 0.05, "#e8dfc8"); }
        else if (dk === "banner") { blob(p.sx, p.depth, 0.75, 0.14, "#7a0f22"); blob(p.sx, p.depth, 0.8, 0.05, "#ffd34a", true); }
        else { blob(p.sx, p.depth, 0.5, 0.12, "#3a2f3a"); blob(p.sx, p.depth, 0.95, 0.15, "#4a3d48"); }
      } }); continue; }
      list.push({ x: pk.x, y: pk.y, z: 0, dist: p.depth, draw: () => {
        const bob = 0.15 + Math.sin(pk.bob * 3) * 0.05;
        const c = pk.kind === "item" ? RARITY_C[pk.item?.rarity ?? 0] : pk.kind === "gold" ? "#ffd34a" : pk.kind === "mat" ? "#7f7" : pk.kind === "food" ? "#fa6" : pk.kind === "water" ? "#6cf" : pk.kind === "key" ? "#ffe08a" : "#fff";
        const icon = pk.kind === "palimpsest" ? "palimpsesto" : pk.kind === "folio" ? "book" : pk.kind === "mapfrag" ? "map" : pk.kind === "cipherlock" ? "chest" : pk.kind === "note" ? "book" : pk.kind === "lore" ? this.region.icon : pk.kind === "sanctuary" ? "rose" : pk.kind === "item" ? "relic" : pk.kind === "shop" ? "shop" : pk.kind === "portal" ? "rune" : pk.kind === "trap" ? "spike_trap" : pk.kind;
        if (this.sprites[icon] && (pk.kind !== "trap" || pk.armed)) { const magical = ["portal","sanctuary","altar","palimpsest","mapfrag","cipherlock","folio"].includes(pk.kind);
          const pose: Pose = pk.kind === "chest" && pk.used ? "open" : "idle";
          const clock = pose === "open" ? 11 : pk.bob*12%12;
          const grab = GRABBABLE.has(pk.kind);
          if (grab) { const f = grabFx(this.time, pk.bob), gz = this.floorHeight(pk.x,pk.y) + f.lift;
            blob(p.sx, p.depth, gz + .1, .16 * f.pulse, c, true);
            drawImg(this.frame(icon,pose,clock),p.sx,p.depth,gz,.25*f.pulse,undefined,f.flash,0,1,f.spin);
            blob(p.sx + Math.sin(this.time*3+pk.bob)*5/p.depth, p.depth, gz + .3 + ((this.time*.5+pk.bob)%1)*.25, .012, c, true);
            return; }
          drawImg(this.frame(icon,pose,clock),p.sx,p.depth,this.floorHeight(pk.x,pk.y)+(magical||pk.kind==="lore"?bob:0),pk.kind === 'portal' ? PORTAL.height : ["shop","sanctuary"].includes(pk.kind)?.55:.25,pk.kind==="portal"?"#7ad8ff":undefined);
          if (magical) { for (let n=0;n<3;n++) blob(p.sx+Math.sin(this.time*2+n*2)*8/p.depth,p.depth,.15+((this.time*.3+n*.3)%1)*.7,.012,pk.kind==="portal"||pk.kind==="palimpsest"||pk.kind==="folio"?"#7ad8ff":pk.kind==="mapfrag"||pk.kind==="cipherlock"?"#ffd34a":"#ff3759",true); }
          return; }
        if (pk.kind === "chest") { blob(p.sx, p.depth, 0.15, 0.22, pk.used ? "#3a2a1a" : "#8a5a2a"); blob(p.sx, p.depth, 0.22, 0.08, pk.used ? "#222" : "#ffd34a"); }
        else if (pk.kind === "trap") { if (pk.armed) { for (let i = -1; i <= 1; i++) blob(p.sx + i * 12 / p.depth, p.depth, 0.02, 0.05, "#c4121e"); } }
        else if (pk.kind === "bench") { blob(p.sx - 10 / p.depth, p.depth, 0, 0.18, "#4a2f1c"); blob(p.sx + 10 / p.depth, p.depth, 0, 0.18, "#4a2f1c"); blob(p.sx, p.depth, 0.18, 0.12, "#7a4e2c"); blob(p.sx, p.depth, 0.32, 0.1, "#5c3a20"); }
        else if (pk.kind === "shop") { blob(p.sx, p.depth, 0.6, 0.35, "#3b1d48", true); blob(p.sx, p.depth, 0.9, 0.12, "#ffd34a", true); }
        else if (pk.kind === "pactstone") { blob(p.sx, p.depth, 0.03, 0.2, pk.used ? "#222" : "#2a0a30"); blob(p.sx, p.depth, 0.06 + Math.sin(this.time * 3) * 0.02, 0.07, pk.used ? "#333" : "#c35bff", !pk.used); }
        else if (pk.kind === "altar") { blob(p.sx, p.depth, 0.3, 0.3, pk.used ? "#222" : "#5a0a20", !pk.used); blob(p.sx, p.depth, 0.7, 0.1, pk.used ? "#333" : "#ff2a4a", !pk.used); }
        else if (pk.kind === "portal") { blob(p.sx, p.depth, 0.6, 0.5 + Math.sin(this.time * 4) * 0.05, "#b45bff", true); blob(p.sx, p.depth, 0.6, 0.25, "#fff", false); }
        else blob(p.sx, p.depth, bob, 0.08, c, true);
      } });
    }
    for (const pr of this.projs) { const p = proj(pr.x, pr.y); list.push({ x: pr.x, y: pr.y, z: pr.z, dist: p.depth, draw: () => {
      const img = pr.sprite ? this.projSprites[pr.sprite] : undefined;
      if (!img) return blob(p.sx, p.depth, pr.z, 0.07, pr.color, true);
      const xi = Math.floor(p.sx); if (p.depth < .15 || xi < 0 || xi >= W || this.zbuf[xi] < p.depth) return;
      const y = screenY(pr.z, p.depth); if (y < 0 || y >= H || this.depthPixels[Math.floor(y) * W + xi] < p.depth) return;
      const q = proj(pr.x + pr.dx * .02, pr.y + pr.dy * .02), y2 = q.depth > .15 ? screenY(pr.z + (pr.dz ?? 0) * .02, q.depth) : y;
      const ddx = q.depth > .15 ? q.sx - p.sx : 0, ddy = y2 - y, sp = Math.hypot(pr.dx, pr.dy, pr.dz ?? 0) || 1;
      const lateral = Math.min(1, Math.max(.22, Math.hypot(ddx, ddy) / (sp * .02 * H / p.depth)));
      if (p.depth < .45) return; const base = Math.min(pr.sprite === "orb" ? 22 : 12, Math.max(2, (pr.size ?? .1) * H / p.depth));
      const round = pr.sprite === "orb";
      const w = round ? base * 2 * (1 + Math.sin(this.time * 18) * .08) : base * (pr.sprite === "pellet" ? 2.6 : 4.2) * lateral, h = round ? w * img.height / img.width : Math.max(1, w / lateral * img.height / img.width);
      ctx.save(); ctx.translate(p.sx, y); if (!round) ctx.rotate(Math.atan2(ddy, ddx)); else ctx.rotate(this.time * 4);
      if (pr.sprite !== "arrow") ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = Math.max(.35, 1 - p.depth / (fogDist + 4)); ctx.imageSmoothingEnabled = false; ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore();
    } }); }
    for (const wv of this.waves) { const p = proj(wv.x, wv.y); if (p.depth < .15) continue; list.push({ x: wv.x, y: wv.y, z: wv.z, dist: p.depth, draw: () => { const r = wv.r * (wv.t / .45); for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, q = proj(wv.x + Math.cos(a) * r, wv.y + Math.sin(a) * r); if (q.depth > .6) blob(q.sx, q.depth, wv.z, .035, i % 2 ? "#d77aff" : "#ff7ad9", true); } } }); }
    for (const fx of this.explosions) {
      const p = proj(fx.x, fx.y); if (p.depth < .15) continue;
      list.push({ x: fx.x, y: fx.y, z: fx.z, dist: p.depth, draw: () => {
        drawImg(explosionFrame(fx.t), p.sx, p.depth, fx.z, 1.6 + Math.min(1, fx.t / .3) * .9);
        const radius = Math.min(2.8, fx.t * 9);
        if (fx.t < .4) for (let i = 0; i < 24; i++) {
          const angle = i / 24 * Math.PI * 2;
          const q = proj(fx.x + Math.cos(angle) * radius, fx.y + Math.sin(angle) * radius);
          blob(q.sx, q.depth, fx.z + .08, .025 * (1 - fx.t / .4), "#ffce72", true);
        }
      } });
    }
    for (const ph of this.phantoms) { const p = proj(ph.x, ph.y); if (p.depth < .15) continue; list.push({ x: ph.x, y: ph.y, z: 0, dist: p.depth, draw: () => { if (Math.sin(this.time * 23 + ph.t * 7) < -.4) return; const t = ENEMY_TYPES[ph.kind]; drawImg(this.frame(ph.kind, "idle", this.time * 9 % 12), p.sx + Math.sin(this.time * 31) * 1.5, p.depth, this.floorHeight(ph.x, ph.y), t?.scale ?? 1, "#2a0a1e"); } }); }
    for (const mk of this.marks) { const p = proj(mk.x, mk.y); if (p.depth < .2 || p.depth > 14) continue; list.push({ x: mk.x, y: mk.y, z: mk.z, dist: p.depth + .05, draw: () => {
      const xi = Math.floor(p.sx), y = screenY(mk.z, p.depth); if (xi < 0 || xi >= W || y < 0 || y >= H || this.depthPixels[Math.floor(y) * W + xi] < p.depth - .1) return;
      const s = Math.max(1.5, .07 * H / p.depth); ctx.globalAlpha = Math.min(1, mk.t / 3); ctx.drawImage(this.holeSprite(), p.sx - s / 2, y - s / 2, s, s); ctx.globalAlpha = 1; } }); }
    for (const pd of this.puddles) { const p = proj(pd.x, pd.y); if (p.depth < .3 || p.depth > 12) continue; list.push({ x: pd.x, y: pd.y, z: 0, dist: p.depth + .3, draw: () => {
      const z = this.floorHeight(pd.x, pd.y), y = screenY(z, p.depth), xi = Math.floor(p.sx); if (xi < 0 || xi >= W || y < 0 || y >= H || this.depthPixels[Math.floor(y) * W + xi] < p.depth - .1) return;
      const rx = pd.r * H / p.depth * .9, ry = Math.max(1, rx * Math.min(.35, .9 / p.depth + .08)), a = Math.min(1, pd.t / 3);
      ctx.save(); ctx.beginPath(); ctx.ellipse(p.sx, y, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
      ctx.globalAlpha = .55 * a; ctx.fillStyle = "#0e1a22"; ctx.fillRect(p.sx - rx, y - ry, rx * 2, ry * 2);
      // Reflection: the sky/ceiling colour and nearby light shimmer mirrored on the water.
      ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = .35 * a; const g = ctx.createLinearGradient(p.sx - rx, y, p.sx + rx, y); g.addColorStop(0, "rgba(120,170,200,0)"); g.addColorStop(.5 + Math.sin(this.time * 1.5 + pd.x) * .2, "rgba(170,215,240,.8)"); g.addColorStop(1, "rgba(120,170,200,0)"); ctx.fillStyle = g; ctx.fillRect(p.sx - rx, y - ry, rx * 2, ry * 2);
      for (let k = 0; k < 3; k++) { const yy = y - ry + (k + .5) * ry * 2 / 3; ctx.globalAlpha = .25 * a; ctx.fillStyle = "#dff4ff"; ctx.fillRect(p.sx - rx * .5 + Math.sin(this.time * 3 + k * 2 + pd.y) * rx * .3, yy, rx * .5, 1); }
      ctx.restore(); } }); }
    for (const f of this.flyers) { const img = this.fxImages.get(f.key); if (!img) continue; const p = proj(f.x, f.y); if (p.depth < .2) continue; list.push({ x: f.x, y: f.y, z: f.z, dist: p.depth, draw: () => {
      const xi = Math.floor(p.sx); if (xi < 0 || xi >= W || this.zbuf[xi] < p.depth) return; const foot = screenY(f.z, p.depth), top = screenY(f.z + f.scale, p.depth), h = foot - top, w = h * img.width / img.height;
      ctx.save(); ctx.translate(p.sx, (foot + top) / 2); ctx.rotate(f.rot); ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false; ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore(); } }); }
    for (const gb of this.gibs) { const img = this.fxImages.get(gb.key); if (!img) continue; const p = proj(gb.x, gb.y); if (p.depth < .2 || p.depth > 16) continue; list.push({ x: gb.x, y: gb.y, z: gb.z, dist: p.depth, draw: () => {
      const renderZ = gb.z + .035;
      const xi = Math.floor(p.sx), y = screenY(renderZ, p.depth); if (xi < 0 || xi >= W || y < 0 || y >= H || this.zbuf[xi] < p.depth || this.depthPixels[Math.floor(y) * W + xi] < p.depth - .04) return;
      const h = Math.max(1, gb.size * H / p.depth), w = h * (gb.uw * img.width) / (gb.vh * img.height);
      // Rotated canvas is passed through the regular per-pixel world-depth renderer.
      const rotated = this.fragmentCanvas ??= document.createElement('canvas'); rotated.width = rotated.height = Math.ceil(Math.hypot(w, h)) + 2;
      const rc = rotated.getContext('2d'); if (!rc) return;
      rc.imageSmoothingEnabled = false; rc.translate(rotated.width / 2, rotated.height / 2); rc.rotate(gb.rot);
      rc.drawImage(img, gb.u * img.width, gb.v * img.height, gb.uw * img.width, gb.vh * img.height, -w / 2, -h / 2, w, h);
      drawImg(rotated, p.sx, p.depth, renderZ - (rotated.height - h) * p.depth / H / 2, rotated.height * p.depth / H, undefined, false, 0, Math.min(1, gb.life * 2)); } }); }
    for (const pa of this.arcFx.length ? [...this.parts, ...this.arcFx] : this.parts) { const p = proj(pa.x, pa.y); list.push({ x: pa.x, y: pa.y, z: pa.z, dist: p.depth, draw: () => { if (pa.soft) { ctx.globalAlpha = Math.min(.55, pa.life * .9); blob(p.sx, p.depth, pa.z, pa.size, pa.color); ctx.globalAlpha = 1; } else blob(p.sx, p.depth, pa.z, pa.size, pa.color); } }); }
    for (const de of [...this.debris, ...(this.arena?.rubble ?? [])]) { const p = proj(de.x, de.y); list.push({ x: de.x, y: de.y, z: 0, dist: p.depth, draw: () => { const ground = this.floorHeight(de.x, de.y); blob(p.sx, p.depth, ground + .01, .22, "#ff3355"); blob(p.sx, p.depth, ground + .005, .34 + .1 * Math.sin(this.time * 18), "rgba(255,90,60,.28)", true); if (de.t <= RUBBLE_FALL.duration) blob(p.sx, p.depth, rubbleHeight(de.t, ground), RUBBLE_FALL.radius, "#8a7a6a"); } }); }
    if (this.camPlayer) { const cp = this.camPlayer, p = proj(cp.x, cp.y), pf = this.playerFrame(cp.camAng);
      if (pf) this.lastPlayerPose = { action: pf.action, dir: pf.dir };
      if (pf?.img && p.depth > .15) { const img = pf.img; list.push({ x: cp.x, y: cp.y, z: cp.z, dist: p.depth, draw: () => {
        const gy = screenY(this.floorHeight(cp.x, cp.y), p.depth); ctx.globalAlpha = .25; ctx.fillStyle = "#080609"; ctx.beginPath(); ctx.ellipse(p.sx, gy, 16 / p.depth, 3.5 / p.depth, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
        drawImg(legible(img, RIM.self, true), p.sx, p.depth, cp.z + this.floorHeight(cp.x, cp.y) * 0, PLAYER_SPRITE_SCALE * img.height / CELL_H, this.hurtFlash > 0 ? "#ff2030" : undefined, false, 0, 1, 1, true); } }); } }
    for (const r of this.remotes) { if (r.state === "gone" || r.state === "extracted") continue; const p = proj(r.x, r.y); if (p.depth < .15 || p.depth > 24) continue;
      const ground = this.floorHeight(r.x, r.y), img = remoteFrame(r, Math.atan2(r.y - this.py, r.x - this.px), this.time + r.x * .37, ground); if (!img) continue;
      list.push({ x: r.x, y: r.y, z: r.z, dist: p.depth, draw: () => { const gy = screenY(ground, p.depth); ctx.globalAlpha = .25; ctx.fillStyle = "#080609"; ctx.beginPath(); ctx.ellipse(p.sx, gy, 16 / p.depth, 3.5 / p.depth, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = r.state === "dead" ? .35 : 1;
        drawImg(legible(img, r.color, true), p.sx, p.depth, r.z, PLAYER_SPRITE_SCALE * img.height / CELL_H, r.state === "downed" ? "#4a5a7a" : undefined, false, 0, r.state === "dead" ? .35 : 1, 1, true); ctx.globalAlpha = 1; } });
      if (p.depth < 16 && p.sx > -20 && p.sx < W + 20) this.enemyLabels.push({ x: p.sx, y: screenY(r.z + 1.3, p.depth), w: Math.max(14, 60 / p.depth), depth: p.depth, hp: Math.max(0, r.hp / Math.max(1, r.hpMax)), brk: 0, name: this.remoteName(r), state: this.remoteLabel(r), elite: false, boss: false, miniBoss: false, tele: false, retreat: false, alert: false, notice: false, ally: r.color });
    }
    for (const m of this.netMarks) { if (m.used) continue; const p = proj(m.x, m.y); if (p.depth < .2 || p.depth > 20) continue; const ground = this.floorHeight(m.x, m.y);
      list.push({ x: m.x, y: m.y, z: ground, dist: p.depth, draw: () => { blob(p.sx, p.depth, ground + .35 + Math.sin(this.time * 3) * .05, .32, m.color, true); blob(p.sx, p.depth, ground + .35, .16, "#fff1d0"); } });
      if (p.depth < 12) this.enemyLabels.push({ x: p.sx, y: screenY(ground + .9, p.depth), w: 0, depth: p.depth, hp: 0, brk: 0, name: m.label, state: "", elite: true, boss: false, miniBoss: false, tele: false, retreat: false, alert: false, notice: false, ally: m.color });
    }
    list.sort((a, b) => b.dist - a.dist).forEach((s) => s.draw(0, 0, 0, s.dist));
    // Low drifting mist, modulated by the visible surface depth instead of a flat screen veil.
    ctx.fillStyle=`rgb(${atmosphere.tint.join(',')})`;
    for(let y=0;y<H;y+=3)for(let x=0;x<W;x+=4){const depth=this.depthPixels[y*W+x],height=eye+this.rowRays[y]*Math.min(depth,8);
      if(height<.35&&height>-.1&&depth>2){ctx.globalAlpha=atmosphere.fog*(.5+.5*Math.sin(x*.07+y*.11+this.time*.6));ctx.fillRect(x,y,4,3);}}
    ctx.globalAlpha=1;
    if(altered) {ctx.globalAlpha=.14;ctx.fillStyle=altered.tint;for(let n=0;n<16;n++){const xx=(n*41+this.time*8)%W,yy=(n*29-this.time*12+H*100)%H;ctx.fillRect(xx,yy,2,2);}ctx.globalAlpha=1;}
    // lluvia / ceniza / arena
    if (this.weather === 2 || this.weather === 1 || this.weather === 5) {
      ctx.fillStyle = this.weather === 2 ? "rgba(120,255,90,0.5)" : this.weather === 1 ? "rgba(200,200,200,0.5)" : "rgba(230,160,80,0.5)";
      for (let i = 0; i < 90; i++) { const x = (i * 97 + this.time * (this.weather === 2 ? 40 : 15) * (1 + i % 3) + this.wind.x * 30 * this.time) % W, y = (i * 53 + this.time * (this.weather === 2 ? 220 : 30)) % H; ctx.fillRect((x + W) % W, y, 1, this.weather === 2 ? 4 : 1); }
    }
    ctx.restore();
    // Dash/slide: slight radial motion blur plus streak lines on the edges of the view.
    { const k = speedFx(this.dashT, this.slideT, Math.hypot(this.vx, this.vy)); if (k > 0) {
      ctx.save(); ctx.globalAlpha = .22 * k; const z = 1.035 + .03 * k; ctx.drawImage(ctx.canvas, W * (1 - z) / 2, H * (1 - z) / 2, W * z, H * z); ctx.globalAlpha = .12 * k; ctx.drawImage(ctx.canvas, W * (1 - z * z) / 2, H * (1 - z * z) / 2, W * z * z, H * z * z);
      ctx.strokeStyle = "rgba(235,230,245,1)"; ctx.lineWidth = 1;
      for (let i = 0; i < 14; i++) { const seed = Math.sin(i * 91.7 + Math.floor(this.time * 30) * 13.1) * 43758.5, f = seed - Math.floor(seed), side = i % 2 ? 1 : -1, yy = f * H, x0 = side < 0 ? 0 : W, len = (18 + f * 40) * k;
        ctx.globalAlpha = (.18 + f * .3) * k; ctx.beginPath(); ctx.moveTo(x0 - side * (4 + f * 20), yy); ctx.lineTo(x0 - side * (4 + f * 20 + len), yy + (H / 2 - yy) * .12); ctx.stroke(); }
      ctx.restore(); } }
    // arma en primera persona
    if (!this.camPlayer) this.drawWeapon(ctx);
    if (this.pitch < -.95) { const a=Math.min(1,(-this.pitch-.95)/.35);ctx.globalAlpha=a;ctx.fillStyle="#312b32";ctx.fillRect(W/2-29,H-40,17,34);ctx.fillRect(W/2+12,H-40,17,34);ctx.fillStyle="#74616b";ctx.fillRect(W/2-29,H-40,17,5);ctx.fillRect(W/2+12,H-40,17,5);ctx.globalAlpha=1; }

    // oscuridad/viñeta
    const vg = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 200);
    vg.addColorStop(0, "rgba(0,0,0,0)"); const dk = Math.max(this.darkness, this.gloom, dreadLevel(this.exp.hasMap, this.bossDead, this.misreads), this.mirrorBuff ? MIRROR.darkness : 0);
    vg.addColorStop(1, `rgba(0,0,0,${0.75 + dk * 0.25})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    if (isPariah(this.cls?.id) && !this.camPlayer && this.mode === "play") PX.drawPerception(this, ctx, W, H);
    if (dk) { const dg = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, 90); dg.addColorStop(0, "rgba(0,0,0,0)"); dg.addColorStop(1, `rgba(0,0,0,${dk})`); ctx.fillStyle = dg; ctx.fillRect(0, 0, W, H); }
    if(this.visionT>0 || this.hp<this.hpMax*.25) {const severity=Math.min(.6,this.visionT*.1+(this.hp<this.hpMax*.25?.18:0));const tunnel=ctx.createRadialGradient(W/2,H/2,22,W/2,H/2,120);tunnel.addColorStop(0,"rgba(8,4,12,0)");tunnel.addColorStop(1,`rgba(8,4,12,${severity})`);ctx.fillStyle=tunnel;ctx.fillRect(0,0,W,H);}
    if(this.denial) {ctx.fillStyle="rgba(8,4,15,0.22)";ctx.fillRect(0,0,W,H);}
    if (this.wounds.CABEZA) { ctx.globalAlpha = 0.25; ctx.drawImage(ctx.canvas, 2, 0); ctx.globalAlpha = 1; }
    // aberración cromática al recibir daño o crítico
    if (this.hurtFlash > 0 || this.critFlash > 0) {
      ctx.globalAlpha = 0.3; ctx.drawImage(ctx.canvas, 2, 0); ctx.globalAlpha = 1;
      ctx.fillStyle = this.hurtFlash > 0 ? `rgba(200,0,20,${this.hurtFlash})` : `rgba(255,220,120,${this.critFlash})`; ctx.fillRect(0, 0, W, H);
    }
    if (this.poison > 0) { ctx.fillStyle = "rgba(40,180,40,0.12)"; ctx.fillRect(0, 0, W, H); }
    if (this.burn > 0) { ctx.fillStyle = `rgba(255,90,0,${0.1 + Math.random() * 0.08})`; ctx.fillRect(0, H - 30, W, 30); }
    if (this.screamer > 0 && (this.sprites.screamer || this.sprites.boss)) { ctx.globalAlpha = Math.min(1, this.screamer * 5); ctx.drawImage(this.sprites.screamer || this.sprites.boss, W / 2 - 42, H / 2 - 50, 84, 100); ctx.fillStyle = "rgba(255,0,0,0.3)"; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    // números de daño sobre enemigos
    this.barkLabels = [];
    for (const b of this.barks) { const p = proj(b.e.x, b.e.y); if (p.depth < .3 || p.depth > 12 || p.sx < -20 || p.sx > W + 20) continue; const zi = Math.floor(clamp(p.sx, 0, W - 1)); if (this.zbuf[zi] < p.depth - .4) continue;
      this.barkLabels.push({ x: p.sx, y: screenY(b.e.z + 1.35 * (ENEMY_TYPES[b.e.kind]?.scale ?? 1), p.depth), text: b.text, a: Math.min(1, b.t * 3, (BARK_SECONDS - b.t) * 8 + .2), depth: p.depth }); }
    ctx.textAlign = "center"; ctx.font = "bold 7px monospace";
    ctx.lineJoin = "round"; for (const n of this.dmgNums) { const p = proj(n.x, n.y); if (p.depth < .3 || p.depth > 14) continue; const sy = screenY(n.z,p.depth), lk = dmgNumLook(n), fpx = Math.max(5, Math.round(lk.px * lk.scale * Math.min(1.25, Math.max(.7, 4 / p.depth)))); ctx.font = `bold ${fpx}px monospace`; ctx.globalAlpha = lk.alpha; ctx.lineWidth = 2; ctx.strokeStyle = "#000"; ctx.strokeText(n.text, p.sx, sy); ctx.fillStyle = n.color; ctx.fillText(n.text, p.sx, sy); } ctx.font = "bold 7px monospace"; { }
    ctx.globalAlpha = 1;
    // marca del objetivo asistido (táctil)
    if (this.slot === 1) { const at = this.assistTarget(shotRange(this.ranged?.base?.range ?? 10)); if (at) { const p = proj(at.e.x, at.e.y); if (p.depth > .3 && p.depth < 14) { const sy = screenY(at.e.z + .7, p.depth), r = Math.max(3, 9 / p.depth); ctx.strokeStyle = "#ffd34a"; ctx.lineWidth = 1; ctx.globalAlpha = .85; ctx.strokeRect(Math.round(p.sx - r), Math.round(sy - r), Math.round(r * 2), Math.round(r * 2)); ctx.globalAlpha = 1; } } }
    // marca de enemigo expuesto
    for (const e of this.enemies) if (!e.dead && (e.exposed ?? 0) > 0) { const p = proj(e.x, e.y); if (p.depth < .3 || p.depth > 12) continue; const sy = screenY(e.z+1.45,p.depth); ctx.fillStyle = Math.sin(this.time * 12) > 0 ? "#ff7ad9" : "#ffffff"; ctx.font = "bold 6px monospace"; ctx.fillText(Math.hypot(e.x-this.px,e.y-this.py) < 2 ? "E ROBAR · V PATADA" : "EXPUESTO", p.sx, sy); }
    // indicadores de dirección de daño y de peligro
    const arc = (worldA: number, color: string, alpha: number, r = 62, w = .32) => { const rel = Math.atan2(Math.sin(worldA - this.ang), Math.cos(worldA - this.ang)); const sa = rel - Math.PI / 2; ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(W / 2, H / 2, r, sa - w, sa + w); ctx.stroke(); ctx.fillStyle = color; const tx = W / 2 + Math.cos(sa) * (r + 7), ty = H / 2 + Math.sin(sa) * (r + 7); ctx.beginPath(); ctx.moveTo(tx + Math.cos(sa) * 5, ty + Math.sin(sa) * 5); ctx.lineTo(tx + Math.cos(sa + 2.4) * 4, ty + Math.sin(sa + 2.4) * 4); ctx.lineTo(tx + Math.cos(sa - 2.4) * 4, ty + Math.sin(sa - 2.4) * 4); ctx.fill(); ctx.lineWidth = 1; ctx.globalAlpha = 1; };
    for (const h of this.hitDirs) arc(h.a, "#ff1a2e", Math.min(1, h.t));
    for (const e of this.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - this.px, e.y - this.py); if (e.tele > 0 && e.aware && d < 9) arc(Math.atan2(e.y - this.py, e.x - this.px), "#ffd34a", .5 + .5 * Math.sin(this.time * 20), 54, .22); else if (e.ambush?.stage === "warning") arc(Math.atan2(e.y - this.py, e.x - this.px), "#c35bff", .9, 54, .28); }
    for (const de of [...this.debris, ...(this.arena?.rubble ?? [])]) { const d = Math.hypot(de.x - this.px, de.y - this.py); if (d < 4.5 && de.t > 0) arc(Math.atan2(de.y - this.py, de.x - this.px), "#c9a27a", .55 + .45 * Math.sin(this.time * (d < 1.2 ? 30 : 14)), 40, .26); }
    for (const pr of this.projs) { if (pr.friendly) continue; const dx = this.px - pr.x, dy = this.py - pr.y, d = Math.hypot(dx, dy); if (d < 6 && (dx * pr.dx + dy * pr.dy) > 0) arc(Math.atan2(pr.y - this.py, pr.x - this.px), "#ff8a2a", .8, 48, .16); }
    // grano + scanlines
    ctx.fillStyle = "rgba(0,0,0,0.18)"; for (let y = 0; y < H; y += 2) ctx.fillRect(0, y, W, 1);
    for (let i = 0; i < 160; i++) { ctx.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.1)"; ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1); }
    // mira
    ctx.fillStyle = "#ff3355"; ctx.fillRect(W / 2, H / 2, 1, 1);
    if (this.slot === 1) { const gap = Math.round(1.5 * (1 - this.aimBlend) * (this.crouching ? .5 : 1)); ctx.fillStyle = aimedReady(this.aiming,this.aimT) ? "#ffd34a" : "rgba(232,214,184,.85)"; ctx.fillRect(W/2-gap-1,H/2,1,1); ctx.fillRect(W/2+gap+1,H/2,1,1); ctx.fillRect(W/2,H/2-gap-1,1,1); ctx.fillRect(W/2,H/2+gap+1,1,1); }
    if(this.aiming){ctx.strokeStyle=aimedReady(this.aiming,this.aimT)?"#ffd34a":"#e8d6b8";ctx.lineWidth=1;ctx.beginPath();ctx.arc(W/2+.5,H/2+.5,3,-Math.PI/2,-Math.PI/2+Math.max(.03,this.aimT)*Math.PI*2);ctx.stroke();}
    if (this.chargeT > 0.1 && this.slot === 0) { ctx.strokeStyle = this.chargeT >= meleeMode(this.melee.base,true).charge-.001 ? "#ff7ad9" : "#fff"; ctx.beginPath(); ctx.arc(W / 2, H / 2, 6, -Math.PI / 2, -Math.PI / 2 + Math.min(1, this.chargeT / meleeMode(this.melee.base,true).charge) * Math.PI * 2); ctx.stroke(); }
  }

  drawWeapon(ctx: CanvasRenderingContext2D) {
    if (drawPickup(this, ctx, W, H)) return;
    if (isPariah(this.cls?.id) && PX.drawFists(this, ctx, W, H)) return;
    const w = this.slot === 0 ? this.melee : this.ranged;
    if (!w?.base) return;
    const sp = Math.hypot(this.vx, this.vy);
    const bobX = Math.sin(this.time * 9) * 8 * Math.min(1, sp / 3), bobY = Math.abs(Math.cos(this.time * 9)) * 7 * Math.min(1, sp / 3);
    const progress=1-this.swingT/this.swingMax;
    const sw=this.swingT>0?Math.sin(Math.min(1,progress)*Math.PI)*.25:0;
    const type = w.base?.type;
    const imageKey = type === "MARTILLO" || type === "HACHA" ? "hammer" : type === "GUADAÑA" ? "scythe" : type === "BASTON" || type === "FOCO" ? "staff" : ["ESCOPETA","RIFLE","FUSIL","SUBFUSIL","AMETRALLADORA"].includes(type) ? "shotgun" : w.base?.ranged ? "revolver" : "sword";
    const weaponImage = this.sprites[imageKey] ?? this.weaponImg;
    if (weaponImage) {
      const charge = Math.min(1, this.chargeT / meleeMode(this.melee.base,true).charge);
      ctx.save();
      const thrust=["LANZA","DAGA","BASTON"].includes(type);
      ctx.translate(W * (.72-.18*this.aimBlend) + bobX*(1-this.aimBlend) - (thrust?sw*50:sw*260) + charge * 20, H + 10 + bobY + charge * 15 - this.vz * 1.5);
      const heavy = imageKey === "hammer" || imageKey === "scythe";
      ctx.rotate((thrust?-sw*.7:-sw*(heavy?7:5))*(this.attackAlternate?-1:1)+charge*(heavy?.7:.4));
      if(thrust)ctx.scale(1+sw,1+sw);
      if (w.base?.ranged) { ctx.translate(sw*35,sw*80); if(sw>.08) {ctx.fillStyle="#ffd34a";ctx.beginPath();ctx.moveTo(-20,-115);ctx.lineTo(-40,-145);ctx.lineTo(-16,-134);ctx.lineTo(0,-148);ctx.lineTo(0,-115);ctx.fill();} }
      const imageH = w.base?.ranged ? 105 : 140;
      ctx.drawImage(weaponImage, -55, -imageH, imageH * weaponImage.width / weaponImage.height, imageH);
      // tinte del arma
      ctx.restore(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      if (sw > 0.05) { ctx.strokeStyle = `rgba(255,60,90,${sw * 3})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(W / 2, H * 0.9, 90, Math.PI * 1.1, Math.PI * 1.1 + (0.25 - sw) * 8); ctx.stroke(); ctx.lineWidth = 1; }
    } else {
      // arma de fuego pixelart procedural
      const x = W / 2 + 30 + bobX, y = H - 40 + bobY + sw * 25;
      const c = w.base!.color;
      ctx.fillStyle = "#1a0f14"; ctx.fillRect(x - 12, y + 10, 34, 40);
      ctx.fillStyle = c; ctx.fillRect(x - 6, y - 10, 14, 50); ctx.fillStyle = "#2a1a20"; ctx.fillRect(x - 2, y - 26, 6, 20);
      ctx.fillStyle = "#c4121e"; ctx.fillRect(x - 4, y + 4, 10, 3); ctx.fillRect(x - 4, y + 16, 10, 2);
      ctx.fillStyle = "#ffd34a"; ctx.fillRect(x + 6, y - 6, 2, 30);
      if (w.base!.type === "FOCO") { ctx.fillStyle = `rgba(180,90,255,${0.5 + Math.sin(this.time * 6) * 0.3})`; ctx.fillRect(x - 6, y - 34, 14, 14); }
      if (this.muzzle > 0) { ctx.fillStyle = "#ffe08a"; ctx.fillRect(x - 10, y - 46, 22, 20); ctx.fillStyle = "#fff"; ctx.fillRect(x - 3, y - 40, 8, 10); }
    }
  }

  variants = new Map<string, HTMLCanvasElement>();
  private hole?: HTMLCanvasElement;
  /** Procedural bullet-hole decal: dark crater, pale chipped rim and hairline cracks. */
  holeSprite() {
    if (this.hole) return this.hole; const c = document.createElement("canvas"); c.width = c.height = 16; const x = c.getContext("2d"); this.hole = c; if (!x) return c;
    x.fillStyle = "rgba(160,150,140,.55)"; x.beginPath(); x.arc(8, 8, 5.5, 0, Math.PI * 2); x.fill();
    x.strokeStyle = "rgba(20,14,16,.8)"; x.lineWidth = 1; for (let i = 0; i < 5; i++) { const a = i * 1.37 + .4; x.beginPath(); x.moveTo(8, 8); x.lineTo(8 + Math.cos(a) * (6 + i % 3), 8 + Math.sin(a) * (6 + i % 3)); x.stroke(); }
    x.fillStyle = "#1a1214"; x.beginPath(); x.arc(8, 8, 3.4, 0, Math.PI * 2); x.fill(); x.fillStyle = "#000"; x.beginPath(); x.arc(8.4, 8.4, 2, 0, Math.PI * 2); x.fill();
    return c;
  }
  variant(img: HTMLImageElement | HTMLCanvasElement, col: string) {
    let id = this.animationIds.get(img); if (id === undefined) { id=this.nextAnimationId++; this.animationIds.set(img,id); }
    const k = id + col; let c = this.variants.get(k); const fresh = isLiveSprite(img);
    if (!c || fresh) { c ??= document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); if (!x) return c; x.clearRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0); x.globalCompositeOperation = "source-atop"; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); this.variants.set(k, c); }
    return c;
  }
  snapshot() {
    return {
      difficulty: this.difficulty.name, adapt: this.adapt,
      expedition: this.bossRequired ? { phase: this.expPhase(), phaseName: PHASE_NAMES[this.expPhase()], noteRead: this.exp.noteRead, unlocked: this.exp.unlocked, hasMap: this.exp.hasMap, bossDead: this.bossDead } : null, collapse: this.collapse ? { t: Math.max(0, this.collapse.t), max: this.collapse.max, progress: collapseProgress(this.collapse.t, this.collapse.max) } : null, hasBook: this.palim.hasBook,
      classSkill: (() => { const s = this.classSkill(); return s ? { name: s.name, desc: s.desc, ready: this.skillCharge >= s.need, pct: Math.min(1, this.skillCharge / s.need), charge: s.charge, need: s.need, buff: Math.max(0, this.skillBuffT) } : null; })(),
      sanityFx: this.sanityFx?.fx ?? null, threat: this.threat, evoPulse: this.evoPulse > 0, evoTraits: this.evoTraits,
      pactCount: this.pacts.length, visitedCount: this.visitedZones.size, crit: this.critFlash > 0,
      aiming:this.aiming, aimT:this.aimT, crouching:this.crouching, swapStacks:this.swapT>0?this.swapStacks:0, airborne:this.pz>this.floorHeight()+.15, chargeT:this.chargeT, attackCd:Math.max(0,this.attackCd),
      hp: this.hp, hpMax: this.hpMax, stam: this.stam, stamMax: this.stamMax, mh: this.mh, mhMax: this.mhMax, lumbre: this.lumbre, lumbreMax: this.lumbreMax, breakValue: this.breakValue, breakMax: this.breakMax,
      score: this.score.total, scoreFx: this.score.recent.map(r => ({ ...r })), food: this.food, thirst: this.thirst, level: this.level, xp: this.xp, xpNext: this.xpNext, gold: this.gold, ammo: this.ammo, magazine: this.ranged.mag ?? 0, magazineMax: this.ranged.magMax ?? 0, reloadT: this.reloadT, bombs: this.bombs, keys: this.keys,
      grado: this.grado, mt: this.mt, cycles: this.cycles, soulState: this.soulState(), resonance: this.resonance, mastery: this.mastery, activePact: this.activePact?.id ?? null, parryT: this.parryT, blocking: this.blocking, playerStagger: this.playerStagger,
      regionName: this.region.name, objective: this.regionCollected ? "Atesorado · busca el umbral" : this.region.objective, interactionPrompt: this.interactionPrompt, sanctuaryT: this.region.id === "garden" ? this.sanctuaryT : null,
      safe:this.isSafe(),restHealed:this.restHealed, alteration:this.alterationAt(), xpMult:this.xpMult(), denial:this.denial ? {...this.denial}:null, fear:this.fear, visionT:this.visionT, bossRequired:this.bossRequired, floorKills:this.floorKills, pressure:floorPressure(this.floor), clearedRooms:this.clearedZones.size, totalRooms:this.zones.length, inked:this.inked>0, raid:this.raid ? {wave:this.raid.wave,remaining:this.raid.remaining}:null,
      combo: this.combo, killStreak: this.killStreak, streakT: this.streakT, streakMax: this.streakMax, frenzy: this.frenzyFx(), fatigue: this.fatigue, needBlur: this.needBlur, need: this.needFx().active, sitting: this.sitting, mirror: this.mirrorBuff ? { name: MIRROR_BUFFS[this.mirrorBuff.id].name, desc: MIRROR_BUFFS[this.mirrorBuff.id].desc, t: this.mirrorBuff.t } : null, attrPoints: this.attrPoints, chipMult: this.chipMult(), floor: this.floor, temp: this.temp, zone: this.zoneAt(), lock: { lvl: this.legacy.lockLvl, xp: this.legacy.lockXp, need: this.legacy.lockLvl * 3 + 3 }, sneaking: this.sneaking, stillT: this.stillT, watchers: this.enemies.filter(e => !e.dead && !e.aware && (e.notice ?? 0) > 0.15).length, alerted: this.enemies.filter(e => !e.dead && e.aware && Math.hypot(e.x - this.px, e.y - this.py) < 14).length, contract: this.contract ? { ...this.contract } : null, marks: this.pickups.filter(p => !p.used && ["shop","chest","altar","portal","key","lore"].includes(p.kind)).map(p => ({ x: p.x, y: p.y, k: p.kind })), elites: this.enemies.filter(e => e.elite || e.kind === "librero").map(e => ({ x: e.x, y: e.y })), weather: WEATHERS[this.weather], event: this.eventName, challenge: this.challenge ? { ...this.challenge } : null,
      weapon: this.slot === 0 ? this.melee : this.ranged, wounds: Object.keys(this.wounds), burn: this.burn > 0, poison: this.poison > 0, bleed: this.bleed > 0,
      log: [...this.log], floats: [...this.floats], boss: this.enemies.find((e) => e.kind === "librero"), onWall: this.wallT, sp: this.sp,
      map: this.map, px: this.px, py: this.py, ang: this.ang, enemies: this.enemies.map((e) => ({ x: e.x, y: e.y })),
    };
  }
}
const RARITY_C = ["#c9c3d6", "#5aa7ff", "#ffd34a", "#c35bff", "#ff6a2a"];
export const MAP_SIZE = MAP;
