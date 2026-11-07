/**
 * Consejos de estrategia por IA a partir de las estadísticas reales de una partida (individual o compartida).
 * Browser-safe: esquemas, recorte de datos y texto para compartir. La llamada a la IA vive en src/lib.
 */
import { z } from "zod";

const num = z.number().finite();
export const strategyInput = z.object({
  mode: z.enum(["solo", "multi"]),
  name: z.string().max(40),
  className: z.string().max(60),
  role: z.string().max(40).optional(),
  ruleMode: z.string().max(30).optional(),
  difficulty: z.string().max(30),
  outcome: z.string().max(80),
  floor: z.number().int().min(0).max(99),
  level: z.number().int().min(0).max(300),
  score: z.number().int().min(0).max(100_000_000),
  place: z.number().int().min(0).max(8).optional(),
  players: z.number().int().min(0).max(8).optional(),
  seconds: z.number().int().min(0).max(1_000_000),
  stats: z.record(z.string().max(40), num).refine(o => Object.keys(o).length <= 40, "demasiadas estadísticas"),
  hurt: z.array(z.object({ cause: z.string().max(60), n: z.number().int().min(0).max(100000) })).max(8),
  gear: z.array(z.string().max(100)).max(4),
  title: z.string().max(80).optional(),
});
export type StrategyInput = z.infer<typeof strategyInput>;

export const strategyOutput = z.object({
  headline: z.string().max(160),
  tips: z.array(z.object({ title: z.string().max(70), detail: z.string().max(320) })).min(1).max(4),
});
export type StrategyAdvice = z.infer<typeof strategyOutput>;

/** Esquema JSON estricto para la respuesta del modelo (equivalente a strategyOutput). */
export const STRATEGY_JSON_SCHEMA = {
  type: "object", additionalProperties: false, required: ["headline", "tips"],
  properties: {
    headline: { type: "string" },
    tips: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "detail"], properties: { title: { type: "string" }, detail: { type: "string" } } } },
  },
} as const;

/** Sólo números finitos y redondeados; descarta claves vacías y limita a 40. */
export function cleanStats(src: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(src)) {
    if (Object.keys(out).length >= 40) break;
    if (typeof v !== "number" || !Number.isFinite(v) || !k) continue;
    out[k.slice(0, 40)] = Math.round(v * 10) / 10;
  }
  return out;
}

/** Las causas de daño más frecuentes, de mayor a menor (máx. 5). */
export function topHurt(counts: Record<string, number> | undefined, n = 5) {
  return Object.entries(counts ?? {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, n)
    .map(([cause, v]) => ({ cause: cause.slice(0, 60), n: Math.round(v) }));
}

/** Recorta textos del modelo y garantiza entre 1 y 4 consejos. */
export function cleanAdvice(raw: unknown): StrategyAdvice | null {
  const r = strategyOutput.safeParse(trimDeep(raw));
  if (!r.success) return null;
  const tips = r.data.tips.filter(t => t.title.trim() && t.detail.trim());
  return tips.length ? { headline: r.data.headline.trim(), tips } : null;
}
function trimDeep(v: unknown): unknown {
  if (!v || typeof v !== "object") return v;
  const o = v as { headline?: unknown; tips?: unknown };
  const cut = (s: unknown, n: number) => (typeof s === "string" ? s.slice(0, n) : s);
  return { headline: cut(o.headline, 160), tips: Array.isArray(o.tips) ? o.tips.slice(0, 4).map(t => ({ title: cut((t as { title?: unknown })?.title, 70), detail: cut((t as { detail?: unknown })?.detail, 320) })) : o.tips };
}

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
/** Texto compartible con estadísticas clave y, si existen, los consejos de la IA. */
export function strategyShareText(i: StrategyInput, advice?: StrategyAdvice | null) {
  const head = i.mode === "multi"
    ? `${i.name} (${i.className}${i.role ? ` · ${i.role}` : ""}) terminó ${i.place ? `#${i.place}${i.players ? ` de ${i.players}` : ""}` : ""} en la Expedición Compartida${i.ruleMode ? ` (${i.ruleMode})` : ""}`
    : `${i.name} (${i.className}) · ${i.outcome}`;
  const pick = ["kills", "damage", "healing", "revives", "pvpKills", "betrayals", "beatCrits", "streakMax"].filter(k => i.stats[k] != null)
    .map(k => `${STAT_SHARE_LABEL[k] ?? k} ${Math.round(i.stats[k] ?? 0)}`);
  const lines = [
    `Ars. Anima. : - "IL'INCONNU." — ${head}.`,
    `Puntaje ${i.score} · Nivel ${i.level} · Piso ${i.floor} · ${fmtTime(i.seconds)} · ${i.difficulty}${i.title ? ` · «${i.title}»` : ""}`,
    pick.length ? pick.join(" · ") : "",
  ];
  if (advice) lines.push(`Consejo IA: ${advice.headline}`, ...advice.tips.map((t, n) => `${n + 1}. ${t.title}: ${t.detail}`));
  return lines.filter(Boolean).join("\n");
}
export const STAT_SHARE_LABEL: Record<string, string> = {
  kills: "Bajas", damage: "Daño", healing: "Curación", revives: "Revividas", pvpKills: "Jugadores derrotados",
  betrayals: "Traiciones", beatCrits: "Golpes a ritmo", streakMax: "Racha máx.",
};
