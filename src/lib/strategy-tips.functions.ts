import { createServerFn } from '@tanstack/react-start';
import { strategyInput } from '@/game/strategy-tips';
import { liveStrategyInput } from '@/game/live-strategy';

/** Consejos de estrategia personalizados para la partida terminada (AI Gateway, sólo servidor). */
export const generateStrategyTips = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => strategyInput.parse(input))
  .handler(async ({ data }) => {
    const { createStrategyTips } = await import('./strategy-tips.server');
    return createStrategyTips(data);
  });

/** Estrategia para el encuentro actual (clase, estado y enemigos cercanos verificados). */
export const generateLiveStrategy = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => liveStrategyInput.parse(input))
  .handler(async ({ data }) => {
    const { createLiveStrategy } = await import('./strategy-tips.server');
    return createLiveStrategy(data);
  });
