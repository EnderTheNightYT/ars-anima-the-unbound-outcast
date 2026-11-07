/** Verificación del servidor de salas multijugador: comparte el secreto MP_SERVER_SECRET con esta app. */
export function mpServerAllowed(request: Request) {
  const secret = process.env["MP_SERVER_SECRET"];
  const got = request.headers.get("x-mp-secret") ?? "";
  if (!secret || secret.length < 16 || got.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= secret.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}
