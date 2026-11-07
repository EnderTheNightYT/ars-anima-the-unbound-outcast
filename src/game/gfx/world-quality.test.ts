import { describe, it, expect } from "vitest";
import { WorldQualityGovernor } from "./world-quality";

const run = (g: WorldQualityGovernor, ms: number, seconds: number) => { for (let t = 0; t < seconds; t += 1 / 30) g.update(ms, 1 / 30); return g.level; };

describe("calidad adaptable de la vista 3D", () => {
  it("a 60 fps estables no baja nada", () => { expect(run(new WorldQualityGovernor(), 16.7, 30)).toBe(0); });
  it("a 30 fps sostenidos baja un nivel cada ~1,5 s hasta el mínimo (3)", () => {
    const g = new WorldQualityGovernor();
    expect(run(g, 33, 1.7)).toBe(1);
    expect(run(g, 33, 10)).toBe(3);
  });
  it("un tirón suelto (menos de 1,5 s) no baja la calidad", () => { const g = new WorldQualityGovernor(); run(g, 50, 1); expect(run(g, 16.7, 5)).toBe(0); });
  it("recupera un nivel tras 10 s a 60 fps; si vuelve a caer, la siguiente espera es de 20 s", () => {
    const g = new WorldQualityGovernor();
    run(g, 33, 1.7); expect(g.level).toBe(1);
    expect(run(g, 16, 9)).toBe(1); expect(run(g, 16, 1.5)).toBe(0);
    run(g, 33, 1.7); expect(g.level).toBe(1);
    expect(run(g, 16, 15)).toBe(1); expect(run(g, 16, 6)).toBe(0);
  });
});
