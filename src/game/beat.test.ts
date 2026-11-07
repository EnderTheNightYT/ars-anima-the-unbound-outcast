import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { detectBeats, onBeat, wantsFloorMusic, RHYTHM } from "./beat";

function synthKicks(sr: number, seconds: number, every: number) {
  const s = new Float32Array(sr * seconds);
  for (let t = 0.5; t < seconds; t += every) {
    const i0 = Math.round(t * sr);
    for (let k = 0; k < sr * 0.12 && i0 + k < s.length; k++) s[i0 + k] = Math.sin((2 * Math.PI * 60 * k) / sr) * Math.exp(-k / (sr * 0.03));
  }
  return s;
}

describe("ritmo", () => {
  it("detecta golpes graves sintéticos cada 0,5 s", () => {
    const beats = detectBeats(synthKicks(22050, 6, 0.5), 22050);
    expect(beats.length).toBeGreaterThanOrEqual(10);
    expect(onBeat(beats, 2.5)).toBe(true);
  });
  it("margen flexible de ±0,16 s alrededor del golpe", () => {
    expect(RHYTHM.window).toBe(0.16);
    expect(onBeat([1, 2], 2.15)).toBe(true);
    expect(onBeat([1, 2], 1.84)).toBe(true);
    expect(onBeat([1, 2], 1.5)).toBe(false);
  });
  it("la música sólo suena en el primer piso al salir del refugio o ver un hostil", () => {
    expect(wantsFloorMusic(1, false, true, false)).toBe(false);
    expect(wantsFloorMusic(1, false, false, false)).toBe(true);
    expect(wantsFloorMusic(1, false, true, true)).toBe(true);
    expect(wantsFloorMusic(2, true, false, true)).toBe(false);
  });
  it.skipIf(!existsSync("/tmp/bell.f32"))("encuentra golpes en la canción real", () => {
    const b = readFileSync("/tmp/bell.f32");
    const pcm = new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
    const beats = detectBeats(pcm, 22050);
    const dur = pcm.length / 22050;
    console.log("beats", beats.length, "dur", dur.toFixed(1), beats.slice(0, 12).map((x) => x.toFixed(2)).join(" "));
    expect(beats.length).toBeGreaterThan(dur / 8);
    expect(beats.length).toBeLessThan(dur * 3);
  });
});

import { beatCue as cue } from "./beat";
describe("indicador del próximo golpe", () => {
  const beats = [1, 2, 3.5];
  it("cuenta los segundos hasta el próximo grave", () => { expect(cue(beats, 0.6)!.until).toBeCloseTo(0.4); });
  it("marca 'ahora' dentro del margen flexible de 0,16 s, antes y después", () => {
    expect(cue(beats, 0.9)!.inWindow).toBe(true);
    expect(cue(beats, 1.12)!.inWindow).toBe(true);
    expect(cue(beats, 1.3)!.inWindow).toBe(false);
  });
  it("tras pasar el margen apunta al siguiente golpe", () => { expect(cue(beats, 1.3)!.until).toBeCloseTo(0.7); });
});
