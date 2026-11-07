/** Floor pressure is independent of player level: leveling always remains a benefit. */
export function floorPressure(floor: number) {
  const step = Math.max(0, Math.min(29, Math.floor(floor) - 1));
  return { hp: 1 + step * .18, damage: 1 + step * .1, eliteChance: Math.min(.3, .08 + step * .025) };
}

export function usesTouchControls(userAgent: string, coarse: boolean, touchPoints: number) {
  return /Android|iPhone|iPad|iPod/i.test(userAgent) || (coarse && touchPoints > 0 && !/Windows|Linux x86|Macintosh/i.test(userAgent));
}