import { combatText } from './combat-stream.server';
import { aiPause, aiFailure } from './combat-ai-status.server';
import { BARK_EVENTS, cleanBarks, type BarkInput, type BarkSet, type BilingualBarks } from "@/game/barks";

const LORE = `Escribes frases de combate en español para enemigos de ARS ANIMA: "IL'INCONNU", un juego gótico de tinta, cartas, dados y un Libro que reescribe el mundo. Para cada tipo de enemigo da 6 frases por evento, muy breves (2-7 palabras, máximo 40 caracteres), variadas y con la personalidad de ese enemigo: detect (te descubre), hit (el jugador le golpea o le dispara), hurt (el enemigo daña al jugador), flee (se retira), death (muere). Sin emojis, sin comillas, sin nombres propios inventados, sin lenguaje ofensivo real.`;

const setSchema = { type: "object", additionalProperties: false, required: [...BARK_EVENTS], properties: Object.fromEntries(BARK_EVENTS.map((e) => [e, { type: "array", items: { type: "string" } }])) };

export async function createBarks(data: BarkInput) {
  const paused = await aiPause(); if (paused) return { ok: false as const, error: paused, stop: true };
  try {
    const text = await combatText({
      model: "openai/gpt-6-luna",
      instructions: `${LORE} Devuelve dos repertorios equivalentes por enemigo: lines en español y english en inglés natural, conservando contexto y personalidad. Ambos son obligatorios y cumplen los mismos límites.`,
      input: JSON.stringify({ region: data.region, enemigos: data.kinds, combate: data.context }),
      reasoning: { effort: "low" },
      text: { format: { type: "json_schema", name: "barks", strict: true, schema: {
        type: "object", additionalProperties: false, required: ["enemies"],
        properties: { enemies: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "lines", "english"], properties: { id: { type: "string" }, lines: setSchema, english: setSchema } } } },
      } } },
    } as unknown as Parameters<typeof combatText>[0]);
    const parsed = JSON.parse(text) as { enemies?: { id: string; lines: Partial<BarkSet>; english:Partial<BarkSet> }[] };
    const allowed = new Set(data.kinds.map((k) => k.id));
    const sets: Record<string, BarkSet> = {};
    const bilingual:Record<string,BilingualBarks>={};
    for (const e of parsed.enemies ?? []) if (allowed.has(e.id)) {const es=cleanBarks(e.lines ?? {});sets[e.id]=es;bilingual[e.id]={es,en:cleanBarks(e.english??{})};}
    return { ok: true as const, sets, bilingual };
  } catch (error) {
    return aiFailure(error);
  }
}
