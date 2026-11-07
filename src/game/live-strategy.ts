/**
 * Estratega en vivo: resume la clase, el estado y el encuentro actual del jugador para pedir una estrategia a la IA.
 * Browser-safe: esquemas y recorte de datos; la llamada vive en src/lib/strategy-tips.server.ts.
 */
import { z } from "zod";

export const liveStrategyInput = z.object({
  className: z.string().max(60),
  level: z.number().int().min(0).max(300),
  floor: z.number().int().min(0).max(99),
  region: z.string().max(60),
  weapon: z.string().max(80),
  condition: z.object({
    hpPct: z.number().int().min(0).max(100), staminaPct: z.number().int().min(0).max(100),
    lumbre: z.number().int().min(0).max(99), food: z.number().int().min(0).max(100), thirst: z.number().int().min(0).max(100),
    statuses: z.array(z.string().max(30)).max(10), wounds: z.array(z.string().max(30)).max(8),
  }),
  encounter: z.array(z.object({ kind: z.string().max(40), count: z.number().int().min(1).max(50), nearest: z.number().min(0).max(99), tag: z.string().max(30).optional() })).max(8),
  note: z.string().max(200).optional(),
});
export type LiveStrategyInput = z.infer<typeof liveStrategyInput>;

type EnemyLike = { kind: string; x: number; y: number; dead: boolean; elite?: string; miniBoss?: boolean; tyrant?: boolean };
type GameLike = {
  cls: { name: string }; level: number; floor: number; region: { name: string };
  hp: number; hpMax: number; stam: number; stamMax: number; lumbre: number; food: number; thirst: number;
  burn: number; poison: number; bleed: number; wounds: Record<string, number>; fatigue: number;
  px: number; py: number; enemies: EnemyLike[]; slot: number; melee?: { type?: string; name?: string } | null; ranged?: { type?: string; name?: string } | null;
};

const pct = (a: number, b: number) => Math.max(0, Math.min(100, Math.round(b > 0 ? (a / b) * 100 : 0)));

/** Construye la entrada sólo con datos verificados de la partida (enemigos vivos a ≤ 14 casillas). */
export function liveStrategyFromGame(g: GameLike, note?: string): LiveStrategyInput {
  const groups = new Map<string, { kind: string; count: number; nearest: number; tag?: string }>();
  for (const e of g.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - g.px, e.y - g.py); if (d > 14) continue;
    const tag = e.tyrant ? "jefe" : e.miniBoss ? "minijefe" : e.elite ? `élite ${e.elite}`.slice(0, 30) : undefined;
    const key = `${e.kind}|${tag ?? ""}`, cur = groups.get(key);
    if (cur) { cur.count++; cur.nearest = Math.min(cur.nearest, d); } else groups.set(key, { kind: String(e.kind).slice(0, 40), count: 1, nearest: d, ...(tag ? { tag } : {}) });
  }
  const encounter = [...groups.values()].sort((a, b) => a.nearest - b.nearest).slice(0, 8).map(x => ({ ...x, nearest: Math.round(x.nearest * 10) / 10 }));
  const statuses = [g.burn > 0 && "quemado", g.poison > 0 && "envenenado", g.bleed > 0 && "sangrando", g.fatigue > 60 && "fatigado"].filter(Boolean) as string[];
  const w = g.slot === 0 ? g.melee : g.ranged;
  const n = note?.trim().slice(0, 200);
  return {
    className: g.cls.name.slice(0, 60), level: Math.round(g.level), floor: Math.round(g.floor), region: g.region.name.slice(0, 60),
    weapon: String(w?.name ?? w?.type ?? "sin arma").slice(0, 80),
    condition: {
      hpPct: pct(g.hp, g.hpMax), staminaPct: pct(g.stam, g.stamMax), lumbre: Math.max(0, Math.min(99, Math.round(g.lumbre))),
      food: Math.max(0, Math.min(100, Math.round(g.food))), thirst: Math.max(0, Math.min(100, Math.round(g.thirst))),
      statuses, wounds: Object.entries(g.wounds).filter(([, v]) => v > 0).map(([k]) => k.slice(0, 30)).slice(0, 8),
    },
    encounter, ...(n ? { note: n } : {}),
  };
}

/** Texto compartible del momento actual (y la estrategia si existe). */
export function liveShareText(i: LiveStrategyInput, plan?: { headline: string; tips: { title: string; detail: string }[] } | null) {
  const enc = i.encounter.length ? i.encounter.map(e => `${e.count}× ${e.kind}${e.tag ? ` (${e.tag})` : ""}`).join(", ") : "sin enemigos cerca";
  const lines = [
    `Ars. Anima. — ${i.className} nv ${i.level}, piso ${i.floor} (${i.region})`,
    `Vida ${i.condition.hpPct}% · Aguante ${i.condition.staminaPct}% · Lumbre ${i.condition.lumbre}${i.condition.statuses.length ? ` · ${i.condition.statuses.join(", ")}` : ""}`,
    `Encuentro: ${enc}`,
  ];
  if (plan) lines.push(`Estrategia IA: ${plan.headline}`, ...plan.tips.map((t, n) => `${n + 1}. ${t.title}: ${t.detail}`));
  return lines.join("\n");
}
