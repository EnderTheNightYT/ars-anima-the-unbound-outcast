import { z } from 'zod';
import { WEAPONS, type Item, type AffixId } from './data';
import { weaponFacts } from './weapon-comparison';

const candidate = z.object({ uid: z.number().int().positive(), type: z.string().max(40), name: z.string().max(120),
  rarity: z.number().int().min(0).max(4), dmgMult: z.number().min(.1).max(10), crit: z.number().min(0).max(100),
  acc: z.number().min(0).max(100), affixes: z.array(z.enum(['SANGRANTE','INCANDESCENTE','TOXICA','VORAZ','EBURNEA','INESTABLE','ENCADENADA','SEGADORA','DADO_LOCO'])).max(9) });
export const advisorInput = z.object({ style: z.string().trim().min(5).max(600), level: z.number().int().min(1).max(100),
  floor: z.number().int().min(1).max(6), rating: z.number().int().min(1).max(100).optional(), score: z.number().int().min(0).max(10000000).optional(), className: z.string().max(80), ammo: z.number().min(0).max(100000),
  weapons: z.array(candidate).min(1).max(100) }).refine(v => new Set(v.weapons.map(w => w.uid)).size === v.weapons.length, 'Armas repetidas.');
export type AdvisorInput = z.infer<typeof advisorInput>;
export const advisorOutput = z.object({ recommendations: z.array(z.object({ uid: z.number(), reason: z.string(), tradeoff: z.string() }).strict()) }).strict();
export type AdvisorOutput = z.infer<typeof advisorOutput>;
export function advisorCandidates(input: AdvisorInput) {
  return input.weapons.map(w => {
    const base = WEAPONS.find(b => b.type === w.type);
    if (!base) throw new Error('Tipo de arma desconocido.');
    const facts = weaponFacts({ ...w, kind: 'weapon', base });
    if (!facts) throw new Error('Arma inválida.');
    return facts;
  });
}
export function validateAdvice(output: AdvisorOutput, input: AdvisorInput) {
  const candidates = advisorCandidates(input);
  if (output.recommendations.length < 1 || output.recommendations.length > 3) throw new Error('La IA no devolvió entre una y tres armas.');
  const seen = new Set<number>();
  return output.recommendations.map(r => {
    const item = candidates.find(w => w.uid === r.uid);
    if (!item || seen.has(r.uid)) throw new Error('La IA recomendó un arma ajena o repetida.');
    if (!r.reason.trim() || !r.tradeoff.trim()) throw new Error('Recomendación incompleta.');
    seen.add(r.uid);
    return { uid: r.uid, reason: r.reason.slice(0,600), tradeoff: r.tradeoff.slice(0,400), locked: item.requiredLevel > input.level };
  });
}
export type WeaponAdvice = ReturnType<typeof validateAdvice>;
export function advisorItem(item: Item) {
  return { uid: item.uid, type: item.base?.type ?? '', name: item.name, rarity: item.rarity,
    dmgMult: item.dmgMult ?? 1, crit: item.crit ?? 0, acc: item.acc ?? 0, affixes: [...(item.affixes ?? [])] as AffixId[] };
}