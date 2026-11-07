// ARS ANIMA: "IL'INCONNU" — datos adaptados del Manual Extendido Unificado y del código C++ 0.3.0
export type Attr = "FUE" | "AGI" | "RES" | "INT" | "VOL" | "PER" | "PRE" | "SUE";
export const ATTRS: Attr[] = ["FUE", "AGI", "RES", "INT", "VOL", "PER", "PRE", "SUE"];

// d120 -> modificador −4…+4 (manual)
export const modD120 = (raw: number) => raw <= 10 ? -4 : raw <= 25 ? -3 : raw <= 40 ? -2 : raw <= 55 ? -1 : raw <= 70 ? 0 : raw <= 85 ? 1 : raw <= 100 ? 2 : raw <= 110 ? 3 : 4;

export interface ClassDef {
  id: string; name: string; desc: string; raw: Record<Exclude<Attr, "SUE">, number> & Partial<Record<"SUE", number>>;
  melee: string; ranged: string; perk: string; secret?: boolean;
}
export const CLASSES: ClassDef[] = [
  { id: "duelista", name: "DUELISTA", desc: "Combos rápidos y críticos.", perk: "+10% crítico, combos duran más",
    raw: { FUE: 90, AGI: 105, RES: 80, INT: 70, VOL: 75, PER: 90, PRE: 80, SUE: 72 }, melee: "ESPADA", ranged: "REVOLVER" },
  { id: "cazador", name: "CAZADORA", desc: "Armas a distancia y trampas.", perk: "+25% daño a distancia, desarma trampas",
    raw: { FUE: 75, AGI: 95, RES: 80, INT: 75, VOL: 70, PER: 110, PRE: 80, SUE: 88 }, melee: "DAGA", ranged: "BALLESTA" },
  { id: "guardian", name: "GUARDIÁN", desc: "Aguante, Break y escudos humanos.", perk: "+2 DEF, +40% Break",
    raw: { FUE: 105, AGI: 70, RES: 110, INT: 65, VOL: 85, PER: 75, PRE: 80, SUE: 64 }, melee: "MARTILLO", ranged: "ESCOPETA" },
  { id: "resonante", name: "RESONANTE", desc: "Lumbre, focos arcanos y epifanías.", perk: "+3 Lumbre, Foco perfora",
    raw: { FUE: 65, AGI: 80, RES: 75, INT: 110, VOL: 105, PER: 85, PRE: 90, SUE: 92 }, melee: "BASTON", ranged: "FOCO" },
  { id: "alquimista", name: "ALQUIMISTA", desc: "Crafteo doble y venenos.", perk: "Crafteo x2, inmune a lluvia tóxica",
    raw: { FUE: 75, AGI: 85, RES: 90, INT: 100, VOL: 80, PER: 90, PRE: 75, SUE: 108 }, melee: "HACHA", ranged: "PISTOLA" },
  { id: "acrobata", name: "ACRÓBATA", desc: "Triple salto, paredes y pisotones.", perk: "Salto extra, dash sin coste",
    raw: { FUE: 80, AGI: 115, RES: 80, INT: 70, VOL: 75, PER: 90, PRE: 85, SUE: 78 }, melee: "LANZA", ranged: "ARCO" },
  { id: "guerrero", name: "GUERRERO", desc: "Primera línea, rupturas y golpes de peso.", perk: "+2 Break al impacto; bloqueo reforzado",
    raw: { FUE: 112, AGI: 78, RES: 105, INT: 60, VOL: 85, PER: 75, PRE: 82, SUE: 96 }, melee: "MANDOBLE", ranged: "ESCOPETA" },
  { id: "tecnomante", name: "TECNOMANTE", desc: "Armas de pólvora, mecanismos y munición medida.", perk: "Recarga 25% más rápida; +12 reserva inicial",
    raw: { FUE: 72, AGI: 90, RES: 80, INT: 108, VOL: 86, PER: 103, PRE: 78, SUE: 70 }, melee: "BASTON", ranged: "RIFLE" },
  { id: "hereje", name: "HEREJE", desc: "Pactos peligrosos y manifestaciones de sombra.", perk: "+2 Lumbre máxima; crítica arcana restaura 1 Lumbre",
    raw: { FUE: 76, AGI: 88, RES: 72, INT: 105, VOL: 112, PER: 82, PRE: 90, SUE: 84 }, melee: "GUADAÑA", ranged: "FOCO" },
  { id: "ocultista", name: "OCULTISTA", desc: "Maldiciones, sangre y runas prohibidas.", perk: "Críticos aplican sangrado; +1 Lumbre al rematar",
    raw: { FUE: 70, AGI: 92, RES: 74, INT: 108, VOL: 110, PER: 86, PRE: 88, SUE: 90 }, melee: "DAGA", ranged: "FOCO" },
  { id: "ingeniero", name: "INGENIERO", desc: "Pólvora del Engranaje Silente y explosivos.", perk: "+2 bombas por piso; recarga 20% más rápida",
    raw: { FUE: 86, AGI: 82, RES: 92, INT: 104, VOL: 78, PER: 100, PRE: 84, SUE: 74 }, melee: "MARTILLO", ranged: "RIFLE" },
  { id: "peregrino", name: "PEREGRINO", desc: "Supervivencia, hallazgos y voluntad obstinada.", perk: "Más recursos; comida y sed caen más lento",
    raw: { FUE: 82, AGI: 88, RES: 102, INT: 86, VOL: 106, PER: 96, PRE: 84, SUE: 112 }, melee: "LANZA", ranged: "PISTOLA" },
  // Clases secretas (desbloqueo en secret-classes.ts)
  { id: "cuervo", name: "CUERVO DE NUNCA MÁS", desc: "Cazador de tiranos y élites; vuela entre sombras.", perk: "+25% daño a Tiranos, élites y minijefes; 5% robo de vida", secret: true,
    raw: { FUE: 88, AGI: 108, RES: 78, INT: 84, VOL: 92, PER: 104, PRE: 86, SUE: 80 }, melee: "GUADAÑA", ranged: "BALLESTA" },
  { id: "archivista", name: "ARCHIVISTA DE BABEL", desc: "Lee la tinta viva: aprende más rápido que nadie.", perk: "+30% EXP; +2 Lumbre máxima", secret: true,
    raw: { FUE: 62, AGI: 82, RES: 76, INT: 118, VOL: 104, PER: 98, PRE: 88, SUE: 94 }, melee: "BASTON", ranged: "FOCO" },
  { id: "campanero", name: "CAMPANERO SIN CAMPANA", desc: "Golpea al compás de la campana que nunca suena.", perk: "+15% daño cuerpo a cuerpo; +40% Break", secret: true,
    raw: { FUE: 110, AGI: 76, RES: 104, INT: 70, VOL: 96, PER: 80, PRE: 84, SUE: 86 }, melee: "MARTILLO", ranged: "ESCOPETA" },
  // P.A.R.I.A.H: clase secreta oculta hasta su desbloqueo (reglas en pariah.ts / pariah-runtime.ts).
  { id: "pariah", name: "P.A.R.I.A.H", desc: "The Unbound Outcast · cañón de cristal: el cuerpo es el único arsenal.", perk: "Puños deterministas ×1,8 sin críticos; sin armas ni armadura; nuca expuesta ×2,5", secret: true,
    raw: { FUE: 112, AGI: 84, RES: 108, INT: 60, VOL: 80, PER: 66, PRE: 78, SUE: 60 }, melee: "PUÑOS", ranged: "RUINAS" },
];

