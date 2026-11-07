import { expect, it } from 'vitest';
import { Game } from './engine';
import { CLASSES } from './data';
import { readRunSave } from './run-save';
it('restores a summoned boss, sealed arena, countdown and player stats after reload', () => {
  localStorage.clear(); const cls = CLASSES[0]; if (!cls) throw new Error('No class');
  const g = new Game(); g.start(cls); const room = g.bossRoom; if (!room) throw new Error('No lair');
  g.spawn('librero', room.x + room.w / 2, room.y + room.h / 2);
  g.bossSpawned = true; g.sealArena(room); if (!g.arena) throw new Error('No arena');
  g.arena.t = 180; g.bossFight = { seconds: 60, damage: 8 }; g.xp = 33; g.hp = 12;
  g.saveRun(); const s = readRunSave(); if (!s) throw new Error('No save');
  const restored = new Game(); restored.resumeRun(s);
  expect(restored.enemies.filter(e => e.kind === 'librero' && !e.dead)).toHaveLength(1);
  expect(restored.arena?.t).toBe(180); expect(restored.bossFight).toEqual({ seconds: 60, damage: 8 });
  expect(restored.hp).toBe(12); expect(restored.xp).toBe(33);
  expect([...restored.map]).toEqual([...g.map]);
});