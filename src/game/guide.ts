/** Timing for gentle "you're taking long" hints toward the map fragment and the boss lair. */
export const GUIDE = { first: 150, every: 45 };
/** Relative direction word (angle relative to where the player looks). */
export function compassWord(rel: number) {
  const a = Math.atan2(Math.sin(rel), Math.cos(rel));
  if (Math.abs(a) < Math.PI / 6) return "delante";
  if (Math.abs(a) > Math.PI * 5 / 6) return "detrás de ti";
  return a > 0 ? (a < Math.PI / 2 ? "hacia la derecha" : "atrás a la derecha") : (a > -Math.PI / 2 ? "hacia la izquierda" : "atrás a la izquierda");
}