export interface WeaponBase {
  type: string; ranged: boolean; dice: [number, number]; range: number; rate: number;
  pellets?: number; projectile?: boolean; breakB: number; color: string; ammo: number; magazine?: number; reloadTime?: number;
}
export const WEAPONS: WeaponBase[] = [
  { type: "DAGA", ranged: false, dice: [1, 4], range: 1.6, rate: 0.22, breakB: 1, color: "#c9c3d6", ammo: 0 },
  { type: "ESPADA", ranged: false, dice: [1, 8], range: 2.0, rate: 0.36, breakB: 2, color: "#e33c4a", ammo: 0 },
  { type: "LANZA", ranged: false, dice: [1, 8], range: 2.8, rate: 0.42, breakB: 2, color: "#d9a441", ammo: 0 },
  { type: "HACHA", ranged: false, dice: [1, 10], range: 1.9, rate: 0.5, breakB: 3, color: "#b7b0a4", ammo: 0 },
  { type: "MARTILLO", ranged: false, dice: [1, 10], range: 1.9, rate: 0.62, breakB: 5, color: "#5b7bd1", ammo: 0 },
  { type: "MANDOBLE", ranged: false, dice: [2, 6], range: 2.3, rate: 0.7, breakB: 4, color: "#9e2734", ammo: 0 },
  { type: "GUADAÑA", ranged: false, dice: [1, 12], range: 2.5, rate: 0.6, breakB: 3, color: "#8a4fd6", ammo: 0 },
  { type: "BASTON", ranged: false, dice: [1, 6], range: 2.2, rate: 0.34, breakB: 2, color: "#3fd6b4", ammo: 0 },
  { type: "PISTOLA", ranged: true, dice: [1, 8], range: 14, rate: 0.3, breakB: 1, color: "#d0703a", ammo: 1, magazine: 10, reloadTime: 1.05 },
  { type: "REVOLVER", ranged: true, dice: [2, 8], range: 12, rate: 0.45, breakB: 1, color: "#c9c3d6", ammo: 1, magazine: 6, reloadTime: 1.45 },
  { type: "ESCOPETA", ranged: true, dice: [2, 6], range: 6, rate: 0.8, pellets: 5, breakB: 2, color: "#9b5d2c", ammo: 1, magazine: 6, reloadTime: 1.7 },
  { type: "RIFLE", ranged: true, dice: [1, 10], range: 18, rate: 0.14, breakB: 1, color: "#666b78", ammo: 1, magazine: 24, reloadTime: 1.9 },
  { type: "SUBFUSIL", ranged: true, dice: [1, 6], range: 12, rate: 0.12, breakB: 1, color: "#8a8f9c", ammo: 1, magazine: 30, reloadTime: 1.6 },
  { type: "FUSIL", ranged: true, dice: [1, 12], range: 20, rate: 0.16, breakB: 2, color: "#5d5a4c", ammo: 1, magazine: 21, reloadTime: 2.0 },
  { type: "AMETRALLADORA", ranged: true, dice: [1, 6], range: 15, rate: 0.08, breakB: 1, color: "#4a4e58", ammo: 1, magazine: 50, reloadTime: 3.0 },
  { type: "BALLESTA", ranged: true, dice: [1, 12], range: 16, rate: 0.7, breakB: 3, color: "#7a4a2a", ammo: 1, magazine: 1, reloadTime: 1.1 },
  { type: "ARCO", ranged: true, dice: [1, 10], range: 15, rate: 0.5, breakB: 2, color: "#8f6a3a", ammo: 1, magazine: 1, reloadTime: 0.72 },
  { type: "FOCO", ranged: true, dice: [2, 6], range: 10, rate: 0.4, projectile: true, breakB: 2, color: "#b45bff", ammo: 0, magazine: 0, reloadTime: 0 },
];

