import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { TITLES } from '@/game/chronicles';
export const generateChronicleTitle = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => z.object({ deedId: z.string().refine(id => TITLES.some(t => t.deedId === id && id !== '')) }).parse(input))
  .handler(async ({ data }) => {
    const { proposeChronicleTitle } = await import('./chronicle-titles.server');
    return proposeChronicleTitle(data.deedId);
  });