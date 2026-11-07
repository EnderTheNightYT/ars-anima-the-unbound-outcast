"""
Prueba de extremo a extremo: dos navegadores reales se conectan al servidor de salas.
Verifica creación de sala, unión por código, inicio, movimiento sincronizado y reconexión.

Uso:
  GAME_URL=https://<juego-publicado> SERVER_URL=https://ars-anima-rooms.<sub>.workers.dev python3 e2e/two-browsers.py
Por defecto usa el juego local (http://localhost:8080) y el servidor local (http://127.0.0.1:8787).
"""
import asyncio, os, re, sys
from playwright.async_api import async_playwright

GAME = os.environ.get("GAME_URL", "http://localhost:8080")
SERVER = os.environ.get("SERVER_URL", "http://127.0.0.1:8787")
OUT = os.environ.get("SHOTS", "/tmp/browser/e2e"); os.makedirs(OUT, exist_ok=True)
ok = True
def check(name, cond, extra=""):
    global ok; ok &= bool(cond); print(("PASA " if cond else "FALLA"), name, extra)

async def open_player(p, name):
    ctx = await p.chromium.new_context(viewport={"width": 1280, "height": 1800}) if False else None
    b = await p.chromium.launch(headless=True)
    ctx = await b.new_context(viewport={"width": 1280, "height": 1800})
    pg = await ctx.new_page()
    pg.on("console", lambda m: print(f"  [{name}] {m.text[:160]}") if m.type == "error" else None)
    await pg.goto(GAME, wait_until="domcontentloaded")
    await pg.evaluate("u => localStorage.setItem('ars_anima_mp_url', u)", SERVER)
    await pg.reload(wait_until="domcontentloaded")
    await pg.get_by_role("button", name=re.compile("EXPEDICIÓN COMPARTIDA")).click(timeout=60000)
    await pg.get_by_text(re.compile("Servidor en línea")).wait_for(timeout=15000)
    await pg.get_by_placeholder("Errante").fill(name)
    return b, pg

async def mp_state(pg):
    return await pg.evaluate("""() => { const g = window.__game; return g ? { mode: g.mode, x: g.px, y: g.py, remotes: (g.remotes||[]).map(r => [r.id, +r.x.toFixed(2), +r.y.toFixed(2)]) } : null }""")

async def main():
    async with async_playwright() as p:
        ba, A = await open_player(p, "Ana")
        bb, B = await open_player(p, "Beto")
        await A.get_by_role("button", name="CREAR").click()
        code_el = A.locator(".title-gothic.text-4xl"); await code_el.wait_for(timeout=15000)
        code = (await code_el.inner_text()).strip(); check("crear sala", re.fullmatch(r"[A-Z0-9]{6}", code), code)
        await B.get_by_placeholder("CÓDIGO", exact=True).fill(code); await B.get_by_role("button", name="ENTRAR", exact=True).click()
        await A.get_by_text("Beto").first.wait_for(timeout=15000); check("unirse por código (A ve a Beto)", True)
        await B.get_by_role("button", name="ESTOY LISTO").click()
        start = A.locator("button.btn-blood").filter(has_not_text="LISTO").last
        await A.wait_for_timeout(800); await start.click()
        await A.wait_for_function("() => window.__game && window.__game.mode === 'play' && (window.__game.remotes||[]).length > 0", timeout=60000)
        await B.wait_for_function("() => window.__game && window.__game.mode === 'play' && (window.__game.remotes||[]).length > 0", timeout=60000)
        check("partida iniciada en ambos", True)
        before = await mp_state(A)
        await B.locator("canvas").first.click(); await B.keyboard.down("w"); await B.wait_for_timeout(2500); await B.keyboard.up("w"); await A.wait_for_timeout(1000)
        after = await mp_state(A); bpos = await mp_state(B)
        moved = before and after and before["remotes"] and after["remotes"] and (abs(before["remotes"][0][1]-after["remotes"][0][1]) + abs(before["remotes"][0][2]-after["remotes"][0][2])) > 0.3
        check("movimiento de B visto por A", moved, f"{before and before['remotes']} -> {after and after['remotes']} | B dice {bpos and (round(bpos['x'],2), round(bpos['y'],2))}")
        await A.screenshot(path=f"{OUT}/A_play.png"); await B.screenshot(path=f"{OUT}/B_play.png")
        # reconexión. Desarrollo: se corta el socket con el gancho __mp. Publicado (sin gancho): B recarga la página,
        # como un jugador que cerró la pestaña, y vuelve con «VOLVER A MI EXPEDICIÓN» (token de reconexión).
        m0 = await (await A.request.get(SERVER + "/metrics")).json()
        d0 = sorted(m0.get("days", {}).keys())[-1] if m0.get("days") else None
        rc0 = (m0["days"][d0].get("reconnects", 0) if d0 else 0)
        forced = await B.evaluate("() => { const r = window.__mp && window.__mp.room; if (r && r.ws) { r.ws.close(3000, 'e2e'); return true; } return false; }")
        if not forced:
            await B.reload(wait_until="domcontentloaded")
            await B.get_by_role("button", name=re.compile("EXPEDICIÓN COMPARTIDA")).click(timeout=60000)
            await B.get_by_role("button", name="VOLVER A MI EXPEDICIÓN").click(timeout=20000)
        await B.wait_for_function("() => window.__game && window.__game.mode === 'play' && (window.__game.remotes||[]).length > 0", timeout=30000)
        await B.wait_for_timeout(3000)
        st = await B.evaluate("() => document.body.innerText.includes('Se perdió la conexión')")
        status = await B.evaluate("() => window.__mp ? window.__mp.status : 'play'")
        m = await (await A.request.get(SERVER + "/metrics")).json()
        day = sorted(m.get("days", {}).keys())[-1] if m.get("days") else None
        rc = m["days"][day].get("reconnects", 0) if day else 0
        check("reconexión de B", not st and status == "play" and (await mp_state(B))["mode"] == "play" and rc > rc0, f"modo={'corte de socket' if forced else 'recarga de página'} reconexiones {rc0}->{rc}")
        await ba.close(); await bb.close()
    print("RESULTADO:", "TODO PASA" if ok else "HAY FALLOS"); sys.exit(0 if ok else 1)
asyncio.run(main())
