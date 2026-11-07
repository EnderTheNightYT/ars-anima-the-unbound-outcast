import { describe, it, expect } from "vitest";
import { translateText } from "./auto-translate";
import { weaponNameEn } from "./dynamic-phrases";
import EN from "./i18n-en.json";
const tr = (s: string) => translateText(s, EN as Record<string, string>);
describe("dynamic HUD phrases", () => {
  it("weapon names use English word order", () => expect(weaponNameEn("ESPADA Pesada Rúnica del Cuervo")).toBe("Runic Heavy SWORD of the Raven"));
  it("broken weapon float", () => expect(tr("¡HACHA Mellada ROTA!")).toBe("Chipped AXE BROKE!"));
  it("merchant gift", () => expect(tr("El mercader te entrega PISTOLA de Tambor de Babel.")).toBe("The merchant hands you a Drum-fed PISTOL of Babel."));
  it("skill ready", () => expect(tr("✦ FRENESÍ LISTA (B)")).toMatch(/READY \(B\)$/));
  it("skill recharge", () => expect(tr("Se recarga con 3 muertes")).toBe("Recharges after 3 kills"));
  it("unlock by merchant", () => expect(tr("Se compra al Mercader por 60 fichas")).toBe("Buy it from the Merchant for 60 tokens"));
});
