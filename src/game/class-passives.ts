/** Class skills and passives unlocked by level. Browser-safe; engine reads `classMods`. */
export type ClassMod = { speed?: number; taken?: number; critDmg?: number; crit?: number; damage?: number; ranged?: number; melee?: number; stamRegen?: number };
export type ClassPassive = { id: string; name: string; level: number; kind: 'pasiva' | 'habilidad'; desc: string; mod: ClassMod };

const P = (id: string, name: string, level: number, kind: ClassPassive['kind'], desc: string, mod: ClassMod): ClassPassive => ({ id, name, level, kind, desc, mod });

export const CLASS_PASSIVES: Record<string, ClassPassive[]> = {
  cuervo: [P('cu1', 'Vuelo nocturno', 1, 'pasiva', '+8% velocidad de movimiento.', { speed: 1.08 }), P('cu2', 'Pico certero', 4, 'habilidad', '+6% crítico.', { crit: 6 }), P('cu3', 'Nunca más', 8, 'pasiva', 'Críticos ×2.5.', { critDmg: 2.5 })],
  archivista: [P('ar1', 'Índice', 1, 'pasiva', '+5% daño.', { damage: 1.05 }), P('ar2', 'Marginalia', 4, 'pasiva', 'Recibes 8% menos daño.', { taken: .92 }), P('ar3', 'Glosa final', 8, 'habilidad', 'Críticos ×2.4.', { critDmg: 2.4 })],
  campanero: [P('cp1', 'Bronce', 1, 'pasiva', 'Recibes 8% menos daño.', { taken: .92 }), P('cp2', 'Tañido', 4, 'pasiva', '+10% daño cuerpo a cuerpo.', { melee: 1.1 }), P('cp3', 'La campana suena', 8, 'habilidad', '+25% recuperación de aguante.', { stamRegen: 1.25 })],
  duelista: [P('du1', 'Paso de esgrima', 1, 'pasiva', '+8% velocidad de movimiento.', { speed: 1.08 }), P('du2', 'Estocada letal', 4, 'habilidad', 'Críticos ×2.4 en lugar de ×2.', { critDmg: 2.4 }), P('du3', 'Ojo del duelo', 8, 'pasiva', '+6% probabilidad de crítico.', { crit: 6 })],
  cazador: [P('ca1', 'Rastro', 1, 'pasiva', '+6% velocidad de movimiento.', { speed: 1.06 }), P('ca2', 'Tiro certero', 4, 'habilidad', '+5% crítico.', { crit: 5 }), P('ca3', 'Punta de hueso', 8, 'pasiva', '+15% daño a distancia.', { ranged: 1.15 })],
  guardian: [P('gu1', 'Muralla', 1, 'pasiva', 'Recibes 10% menos daño.', { taken: .9 }), P('gu2', 'Aliento de piedra', 4, 'pasiva', '+25% recuperación de aguante.', { stamRegen: 1.25 }), P('gu3', 'Bastión', 8, 'habilidad', 'Recibes 10% menos daño adicional.', { taken: .9 })],
  resonante: [P('re1', 'Eco arcano', 1, 'pasiva', '+5% daño.', { damage: 1.05 }), P('re2', 'Epifanía', 4, 'habilidad', 'Críticos ×2.3.', { critDmg: 2.3 }), P('re3', 'Velo', 8, 'pasiva', 'Recibes 8% menos daño.', { taken: .92 })],
  alquimista: [P('al1', 'Piel curtida', 1, 'pasiva', 'Recibes 6% menos daño.', { taken: .94 }), P('al2', 'Tónico interno', 4, 'pasiva', '+20% recuperación de aguante.', { stamRegen: 1.2 }), P('al3', 'Reactivo', 8, 'habilidad', '+10% daño.', { damage: 1.1 })],
  acrobata: [P('ac1', 'Pies ligeros', 1, 'pasiva', '+12% velocidad de movimiento.', { speed: 1.12 }), P('ac2', 'Respiración', 4, 'pasiva', '+30% recuperación de aguante.', { stamRegen: 1.3 }), P('ac3', 'Golpe en caída', 8, 'habilidad', '+6% crítico.', { crit: 6 })],
  guerrero: [P('ge1', 'Brazo de hierro', 1, 'pasiva', '+8% daño cuerpo a cuerpo.', { melee: 1.08 }), P('ge2', 'Aguante', 4, 'pasiva', 'Recibes 8% menos daño.', { taken: .92 }), P('ge3', 'Tajo brutal', 8, 'habilidad', 'Críticos ×2.5.', { critDmg: 2.5 })],
  tecnomante: [P('te1', 'Calibre', 1, 'pasiva', '+8% daño a distancia.', { ranged: 1.08 }), P('te2', 'Mira fina', 4, 'habilidad', '+5% crítico.', { crit: 5 }), P('te3', 'Servomotor', 8, 'pasiva', '+8% velocidad de movimiento.', { speed: 1.08 })],
  hereje: [P('he1', 'Sombra', 1, 'pasiva', '+6% velocidad de movimiento.', { speed: 1.06 }), P('he2', 'Pacto de filo', 4, 'habilidad', 'Críticos ×2.4.', { critDmg: 2.4 }), P('he3', 'Herejía', 8, 'pasiva', '+10% daño.', { damage: 1.1 })],
  ocultista: [P('oc1', 'Runa de sangre', 1, 'pasiva', '+4% crítico.', { crit: 4 }), P('oc2', 'Maleficio', 4, 'habilidad', '+8% daño.', { damage: 1.08 }), P('oc3', 'Sello', 8, 'pasiva', 'Recibes 8% menos daño.', { taken: .92 })],
  ingeniero: [P('in1', 'Chaleco', 1, 'pasiva', 'Recibes 8% menos daño.', { taken: .92 }), P('in2', 'Pólvora fina', 4, 'pasiva', '+10% daño a distancia.', { ranged: 1.1 }), P('in3', 'Detonador', 8, 'habilidad', 'Críticos ×2.3.', { critDmg: 2.3 })],
  peregrino: [P('pe1', 'Camino largo', 1, 'pasiva', '+25% recuperación de aguante.', { stamRegen: 1.25 }), P('pe2', 'Paso firme', 4, 'pasiva', '+6% velocidad de movimiento.', { speed: 1.06 }), P('pe3', 'Voluntad', 8, 'habilidad', 'Recibes 10% menos daño.', { taken: .9 })],
  pariah: [
    P('px1', 'Pugilista Absoluto', 1, 'pasiva', 'Puños y patadas ×1,8, daño fijo sin críticos; 25 % de sangrado (3 % de vida máx./s, 4 s).', {}),
    P('px2', 'Carne de Hierro', 1, 'pasiva', 'FUE +60 %, resistencia física +50 %; no puede vestir armadura.', {}),
    P('px3', 'Inmutable', 1, 'pasiva', 'Sus atributos permanentes nunca bajan.', {}),
    P('px4', 'Euforia Hostil', 1, 'pasiva', 'Con 2+ enemigos encarándolo: +8 % FUE, +5 % vel. de ataque, +4 % resistencia por enemigo extra (máx. +20 %).', {}),
    P('px5', 'Paroxismo', 1, 'pasiva', 'Cada 5 impactos seguidos: +5 % daño, +3 % vel. de ataque, +2 % movimiento (máx. +30 %). Estado especial a los 20.', {}),
    P('px6', 'Dolor Diferido', 1, 'pasiva', 'En combo acumula 60 % del daño recibido y refleja 15 %; al romperse la cadena lo recibe todo de golpe.', {}),
    P('px7', 'Instinto Paria', 1, 'pasiva', 'Parry +40 %; el parry devuelve balas; 20 % de paralizar 0,8 s.', {}),
    P('px8', 'Desposesión', 1, 'pasiva', 'No equipa armas: las lanza (70 % de daño). Mochila 60 %, botín 65 % y un nivel menos de calidad.', {}),
    P('px9', 'Estómago de Nadie', 1, 'pasiva', 'Hambre y sed caen a la mitad; comida y bebida rinden +50 %.', {}),
    P('px10', 'Anomalía de los Pactos', 1, 'pasiva', 'Ignora las penalizaciones de los pactos; conserva costes y requisitos.', {}),
    P('px11', 'Percepción Fragmentada', 1, 'pasiva', 'Campo de visión 70 %, profundidad 75 %, periferia oscura.', {}),
    P('px12', 'Nuca Expuesta', 1, 'pasiva', 'Golpes reales a la nuca: daño ×2,5.', {}),
    P('px13', 'Arranque Pesado', 1, 'pasiva', 'Camina al 65 % y acelera hasta el 75 % en 5 s; salta un 30 % menos.', {}),
    P('px14', 'Ruptura del Desposeído', 1, 'habilidad', '[B] 3 Lumbre: tres ondas de radio 1 / 1,6 / 2,3 que empujan; genera 7 escombros.', {}),
    P('px15', 'Impulso del Desposeído', 1, 'habilidad', 'Quieto 1–2,5 s y [Dash]: embestida o salto explosivo (1 Lumbre, 6 s).', {}),
    P('px16', 'Percepción del Vacío', 1, 'pasiva', 'Episodios de visión borrosa, oscura o rota y alucinaciones sin cuerpo.', {}),
    P('px17', 'Anatomía del Desamparado', 1, 'pasiva', '+35 % de heridas por región, +20 % de severidad; las críticas necesitan vendas o descanso.', {}),
    P('px18', 'Progresión Anómala', 1, 'pasiva', '+25 % de EXP por nivel; desde el nivel 6 crece solo en FUE, RES y AGI.', {}),
  ],
};

