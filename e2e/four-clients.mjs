// Prueba de 4 jugadores reales contra el servidor de salas (local o publicado) + un 5.º que debe ser rechazado.
// Uso: SERVER_URL=https://ars-anima-rooms.<sub>.workers.dev node e2e/four-clients.mjs   (Node 22+, sin dependencias)
const SERVER = (process.env.SERVER_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const WS = SERVER.replace(/^http/, "ws");
let ok = true;
const check = (name, cond, extra = "") => { ok &&= !!cond; console.log(cond ? "PASA " : "FALLA", name, extra); };
const wait = ms => new Promise(r => setTimeout(r, ms));

function join(code, name) {
  const c = { name, msgs: {}, lobby: null, id: "", err: "", closed: false, snaps: 0, fast: 0, enemies: new Set(), floorSeed: null, others: new Set() };
  c.ws = new WebSocket(`${WS}/ws/${code}?name=${encodeURIComponent(name)}`);
  c.ws.onmessage = e => {
    const [t, d] = JSON.parse(String(e.data));
    c.msgs[t] = (c.msgs[t] ?? 0) + 1;
    if (t === "hello") c.id = d.id;
    if (t === "lobby") c.lobby = d;
    if (t === "__error" || t === "err") c.err = String(d);
    if (t === "s") { c.snaps++; for (const [id] of d.en?.upd ?? []) c.enemies.add(id); if (d.floor) c.floorSeed = d.floor.seed; for (const row of d.pl ?? []) if (row[0] !== c.id) c.others.add(row[0]); }
    if (t === "p") c.fast++;
  };
  c.ws.onclose = e => { c.closed = true; if (process.env.DEBUG) console.log("  cierre", name, e.code, e.reason); };
  c.ws.onerror = e => { if (process.env.DEBUG) console.log("  error", name, e.message ?? ""); };
  c.send = (t, d) => c.ws.readyState === 1 && c.ws.send(JSON.stringify([t, d]));
  return c;
}

const health = await fetch(`${SERVER}/health`).then(r => r.json()).catch(e => ({ error: String(e) }));
check("servidor en línea", health.ok && health.kind === "cf", JSON.stringify(health));
if (!health.ok) process.exit(1);
const { code } = await fetch(`${SERVER}/create`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "caos", isPrivate: true }) }).then(r => r.json());
check("crear sala privada", /^[A-Z0-9]{4,8}$/.test(code ?? ""), code);

const names = ["Ana", "Beto", "Cira", "Dario"];
const cs = [];
for (const n of names) { cs.push(join(code, n)); await wait(400); }
await wait(1500);
check("4 jugadores en el lobby", cs.every(c => c.lobby?.players?.length === 4), cs.map(c => c.lobby?.players?.length).join(","));
const fifth = join(code, "Eva"); await wait(1500);
check("5.º jugador rechazado (sala llena)", /llena/i.test(fifth.err), fifth.err);

for (const c of cs.slice(1)) c.send("ready", true);
await wait(600);
cs[0].send("start");
await wait(4000);
check("partida iniciada en los 4", cs.every(c => c.msgs.started), cs.map(c => c.msgs.started ?? 0).join(","));
const before = cs.map(c => c.snaps);
for (let i = 0; i < 30; i++) { cs.forEach((c, k) => c.send("in", { mx: 0, my: 1, ang: k, pitch: 0, fire: i % 4 === 0 })); await wait(66); }
await wait(800);
check("los 4 reciben instantáneas (~10/s)", cs.every((c, k) => c.snaps - before[k] >= 15), cs.map((c, k) => c.snaps - before[k]).join(","));
check("los 4 reciben posiciones rápidas", cs.every(c => c.fast > 10), cs.map(c => c.fast).join(","));
check("los 4 están en el mismo piso (misma semilla)", cs.every(c => c.floorSeed !== null && c.floorSeed === cs[0].floorSeed), cs.map(c => c.floorSeed).join(","));
check("cada uno ve a los otros 3", cs.every(c => c.others.size === 3), cs.map(c => c.others.size).join(","));
{ const shared = [...cs[0].enemies].filter(id => cs.slice(1).some(c => c.enemies.has(id)));
  check("enemigos compartidos (mismos ids en varios clientes)", cs[0].enemies.size === 0 || shared.length > 0, `A ve ${cs[0].enemies.size}, compartidos ${shared.length}`); }
check("sin errores del servidor", cs.every(c => !c.err), cs.map(c => c.err).filter(Boolean).join(" | "));

for (const c of cs) c.send("leave");
await wait(800);
const m = await fetch(`${SERVER}/metrics`).then(r => r.json()).catch(() => null);
console.log("métricas:", JSON.stringify(m?.today ?? m ?? {}).slice(0, 300));
console.log(ok ? "RESULTADO: TODO PASA" : "RESULTADO: HAY FALLOS");
process.exit(ok ? 0 : 1);
