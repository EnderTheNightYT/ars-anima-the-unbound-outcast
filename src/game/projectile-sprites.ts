import arrow from "@/assets/projectiles/arrow.png";
import bullet from "@/assets/projectiles/bullet.png";
import pellet from "@/assets/projectiles/pellet.png";
import orb from "@/assets/projectiles/orb.png";

const SOURCES: Record<string, string> = { arrow, bullet, pellet, orb };
export async function loadProjectileSprites() {
  const out: Record<string, HTMLImageElement> = {};
  await Promise.all(Object.entries(SOURCES).map(async ([k, src]) => { const i = new Image(); i.src = src; await i.decode(); out[k] = i; }));
  return out;
}
