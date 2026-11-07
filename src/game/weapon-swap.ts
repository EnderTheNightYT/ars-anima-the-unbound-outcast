/** Alternancia de armas: cambiar entre cuerpo a cuerpo y distancia tras acertar un golpe en combate acumula ritmo. */
export const SWAP = {
  /** Segundos tras un golpe acertado en los que el cambio cuenta. */
  window: 2.5,
  maxStacks: 4,
  /** Daño extra por carga. */
  perStack: 0.12,
  /** Duración del bono tras el último cambio válido. */
  stackTime: 4,
  /** Desde esta carga cada golpe aturde brevemente. */
  staggerAt: 3,
  /** Aguante devuelto por cada cambio válido. */
  stamRefund: 3,
};

/** Nueva carga de ritmo al cambiar de arma. Sin combate o sin golpe reciente el ritmo se pierde. */
export function nextSwapStacks(prev: number, sinceHit: number, inCombat: boolean) {
  if (!inCombat || sinceHit > SWAP.window) return 0;
  return Math.min(SWAP.maxStacks, prev + 1);
}

export const swapDamageMult = (stacks: number) => 1 + Math.max(0, Math.min(SWAP.maxStacks, stacks)) * SWAP.perStack;
export const swapStaggers = (stacks: number) => stacks >= SWAP.staggerAt;