export const RARITY = ["Común", "Mágica", "Rara", "Épica", "Legendaria"];
export const RARITY_COLOR = ["#c9c3d6", "#5aa7ff", "#ffd34a", "#c35bff", "#ff6a2a"];
export const PREFIX = ["Mellada", "Velada", "Rúnica", "Despierta", "Imposible"];
export const SUFFIX = ["del Náufrago", "de Babel", "del Último Trato", "del Hilo", "del Hambre", "de la Penitencia"];

export type AffixId = "SANGRANTE" | "INCANDESCENTE" | "TOXICA" | "VORAZ" | "EBURNEA" | "INESTABLE" | "ENCADENADA" | "SEGADORA" | "DADO_LOCO";
export const AFFIXES: Record<AffixId, string> = {
  SANGRANTE: "Golpes causan sangrado",
  INCANDESCENTE: "Quema al objetivo",
  TOXICA: "Envenena al objetivo",
  VORAZ: "Roba 15% del daño como PV",
  EBURNEA: "+3 Break por golpe",
  INESTABLE: "10%: el golpe explota en área",
  ENCADENADA: "El daño salta a un enemigo cercano",
  SEGADORA: "Matar recarga munición y Aguante",
  DADO_LOCO: "Cada golpe tira 1d6: 6 = daño x3, 1 = x0.5",
};

