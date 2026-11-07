export interface Subclass { id: string; name: string; desc: string; damage: number; speed: number; taken: number }
const NAMES: Record<string, [string, string]> = {
  cuervo: ['Segador de Tiranos', 'Plumaje de Ceniza'], archivista: ['Glosador Prohibido', 'Custodio del Índice'], campanero: ['Badajo Furioso', 'Bronce Callado'],
  duelista: ['Esgrimista', 'Danzante'], cazador: ['Francotiradora', 'Exploradora'], guardian: ['Quebrantador', 'Bastión'], resonante: ['Canalizador', 'Custodio astral'], alquimista: ['Toxicólogo', 'Boticario'], acrobata: ['Executor aéreo', 'Saltamontes'], guerrero: ['Berserker', 'Caballero'], tecnomante: ['Artillero', 'Mecanista'], hereje: ['Apóstata', 'Penitente'], ocultista: ['Hemomante', 'Runista'], ingeniero: ['Demoledor', 'Zapador'], peregrino: ['Cazador de reliquias', 'Caminante'],
};
export function subclasses(classId: string): Subclass[] {
  const names = NAMES[classId]; if (!names) return [];
  return [{ id: `${classId}-ataque`, name: names[0], desc: '+12% daño', damage: 1.12, speed: 1, taken: 1 }, { id: `${classId}-resguardo`, name: names[1], desc: '+8% velocidad · −10% daño recibido', damage: 1, speed: 1.08, taken: 0.9 }];
}
export function subclassMods(classId: string, id: string) { return subclasses(classId).find(s => s.id === id) ?? { damage: 1, speed: 1, taken: 1 }; }