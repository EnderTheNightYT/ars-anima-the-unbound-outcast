import { describe, expect, it } from "vitest";
import { DOCS, docById } from "./palimpsest-data";
import { canInvestigate, checkArrange, checkConnect, emptyPalimpsest, grilleReveal, loadPalimpsest, overlayReveal, pickBook, savePalimpsest, solveDoc, EPIPHANY_CAP, decipher, runBonuses, consumeTabula, mementoFactor } from "./palimpsest";

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

describe("PALIMPSESTOS", () => {
  it("research requires the book and sitting on a bench, and never during a collapse", () => {
    expect(canInvestigate({ hasBook: true, sitting: true, collapse: false })).toBe(true);
    expect(canInvestigate({ hasBook: true, sitting: false, collapse: false })).toBe(false);
    expect(canInvestigate({ hasBook: true, sitting: true, collapse: true })).toBe(false);
    expect(canInvestigate({ hasBook: false, sitting: true, collapse: false })).toBe(false);
  });
  it("every document has a verifiable, deducible solution", () => {
    for (const d of DOCS) {
      if (d.pairs) expect(checkConnect(d, Object.fromEntries(d.pairs))).toBe(true);
      else { expect(d.answer && d.tiles).toBeTruthy(); const pool = [...d.tiles!]; for (const t of d.answer!) { const i = pool.indexOf(t); expect(i, `${d.id} needs tile ${t}`).toBeGreaterThanOrEqual(0); pool.splice(i, 1); } expect(checkArrange(d, d.answer!)).toBe(true); }
      expect(d.hints.length).toBeGreaterThanOrEqual(3);
    }
  });
  it("grille, overlay and cipher reveal the answers", () => {
    expect(grilleReveal(docById("doc-kenoma")!).join("")).toBe("KENOMA");
    const l = docById("doc-inconnu")!.layers!; expect(overlayReveal(l[0], l[1]).replace(/·/g, "")).toBe("LINCONNU");
    const c = docById("doc-olvido")!; expect(decipher(c.cipher!, { ...c.key!, "⟟": "V" })).toBe("OLVIDO");
  });
  it("NEMO grants +1 VOL once; rewards never duplicate and epiphanies are capped", () => {
    let s = pickBook(emptyPalimpsest(), 1);
    const r1 = solveDoc(s, "doc-nemo"); s = r1.state;
    expect(s.epiphanies.VOL).toBe(1);
    const r2 = solveDoc(s, "doc-nemo");
    expect(r2.fresh).toBe(false); expect(r2.state.epiphanies.VOL).toBe(1);
    expect(EPIPHANY_CAP).toBe(2);
  });
  it("OUTIS grants +1 SUE", () => { const s = solveDoc(pickBook(emptyPalimpsest(), 1), "doc-outis").state; expect(s.epiphanies.SUE).toBe(1); });
  it("cannot solve a document that has not been found", () => { expect(solveDoc(pickBook(emptyPalimpsest(), 1), "doc-inconnu").fresh).toBe(false); });
  it("progress persists across deaths/runs and survives corrupted saves", () => {
    const store = mem();
    const s = solveDoc(pickBook(emptyPalimpsest(), 1), "doc-nemo").state; savePalimpsest(s, store);
    const back = loadPalimpsest(store);
    expect(back.hasBook).toBe(true); expect(back.solved).toEqual(["doc-nemo"]); expect(back.dict).toContain("nemo");
    store.setItem("ars_anima_palimpsestos", "{broken"); expect(loadPalimpsest(store).hasBook).toBe(false);
  });
  it("Tabula Rasa gives one extra attribute point and is consumed", () => {
    const s = { ...emptyPalimpsest(), tabulaRasa: 1 };
    expect(runBonuses(s).extraPoints).toBe(1); expect(consumeTabula(s).tabulaRasa).toBe(0);
  });
  it("MEMENTO MORI reduces damage 15% only under 25% HP", () => {
    expect(mementoFactor(true, 20, 100)).toBe(0.85); expect(mementoFactor(true, 30, 100)).toBe(1); expect(mementoFactor(false, 10, 100)).toBe(1);
  });
});

import { MISREAD, shouldSummonMisread } from "./palimpsest";
describe("misread mini-boss", () => {
  it("summons only one at a time and never during a collapse", () => {
    expect(shouldSummonMisread(false, false)).toBe(true);
    expect(shouldSummonMisread(true, false)).toBe(false);
    expect(shouldSummonMisread(false, true)).toBe(false);
  });
  it("has lots of life but moderate damage", () => {
    expect(MISREAD.hpMult).toBeGreaterThanOrEqual(3);
    expect(MISREAD.dmgMult).toBeLessThan(1);
  });
});

import { solveScoreMult } from "./palimpsest";
import { SCORE } from "./score";
describe("palimpsest score", () => {
  it("first correct solve is worth 500 points, more than a boss", () => { expect(SCORE.palimpsest).toBe(500); expect(SCORE.palimpsest).toBeGreaterThan(SCORE.boss); });
  it("each hint costs 15%, floor 55%", () => { expect(solveScoreMult(0)).toBe(1); expect(solveScoreMult(1)).toBeCloseTo(.85); expect(solveScoreMult(3)).toBe(.55); });
  it("misread mini-boss is annoying, not lethal", () => { expect(MISREAD.dmgMult).toBe(.55); expect(MISREAD.hpMult).toBe(3); });
});
