// Extra enemy roles and boss bullet-cloud patterns (browser-safe, pure).
export type EnemyRole = "kamikaze" | "gunner" | "lobber";

export const ROLES = {
  // probability per eligible melee enemy
  kamikazeChance: 0.14, gunnerChance: 0.14, lobberChance: 0.1,
  kamikazeSpeed: 1.9, kamikazeTrigger: 1.4, kamikazeFuse: 0.45, kamikazeRadius: 2.4, kamikazeDmg: 2.2,
  gunRange: 12, gunSpeed: 13, gunDmg: 0.55, gunCd: [1.8, 2.8] as [number, number],
  lobCd: [2.6, 3.8] as [number, number], lobDmg: 1, lobRadius: 2.2, gravity: 9,
  cloudCd: [6, 9] as [number, number], cloudLife: 7, cloudBounces: 6, cloudDmg: 0.45, ceiling: 2.2,
} as const;

export const ROLE_LABEL: Record<EnemyRole, string> = { kamikaze: "SUICIDA", gunner: "TIRADOR", lobber: "LANZABOMBAS" };

/** Only plain melee patterns get a role; ranged/support enemies already have their own attacks. */
const MELEE = new Set(["chase", "charger", "pounce", "zealot", "flanker", "guard", "knight", "jumper", "blink", "leech", "mimic", "hook"]);

export function rollEnemyRole(pattern: string, r: number): EnemyRole | undefined {
  if (!MELEE.has(pattern)) return undefined;
  if (r < ROLES.kamikazeChance) return "kamikaze";
  if (r < ROLES.kamikazeChance + ROLES.gunnerChance) return "gunner";
  if (r < ROLES.kamikazeChance + ROLES.gunnerChance + ROLES.lobberChance) return "lobber";
  return undefined;
}

export type CloudShot = { a: number; speed: number; dz: number; h: number; ring: number };
export const CLOUD_PATTERNS = ["anillo", "espiral", "caos", "flor"] as const;

/** Random bullet-hell pattern: ring, spiral, chaotic scatter or flower. */
export function cloudPattern(rand: () => number, enraged: boolean): CloudShot[] {
  const kind = Math.floor(rand() * CLOUD_PATTERNS.length);
  const n = Math.floor(18 + rand() * 14) + (enraged ? 12 : 0);
  const base = rand() * Math.PI * 2, out: CloudShot[] = [];
  for (let i = 0; i < n; i++) {
    const f = i / n;
    let a = base + f * Math.PI * 2, speed = 3.5, dz = (rand() - .5) * 2, ring = 0;
    if (kind === 1) { a = base + f * Math.PI * 6; speed = 2.5 + f * 3; ring = f; }
    else if (kind === 2) { a = base + rand() * Math.PI * 2; speed = 2 + rand() * 4; dz = (rand() - .3) * 4; }
    else if (kind === 3) { speed = 3 + Math.sin(f * Math.PI * 10) * 1.5; dz = Math.cos(f * Math.PI * 6) * 1.5; }
    out.push({ a, speed, dz, h: rand() * .6, ring });
  }
  return out;
}
