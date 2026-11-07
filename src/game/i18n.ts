import { useEffect, useState } from "react";

/** Idioma del menú: "es" (original) o "en". Las traducciones se buscan por el texto en español. */
export type Lang = "es" | "en";
const KEY = "ars_anima_lang";
const EN: Record<string, string> = {
  "EL JUEGO DE LOS DADOS ETERNOS · v0.5": "THE GAME OF THE ETERNAL DICE · v0.5",
  "Vestigios acumulados": "Accumulated vestiges",
  "Grado y Ciclos persisten entre vidas": "Grade and Cycles persist between lives",
  "ESTADÍSTICAS": "STATISTICS",
  "MI PERFIL": "MY PROFILE",
  "SUBCLASE": "SUBCLASS",
  "DIFICULTAD": "DIFFICULTY",
  "AVISOS DE ESQUIVE": "DODGE WARNINGS",
  "COMENZAR RUN": "START RUN",
  "NUEVA RUN": "NEW RUN",
  "CONTROLES Y MECÁNICAS": "CONTROLS AND MECHANICS",
  "PC · TECLADO Y RATÓN": "PC · KEYBOARD AND MOUSE",
  "MANDO / JOYSTICK": "GAMEPAD / JOYSTICK",
  "MECÁNICAS": "MECHANICS",
  "LA TINTA SE SECA": "THE INK RUNS DRY",
  "El reto se ajusta solo: si sufres se suaviza, si arrasas se endurece. Cada 20 s se revisa tu rendimiento.":
    "The challenge adapts: it softens if you struggle and hardens if you dominate. Your performance is checked every 20 s.",
  "Tienes una run en curso: sólo termina al morir. Reanúdala arriba para jugar.":
    "You have a run in progress: it only ends when you die. Resume it above to play.",
  "Fácil": "Easy", "Normal": "Normal", "Difícil": "Hard", "Pesadilla": "Nightmare",
  "Golpes suaves, esquivan poco": "Soft hits, enemies rarely dodge",
  "Reto equilibrado": "Balanced challenge",
  "Pegan más y esquivan más": "They hit harder and dodge more",
  "Castigo total": "Total punishment",
  "Todos": "All", "Solo cercanos": "Nearby only", "Apagados": "Off",
  "Piso": "Floor", "Nivel": "Level", "muertes": "kills", "Fichas": "Tokens",
  "IDIOMA": "LANGUAGE",
};

let current: Lang = "es";
const subs = new Set<() => void>();
export function getLang(): Lang { return current; }
export function setLang(l: Lang) {
  current = l;
  try { localStorage.setItem(KEY, l); } catch { /* sin almacenamiento */ }
  if (typeof document !== "undefined") document.documentElement.lang = l;
  subs.forEach((f) => f());
}
/** Traduce un texto del menú; sin traducción conocida devuelve el original. */
export function t(es: string, lang: Lang = current): string { return lang === "en" ? EN[es] ?? es : es; }

/** Hook: idioma actual y re-render al cambiarlo. Lee localStorage después de hidratar. */
export function useLang() {
  const [lang, set] = useState<Lang>("es");
  useEffect(() => {
    const saved = (() => { try { return localStorage.getItem(KEY); } catch { return null; } })();
    if (saved === "en" || saved === "es") { current = saved; document.documentElement.lang = saved; }
    set(current);
    const f = () => set(current); subs.add(f); return () => { subs.delete(f); };
  }, []);
  return { lang, t: (s: string) => t(s, lang), setLang };
}
