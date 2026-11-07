export const ALTERATIONS = [
  { id: 'echo', name: 'Archivo invertido', tint: '#54daca', fog: [20,68,64], boon: 'Daño +20% · EXP +25%', bane: 'Enemigos acelerados · Aguante regenera menos', damage: 1.2, xp: 1.25, gravity: 1, regen: .7, enemySpeed: 1.35, enemyHp: 1, variant: 'ECO FRACTURADO' },
  { id: 'ash', name: 'Capilla de vidrio rojo', tint: '#de5268', fog: [74,24,38], boon: 'Postura enemiga −25%', bane: 'Rivales blindados · Sed +50%', damage: 1, xp: 1, gravity: 1, regen: 1, enemySpeed: 1, enemyHp: 1.35, variant: 'VIDRIO VIVO' },
  { id: 'moon', name: 'Claustro sin gravedad', tint: '#acbde9', fog: [35,45,70], boon: 'Saltos más altos · EXP +15%', bane: 'Proyectiles extra · Aguante regenera menos', damage: 1, xp: 1.15, gravity: .6, regen: .8, enemySpeed: 1, enemyHp: 1, variant: 'LUNAR HUECO' },
] as const;
export type Alteration = typeof ALTERATIONS[number];