import { describe, it, expect } from "vitest";
import { buildRoomTiles, puddleAt, puddleExact } from "./render-cache";

describe("caché de salas por casilla", () => {
  it("devuelve la primera sala que contiene la casilla, como Array.find", () => {
    const rooms = [{ x: 2, y: 2, w: 4, h: 3 }, { x: 4, y: 3, w: 5, h: 5 }];
    const t = buildRoomTiles(rooms, 10)!;
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
      const ref = rooms.findIndex(r => x + .5 >= r.x && x + .5 < r.x + r.w && y + .5 >= r.y && y + .5 < r.y + r.h);
      expect(t[y * 10 + x]).toBe(ref);
    }
  });
  it("salas no alineadas a casillas: sin caché (se usa la búsqueda normal)", () => {
    expect(buildRoomTiles([{ x: 1.5, y: 1, w: 2, h: 2 }], 10)).toBeNull();
  });
});

describe("tabla de charcos", () => {
  it("coincide con la fórmula original en más del 97 % de los puntos", () => {
    let same = 0, n = 0;
    for (let i = 0; i < 20000; i++) { const x = (i * 7.31) % 40, y = (i * 3.17) % 40; n++; if (puddleAt(x, y, 40) === puddleExact(x, y)) same++; }
    expect(same / n).toBeGreaterThan(.97);
  });
});
