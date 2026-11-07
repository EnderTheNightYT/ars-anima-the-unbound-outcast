import { generateResponse, GatewayError } from "@lovable.dev/ai-gateway";
import type { z } from "zod";
import { questInput, questSchema, normalizeQuest } from "@/game/quests";
import { regionForFloor } from "@/game/regions";

const LORE = `Escribes misiones secundarias en español para ARS ANIMA: "IL'INCONNU". Lore canónico: el Creador y su hija manipulan cartas, dados y probabilidades en el Juego de los Dados Eternos. Nuevo Azar tiene Port Veilance (torres sumergidas), Cogspire (industria del Engranaje Silente), The Abyssal Pits, el Jardín de la Última Rosa que desaparece al amanecer, y el Archivatorio infinito de Babel. Orden del Engranaje Silente y Hermandad del Caos son facciones opuestas. Sombras Silenciosas y Amalgamas de Papel habitan Babel. Los Romanticistas buscan el Libro Perfecto. Aethryon absorbe fragmentos para reconstruirse. Lumbre nace de emociones auténticas. No inventes ubicaciones, poderes o NPCs obligatorios. Inventa solo un encargo secundario plausible. Objetivos ejecutables: kill (enemigos), chest (cofres), collect (materiales), craft (recetas), jump (saltos). Acrobacias→jump, Exploración→chest o collect, Supervivencia→craft o collect, Combate→kill. Jardín no tiene enemigos: nunca kill allí. count entero 1-3 (kill hasta 6, jump hasta 8) según el nivel. Historia 2-3 frases, título corto, no prometas premios. Evita títulos previos.`;

export async function createQuest(data: z.infer<typeof questInput>) {
  const region = regionForFloor(data.floor);
  try {
    const res = await generateResponse({
      model: "openai/gpt-6-astra",
      instructions: LORE,
      input: JSON.stringify({ ...data, region: region.name, description: region.desc }),
      text: {
        format: {
          type: "json_schema",
          name: "quest",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["title", "story", "kind", "count"],
            properties: {
              title: { type: "string" },
              story: { type: "string" },
              kind: { type: "string", enum: ["kill", "chest", "collect", "craft", "jump"] },
              count: { type: "integer" },
            },
          },
        },
      },
    });
    let text = "";
    for (const item of res.output ?? []) {
      if (item.type === "message") for (const c of item.content) if (c.type === "output_text") text += c.text;
    }
    if (!text) return { ok: false as const, error: "La IA no devolvió una misión. Inténtalo de nuevo." };
    const parsed = questSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return { ok: false as const, error: "La misión recibida no era válida. Inténtalo de nuevo." };
    const quest = normalizeQuest(parsed.data);
    if (data.floor === 4 && quest.kind === "kill") return { ok: false as const, error: "Misión incompatible con el Jardín. Pide otra." };
    return { ok: true as const, quest };
  } catch (error) {
    if (error instanceof GatewayError) {
      console.error("quest gateway error", error.code, error.httpStatus, error.ids);
      if (error.httpStatus === 402) return { ok: false as const, error: "Sin créditos de IA en el espacio de trabajo." };
      if (error.httpStatus === 429) return { ok: false as const, error: "Demasiadas solicitudes. Espera un momento." };
    } else console.error(error);
    return { ok: false as const, error: "No se pudo generar la misión." };
  }
}
