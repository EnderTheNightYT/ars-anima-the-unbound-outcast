import { describe, it, expect } from "vitest";
import { CLASS_SKILLS, skillFor, chargeSkill } from "./class-skills";
import { CLASSES } from "./data";

describe("habilidades activas de clase", () => {
  it("cada clase tiene su habilidad", () => { for (const c of CLASSES.filter(c => c.id !== "pariah")) expect(CLASS_SKILLS[c.id]?.length, c.id).toBeGreaterThanOrEqual(2); });
  it("se puede elegir otra habilidad", () => { expect(skillFor("duelista", "", 1)!.id).toBe("zancada"); expect(skillFor("duelista", "", 9)!.id).toBe("danza"); });
  it("la subclase de ataque potencia ×1,3 y la de resguardo recarga 25% antes", () => {
    expect(skillFor("resonante", "resonante-ataque")!.power).toBeCloseTo(39);
    expect(skillFor("cazador", "cazador-resguardo")!.need).toBe(9);
    expect(skillFor("guardian", "guardian-resguardo")!.duration).toBe(7);
  });
  it("solo carga con su propio tipo de evento y no pasa del máximo", () => {
    const s = skillFor("duelista")!;
    expect(chargeSkill(s, 0, "time", 5)).toBe(0);
    expect(chargeSkill(s, 2, "kills")).toBe(3);
    expect(chargeSkill(s, 3, "kills")).toBe(3);
  });
});

import { skillUnlocked as su, unlockOf } from './class-skills';
const P = { level: 1, floor: 1, kills: 0, bosses: 0, secrets: 0, puzzles: 0, pacts: 0, bought: [] as string[] };
describe('skill unlocks', () => {
  it('signature always open', () => expect(su('danza', P)).toBe(true));
  it('frenesi needs 15 kills', () => { expect(su('frenesi', { ...P, kills: 14 })).toBe(false); expect(su('frenesi', { ...P, kills: 15 })).toBe(true); });
  it('aullido needs a boss', () => expect(su('aullido', { ...P, bosses: 1 })).toBe(true));
  it('zancada needs a secret', () => { expect(su('zancada', P)).toBe(false); expect(su('zancada', { ...P, secrets: 1 })).toBe(true); });
  it('maldicion needs a book puzzle', () => expect(su('maldicion', { ...P, puzzles: 1 })).toBe(true));
  it('sanguijuela needs a pact', () => expect(su('sanguijuela', { ...P, pacts: 1 })).toBe(true));
  it('eco at level 3, baluarte at floor 2', () => { expect(su('eco', { ...P, level: 3 })).toBe(true); expect(su('baluarte', { ...P, floor: 2 })).toBe(true); });
  it('metralla bought for 60 fichas', () => { expect(unlockOf('metralla')).toEqual({ kind: 'merchant', n: 60 }); expect(su('metralla', { ...P, kills: 99 })).toBe(false); expect(su('metralla', { ...P, bought: ['metralla'] })).toBe(true); });
});
