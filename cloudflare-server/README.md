# Servidor de salas de Ars Anima — Cloudflare Workers + Durable Objects

Servidor autoritativo gratuito. Cada sala es una instancia `GameRoom` (Durable Object con SQLite) que
simula la expedición compartida con el mismo motor del juego (`src/game/net/sim.ts`). `RoomDirectory`
guarda la lista de salas públicas. Comunicación por WebSockets con la API de hibernación.

- 2–4 jugadores por sala · salas públicas/privadas · código de invitación
- Simulación 20 Hz, posiciones 10 Hz, instantáneas 10 Hz; el cliente envía entradas 15 veces/s
- El cliente sólo manda entradas; daño, botín, puntuación y resultados los decide el servidor
- Reconexión: 60 s con un token secreto por plaza; en el lobby la sala hiberna (sin bucles)

## Rutas
| Ruta | Uso |
|---|---|
| `GET /health` | `{ ok, kind: "cf" }` (el juego lo usa para detectar este servidor) |
| `GET /rooms` | salas públicas abiertas |
| `POST /create` | crea una sala → `{ code }` |
| `GET /ws/:code` | WebSocket (`?name=&token=&vaultId=` o `?reconnect=`) |

## Producción (ya desplegado)
- Dirección: **https://ars-anima-rooms.nightbhgs10.workers.dev** (el juego la usa por defecto).
- Cuenta Cloudflare: la del usuario, Worker `ars-anima-rooms`, plan gratuito.
- Durable Objects `GameRoom` y `RoomDirectory` (SQLite, migración `v1`); variables `ALLOW_GUESTS`, `SUPABASE_URL`,
  `SUPABASE_PUBLISHABLE_KEY`, `APP_URL`; secreto `MP_SERVER_SECRET` (el mismo que tiene el juego).

### Actualizar el servidor cuando cambie el juego
El servidor ejecuta las reglas del juego (`src/game/net/sim.ts` y el motor), así que conviene volver a publicarlo
cuando cambien combate, enemigos, botín o reglas multijugador. Cualquiera de estas vías:
- Pedirlo en el chat de Lovable («vuelve a publicar el servidor de salas»): se publica con el conector de Cloudflare.
- Automático desde GitHub (Workers Builds, gratis): Cloudflare → Workers & Pages → `ars-anima-rooms` → Settings →
  Build → Connect → GitHub → repositorio del juego, rama `main`. **Root directory** `cloudflare-server`,
  **Build command** vacío, **Deploy command** `npx wrangler deploy`, **Build watch paths** (incluir)
  `cloudflare-server/*` y `src/game/*` (son las únicas carpetas que usa el servidor), sin builds de otras ramas.
  Comprobado desde una copia limpia del repositorio: instala, compila y valida los bindings sin errores.
- A mano: `cd cloudflare-server && npm install && npx wrangler login && npx wrangler deploy`.
Las tres conservan el secreto y las salas (la migración `v1` ya está aplicada).

## Coste: 0 €
Todo cabe en el plan gratuito de Cloudflare Workers (sin tarjeta): Workers + Durable Objects con SQLite +
WebSockets con hibernación. El paquete del servidor pesa ~0,3 MB comprimido (límite gratuito: 3 MB).

## Desplegar (una vez, ~5 minutos)
Opción A — desde GitHub (recomendada, se vuelve a publicar en cada cambio):
1. Crea una cuenta gratis en https://dash.cloudflare.com/sign-up
2. Workers & Pages → Create → Import a repository → conecta GitHub y elige el repositorio del juego.
3. Configuración: **Root directory** `cloudflare-server` · **Build command** vacío · **Deploy command** `npx wrangler deploy`.
4. Deploy. Copia la dirección que aparece (`https://ars-anima-rooms.<tu-subdominio>.workers.dev`).

Opción B — desde tu ordenador:
```bash
cd cloudflare-server
npm install
npx wrangler login          # abre el navegador con tu cuenta de Cloudflare
npx wrangler deploy         # imprime la dirección https://ars-anima-rooms.<tu-subdominio>.workers.dev
```
Después: en el juego, Multijugador → SERVIDOR DE SALAS → pega la dirección → GUARDAR (o cambia
`DEFAULT_SERVER` en `src/game/net/client.ts` para que sea la de todos).

El servidor se empaqueta solo con las dependencias de esta carpeta (React y las imágenes del juego se
sustituyen en `build.mjs`), así que el despliegue desde GitHub no necesita instalar el juego entero.

### Opcional: guardar resultados en las cuentas
`SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` ya están completados (son públicos). Falta:
1. Publicar el juego y poner su dirección en `wrangler.jsonc → vars.APP_URL`.
2. Inventar una contraseña larga y ponerla en los dos lados con el mismo valor:
   - en el juego, como secreto `MP_SERVER_SECRET`;
   - en Cloudflare: Workers → ars-anima-rooms → Settings → Variables and Secrets → Add → Secret
     `MP_SERVER_SECRET` (o `npx wrangler secret put MP_SERVER_SECRET`).
Sin esto se juega igual como invitado, pero no se guardan resultados ni el arcón.

## Probar en local
```bash
npx wrangler dev --port 8787
```
Y en el juego usa `http://127.0.0.1:8787` como dirección del servidor.

## Cuotas gratuitas (orientativo)
Cada mensaje entrante cuenta 1/20 de petición. Con 4 jugadores (60 entradas/s) son ~3 peticiones/s:
el límite diario de 100 000 da ~9 h de partida de 4 jugadores al día. Una sala en partida permanece
despierta (duración), una sala en el lobby hiberna.

## Supervisión
- `GET /metrics` → salas abiertas y contadores diarios de 7 días (`joins`, `refused`, `reconnects`, `drops`, `leaves`, `matches_started`, `matches_finished`, `rooms_closed`, `tick_errors`, `results_saved`, `results_failed`).
- Cada evento se registra como JSON (`{"ev": "...", "room": "..."}`): Cloudflare → Workers → ars-anima-rooms → Logs, o `npx wrangler tail`.

## Pruebas con clientes reales
```bash
SERVER_URL=https://ars-anima-rooms.<sub>.workers.dev node e2e/four-clients.mjs   # 4 jugadores + un 5.º rechazado
```

## Prueba con dos navegadores
```bash
GAME_URL=https://<tu-juego-publicado> SERVER_URL=https://ars-anima-rooms.<sub>.workers.dev python3 e2e/two-browsers.py
```
