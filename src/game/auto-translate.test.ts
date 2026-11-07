import { describe, expect, it } from "vitest";
import { translateText } from "./auto-translate";
import EN from "./i18n-en.json";

describe("traducción automática al inglés", () => {
  const dict = { "Fichas": "Tokens", "Mercader de Babel": "Merchant of Babel" };
  it("traduce un texto exacto conservando espacios", () => {
    expect(translateText(" Fichas ", dict)).toBe(" Tokens ");
  });
  it("traduce frases conocidas dentro de un texto mayor", () => {
    expect(translateText("Mercader de Babel · Fichas: ", dict)).toBe("Merchant of Babel · Tokens: ");
  });
  it("deja intacto lo que no conoce", () => {
    expect(translateText("xyz 12", dict)).toBe("xyz 12");
  });
  it("el diccionario llama fichas a la moneda en inglés como tokens", () => {
    const fichas = Object.entries(EN as Record<string, string>).filter(([es]) => /\bfichas\b/i.test(es));
    expect(fichas.length).toBeGreaterThan(0);
    for (const [, en] of fichas) expect(en.toLowerCase()).toContain("token");
  });
});
