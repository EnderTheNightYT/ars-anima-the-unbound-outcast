import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { encounterInput } from '@/game/encounters';

export const generateEncounters = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => encounterInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env['LOVABLE_API_KEY'];
    if (!key) return { ok: false as const, error: 'La conexión de IA no está configurada.' };
    const { proposeEncounters } = await import('./encounters.server');
    return proposeEncounters(data, key, getRequest().signal);
  });