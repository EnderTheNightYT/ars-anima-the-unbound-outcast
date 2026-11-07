import { translateDynamic } from "./dynamic-phrases";
/** Traducción por diccionario: coincidencia exacta del texto y, si no, de frases conocidas dentro de él. */
const phraseCache = new WeakMap<Record<string, string>, [RegExp, Record<string, string>] | null>();

function phrases(dict: Record<string, string>) {
  if (phraseCache.has(dict)) return phraseCache.get(dict)!;
  const keys = Object.keys(dict).filter((k) => k.length >= 4).sort((a, b) => b.length - a.length);
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const v = keys.length ? ([new RegExp(`(?<![\\p{L}])(?:${keys.map(esc).join("|")})(?![\\p{L}])`, "giu"), lowerDict(dict)] as [RegExp, Record<string, string>]) : null;
  phraseCache.set(dict, v);
  return v;
}

const resultCache = new WeakMap<Record<string, string>, Map<string, string>>();

export function translateText(text: string, dict: Record<string, string>): string {
  let cache = resultCache.get(dict); if (!cache) { cache = new Map(); resultCache.set(dict, cache); }
  const hit = cache.get(text); if (hit !== undefined) return hit;
  const out = translateUncached(text, dict);
  if (cache.size > 4000) cache.clear();
  cache.set(text, out);
  return out;
}

function translateUncached(text: string, dict: Record<string, string>): string {
  const trimmed = text.trim();
  if (!trimmed) return text;
  const exact = dict[trimmed];
  if (exact !== undefined) return text.replace(trimmed, exact);
  const dyn = translateDynamic(trimmed, (s) => translateText(s, dict));
  if (dyn !== null) return text.replace(trimmed, dyn);
  const p = phrases(dict);
  if (!p) return text;
  return shortWords(text.replace(p[0], (m) => { const hit = dict[m]; if (hit !== undefined) return hit; const r = p[1][m.toLowerCase()]; if (r === undefined) return m; return matchCase(m, r); }));
}

/** Palabras cortas del español (artículos, preposiciones) que el diccionario de frases no cubre. */
const SHORT: Record<string, string> = { de: "of", del: "of the", con: "with", sin: "without", por: "per", y: "and", en: "in", al: "to the", la: "the", el: "the", los: "the", las: "the", un: "a", una: "a", cada: "each", si: "if", es: "is", "más": "more", que: "that", tu: "your", nv: "lv", ver: "see", dos: "two", vez: "time", dan: "give", pv: "HP", ves: "you see", "o": "or", "u": "or", se: "", lo: "it", te: "you", "¡": "" };
const SHORT_RE = /(?<![\p{L}])(de|del|con|sin|por|y|en|al|la|el|los|las|un|una|cada|si|es|más|que|tu|nv|ver|dos|vez|dan|pv|ves|o|u|se|lo|te)(?![\p{L}])|¡/giu;
function shortWords(text: string) {
  return text.replace(SHORT_RE, (m) => { const r = SHORT[m.toLowerCase()]; if (r === undefined) return m; return r ? matchCase(m, r) : r; });
}

function lowerDict(dict: Record<string, string>) { const o: Record<string, string> = {}; for (const [k, v] of Object.entries(dict)) { const l = k.toLowerCase(); if (!(l in o) || k === l) o[l] = v; } return o; }
/** Copia mayúsculas del original: TODO EN MAYÚSCULAS o Primera letra. */
function matchCase(src: string, out: string) { if (src.length > 1 && src === src.toUpperCase()) return out.toUpperCase(); if (src[0] !== src[0]!.toLowerCase()) return out[0]!.toUpperCase() + out.slice(1); return out; }
