export interface MapLabel { x: number; y: number; w: number; h: number }
export function placeMapLabel(x: number, y: number, w: number, bounds: number, occupied: MapLabel[]): MapLabel | null {
  w = Math.min(w, bounds - 8);
  for (const dy of [0, -18, 18, -36, 36, -54, 54]) {
    const r = { x: Math.max(4, Math.min(bounds - w - 4, x - w / 2)), y: Math.max(4, Math.min(bounds - 18, y + dy - 9)), w, h: 14 };
    if (occupied.every(o => r.x + r.w + 3 <= o.x || o.x + o.w + 3 <= r.x || r.y + r.h + 3 <= o.y || o.y + o.h + 3 <= r.y)) { occupied.push(r); return r; }
  }
  return null;
}