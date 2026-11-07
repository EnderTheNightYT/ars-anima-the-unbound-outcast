/** Serialización del estado del juego para la red: datos planos, sin funciones ni recursos de dibujo. */

const isEnemyLike = (v: Record<string, unknown>) => typeof v["id"] === "number" && "brkMax" in v && "hpMax" in v && "kind" in v;

/** Convierte un valor del motor en JSON seguro. Sets → {__set}, Uint8Array → {__u8}, enemigos referenciados → {__e}. */
export function toPlain(v: unknown, depth = 0, root = true): unknown {
  if (v === null) return null;
  const t = typeof v;
  if (t === "number") return Number.isFinite(v as number) ? Math.round((v as number) * 1000) / 1000 : 0;
  if (t === "string" || t === "boolean") return v;
  if (t !== "object" || depth > 7) return undefined;
  if (Array.isArray(v)) { const out: unknown[] = []; for (const x of v) { const p = toPlain(x, depth + 1, false); out.push(p === undefined ? null : p); } return out; }
  if (v instanceof Set) return { __set: [...v].map(x => toPlain(x, depth + 1, false)).filter(x => x !== undefined) };
  if (v instanceof Uint8Array) return { __u8: Array.from(v) };
  if (v instanceof Map || v instanceof WeakMap || v instanceof WeakSet || ArrayBuffer.isView(v)) return undefined;
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) return undefined;
  const o = v as Record<string, unknown>;
  if (!root && depth > 0 && isEnemyLike(o)) return { __e: o["id"] };
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(o)) { const p = toPlain(o[k], depth + 1, false); if (p !== undefined) out[k] = p; }
  return out;
}

/** Inverso de toPlain. Los {__e} se resuelven con `enemy` cuando se indica. */
export function fromPlain(v: unknown, enemy?: (id: number) => unknown): unknown {
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(x => fromPlain(x, enemy));
  const o = v as Record<string, unknown>;
  if (Array.isArray(o["__set"])) return new Set((o["__set"] as unknown[]).map(x => fromPlain(x, enemy)));
  if (Array.isArray(o["__u8"])) return Uint8Array.from(o["__u8"] as number[]);
  if (typeof o["__e"] === "number") return enemy ? enemy(o["__e"] as number) ?? null : null;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(o)) out[k] = fromPlain(o[k], enemy);
  return out;
}

/** Cambios por clave respecto a lo último enviado (`prev` guarda el JSON de cada clave). */
export function diffKeys(prev: Map<string, string>, obj: Record<string, unknown>, keys: Iterable<string>) {
  const out: Record<string, unknown> = {}; let n = 0;
  for (const k of keys) {
    const p = toPlain(obj[k], 0, true); if (p === undefined) continue;
    const j = JSON.stringify(p); if (prev.get(k) === j) continue;
    prev.set(k, j); out[k] = p; n++;
  }
  return n ? out : null;
}

/** Diferencias por entidad con id: { upd: [[id, campos cambiados]], del: [ids] }. */
export function diffEntities(prev: Map<number, Map<string, string>>, list: Record<string, unknown>[], idOf: (e: Record<string, unknown>) => number, skip: ReadonlySet<string>, filter?: (e: Record<string, unknown>) => boolean) {
  const seen = new Set<number>(); const upd: [number, Record<string, unknown>][] = [];
  for (const e of list) {
    if (filter && !filter(e)) continue;
    const id = idOf(e); seen.add(id);
    let p = prev.get(id); const fresh = !p; if (!p) { p = new Map(); prev.set(id, p); }
    const ch: Record<string, unknown> = {}; let n = 0;
    for (const k of Object.keys(e)) {
      if (skip.has(k)) continue;
      const v = toPlain(e[k], 1, false); if (v === undefined) continue;
      const j = typeof v === "object" && v !== null ? JSON.stringify(v) : String(v) + typeof v;
      if (p.get(k) === j) continue; p.set(k, j); ch[k] = v; n++;
    }
    if (n || fresh) upd.push([id, ch]);
  }
  const del: number[] = [];
  for (const id of prev.keys()) if (!seen.has(id)) { del.push(id); prev.delete(id); }
  return upd.length || del.length ? { upd, del } : null;
}

/** Aplica los cambios de entidades sobre una lista local (crea, actualiza, borra). */
export function applyEntities<T extends Record<string, unknown>>(list: T[], idKey: string, d: { upd: [number, Record<string, unknown>][]; del: number[] } | null | undefined, revive: (v: unknown) => unknown = fromPlain) {
  if (!d) return list;
  const byId = new Map<number, T>(); for (const e of list) byId.set(e[idKey] as number, e);
  for (const [id, ch] of d.upd) {
    let e = byId.get(id); if (!e) { e = { [idKey]: id } as T; byId.set(id, e); list.push(e); }
    for (const k of Object.keys(ch)) (e as Record<string, unknown>)[k] = revive(ch[k]);
  }
  if (d.del.length) { const del = new Set(d.del); return list.filter(e => !del.has(e[idKey] as number)); }
  return list;
}
