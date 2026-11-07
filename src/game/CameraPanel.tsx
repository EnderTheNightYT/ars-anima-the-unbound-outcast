import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { Game } from "./engine";
import { CAMERA_DIST, CAMERA_HINT, CAMERA_LABEL, type CameraMode } from "./camera-view";

const MODES: CameraMode[] = ["fp", "shoulder", "front", "top", "iso"];

/** Selector de perspectiva: modo y lejanía, con aviso de la vista activa. */
export function CameraPanel({ g }: { g: Game }) {
  const [cam, setCam] = useState(g.camera);
  const set = (c: Partial<typeof cam>) => { g.setCamera(c); setCam(g.camera); if (c.mode) g.float(`CÁMARA: ${CAMERA_LABEL[c.mode].toUpperCase()}`, "#7ad8ff"); };
  return (
    <section className="mb-4 rounded border border-border p-3" aria-label="Cámara y perspectiva">
      <h4 className="title-gothic text-primary">Cámara · perspectiva (tecla O para alternar)</h4>
      <p className="text-xs text-muted-foreground">Vista actual: <b className="text-foreground">{CAMERA_LABEL[cam.mode]}</b> — {CAMERA_HINT[cam.mode]}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {MODES.map(m => <Button key={m} size="sm" variant={cam.mode === m ? "default" : "outline"} onClick={() => set({ mode: m })}>{CAMERA_LABEL[m]}</Button>)}
      </div>
      <label className="mt-3 block text-xs">Lejanía: {cam.distance.toFixed(1)} {cam.mode === "fp" ? "(sin efecto en primera persona)" : ""}</label>
      <div className="flex items-center gap-2 text-xs"><span>Cerca</span>
        <Slider className="max-w-xs" min={CAMERA_DIST.min} max={CAMERA_DIST.max} step={0.1} value={[cam.distance]} onValueChange={v => set({ distance: v[0] ?? cam.distance })} />
        <span>Lejos</span></div>
    </section>
  );
}
