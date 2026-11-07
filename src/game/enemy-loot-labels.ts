import { VARIANTS } from "./weapon-forge";
export { ENEMY_TYPES } from "./data";
/** Nombre visible de una variante de forja. */
export const VARIANT_LABEL_FALLBACK = (id: string) => VARIANTS.find(v => v.id === id)?.label ?? id;
