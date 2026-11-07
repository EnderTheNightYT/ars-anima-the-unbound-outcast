import { describe, it, expect } from "vitest";
import { bestRun, furthestRun, pushHistory, readRunSave, writeRunSave, clearRunSave, cleanName, type RunRecord, type RunSave } from "./run-save";
import { cleanBarks, barkLine, FALLBACK_BARKS } from "./barks";
import { ScoreKeeper } from "./score";

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };
const rec = (id: string, score: number, floor: number, outcome: "death" | "won" = "death"): RunRecord => ({ id, name: "A", clsName: "C", diff: "normal", score, floor, region: "R", level: 1, kills: 0, seconds: 0, outcome, cause: "x", floors: [], endedAt: 0 });

describe("runs", () => {
  it("best run is the highest score; furthest counts a win above floor 6", () => {
    const h = [rec("a", 900, 3), rec("b", 1200, 2), rec("c", 500, 6, "won")];
    expect(bestRun(h)?.id).toBe("b");
    expect(furthestRun(h)?.id).toBe("c");
  });
  it("saved run survives until cleared (death ends it)", () => {
    const s = mem(); const save = { v: 1, cls: "x" } as RunSave;
    writeRunSave(save, s); expect(readRunSave(s)?.cls).toBe("x");
    clearRunSave(s); expect(readRunSave(s)).toBeNull();
  });
  it("history keeps newest first", () => { const s = mem(); pushHistory(rec("a", 1, 1), s); expect(pushHistory(rec("b", 2, 1), s)[0]?.id).toBe("b"); });
  it("preserves name spaces, case and special characters exactly", () => { const name = "  <Ána> / 星 🕯  "; expect(cleanName(name)).toBe(name); expect(cleanName("x".repeat(40)).length).toBe(40); });
  it("score keeper restores the run total", () => { const a = new ScoreKeeper(); a.gain("kill", 3); const b = new ScoreKeeper(); b.load(a.dump()); expect(b.total).toBe(a.total); });
});

describe("barks", () => {
  it("drops lines over 48 characters", () => { expect(cleanBarks({ detect: ["¡Ahí!", "x".repeat(60)] }).detect).toEqual(["¡Ahí!"]); });
  it("falls back to generic lines for unknown enemies", () => { expect(FALLBACK_BARKS.death).toContain(barkLine("desconocido", "death", () => 0)); });
});
