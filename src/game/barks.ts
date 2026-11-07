/** Frases breves de enemigos (detectar, recibir golpe, dañar, huir, morir). Sin DOM obligatorio; la IA solo rellena el repertorio. */
import { z } from "zod";
import { getLang, type Lang } from './i18n';

export const BARK_EVENTS = ["detect", "hit", "hurt", "flee", "death"] as const;
export type BarkEvent = (typeof BARK_EVENTS)[number];
export type BarkSet = Record<BarkEvent, string[]>;
export type BilingualBarks = { es: BarkSet; en: BarkSet };

/** Probabilidad de hablar y segundos mínimos entre frases del mismo enemigo. */
export const BARK_RULES: Record<BarkEvent, { chance: number; cooldown: number }> = {
  detect: { chance: 1, cooldown: 0 }, flee: { chance: 1, cooldown: 0 }, death: { chance: 0.7, cooldown: 0 },
  hit: { chance: 0.35, cooldown: 3 }, hurt: { chance: 0.45, cooldown: 3 },
};
export const BARK_SECONDS = 2.2;
export const BARK_MAX_ACTIVE = 3;
export const BARK_MAX_CHARS = 48;

export const FALLBACK_BARKS: BarkSet = {
  detect: ["¡Ahí estás!", "Te huelo, tinta fresca.", "¡Intruso!", "No saldrás de aquí.", "¡Lo he visto!", "Los dados te señalan."],
  hit: ["¡Agh!", "¿Eso es todo?", "Me las pagarás…", "¡Maldito!", "Duele… pero sigo.", "¡Sangre por sangre!"],
  hurt: ["¡Toma!", "Sangra para mí.", "Otro tajo al Libro.", "¡Caes, caes!", "Débil.", "Así se escribe."],
  flee: ["¡Retirada!", "Volveré…", "¡Ahora no!", "Necesito refuerzos.", "¡Atrás, atrás!"],
  death: ["No… el final no…", "Se seca mi tinta…", "Recuérdame…", "Arrgh…", "El azar… me abandona."],
};

export const barkSetSchema = z.object({
  detect: z.array(z.string()), hit: z.array(z.string()), hurt: z.array(z.string()), flee: z.array(z.string()), death: z.array(z.string()),
});
export const barkInput = z.object({
  region: z.string().max(60),
  kinds: z.array(z.object({ id: z.string().max(30), name: z.string().max(60) })).min(1).max(10),
  context: z.object({ difficulty: z.string().max(30), equipment: z.array(z.string().max(100)).max(3), events: z.array(z.string().max(120)).max(12) }).optional(),
});
export type BarkInput = z.infer<typeof barkInput>;

/** Limpia y recorta frases de la IA; descarta vacías o largas. */
export function cleanBarks(raw: Partial<Record<BarkEvent, unknown>>): BarkSet {
  const out = {} as BarkSet;
  for (const ev of BARK_EVENTS) {
    const list = Array.isArray(raw[ev]) ? (raw[ev] as unknown[]) : [];
    out[ev] = [...new Set(list.filter((s): s is string => typeof s === "string").map((s) => s.trim().replace(/\s+/g, " ")).filter((s) => s.length > 0 && s.length <= BARK_MAX_CHARS))].slice(0, 8);
  }
  return out;
}

const CACHE_KEY = "ars_anima_barks_v1";
let pool: Record<string, BarkSet> = {};
const BILINGUAL_KEY='ars_anima_barks_bilingual_v1';
let bilingual: Record<string,BilingualBarks>={};
export function addBilingualBarks(kind:string,set:BilingualBarks){bilingual[kind]={es:cleanBarks(set.es),en:cleanBarks(set.en)};addBarks(kind,bilingual[kind].es);try{localStorage.setItem(BILINGUAL_KEY,JSON.stringify(bilingual));}catch{/* optional */}}
export function loadBilingualBarks(){try{bilingual=JSON.parse(localStorage.getItem(BILINGUAL_KEY)||'{}');}catch{bilingual={};}}
const EN_FALLBACK: BarkSet={detect:['There you are!','I smell fresh ink.','Intruder!','You will not leave.','I saw them!','The dice chose you.'],hit:['Argh!','Is that all?','You will pay…','Cursed one!','It hurts… I endure.','Blood for blood!'],hurt:['Take that!','Bleed for me.','Another cut in the Book.','Fall, fall!','Weak.','So it is written.'],flee:['Retreat!','I will return…','Not now!','I need reinforcements.','Back, back!'],death:['No… not the end…','My ink runs dry…','Remember me…','Arrgh…','Chance… abandons me.']};
export function loadBarkCache() { try { pool = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") ?? {}; } catch { pool = {}; } return pool; }
export function addBarks(kind: string, set: BarkSet) { pool[kind] = set; try { localStorage.setItem(CACHE_KEY, JSON.stringify(pool)); } catch { /* opcional */ } }
export function hasBarks(kind: string) { return !!pool[kind] && BARK_EVENTS.some((e) => pool[kind]?.[e]?.length); }

/** Elige frase: repertorio de la IA del tipo si existe, si no el genérico. Evita repetir la última. */
const last: Record<string, string> = {};
export function barkLine(kind: string, ev: BarkEvent, rand = Math.random, lang:Lang=getLang()) {
  const fallback=lang==='en'?EN_FALLBACK:FALLBACK_BARKS;
  const own = bilingual[kind]?.[lang]?.[ev] ?? (lang==='es'?pool[kind]?.[ev]:[]) ?? [];
  const list = own.length ? own : fallback[ev];
  let line: string = list[Math.floor(rand() * list.length)] ?? fallback[ev][0] ?? "";
  if (list.length > 1 && line === last[kind + ev]) line = list[(list.indexOf(line) + 1) % list.length] ?? line;
  last[kind + ev] = line; return line;
}
