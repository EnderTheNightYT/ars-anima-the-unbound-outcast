import { z } from 'zod';
export const playStyles = ['Combate', 'Exploración', 'Supervivencia', 'Acrobacias'] as const;
export const questInput = z.object({ level: z.number().int().min(1).max(100), style: z.enum(playStyles), floor: z.number().int().min(1).max(6), previous: z.array(z.string().max(100)).max(8) });
export const questSchema = z.object({ title: z.string(), story: z.string(), kind: z.enum(['kill','chest','collect','craft','jump']), count: z.number() }).strict();
export type Quest = z.infer<typeof questSchema>;
export type ActiveQuest = Quest & { progress: number; complete: boolean; reward: number };
export function normalizeQuest(q: Quest): Quest {
  return { title: q.title.slice(0,100), story: q.story.slice(0,600), kind: q.kind, count: Math.max(1, Math.min(q.kind === 'kill' ? 6 : q.kind === 'jump' ? 8 : 3, Math.round(q.count))) };
}
export const questLabels = { kill: 'Derrotar enemigos', chest: 'Abrir cofres', collect: 'Recoger materiales', craft: 'Fabricar objetos', jump: 'Realizar saltos' };