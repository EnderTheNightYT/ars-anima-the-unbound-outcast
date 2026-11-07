/**
 * Conexión con el servidor de salas en Cloudflare (Durable Objects). Expone la misma forma que usa
 * NetSession del SDK de Colyseus (create / joinById / reconnect y Room con onMessage, send, leave…),
 * así el resto del cliente no cambia. Reconexión automática con el token secreto de la plaza.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
type Handler = (m: Any) => void;
const RECONNECT_MS = 60_000;

const httpBase = (u: string) => u.trim().replace(/^ws/, "http").replace(/\/$/, "");
const wsBase = (u: string) => httpBase(u).replace(/^http/, "ws");

export class CfRoom {
  roomId = ""; sessionId = ""; private token = "";
  private ws: WebSocket | null = null; private handlers = new Map<string, Handler>(); private early = new Map<string, Any[]>();
  private dropFns: (() => void)[] = []; private reconnectFns: (() => void)[] = []; private leaveFns: ((code: number) => void)[] = []; private errorFns: ((c: number, m?: string) => void)[] = [];
  private leaving = false; private closed = false;
  constructor(private base: string) {}
  get reconnectionToken() { return `${this.roomId}:${this.token}`; }

  /** Abre el socket y resuelve cuando el servidor confirma la plaza. */
  open(code: string, params: Record<string, string>): Promise<this> {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
    return new Promise((resolve, reject) => {
      let settled = false;
      const ws = new WebSocket(`${wsBase(this.base)}/ws/${encodeURIComponent(code)}?${q}`);
      this.ws = ws;
      ws.onmessage = ev => {
        let msg: unknown; try { msg = JSON.parse(String(ev.data)); } catch { return; }
        if (!Array.isArray(msg)) return; const [type, data] = msg as [string, Any];
        if (type === "__joined") { this.roomId = data.code; this.sessionId = data.sid; this.token = data.token; if (!settled) { settled = true; resolve(this); } return; }
        if (type === "__error") { if (!settled) { settled = true; reject(new Error(String(data))); } return; }
        const h = this.handlers.get(type); if (h) h(data); else { const l = this.early.get(type) ?? []; if (l.length < 20) l.push(data); this.early.set(type, l); }
      };
      ws.onclose = ev => { if (!settled) { settled = true; reject(new Error(ev.reason || "No se pudo conectar con la sala.")); return; } if (this.ws === ws) this.onClosed(ev.code); };
      ws.onerror = () => { /* onclose informa */ };
    });
  }
  private async onClosed(code: number) {
    if (this.closed) return;
    if (this.leaving || code === 4000 || code === 1000 || code === 4001 || code === 4005 || code === 4006) { this.closed = true; this.leaveFns.forEach(f => f(this.leaving ? 4000 : code)); return; }
    this.dropFns.forEach(f => f());
    const until = Date.now() + RECONNECT_MS;
    while (!this.leaving && Date.now() < until) {
      await new Promise(r => setTimeout(r, 1500));
      try { await this.open(this.roomId, { reconnect: this.token }); this.reconnectFns.forEach(f => f()); return; }
      catch (e) { if (e instanceof Error && /sitio|no existe|cerró/.test(e.message)) break; }
    }
    if (!this.closed) { this.closed = true; this.leaveFns.forEach(f => f(4002)); }
  }
  onMessage(type: string, fn: Handler) { this.handlers.set(type, fn); const l = this.early.get(type); if (l) { this.early.delete(type); for (const m of l) fn(m); } }
  onDrop(fn: () => void) { this.dropFns.push(fn); }
  onReconnect(fn: () => void) { this.reconnectFns.push(fn); }
  onLeave(fn: (code: number) => void) { this.leaveFns.push(fn); }
  onError(fn: (code: number, msg?: string) => void) { this.errorFns.push(fn); }
  send(type: string, msg?: unknown) { const ws = this.ws; if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify([type, msg ?? null])); }
  async leave(_consented = true) { this.leaving = true; this.send("leave"); try { this.ws?.close(4000, "bye"); } catch { /* */ } if (!this.closed) { this.closed = true; this.leaveFns.forEach(f => f(4000)); } }
}

export class CfClient {
  auth = { token: "" };
  constructor(private base: string) {}
  async create(_name: string, opts: Record<string, unknown>) {
    const r = await fetch(`${httpBase(this.base)}/create`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(opts) });
    const d = await r.json().catch(() => ({})) as { code?: string; error?: string };
    if (!r.ok || !d.code) throw new Error(d.error ?? `El servidor respondió ${r.status}`);
    return this.joinById(d.code, { name: String(opts["name"] ?? "") });
  }
  joinById(code: string, opts: { name?: string; vaultId?: string }) {
    return new CfRoom(this.base).open(code, { name: opts.name ?? "", vaultId: opts.vaultId ?? "", token: this.auth.token });
  }
  reconnect(tok: string) {
    const i = tok.indexOf(":"); if (i < 1) return Promise.reject(new Error("Token inválido"));
    return new CfRoom(this.base).open(tok.slice(0, i), { reconnect: tok.slice(i + 1) });
  }
}

/** ¿El servidor configurado es el de Cloudflare? (responde /health con kind "cf"). */
const kindCache = new Map<string, boolean>();
export async function isCfServer(url: string) {
  const b = httpBase(url); if (kindCache.has(b)) return kindCache.get(b)!;
  try { const r = await fetch(`${b}/health`); const d = await r.json() as { kind?: string }; const cf = d?.kind === "cf"; kindCache.set(b, cf); return cf; }
  catch { return false; }
}

export type ServerHealth = { state: "checking" | "ok" | "down" | "wrong"; kind?: "cf" | "colyseus"; ms?: number; msg: string };
/** Comprueba de verdad si la dirección responde como servidor de salas (sin simular nada). */
export async function probeServer(url: string): Promise<ServerHealth> {
  const b = httpBase(url); if (!b) return { state: "down", msg: "No hay dirección de servidor configurada." };
  const t0 = performance.now(); const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(`${b}/health`, { signal: ctl.signal }); const ms = Math.round(performance.now() - t0);
    const txt = await r.text(); let d: { ok?: boolean; kind?: string } | null = null; try { d = JSON.parse(txt); } catch { /* no es JSON */ }
    if (r.ok && d?.ok) { const kind = d.kind === "cf" ? "cf" : "colyseus"; kindCache.set(b, kind === "cf"); return { state: "ok", kind, ms, msg: `Servidor en línea (${kind === "cf" ? "Cloudflare" : "Colyseus"}) · ${ms} ms` }; }
    if (r.status === 404 || /<html/i.test(txt)) return { state: "wrong", ms, msg: "Esa dirección responde, pero no es un servidor de salas: aún no está desplegado ahí (publica cloudflare-server con «npx wrangler deploy»)." };
    return { state: "down", ms, msg: `El servidor respondió con error ${r.status}. Puede estar caído o mal configurado.` };
  } catch (e) {
    return { state: "down", msg: (e as Error).name === "AbortError" ? "El servidor no responde (tiempo agotado). Puede no estar desplegado o estar caído." : "No se pudo contactar con el servidor: no está desplegado, la dirección es incorrecta o no hay conexión." };
  } finally { clearTimeout(to); }
}
