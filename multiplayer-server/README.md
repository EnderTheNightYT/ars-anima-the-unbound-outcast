# Servidor de salas · Expedición compartida

Servidor autoritativo (Colyseus 0.18 + Bun) que simula cada sala con el mismo motor del juego
(`src/game/engine.ts` vía `src/game/net/sim.ts`). Los clientes sólo envían entradas y acciones de menú;
el servidor decide daño, botín, robos, eventos y puntuaciones.

## Ejecutar en local

```bash
cd multiplayer-server
bun install
PORT=2567 bun src/index.ts
```

En el juego: Título → EXPEDICIÓN COMPARTIDA → servidor `ws://localhost:2567`.

## Publicar (plan gratuito o barato)

Cualquier servicio que ejecute un contenedor con WebSockets persistentes sirve (Fly.io, Render, Railway, una VPS).
Construye desde la raíz del repositorio:

```bash
docker build -f multiplayer-server/Dockerfile -t ars-anima-rooms .
docker run -p 2567:2567 --env-file rooms.env ars-anima-rooms
```

Variables de entorno:

| Variable | Para qué |
|---|---|
| `PORT` | Puerto HTTP/WebSocket (2567 por defecto). |
| `SUPABASE_URL` | Dirección del backend del juego: verifica la sesión de cada jugador. |
| `SUPABASE_PUBLISHABLE_KEY` | Clave pública del backend (la misma que usa el navegador). |
| `APP_URL` | Dirección publicada del juego, p. ej. `https://tu-juego.lovable.app`. |
| `MP_SERVER_SECRET` | El mismo secreto guardado en el juego: permite guardar resultados y reclamar objetos del arcón. |
| `ALLOW_GUESTS` | `0` para exigir cuenta; por defecto se permiten invitados (no guardan nada). |

Después, en el juego, escribe la dirección `wss://…` en la pantalla de la expedición compartida
o define `VITE_MP_SERVER_URL` para que aparezca por defecto.

Rutas HTTP: `GET /health`, `GET /rooms` (salas públicas abiertas).
