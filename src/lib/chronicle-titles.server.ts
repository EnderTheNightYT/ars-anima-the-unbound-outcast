import { combatText } from './combat-stream.server';
import { aiPause, aiFailure } from './combat-ai-status.server';
import { z } from 'zod';
import { TITLES } from '@/game/chronicles';

const output = z.object({ name: z.string().min(3).max(60), meaning: z.string().min(3).max(240) });
export async function proposeChronicleTitle(deedId: string) {
  const base = TITLES.find(t => t.deedId === deedId);
  if (!base) return { ok: false as const, error: 'Esta hazaña no tiene una condición de título reconocida.' };
  const paused = await aiPause(); if (paused) return { ok: false as const, error: paused, stop: true };
  try {
    const text = await combatText({
      model: 'openai/gpt-6-astra',
      instructions: `Crea un título FICTICIO en español o francés estilizado para Ars Anima: "IL'INCONNU". Debe conservar INCONNU en su grafía y expresar anonimato, olvido o misterio, y la conducta proporcionada. No afirmes etimologías históricas ni cambies los requisitos. Devuelve sólo name y meaning, explicando el vínculo metafórico con la estrategia. No se verifica ninguna puntuación online: es un adorno para una hazaña singleplayer.`,
      input: JSON.stringify({ deed: base.deedId, behavior: base.requirement }),
      text: { format: { type: 'json_schema', name: 'chronicle_title', strict: true, schema: { type: 'object', additionalProperties: false, required: ['name', 'meaning'], properties: { name: { type: 'string' }, meaning: { type: 'string' } } } } },
    });
    const parsed = output.safeParse(JSON.parse(text));
    if (!parsed.success) return { ok: false as const, error: 'La IA devolvió un título con formato inválido; vuelve a intentarlo.' };
    // Si la IA olvida la palabra clave, se añade en vez de descartar el título.
    if (!parsed.data.name.toUpperCase().includes('INCONNU')) parsed.data.name = `${parsed.data.name.slice(0, 50)} INCONNU`;
    return { ok: true as const, title: { ...base, id: `ai-${deedId}-${parsed.data.name}`, name: parsed.data.name, meaning: parsed.data.meaning, language: 'Construcción poética ficticia', fictional: true } };
  } catch (e) {
    return aiFailure(e);
  }
}