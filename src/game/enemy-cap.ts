/** Tope de enemigos vivos: en todo el nivel y alrededor de un punto (radio 9 casillas). El jefe no cuenta. */
export function enemyCap(floor: number) {
  const f = Math.max(1, Math.floor(floor));
  return { level: 12 + Math.min(10, f * 2), nearby: 4 + Math.min(3, Math.floor(f / 2)) };
}
