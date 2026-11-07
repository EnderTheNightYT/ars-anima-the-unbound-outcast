/** Pantalla completa del navegador. Browser-only; cada llamada tolera navegadores sin soporte. */
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => void };
type FsDoc = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
export const isFullscreen = () => typeof document !== "undefined" && !!(document.fullscreenElement || (document as FsDoc).webkitFullscreenElement);

export function enterFullscreen() {
  const el = document.documentElement as FsEl;
  const done = () => {
    // En celular: fijar horizontal cuando el navegador lo permite.
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    if (window.matchMedia?.("(pointer: coarse)").matches) o?.lock?.("landscape").catch(() => {});
  };
  if (isFullscreen()) { done(); return; }
  if (el.requestFullscreen) el.requestFullscreen({ navigationUI: "hide" }).then(done).catch(() => hideBars());
  else if (el.webkitRequestFullscreen) { el.webkitRequestFullscreen(); done(); }
  else hideBars();
}

/** iPhone (sin API de pantalla completa): desplaza para recoger la barra de direcciones. */
function hideBars() { window.setTimeout(() => window.scrollTo(0, 1), 50); }

export function exitFullscreen() {
  const d = document as FsDoc;
  if (!isFullscreen()) return;
  screen.orientation?.unlock?.();
  if (document.exitFullscreen) document.exitFullscreen().catch(() => {}); else d.webkitExitFullscreen?.();
}

export function toggleFullscreen() { if (isFullscreen()) exitFullscreen(); else enterFullscreen(); }

/**
 * En pantallas táctiles la petición debe salir de un toque. Cada toque mientras se juega
 * vuelve a pedir pantalla completa si el navegador la perdió (girar, cambiar de app).
 */
export function installTouchFullscreen(isPlaying: () => boolean) {
  const onTouch = () => { if (isPlaying() && !isFullscreen()) enterFullscreen(); };
  document.addEventListener("touchend", onTouch, { passive: true });
  return () => document.removeEventListener("touchend", onTouch);
}
