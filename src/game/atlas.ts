import atlas from '@/assets/refined-atlas.png';
import rectangles from './sprite-rects.json';
import { loadProps } from './props';
import { loadEnemySprites } from './enemy-sprites';
import { yieldToBrowser, type SpriteImage } from './render-performance';
export const ATLAS_URL = atlas;
export const ATLAS_KEYS = Object.keys(rectangles);
export async function loadAtlas() {
  const response = await fetch(ATLAS_URL);
  if (!response.ok) throw new Error('No se pudo cargar la lámina');
  const bitmap = await createImageBitmap(await response.blob());
  const sprites: Record<string, SpriteImage> = {};
  for (const [key, rect] of Object.entries(rectangles)) {
    const canvas = document.createElement('canvas'); canvas.width = rect.w; canvas.height = rect.h;
    const context = canvas.getContext('2d'); if (!context) continue;
    context.imageSmoothingEnabled = false;
    context.drawImage(bitmap, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
    sprites[key] = canvas;
    await yieldToBrowser();
  }
  bitmap.close(); Object.assign(sprites, await loadProps(), await loadEnemySprites()); return sprites;
}