export const classPassives = (clsId: string) => CLASS_PASSIVES[clsId] ?? [];

/** Combined multipliers of every passive unlocked at this level. */
export function classMods(clsId: string, level: number) {
  const m = { speed: 1, taken: 1, critDmg: 2, crit: 0, damage: 1, ranged: 1, melee: 1, stamRegen: 1 };
  for (const p of classPassives(clsId)) if (level >= p.level) {
    const o = p.mod;
    m.speed *= o.speed ?? 1; m.taken *= o.taken ?? 1; m.damage *= o.damage ?? 1; m.ranged *= o.ranged ?? 1; m.melee *= o.melee ?? 1; m.stamRegen *= o.stamRegen ?? 1;
    m.crit += o.crit ?? 0; if (o.critDmg) m.critDmg = Math.max(m.critDmg, o.critDmg);
  }
  return m;
}

/** Level needed to open the forbidden zone on a floor, and the strength boost of its enemies. */
export const forbiddenZoneLevel = (floor: number) => 2 + floor * 2;
export const FORBIDDEN = { hpMult: 1.4, dmgMult: 1.25, extraLevels: 2, enemies: 3 } as const;

/** Concrete combat examples for one passive (base values: hit 20, enemy hit 10, 3.6 m/s, 20 stamina at 2.2/s). */
export function passiveExamples(p: ClassPassive): string[] {
  const o = p.mod, out: string[] = [];
  const r = (n: number) => +n.toFixed(1);
  if (o.damage) out.push(`Golpe de 20 → ${r(20 * o.damage)} de daño`);
  if (o.melee) out.push(`Golpe cuerpo a cuerpo de 20 → ${r(20 * o.melee)}`);
  if (o.ranged) out.push(`Disparo de 20 → ${r(20 * o.ranged)}`);
  if (o.critDmg) out.push(`Crítico de un golpe de 20: 40 → ${r(20 * o.critDmg)}`);
  if (o.crit) out.push(`Crítico con arma +5%: 5% → ${5 + o.crit}%`);
  if (o.taken) out.push(`Golpe enemigo de 10 → ${r(10 * o.taken)} de daño recibido`);
  if (o.speed) out.push(`Velocidad 3.6 → ${r(3.6 * o.speed)} m/s · cruzas 10 m en ${r(10 / 3.6)} s → ${r(10 / (3.6 * o.speed))} s`);
  if (o.stamRegen) out.push(`Recuperar 20 de aguante: ${r(20 / 2.2)} s → ${r(20 / (2.2 * o.stamRegen))} s`);
  return out;
}

/** Reward for unlocking a passive: level 4 grants a weapon, level 8 a shield/armor; level 1 is the starting kit. */
export function passiveReward(p: ClassPassive): 'arma' | 'escudo' | null { return p.level >= 8 ? 'escudo' : p.level >= 4 ? 'arma' : null; }
/** Passives that unlock exactly when reaching this level. */
export const passivesUnlockedAt = (clsId: string, level: number) => classPassives(clsId).filter(p => p.level === level);
/** Next passive still locked at this level. */
export const nextPassive = (clsId: string, level: number) => classPassives(clsId).find(p => p.level > level) ?? null;
