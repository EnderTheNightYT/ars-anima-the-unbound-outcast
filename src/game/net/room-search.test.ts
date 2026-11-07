import { describe, it, expect } from "vitest";
import { filterRooms, type RoomLike } from "./room-search";

const rooms: RoomLike[] = [
  { code: "ABC123", clients: 1, max: 4, mode: "coop", difficulty: "normal", host: "Ana", phase: "lobby" },
  { code: "ZZZ999", clients: 4, max: 4, mode: "caos", difficulty: "dificil", host: "Beto", phase: "lobby" },
  { code: "QWE456", clients: 2, max: 4, mode: "traicion", difficulty: "facil", host: "Cirilo", phase: "lobby" },
];
const all = { q: "", mode: "all" as const, openOnly: false };

describe("búsqueda de salas públicas", () => {
  it("busca por anfitrión o código sin importar mayúsculas", () => {
    expect(filterRooms(rooms, { ...all, q: "ana" }).map(r => r.code)).toEqual(["ABC123"]);
    expect(filterRooms(rooms, { ...all, q: "qwe" }).map(r => r.code)).toEqual(["QWE456"]);
  });
  it("filtra por modalidad", () => {
    expect(filterRooms(rooms, { ...all, mode: "caos" }).map(r => r.code)).toEqual(["ZZZ999"]);
  });
  it("oculta las salas llenas si se piden sólo con sitio", () => {
    expect(filterRooms(rooms, { ...all, openOnly: true }).map(r => r.code)).not.toContain("ZZZ999");
  });
  it("las salas con sitio y más jugadores van primero", () => {
    expect(filterRooms(rooms, all).map(r => r.code)).toEqual(["QWE456", "ABC123", "ZZZ999"]);
  });
});
