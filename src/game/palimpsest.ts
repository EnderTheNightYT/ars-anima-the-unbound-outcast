// PALIMPSESTOS rules: verification, rewards and persistent journal. Browser-safe, no React/canvas.
import type { Attr } from "./data";
import { DOCS, docById, type PalimpsestDoc, type Reward } from "./palimpsest-data";

export const PALIMPSEST_KEY = "ars_anima_palimpsestos";
/** Each attribute can gain at most this many points from Epiphanies (balance cap). */
export const EPIPHANY_CAP = 2;

export interface PalimpsestState {
  v: 1;
  hasBook: boolean;
  found: string[]; // document ids available to investigate
  solved: string[];
  hints: Record<string, number>;
  dict: string[];
  memories: string[]; // doc ids whose memory was revealed
  epiphanies: Partial<Record<Attr, number>>;
  relics: string[];
  pacts: string[];
  tabulaRasa: number;
}

export const emptyPalimpsest = (): PalimpsestState => ({ v: 1, hasBook: false, found: [], solved: [], hints: {}, dict: [], memories: [], epiphanies: {}, relics: [], pacts: [], tabulaRasa: 0 });

type Store = Pick<Storage, "getItem" | "setItem">;
const uniq = (a: string[]) => [...new Set(a)];

export function loadPalimpsest(store?: Store): PalimpsestState {
  const base = emptyPalimpsest();
  try {
    const raw = (store ?? localStorage).getItem(PALIMPSEST_KEY);
    if (!raw) return base;
    const d = JSON.parse(raw) as Partial<PalimpsestState>;
    const valid = (ids: unknown) => (Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : []);
    return {
      ...base,
      hasBook: !!d.hasBook,
      found: uniq(valid(d.found)).filter((id) => !!docById(id)),
      solved: uniq(valid(d.solved)).filter((id) => !!docById(id)),
      hints: typeof d.hints === "object" && d.hints ? d.hints : {},
      dict: uniq(valid(d.dict)),
      memories: uniq(valid(d.memories)),
      epiphanies: typeof d.epiphanies === "object" && d.epiphanies ? d.epiphanies : {},
      relics: uniq(valid(d.relics)),
      pacts: uniq(valid(d.pacts)),
      tabulaRasa: Math.max(0, Math.min(3, Number(d.tabulaRasa) || 0)),
    };
  } catch { return base; }
}

export function savePalimpsest(s: PalimpsestState, store?: Store) {
  try { (store ?? localStorage).setItem(PALIMPSEST_KEY, JSON.stringify(s)); } catch { /* optional */ }
}

/** Documents unlocked by depth that are not yet found. */
export function nextUnfound(s: PalimpsestState, floor: number): PalimpsestDoc | undefined {
  return DOCS.find((d) => d.minFloor <= floor && !s.found.includes(d.id));
}

/** Picking up the book: becomes persistent and reveals the documents available at this depth (max 2). */
export function pickBook(s: PalimpsestState, floor: number): PalimpsestState {
  const n = { ...s, hasBook: true, found: [...s.found] };
  for (let i = 0; i < 2; i++) { const d = nextUnfound(n, floor); if (d) n.found.push(d.id); }
  return n;
}

export function pickFolio(s: PalimpsestState, floor: number): { state: PalimpsestState; doc?: PalimpsestDoc } {
  const d = nextUnfound(s, floor);
  if (!d) return { state: s };
  return { state: { ...s, found: [...s.found, d.id] }, doc: d };
}

/** Research needs: the book, a bench, and no active collapse. Reading the journal never needs a bench. */
export function canInvestigate(o: { hasBook: boolean; sitting: boolean; collapse: boolean }) {
  return o.hasBook && o.sitting && !o.collapse;
}

export function checkArrange(doc: PalimpsestDoc, seq: string[]) {
  return !!doc.answer && seq.length === doc.answer.length && seq.every((t, i) => t === doc.answer![i]);
}

export function checkConnect(doc: PalimpsestDoc, links: Record<string, string>) {
  return !!doc.pairs && doc.pairs.every(([l, r]) => links[l] === r) && Object.keys(links).length === doc.pairs.length;
}

/** Letters revealed by the Cardano grille in reading order. */
export function grilleReveal(doc: PalimpsestDoc) {
  if (!doc.grid || !doc.mask) return [];
  return [...doc.mask].sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([r, c]) => doc.grid![r]?.[c] ?? "");
}

/** Overlaying two layers keeps only coinciding letters. */
export function overlayReveal(a: string, b: string) {
  return [...a].map((ch, i) => (ch === b[i] ? ch : "·")).join("");
}

export function decipher(cipher: string, key: Record<string, string>) {
  return cipher.split(" ").map((g) => key[g] ?? "?").join("");
}

export function addHint(s: PalimpsestState, docId: string): PalimpsestState {
  const doc = docById(docId); if (!doc) return s;
  const used = Math.min(doc.hints.length, (s.hints[docId] ?? 0) + 1);
  return { ...s, hints: { ...s.hints, [docId]: used } };
}

/** Solving a document records discoveries and applies its reward once. Rewards never duplicate. */
export function solveDoc(s: PalimpsestState, docId: string): { state: PalimpsestState; reward?: Reward; fresh: boolean } {
  const doc = docById(docId);
  if (!doc || !s.found.includes(docId)) return { state: s, fresh: false };
  if (s.solved.includes(docId)) return { state: s, fresh: false };
  const n: PalimpsestState = { ...s, solved: [...s.solved, docId], dict: uniq([...s.dict, ...doc.dict]), memories: doc.memory ? uniq([...s.memories, docId]) : s.memories, epiphanies: { ...s.epiphanies }, relics: [...s.relics], pacts: [...s.pacts] };
  const r = doc.reward;
  if (r.kind === "epifania") n.epiphanies[r.attr] = Math.min(EPIPHANY_CAP, (n.epiphanies[r.attr] ?? 0) + r.amount);
  if (r.kind === "reliquia") n.relics = uniq([...n.relics, r.id]);
  if (r.kind === "escritura") n.pacts = uniq([...n.pacts, r.pact]);
  if (r.kind === "tabula") n.tabulaRasa = Math.min(3, n.tabulaRasa + 1);
  if (r.kind === "recuerdo" && !doc.memory) n.memories = uniq([...n.memories, docId]);
  return { state: n, reward: r, fresh: true };
}

/** Run-start bonuses read by the engine (Tabula Rasa is consumed). */
export function runBonuses(s: PalimpsestState) {
  return { attrs: { ...s.epiphanies }, memento: s.relics.includes("memento"), pacts: [...s.pacts], extraPoints: s.tabulaRasa };
}
export function consumeTabula(s: PalimpsestState): PalimpsestState { return { ...s, tabulaRasa: 0 }; }

/** Damage multiplier from the MEMENTO MORI relic near death. */
export function mementoFactor(has: boolean, hp: number, hpMax: number) { return has && hp < hpMax * 0.25 ? 0.85 : 1; }

/** Misreading a palimpsest calls a persistent mini-boss: lots of life, moderate damage, one at a time. */
export const MISREAD = { hpMult: 3, brkMult: 2.5, dmgMult: 0.55, speedMult: 1.2, regenPerSec: 0.012, farDist: 16, catchUpAfter: 7 };
/** Score for a first-time correct solve: big base, each hint used costs 15%, never below 55%. */
export function solveScoreMult(hintsUsed: number) { return Math.max(0.55, 1 - hintsUsed * 0.15); }
export function shouldSummonMisread(alreadyAlive: boolean, collapseActive: boolean) { return !alreadyAlive && !collapseActive; }
