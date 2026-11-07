import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { advisorInput } from '@/game/weapon-recommendations';

export const recommendWeapons = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => advisorInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env['LOVABLE_API_KEY'];
    if (!key) return { ok: false as const, error: 'La conexión de IA no está configurada.' };
    const { recommendInventory } = await import('./weapon-recommendations.server');
    return recommendInventory(data, key, getRequest().signal);
  });