export interface Item {
  uid: number; kind: "weapon" | "armor" | "consumable" | "material" | "key";
  name: string; rarity: number; qty?: number;
  // weapon
  base?: WeaponBase; dmgMult?: number; crit?: number; affixes?: AffixId[]; acc?: number;
  dur?: number; durMax?: number; wlvl?: number;
  // armor
  def?: number;
  id?: string; mag?: number; magMax?: number;
}

export const ENEMY_TYPES = {
  sombra: { name: "SOMBRA DEL SONIDO DEL SILENCIO", hp: 22, def: 11, brk: 8, speed: 2.6, dmg: 5, pattern: "chase", scale: 0.9, sprite: "enemy" },
  vigia: { name: "VIGÍA NUNCA MÁS", hp: 30, def: 12, brk: 10, speed: 1.6, dmg: 6, pattern: "ranged", scale: 0.95, sprite: "enemy" },
  amalgama: { name: "PROMETEO DE RETAZOS", hp: 46, def: 12, brk: 14, speed: 2.0, dmg: 9, pattern: "charger", scale: 1.15, sprite: "enemy" },
  espectro: { name: "FANTASMA DE LA ÓPERA DE PAPEL", hp: 24, def: 13, brk: 7, speed: 2.2, dmg: 6, pattern: "blink", scale: 0.85, sprite: "enemy" },
  carcelero: { name: "CARCELERO DEL JAILHOUSE ROCK", hp: 60, def: 14, brk: 18, speed: 1.7, dmg: 11, pattern: "jumper", scale: 1.25, sprite: "enemy" },
  soldado: { name: "SOLDADITO DE PLOMO FUNDIDO", hp: 52, def: 14, brk: 16, speed: 1.5, dmg: 9, pattern: "guard", scale: 1.05, sprite: "enemy" },
  hereje: { name: "MR. HYDE DESCOSIDO", hp: 30, def: 11, brk: 9, speed: 1.7, dmg: 6, pattern: "caster", scale: 0.95, sprite: "enemy" },
  bestia: { name: "BESTIA SIN BELLA", hp: 34, def: 12, brk: 10, speed: 3.0, dmg: 7, pattern: "pounce", scale: 0.85, sprite: "enemy" },
  automata: { name: "HOJALATA SIN CORAZÓN", hp: 70, def: 15, brk: 22, speed: 1.1, dmg: 5, pattern: "gunner", scale: 1.2, sprite: "enemy" },
  bruja: { name: "CAPERUCITA CARMESÍ", hp: 28, def: 13, brk: 8, speed: 2.0, dmg: 7, pattern: "witch", scale: 0.95, sprite: "enemy" },
  ahogado: { name: "OFELIA DE AETHRYON", hp: 58, def: 13, brk: 15, speed: 1.4, dmg: 10, pattern: "hook", scale: 1.15, sprite: "enemy" },
  tahur: { name: "TAHÚR DEL HOTEL CALIFORNIA", hp: 32, def: 12, brk: 9, speed: 1.8, dmg: 5, pattern: "drummer", scale: 0.95, sprite: "enemy" },
  acechador: { name: "THRILLER DESOLLADO", hp: 30, def: 12, brk: 9, speed: 2.8, dmg: 8, pattern: "flanker", scale: 0.85, sprite: "enemy" },
  fanatico: { name: "DEVOTO DEL DIABLO SIMPÁTICO", hp: 26, def: 11, brk: 7, speed: 2.3, dmg: 6, pattern: "zealot", scale: 0.95, sprite: "enemy" },
  behemoth: { name: "PROMETEO ENCADENADO", hp: 110, def: 15, brk: 30, speed: 0.9, dmg: 14, pattern: "brute", scale: 1.45, sprite: "enemy" },
  screamer: { name: "EL GRITO DE MUNCH", hp: 20, def: 13, brk: 6, speed: 2.1, dmg: 3, pattern: "screamer", scale: 0.95, sprite: "enemy" },
  caballero: { name: "JINETE DE SLEEPY HOLLOW", hp: 72, def: 16, brk: 22, speed: 1.4, dmg: 12, pattern: "knight", scale: 1.15, sprite: "enemy" },
  ballestero: { name: "GUILLERMO TELL SIN MANZANA", hp: 28, def: 12, brk: 8, speed: 1.3, dmg: 13, pattern: "sniper", scale: 0.95, sprite: "enemy" },
  alquimista: { name: "FAUSTO DE LA PÓLVORA", hp: 32, def: 12, brk: 9, speed: 1.5, dmg: 10, pattern: "bomber", scale: 0.95, sprite: "enemy" },
  obispo: { name: "OBISPO DE NOTRE-DAME INVERSA", hp: 150, def: 15, brk: 32, speed: 1.2, dmg: 9, pattern: "bishop", scale: 1.5, sprite: "enemy" },
  tejedora: { name: "ARACNE DE TINTA", hp: 30, def: 12, brk: 8, speed: 1.9, dmg: 5, pattern: "webber", scale: 1.0, sprite: "enemy" },
  relojero: { name: "RELOJERO DEL CONEJO BLANCO", hp: 34, def: 13, brk: 10, speed: 1.4, dmg: 5, pattern: "engineer", scale: 1.0, sprite: "enemy" },
  portaestandarte: { name: "VALQUIRIA SIN CABALGATA", hp: 48, def: 14, brk: 14, speed: 1.3, dmg: 8, pattern: "banner", scale: 1.15, sprite: "enemy" },
  sirena: { name: "SIRENITA SIN VOZ", hp: 30, def: 12, brk: 8, speed: 1.6, dmg: 6, pattern: "siren", scale: 1.05, sprite: "enemy" },
  sanguijuela: { name: "NOSFERATU SANGUIJUELA", hp: 40, def: 12, brk: 11, speed: 1.9, dmg: 7, pattern: "leech", scale: 1.0, sprite: "enemy" },
  portador: { name: "MÁSCARA DE LA MUERTE ROJA", hp: 54, def: 12, brk: 14, speed: 1.1, dmg: 7, pattern: "spore", scale: 1.15, sprite: "enemy" },
  golem: { name: "GÓLEM DE PRAGA ENCUADERNADO", hp: 90, def: 15, brk: 26, speed: 1.0, dmg: 12, pattern: "splitter", scale: 1.4, sprite: "enemy" },
  espejo: { name: "DORIAN GRAY DEL ESPEJO", hp: 30, def: 14, brk: 8, speed: 2.4, dmg: 8, pattern: "mimic", scale: 1.0, sprite: "enemy" },
  librero: { name: "EL LIBRERO DE BABEL", hp: 260, def: 15, brk: 40, speed: 2.0, dmg: 14, pattern: "boss", scale: 1.9, sprite: "boss" },
} as const;
export type EnemyKind = keyof typeof ENEMY_TYPES;

