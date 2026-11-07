/**
 * Color de la silueta brillante de cada jugador en la expedición compartida.
 * Parte de un tono preestablecido por clase, lo desplaza por subclase, rol principal/secundario y
 * nombre, y añade un pequeño azar (`salt`). Después se separa de los tonos de los demás jugadores.
 */
export const CLASS_HUE: Record<string, number> = {
  duelista: 0, cazador: 130, guardian: 210, resonante: 275, alquimista: 95, acrobata: 175,
  guerrero: 20, tecnomante: 45, hereje: 300, ocultista: 335, ingeniero: 60, peregrino: 150,
};
export const ROLE_SHIFT: Record<string, { hue: number; sat: number; light: number }> = {
  dano: { hue: -8, sat: 1, light: 58 }, soporte: { hue: 10, sat: .85, light: 66 }, tanque: { hue: 0, sat: .9, light: 54 },
  control: { hue: 14, sat: .95, light: 62 }, exploracion: { hue: -14, sat: 1, light: 60 },
};
export const GLOW = { jitter: 10, minGap: 30, step: 37 } as const;

export function hashText(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const wrap = (h: number) => ((h % 360) + 360) % 360;
export const hueGap = (a: number, b: number) => { const d = Math.abs(wrap(a) - wrap(b)); return Math.min(d, 360 - d); };

export interface GlowInput { clsId: string; subclassId?: string; name: string; role: string; role2?: string; salt?: number }

/** Tono base (sin separar de los demás). `salt` en [0,1). */
export function baseGlow(p: GlowInput): { h: number; s: number; l: number } {
  const base = CLASS_HUE[p.clsId] ?? hashText(p.clsId) % 360;
  const sub = p.subclassId ? (hashText(p.subclassId) % 2 ? 1 : -1) * (12 + hashText(p.subclassId) % 10) : 0;
  const r1 = ROLE_SHIFT[p.role] ?? ROLE_SHIFT["dano"]!, r2 = p.role2 ? ROLE_SHIFT[p.role2] : undefined;
  const name = (hashText(p.name.toLowerCase()) % 13) - 6;
  const salt = ((p.salt ?? .5) - .5) * 2 * GLOW.jitter;
  const h = wrap(base + sub + r1.hue + (r2 ? r2.hue / 2 : 0) + name + salt);
  return { h, s: Math.round(80 + 20 * r1.sat * (r2 ? (r1.sat + r2.sat) / 2 : 1)) / 1, l: r2 ? Math.round((r1.light + r2.light) / 2) : r1.light };
}

/** Rota el tono hasta quedar a `minGap` grados de los tonos ya usados. */
export function separateHue(h: number, used: number[]): number {
  let out = wrap(h);
  for (let i = 0; i < 12 && used.some(u => hueGap(u, out) < GLOW.minGap); i++) out = wrap(h + GLOW.step * Math.ceil((i + 1) / 2) * (i % 2 ? -1 : 1));
  return out;
}

const hex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
export function hslHex(h: number, s: number, l: number) {
  const S = Math.min(100, s) / 100, L = l / 100, k = (n: number) => (n + h / 30) % 12, a = S * Math.min(L, 1 - L);
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${hex(f(0) * 255)}${hex(f(8) * 255)}${hex(f(4) * 255)}`;
}
export function hexHue(c: string): number | null {
  const m = /^#([0-9a-f]{6})$/i.exec(c); if (!m) return null; const v = parseInt(m[1]!, 16), r = (v >> 16 & 255) / 255, g = (v >> 8 & 255) / 255, b = (v & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (d < 1e-6) return null;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return wrap(h * 60);
}

/** Color final del jugador, distinto de `others` (colores hex de los demás). */
export function playerGlow(p: GlowInput, others: string[] = []): string {
  const b = baseGlow(p), used = others.map(hexHue).filter((h): h is number => h !== null);
  return hslHex(separateHue(b.h, used), b.s, b.l);
}
