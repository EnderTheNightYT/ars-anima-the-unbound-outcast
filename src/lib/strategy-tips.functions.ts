import { createServerFn } from '@tanstack/react-start';
import { strategyInput } from '@/game/strategy-tips';

/** Consejos de estrategia personalizados para la partida terminada (AI Gateway, sólo servidor). */
export const generateStrategyTips = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => strategyInput.parse(input))
  .handler(async ({ data }) => {
    const { createStrategyTips } = await import('./strategy-tips.server');
    return createStrategyTips(data);
  });