export const ELITE_AFFIXES = ["ÍGNEO", "VENENOSO", "EXPLOSIVO", "VELOZ", "BLINDADO", "VAMPÍRICO", "ESPEJADO"] as const;

export const MATERIALS: Record<string, string> = {
  tela: "Tela rasgada", hierba: "Hierba amarga", chatarra: "Chatarra", polvora: "Pólvora",
  carne: "Carne cruda", agua_sucia: "Agua turbia", brasa: "Brasa viva", hueso: "Hueso tallado", fragmento: "Fragmento de memoria",
};

export interface Recipe { id: string; name: string; needs: Record<string, number>; desc: string }
export const RECIPES: Recipe[] = [
  { id: "venda", name: "Venda", needs: { tela: 2 }, desc: "Cura heridas y sangrado, +8 PV" },
  { id: "antidoto", name: "Antídoto", needs: { hierba: 2 }, desc: "Quita veneno" },
  { id: "racion", name: "Ración asada", needs: { carne: 1, brasa: 1 }, desc: "+45 comida, +10 PV" },
  { id: "agua", name: "Agua hervida", needs: { agua_sucia: 1, brasa: 1 }, desc: "+50 sed" },
  { id: "bomba", name: "Bomba de tinta", needs: { polvora: 1, chatarra: 1 }, desc: "Explosivo arrojadizo (tecla X)" },
  { id: "municion", name: "Munición x12", needs: { chatarra: 2 }, desc: "Recarga armas a distancia" },
  { id: "tonico", name: "Tónico de Lumbre", needs: { hierba: 1, fragmento: 1 }, desc: "+4 Lumbre" },
  { id: "ganzua", name: "Llave de hueso", needs: { hueso: 3 }, desc: "Abre muros secretos" },
];

