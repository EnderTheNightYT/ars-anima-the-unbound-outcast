import { describe, it, expect } from "vitest";
import { DEFAULT_PAD_MAP, mapConflicts, validateProposal } from "./pad-mapping";

describe("pad mapping", () => {
  it("default map has no duplicates and every action bound", () => {
    expect(mapConflicts(DEFAULT_PAD_MAP)).toEqual({ duplicates: [], missing: [] });
  });
  it("flags an action bound to two buttons", () => {
    expect(mapConflicts({ ...DEFAULT_PAD_MAP, 17: "reload" }).duplicates).toEqual([{ action: "reload", buttons: [16, 17] }]);
  });
  it("rejects a proposal giving one button two actions", () => {
    const assignments = Object.entries(DEFAULT_PAD_MAP).map(([b, a]) => ({ button: Number(b), action: a! }));
    expect(validateProposal({ assignments: [...assignments, { button: 0, action: "dash" }], notes: "" }).ok).toBe(false);
    expect(validateProposal({ assignments, notes: "" }).ok).toBe(true);
  });
  it("rejects fixed Start/Select buttons", () => {
    expect(validateProposal({ assignments: [{ button: 9, action: "jump" }], notes: "" }).ok).toBe(false);
  });
});
