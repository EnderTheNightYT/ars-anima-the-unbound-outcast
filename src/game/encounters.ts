import { z } from 'zod';
import { ENEMY_TYPES, type EnemyKind } from './data';
import { REGIONS } from './regions';

export const difficulties = ['Suave', 'Normal', 'Difícil', 'Pesadilla'] as const;
export const encounterInput = z.object({
  equipment: z.string().trim().min(3).max(1200),
  level: z.number().int().min(1).max(100),
  difficulty: z.enum(difficulties),
  region: z.enum(['all', 'port', 'cogspire', 'pits', 'garden', 'babel', 'aethryon']),
}).strict();
export type EncounterInput = z.infer<typeof encounterInput>;
export const synergyPairs = [
  { pair: ['sirena', 'ahogado'], effect: 'La sirena atrae al jugador y el ahogado lo engancha de cerca.' },
  { pair: ['screamer', 'acechador'], effect: 'El chillido alerta y acelera a los aliados mientras el acechador rodea al jugador.' },
  { pair: ['relojero', 'automata'], effect: 'El relojero repara y sobrecarga al autómata.' },
  { pair: ['behemoth', 'ballestero'], effect: 'El behemoth protege a los aliados cercanos y potencia los virotes del ballestero.' },
  { pair: ['alquimista', 'fanatico'], effect: 'El alquimista cura aliados; la inmolación del fanático cura y acelera al grupo.' },
  { pair: ['portaestandarte', 'soldado'], effect: 'El estandarte sostiene al soldado mientras este protege la formación.' },
  { pair: ['tejedora', 'sombra'], effect: 'La tinta ralentiza al jugador mientras la sombra lo persigue.' },
  { pair: ['golem', 'espejo'], effect: 'El doble intercambia posiciones con aliados heridos; el gólem libera sombras al dividirse.' },
  { pair: ['sanguijuela', 'portador'], effect: 'El portador presiona con esporas y la sanguijuela drena vida para sanar aliados.' },
  { pair: ['caballero', 'screamer'], effect: 'El caballero protege a aliados próximos mientras el screamer alerta al grupo.' },
] as const;

export const encounterOutput = z.object({ encounters: z.array(z.object({
  region: z.string(), title: z.string(),
  enemies: z.array(z.object({ kind: z.string(), count: z.number().int() }).strict()),
  synergy: z.array(z.string()), tactics: z.string(), equipmentFit: z.string(),
}).strict()) }).strict();
export type EncounterProposal = z.infer<typeof encounterOutput>;
export const encounterBudget = (difficulty: EncounterInput['difficulty']) => ({ Suave: 3, Normal: 5, Difícil: 7, Pesadilla: 9 })[difficulty];
export function encounterRegions(input: EncounterInput) {
  return REGIONS.filter(r => input.region === 'all' || r.id === input.region);
}
export function availableSynergies(region: typeof REGIONS[number]) {
  return synergyPairs.filter(s => s.pair.every(k => (region.enemies as readonly string[]).includes(k)));
}
export function validateEncounters(raw: unknown, input: EncounterInput): EncounterProposal {
  const output = encounterOutput.parse(raw);
  const regions = encounterRegions(input);
  if (output.encounters.length !== regions.length) throw new Error('La propuesta no cubre las regiones elegidas.');
  const seen = new Set<string>();
  for (const encounter of output.encounters) {
    const region = regions.find(r => r.id === encounter.region);
    if (!region || seen.has(region.id)) throw new Error('La propuesta contiene una región incompatible.');
    seen.add(region.id);
    if (!encounter.title.trim() || !encounter.tactics.trim() || !encounter.equipmentFit.trim()) throw new Error('La propuesta está incompleta.');
    if (region.id === 'garden') {
      if (encounter.enemies.length || encounter.synergy.length) throw new Error('El Jardín debe permanecer libre de enemigos.');
      continue;
    }
    const kinds = new Set<string>();
    let total = 0;
    for (const enemy of encounter.enemies) {
      if (!(region.enemies as readonly string[]).includes(enemy.kind) || kinds.has(enemy.kind) || enemy.count < 1) throw new Error('La formación contiene enemigos incompatibles.');
      kinds.add(enemy.kind); total += enemy.count;
    }
    if (total > encounterBudget(input.difficulty) || kinds.size < 2) throw new Error('La formación no corresponde a la dificultad elegida.');
    const matched = availableSynergies(region).filter(s => s.pair.every(k => kinds.has(k))).map(s => s.pair.join('+'));
    if (!encounter.synergy.length || encounter.synergy.some(id => !matched.includes(id))) throw new Error('La sinergia propuesta no existe en esta formación.');
  }
  return output;
}
export function enemyName(kind: string) {
  return ENEMY_TYPES[kind as EnemyKind]?.name ?? kind;
}