/** Difficulty presets (chosen at run start) and dynamic challenge adjustment. Browser-safe, pure. */
export type DifficultyId = "facil" | "normal" | "dificil" | "pesadilla";
export interface Difficulty { id: DifficultyId; name: string; desc: string; enemyDmg: number; enemyHp: number; evade: number }
export const DIFFICULTIES: Difficulty[] = [
  { id: "facil", name: "Fácil", desc: "Golpes suaves, esquivan poco", enemyDmg: .7, enemyHp: .85, evade: .5 },
  { id: "normal", name: "Normal", desc: "Reto equilibrado", enemyDmg: 1, enemyHp: 1, evade: 1 },
  { id: "dificil", name: "Difícil", desc: "Pegan más y esquivan más", enemyDmg: 1.25, enemyHp: 1.15, evade: 1.3 },
  { id: "pesadilla", name: "Pesadilla", desc: "Castigo total", enemyDmg: 1.5, enemyHp: 1.3, evade: 1.6 },
];
export const getDifficulty = (id: string | null | undefined): Difficulty => DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1]!;

/** Dynamic adjustment: 'adapt' drifts within [min,max]; struggling lowers it, dominating raises it. */
export const ADAPT = { min: .8, max: 1.2, hurtStep: .015, killStep: .01, deathlessDrift: .002 };
export const clampAdapt = (v: number) => Math.min(ADAPT.max, Math.max(ADAPT.min, v));
/** Player took damage: bigger share of max HP → bigger ease-off; extra ease when below 30% HP. */
export function adaptOnHurt(adapt: number, dmg: number, hpMax: number, hpAfter: number) {
  const share = Math.min(1, dmg / Math.max(1, hpMax));
  return clampAdapt(adapt - ADAPT.hurtStep * (1 + share * 4) - (hpAfter < hpMax * .3 ? ADAPT.hurtStep : 0));
}
/** Player killed an enemy: harder when healthy. */
export function adaptOnKill(adapt: number, hp: number, hpMax: number) {
  return clampAdapt(adapt + (hp > hpMax * .6 ? ADAPT.killStep : ADAPT.killStep * .3));
}
/** Final multipliers combining preset and adaptation. */
export const challenge = (d: Difficulty, adapt: number) => ({ dmg: d.enemyDmg * adapt, hp: d.enemyHp * (1 + (adapt - 1) * .5), evade: d.evade * adapt });

/** Periodic performance review (every PERF.window s): heavy damage taken eases, fast clean kills harden. Returns adapt delta. */
export const PERF = { window: 20, step: .04 };
export function performanceDelta(dmgTaken: number, hpMax: number, kills: number) {
  const hurt = dmgTaken / Math.max(1, hpMax);
  if (hurt > .6) return -PERF.step * 1.5;
  if (hurt > .3) return -PERF.step;
  if (kills >= 3 && hurt < .1) return PERF.step;
  if (kills >= 1 && hurt < .2) return PERF.step * .5;
  return 0;
}

/** Dodge notices: wording/colour per reason; display mode chosen by the player. */
export type DodgeReason = "projectile" | "charge" | "afterSwing" | "lowHp" | "feint";
export type DodgeMsgMode = "todos" | "cerca" | "off";
export const DODGE_MSG_MODES: { id: DodgeMsgMode; name: string }[] = [
  { id: "todos", name: "Todos" }, { id: "cerca", name: "Solo cercanos" }, { id: "off", name: "Apagados" },
];
export const DODGE_MSG: Record<DodgeReason, { text: string; color: string }> = {
  projectile: { text: "ESQUIVA TU DISPARO", color: "#7ad8ff" },
  charge: { text: "RETROCEDE ANTE TU CARGA", color: "#ffb347" },
  afterSwing: { text: "SE APARTA TRAS GOLPEAR", color: "#ffd34a" },
  lowHp: { text: "HUYE HERIDO", color: "#ff6a6a" },
  feint: { text: "FINTA", color: "#c9a0ff" },
};
export function dodgeNotice(mode: DodgeMsgMode, dist: number, name: string, reason: DodgeReason) {
  if (mode === "off" || (mode === "cerca" && dist > 4)) return null;
  const m = DODGE_MSG[reason];
  return { text: `${name} · ${m.text}!`, color: m.color };
}