export interface SkillNode { id: string; name: string; branch: 0 | 1 | 2; req?: string; desc: string; cost: number }
export const SKILL_BRANCHES = ["COMBATE", "ARCANO", "SUPERVIVENCIA"];
export const SKILLS: SkillNode[] = [
  { id: "filo1", name: "Filo Hambriento", branch: 0, desc: "+15% daño cuerpo a cuerpo", cost: 1 },
  { id: "carga", name: "Carga Brutal", branch: 0, req: "filo1", desc: "Ataque cargado x3 y aturde", cost: 1 },
  { id: "critico", name: "Ojo del Verdugo", branch: 0, req: "filo1", desc: "+8% crítico", cost: 1 },
  { id: "estampida", name: "Estampida", branch: 0, req: "carga", desc: "Embestida derriba y daña", cost: 2 },
  { id: "carnicero", name: "Carnicero", branch: 0, req: "critico", desc: "Remates dan doble recompensa", cost: 2 },
  { id: "lumbre1", name: "Llama Interior", branch: 1, desc: "+3 Lumbre máxima", cost: 1 },
  { id: "nova", name: "Nova de Tinta", branch: 1, req: "lumbre1", desc: "Tecla Z: explosión arcana (3 Lumbre)", cost: 1 },
  { id: "eco", name: "Eco Resonante", branch: 1, req: "lumbre1", desc: "Proyectiles perforan", cost: 2 },
  { id: "tiempo", name: "Dados Lentos", branch: 1, req: "nova", desc: "Tras dash, el tiempo se ralentiza", cost: 2 },
  { id: "pacto", name: "Pactante", branch: 1, req: "eco", desc: "Los pactos dan +50% beneficio", cost: 2 },
  { id: "piel", name: "Piel de Cuero", branch: 2, desc: "+15 PV máx.", cost: 1 },
  { id: "salto", name: "Alas de Ceniza", branch: 2, req: "piel", desc: "+1 salto aéreo", cost: 1 },
  { id: "recolector", name: "Recolector", branch: 2, req: "piel", desc: "Más materiales y hambre más lenta", cost: 1 },
  { id: "pisoton", name: "Meteoro", branch: 2, req: "salto", desc: "Pisotón x2 de radio y daño", cost: 2 },
  { id: "trampero", name: "Trampero", branch: 2, req: "recolector", desc: "Desarmar siempre funciona", cost: 2 },
  { id: "parry_maestro", name: "Mano de Espejo", branch: 0, req: "critico", desc: "Parry perfecto: riposte ×2 y +2 Break adicional", cost: 2 },
  { id: "guardia", name: "Guardia de Hierro", branch: 0, req: "filo1", desc: "Bloqueo reduce 35% más daño y Break recibido", cost: 2 },
  { id: "cazador_cabezas", name: "Cazador de Cabezas", branch: 0, req: "carnicero", desc: "+10% daño a élites y jefes", cost: 2 },
  { id: "recarga", name: "Manos de Artífice", branch: 0, req: "critico", desc: "Recarga 20% más rápido; +2 balas al encontrar munición", cost: 1 },
  { id: "ritualista", name: "Ritualista", branch: 1, req: "eco", desc: "Memorias restauran +1 Lumbre adicional", cost: 2 },
  { id: "epifania", name: "Revelación", branch: 1, req: "pacto", desc: "+1 rango de Epifanía al cumplir un hito de Ciclos", cost: 3 },
  { id: "pacto_vivo", name: "Pacto Vivo", branch: 1, req: "pacto", desc: "Activa el precio y beneficio extra de un Pacto con P", cost: 1 },
  { id: "sangre_frio", name: "Sangre Fría", branch: 1, req: "tiempo", desc: "Tras parry perfecto, ralentiza 0,6 s", cost: 2 },
  { id: "paso_silente", name: "Paso Silente", branch: 2, req: "recolector", desc: "Agachado, enemigos detectan a menor distancia", cost: 1 },
  { id: "paredes", name: "Acróbata de Cornisas", branch: 2, req: "salto", desc: "Más tiempo de wall-run y escalada; salto de pared recupera Aguante", cost: 2 },
  { id: "stomp_legend", name: "Sepulcro Aéreo", branch: 2, req: "pisoton", desc: "Slam rompe 2 Break extra y empuja en área", cost: 2 },
  { id: "superviviente", name: "Pulmón de Ceniza", branch: 2, req: "piel", desc: "Menor consumo de comida y agua; veneno dura menos", cost: 2 },
];

