/**
 * Separación del estado de `Game` entre jugador y mundo compartido para la simulación multijugador.
 * El servidor guarda un "contexto" por jugador (estas claves) y lo carga en la única partida del mundo
 * antes de simular el turno de ese jugador.
 */

export const PLAYER_KEYS = [
  "mode", "score", "recap", "recapChecks", "floorDamage", "lastDefT", "needWarn", "choice", "cls",
  "px", "py", "pz", "vz", "ang", "pitch", "vx", "vy", "jumps", "dashT", "dashCd", "dashes", "slideT", "wallT", "onWall", "wallNx", "wallNy",
  "crouching", "poundZ", "swapStacks", "swapT", "sinceHit", "vaultDoors", "aiming", "aimT", "aimBlend", "attackAlternate", "swingMax", "hitGrace",
  "chargeT", "attackCd", "swingT", "stampede", "shieldEnemy", "shieldT", "slowmo", "level", "xp", "xpNext", "sp", "gold", "anima",
  "grado", "mt", "cycles", "resonance", "mastery", "mtAwardedRun", "adapt", "evadeMsgAt", "perfT", "perfDmg", "perfKills",
  "hp", "hpMax", "stam", "stamMax", "mh", "mhMax", "lumbre", "lumbreMax", "def", "breakValue", "breakMax", "capacity",
  "playerStagger", "breakDelay", "blocking", "perfectBlockT", "parryT", "parryCd", "reloadT", "reloadProgress",
  "activePact", "pactCooldowns", "pactBaneT", "epiphanyLastStand", "detectionRadius", "food", "thirst", "ammo", "bombs", "keys",
  "wounds", "burn", "poison", "bleed", "skills", "pacts", "epiph", "bag", "mats", "cons", "melee", "ranged", "armor", "slot",
  "combo", "comboT", "kills", "meleeStep", "meleeLast", "levelPerks", "hitDirs", "dmgNums", "floats", "log", "chronicles",
  "extractionConditions", "chronicleAttempt", "runFloors", "runName", "runId", "barks", "barkLabels", "meleeHitStep",
  "shake", "hurtFlash", "critFlash", "dotMsgCd", "lastHurt", "hurtCounts", "deathCause", "challenge",
  "stillT", "lastDashT", "sneaking", "ductMsgT", "ceilMsgT", "safeX", "safeY", "killStreak", "streakT", "streakMax",
  "fatigue", "needEpisodeT", "needBlur", "sitting", "vendorTalkCd", "mirrorBuff", "attrs", "attrPoints", "subclassId",
  "skillCharge", "skillBuffT", "skillPick", "skillRun", "classRewards", "xpLog", "floorDamageXp", "xpFrac",
  "prev", "lookPendingX", "lookPendingY", "stepAcc", "prevSpeed", "wallFxT", "pounding", "muzzle", "lastWeapon", "guideT", "guideCd",
  "pushT", "pushX", "pushY", "fear", "visionT", "horrorCd", "sanity", "sanityFx", "sanityRollT", "phantoms", "lastHp", "lastPactCount",
  "burstQueue", "slideHits", "restHealed", "restInside", "temp", "sideQuest", "questHistory", "merchantTalks", "merchantQuest", "journal",
  "palim", "palimMemento", "palimView", "interactionPrompt", "erasedAt", "inked", "contract", "legacy",
] as const;
export type PlayerKey = (typeof PLAYER_KEYS)[number];
export const PLAYER_SET: ReadonlySet<string> = new Set(PLAYER_KEYS);

/** Temporizadores del mundo que sólo avanzan una vez por tick (en el turno del jugador "principal"). */
export const ONCE_KEYS = ["time", "weatherT", "eventT", "eventLeft", "weather", "merchantCd", "flowT", "feudT", "bossPulseT", "evoPulse", "lairWarnT", "portalMsgT", "darkness", "gloom", "screamer", "fxSeed"] as const;

/** Claves que el cliente mantiene localmente (mira y cámara) y no sobrescribe con el servidor. */
export const CLIENT_KEEP: ReadonlySet<string> = new Set(["ang", "pitch", "lookPendingX", "lookPendingY", "prev", "camera", "viewBasis", "worldReticle", "camPlayer", "lastPlayerPose", "sway", "swayLast", "menuTab", "barkLabels", "dmgNums", "skillPick", "chronicles", "score", "mode", "legacy", "palim"]);

/** Mundo que no se envía: buffers de dibujo, texturas, cachés, callbacks y listas con su propio canal. */
export const WORLD_SKIP: ReadonlySet<string> = new Set([
  "enemies", "projs", "pickups", "map", "region", "difficulty", "zbuf", "tex", "tex2", "sprites", "weaponImg", "buf", "buf32", "animationIds",
  "nextAnimationId", "animations", "poseCache", "animationQueue", "animationWorking", "regionTextures", "depthPixels", "gDepth", "gInfo", "sDepth",
  "gfxCam", "gfxRowRays", "rowRays", "groundTextures", "scenicRooms", "scenicLight", "flow", "projSprites", "fxImages", "fragmentCanvas", "variants",
  "hole", "parts", "marks", "flyers", "gibs", "puddles", "explosions", "arcFx", "enemyLabels", "barkLabels", "remotes", "netMarks", "retreatCue",
  "musicOn", "rhythmHint", "partCap", "dustT", "ceilFxT", "sanT", "fxAcc", "dripAcc", "stepFxT", "doorAnim", "doorSpd", "camera", "pos",
  "menuTab", "wikiFocus", "wikiFocusKey", "touchAssist", "waves", "lookPendingX", "lookPendingY", "dodgeMsgs", "fragmentSerial", "vendorLines",
]);

/** Campos de enemigo que no viajan (cachés de dibujo y conjuntos internos). */
export const ENEMY_SKIP: ReadonlySet<string> = new Set(["spriteCuts", "cutFrames", "dodgedProj", "chainHit", "netSkip", "netOwner", "fragmentHits"]);
export const PICKUP_SKIP: ReadonlySet<string> = new Set(["netId", "bob"]);

type Bag = Record<string, unknown>;
export function captureCtx(game: object, into: Bag = {}) { const g = game as Bag; for (const k of PLAYER_KEYS) into[k] = g[k]; return into; }
export function loadCtx(game: object, ctx: Bag) { const g = game as Bag; for (const k of PLAYER_KEYS) if (k in ctx) g[k] = ctx[k]; }
export function saveOnce(game: object) { const g = game as Bag, o: Bag = {}; for (const k of ONCE_KEYS) o[k] = g[k]; return o; }
export function restoreOnce(game: object, o: Bag) { const g = game as Bag; for (const k of ONCE_KEYS) g[k] = o[k]; }
/** Claves de mundo sincronizables de un objeto Game. */
export const worldKeys = (game: object) => Object.keys(game).filter(k => !PLAYER_SET.has(k) && !WORLD_SKIP.has(k) && typeof (game as Bag)[k] !== "function");
