import { describe, expect, it } from 'vitest';
import { availableSynergies, encounterInput, encounterRegions, validateEncounters, type EncounterInput } from './encounters';
const input: EncounterInput = { equipment: 'Espada y revólver', level: 4, difficulty: 'Normal', region: 'port' };
function proposal(data: EncounterInput) {
  return { encounters: encounterRegions(data).map(r => {
    const pair = availableSynergies(r)[0];
    return { region: r.id, title: 'Encuentro', enemies: pair ? pair.pair.map(kind => ({ kind, count: 1 })) : [], synergy: pair ? [pair.pair.join('+')] : [], tactics: 'Separar aliados', equipmentFit: 'Usar el revólver' };
  }) };
}
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing fixture');
  return value;
}
describe('AI regional encounter proposals', () => {
  it('accepts player equipment and the desired difficulty', () => {
    expect(encounterInput.parse({ ...input, difficulty: 'Pesadilla' }).equipment).toBe('Espada y revólver');
    expect(encounterInput.safeParse({ ...input, equipment: '' }).success).toBe(false);
  });
  it('rejects enemies outside the selected region', () => {
    const output = proposal(input); required(required(output.encounters[0]).enemies[0]).kind = 'relojero';
    expect(() => validateEncounters(output, input)).toThrow();
  });
  it('requires a real synergy between enemies present in the formation', () => {
    const output = proposal(input); required(output.encounters[0]).synergy = ['relojero+automata'];
    expect(() => validateEncounters(output, input)).toThrow();
    expect(validateEncounters(proposal(input), input).encounters).toHaveLength(1);
  });
  it('covers every selected region exactly once', () => {
    const all: EncounterInput = { ...input, region: 'all' };
    expect(validateEncounters(proposal(all), all).encounters).toHaveLength(6);
    const output = proposal(all); required(output.encounters[1]).region = 'port';
    expect(() => validateEncounters(output, all)).toThrow();
  });
  it('keeps the garden free of enemies', () => {
    const garden: EncounterInput = { ...input, region: 'garden' };
    const output = proposal(garden);
    expect(required(validateEncounters(output, garden).encounters[0]).enemies).toHaveLength(0);
    required(output.encounters[0]).enemies.push({ kind: 'sombra', count: 1 });
    expect(() => validateEncounters(output, garden)).toThrow();
  });
  it('makes easy formations smaller than nightmare formations', () => {
    const output = proposal(input); required(required(output.encounters[0]).enemies[0]).count = 4;
    expect(() => validateEncounters(output, { ...input, difficulty: 'Suave' })).toThrow();
    expect(required(required(validateEncounters(output, { ...input, difficulty: 'Pesadilla' }).encounters[0]).enemies[0]).count).toBe(4);
  });
});