export interface Pact {
  id: string; name: string; boon: string; bane: string;
  principle: string; trigger: string; price: string; cost: number; resource: "PV" | "AGU" | "LUM" | "FOOD";
  activeEffect: "blood" | "ash" | "void" | "hunger" | "dice" | "babel";
  duration: number; cooldown: number; rupture: string; repair: string;
}
export const PACTS: Pact[] = [
  { id: "sangre", name: "Pacto de Sangre", boon: "+35% daño; el tajo pactado gana potencia", bane: "−20 PV máximos", principle: "La victoria se paga con carne propia.", trigger: "Un enemigo tambaleante está al alcance del remate.", price: "6 PV antes del efecto", cost: 6, resource: "PV", activeEffect: "blood", duration: 6, cooldown: 28, rupture: "Si el golpe pactado no mata, sufres Sangrado.", repair: "Vencer a un rival de élite sin ejecutar a un indefenso." },
  { id: "ceniza", name: "Pacto de Ceniza", boon: "Los golpes queman; el pacto inflama tres impactos", bane: "La sed baja el doble", principle: "Todo fuego exige una reserva que consumir.", trigger: "Estás bajo lluvia tóxica, ceniza o quemadura activa.", price: "2 Lumbre antes del efecto", cost: 2, resource: "LUM", activeEffect: "ash", duration: 7, cooldown: 24, rupture: "La sed cae 12 puntos al extinguirse.", repair: "Purificar agua y cruzar el clima sin refugio." },
  { id: "vacio", name: "Pacto del Vacío", boon: "Dash sin coste y +1 carga de dash", bane: "Visión más oscura", principle: "La distancia entre dos lugares también puede romperse.", trigger: "Estás en el aire o tocando una pared escalable.", price: "2 Aguante antes del efecto", cost: 2, resource: "AGU", activeEffect: "void", duration: 5, cooldown: 18, rupture: "La oscuridad se intensifica durante 5 segundos.", repair: "Descubrir un atajo secreto sin utilizar el dash." },
  { id: "hambre", name: "Pacto del Hambre", boon: "Robo de vida 10%; el pacto duplica la absorción temporalmente", bane: "El hambre baja el doble", principle: "La vida devora vida para continuar.", trigger: "Comida por debajo de 40 o PV por debajo del 50%.", price: "10 comida antes del efecto", cost: 10, resource: "FOOD", activeEffect: "hunger", duration: 7, cooldown: 26, rupture: "La saciedad cae 10 puntos adicionales al final.", repair: "Preparar una ración y compartirla en un oasis." },
  { id: "dados", name: "Pacto de los Dados", boon: "Crítico con 18–20", bane: "Fallo crítico con 1–3", principle: "La suerte no distingue entre premio y condena.", trigger: "Combo de 3 o más impactos.", price: "1 Lumbre antes de la tirada", cost: 1, resource: "LUM", activeEffect: "dice", duration: 8, cooldown: 20, rupture: "El primer 1–3 natural provoca pérdida de Aguante adicional.", repair: "Superar una sala de azar sin repetir una tirada." },
  { id: "babel", name: "Pacto de Babel", boon: "+50% fichas y botín", bane: "Enemigos +25% PV", principle: "Toda recompensa escribe otra deuda en el libro.", trigger: "Estás junto a un cofre, altar o puerta de jefe.", price: "4 Lumbre antes del efecto", cost: 4, resource: "LUM", activeEffect: "babel", duration: 9, cooldown: 32, rupture: "Durante la duración los enemigos reciben +25% PV.", repair: "Devolver una reliquia al Archivatorio en vez de venderla." },
];
export interface Epiphany {
  id: string; name: string; desc: string; rank: 1 | 2 | 3 | 4; requiredCycles: number;
  source: string; activation: string; cost: string; limit: string;
}
export const EPIPHANIES: Epiphany[] = [
  { id: "frenesi", name: "Frenesí del Náufrago", desc: "Cada 10 de combo: +20% velocidad de ataque", rank: 1, requiredCycles: 10, source: "Recuerdo de una huida por Port Veilance", activation: "Al encadenar impactos sin romper la presión", cost: "Aguante durante la cadena", limit: "La aceleración se reinicia al fallar o cambiar de objetivo" },
  { id: "sangria", name: "Sangría de Fichas", desc: "Los críticos curan 4 PV", rank: 1, requiredCycles: 10, source: "Deseo de sobrevivir a cualquier precio", activation: "Al causar un crítico", cost: "El daño crítico no aumenta por esta Epifanía", limit: "Una curación por impacto crítico" },
  { id: "rebote", name: "Rebote de la Cornisa", desc: "Saltar en pared recarga el dash", rank: 1, requiredCycles: 10, source: "Memoria de una caída evitada", activation: "Al ejecutar un salto de pared", cost: "Requiere contacto con una pared válida", limit: "No se activa más de una vez por 1 s" },
  { id: "meteoro", name: "Caída Celeste", desc: "Los pisotones generan Lumbre", rank: 2, requiredCycles: 30, source: "Temor convertido en peso", activation: "Al impactar un slam y alcanzar al menos un objetivo", cost: "El salto consume Aguante", limit: "Máximo +1 Lumbre por enemigo y sin superar reserva" },
  { id: "escudo", name: "Escudo de Carne", desc: "Agarrar enemigos dura el doble", rank: 2, requiredCycles: 30, source: "Vínculo roto con la violencia", activation: "Al sujetar a un enemigo tambaleante", cost: "El enemigo retenido puede morir", limit: "No funciona contra jefes" },
  { id: "ecos", name: "Ecos de una Vida", desc: "Remates generan una explosión", rank: 2, requiredCycles: 30, source: "Recuerdo de una vida que ya no existe", activation: "Al ejecutar un remate válido", cost: "La explosión puede alcanzar objetos peligrosos", limit: "Una explosión por remate" },
  { id: "pies", name: "Pies Ligeros", desc: "+20% velocidad de movimiento", rank: 3, requiredCycles: 50, source: "Convicción de no volver a arrodillarse", activation: "Mientras la carga sea ligera y no exista herida de pierna", cost: "Sin coste de Lumbre", limit: "La bonificación no elimina penalizaciones por heridas" },
  { id: "suerte", name: "Dado Cargado", desc: "+1 a todas las tiradas", rank: 3, requiredCycles: 50, source: "Contradicción entre azar y voluntad", activation: "Una tirada con consecuencias reales", cost: "No modifica el resultado después de verlo", limit: "No se acumula con otra fuente de +1" },
  { id: "espejo", name: "Último Espejo", desc: "Un parry perfecto restaura 1 Lumbre y aturde al agresor", rank: 4, requiredCycles: 90, source: "Memoria aceptada de una derrota", activation: "Parry perfecto frente a un ataque telegráfico", cost: "2 Aguante para el parry", limit: "Una vez cada 5 segundos" },
  { id: "umbral", name: "Umbral del Archivatorio", desc: "Una vez por sala, permanecer consciente con 1 PV al recibir daño letal", rank: 4, requiredCycles: 90, source: "Deseo de encontrar el Libro Perfecto", activation: "Daño que reduciría PV a cero", cost: "Consume 3 Lumbre y 1 Resonancia", limit: "Una vez por piso" },
];
export const WEATHERS = ["SERENO", "CENIZA", "LLUVIA TÓXICA", "VIENTO", "NEBLINA", "TORMENTA DE ARENA", "OSCURECIMIENTO"];
export const EVENTS = ["RAID DE LOS DESHILADOS", "DADOS ETERNOS", "MAREA DE AETHRYON", "DERRUMBE", "GRITO EN LA OSCURIDAD", "COFRE ERRANTE", "MERCADER ERRANTE", "TEMBLOR"];
export const BODY_PARTS = ["CABEZA", "TORSO", "BRAZO", "PIERNA"] as const;
export const WOUND_FX: Record<string, string> = {
  CABEZA: "Visión borrosa", TORSO: "Sangrado leve", BRAZO: "−20% daño", PIERNA: "−20% velocidad",
};
