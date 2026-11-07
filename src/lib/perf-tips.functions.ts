import { createServerFn } from '@tanstack/react-start';
import { perfInput } from '@/game/perf-monitor';

/** Recomendaciones de optimización personalizadas a partir de las métricas reales (AI Gateway, sólo servidor). */
export const generatePerfTips = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => perfInput.parse(input))
  .handler(async ({ data }) => {
    const { createPerfTips } = await import('./perf-tips.server');
    return createPerfTips(data);
  });
