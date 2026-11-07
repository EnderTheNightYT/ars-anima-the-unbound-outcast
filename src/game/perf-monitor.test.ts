import { describe, it, expect } from "vitest";
import { PerfMonitor, HITCH_MS, FREEZE_MS, perfInput, perfShareText } from "./perf-monitor";
const ctx = () => ({ mode: "play", camera: "fp", enemies: 4, floor: 1, online: false, ping: 0, quality: "auto" });

describe("PerfMonitor", () => {
  it("counts a frame of 50 ms or more as a hitch and 250 ms or more as a freeze", () => {
    const m = new PerfMonitor(); let t = 0;
    for (const ms of [16, 49, HITCH_MS, 120, FREEZE_MS]) { t += ms; m.sample(ms, t, ctx); }
    expect(m.hitches.map(h => h.ms)).toEqual([50, 120, 250]);
    expect(m.freezes).toBe(1);
    expect(m.hitches[0]?.enemies).toBe(4);
  });
  it("ignores hidden-tab gaps over 5 s", () => {
    const m = new PerfMonitor(); expect(m.sample(6000, 6000, ctx)).toBe(false); expect(m.hitches).toHaveLength(0);
  });
  it("reports 60 FPS for steady 16.67 ms frames", () => {
    const m = new PerfMonitor(); let t = 0; for (let i = 0; i < 120; i++) { t += 1000 / 60; m.sample(1000 / 60, t, ctx); }
    expect(m.fps).toBe(60); expect(m.summary().avgFps).toBe(60); expect(m.fpsHistory[0]).toBe(60);
  });
  it("produces a payload the server accepts and a share text with the worst hitch", () => {
    const m = new PerfMonitor(); let t = 0; for (const ms of [16, 300, 80]) { t += ms; m.sample(ms, t, ctx); }
    const p = perfInput.parse({ summary: m.summary(), hitches: m.hitches, device: { platform: "Android", mobile: true, cores: 8, memoryGB: 4, dpr: 2.6, screen: "411x914", gpu: "Adreno 610", browser: "Chrome 140" }, net: { online: true, ping: 120, reconnecting: false }, settings: { preset: "auto", backend: "auto", camera: "fp", maxFps: 60, renderScale: 1 } });
    expect(perfShareText(p)).toContain("300 ms");
  });
});
