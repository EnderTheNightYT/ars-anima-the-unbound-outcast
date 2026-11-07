// Presentation-only palettes: never feed these values into simulation or RNG.
export type Theme = { name: string; tint: [number, number, number]; fog: number; wet: number; props: string[] };
const theme = (name: string, tint: Theme['tint'], fog: number, wet: number, ...props: string[]): Theme => ({name,tint,fog,wet,props});
export const SCENERY: Record<string, Theme[]> = {
  port: [theme('Dársena mojada',[24,70,76],.09,.7,'neon_pipe','gothic_lantern'),theme('Capilla de los náufragos',[75,40,50],.05,.35,'glass_shrine','votive'),theme('Jardín salobre',[35,68,46],.12,.5,'moss_planter','crystal')],
  cogspire: [theme('Taller de neón',[76,35,66],.04,.25,'neon_pipe','gothic_lantern'),theme('Forja votiva',[85,57,28],.06,.12,'votive','gothic_lantern'),theme('Galería de cobre',[43,69,66],.04,.2,'glass_shrine','neon_pipe')],
  pits: [theme('Gruta de cristales',[28,75,67],.13,.3,'crystal','votive'),theme('Osario carmesí',[80,26,39],.1,.12,'votive','gothic_lantern'),theme('Oasis de esporas',[43,69,30],.15,.4,'moss_planter','crystal')],
  garden: [theme('Claustro de musgo',[36,73,43],.08,.35,'moss_planter','gothic_lantern'),theme('Estanque de cristal',[26,68,82],.12,.7,'crystal','moss_planter'),theme('Rosal de las vidrieras',[73,39,59],.06,.2,'glass_shrine','moss_planter')],
  babel: [theme('Capilla de tinta',[76,29,46],.06,.35,'glass_shrine','votive'),theme('Archivo iluminado',[78,62,34],.04,.1,'gothic_lantern','glass_shrine'),theme('Invernadero olvidado',[39,68,59],.09,.25,'moss_planter','crystal')],
  aethryon: [theme('Marea de cristal',[30,70,89],.12,.7,'crystal','glass_shrine'),theme('Observatorio de neón',[72,34,76],.08,.45,'neon_pipe','crystal'),theme('Santuario del frío',[48,70,74],.1,.35,'votive','glass_shrine')],
};
export const LIGHTS: Record<string, {color: [number,number,number]; height: number; radius: number}> = {
  gothic_lantern: {color:[255,170,65],height:.9,radius:4},
  glass_shrine: {color:[105,185,225],height:.9,radius:3.2},
  crystal: {color:[55,225,193],height:.45,radius:3.8},
  neon_pipe: {color:[238,61,155],height:.7,radius:3.5},
  votive: {color:[244,84,48],height:.35,radius:3.3},
};
const fallback = theme('Pasadizo',[40,55,60],.06,.2,'gothic_lantern');
export const sceneryTheme = (region: string, room: number, floor: number): Theme => {
  const themes=SCENERY[region] ?? SCENERY['port'] ?? [];
  return themes[((room+floor-1)%3+3)%3] ?? fallback;
};
export type ScenicProp = {x:number;y:number;deco:string};