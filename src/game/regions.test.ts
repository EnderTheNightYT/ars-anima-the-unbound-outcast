import { describe, expect, it } from 'vitest';
import { Game, emptyInput, MAP_SIZE } from './engine';
import { CLASSES } from './data';
import { regionForFloor } from './regions';
const playerClass = CLASSES.find(c => c.id === 'duelista');
if (!playerClass) throw new Error('Missing Duelista');
const startGame = () => { const g = new Game(); g.start(playerClass); return g; };

describe('Babel journey', () => {
  it('visits the six document-grounded settings in sequence', () => {
    expect([1,2,3,4,5,6].map(n => regionForFloor(n).name)).toEqual(['Port Veilance','Cogspire','The Abyssal Pits','Jardín de la Última Rosa','Archivatorio de Babel','Marea de Aethryon']);
  });
  it('generates accessible journey objects and a safe player start in every region', () => {
    const g = startGame();
    for (let floor = 1; floor <= 6; floor++) {
      g.floor = floor; g.genFloor(); expect(g.solid(g.px,g.py)).toBe(false);
      const visited = new Set<number>(); const queue = [Math.floor(g.py)*MAP_SIZE+Math.floor(g.px)];
      while (queue.length) { const cell = queue.pop(); if (cell === undefined || visited.has(cell) || ![0,5,6,7,8,9].includes(g.map[cell] ?? 1)) continue; visited.add(cell); const x = cell%MAP_SIZE, y = Math.floor(cell/MAP_SIZE); if(x>0) queue.push(cell-1); if(x<MAP_SIZE-1) queue.push(cell+1); if(y>0) queue.push(cell-MAP_SIZE); if(y<MAP_SIZE-1) queue.push(cell+MAP_SIZE); }
      const lore = g.pickups.find(p => p.kind === 'lore'); expect(lore).toBeDefined();
      if (lore) expect(visited.has(Math.floor(lore.y)*MAP_SIZE+Math.floor(lore.x))).toBe(true);
      expect(g.enemies.every(e => g.canOccupy(e.x,e.y,e.z,.28))).toBe(true);
    }
  });
  it('preserves the refuge until dawn and removes it afterwards', () => {
    const g = startGame(); g.floor = 4; g.genFloor();
    expect(g.enemies).toHaveLength(0); expect(g.pickups.some(p => p.kind === 'sanctuary' && !p.used)).toBe(true);
    g.updateWorld(90); expect(g.pickups.some(p => p.kind === 'sanctuary' && !p.used)).toBe(false); expect(g.weather).toBe(2);
  });
  it('collects texts and map pieces once before leaving a region', () => {
    const g = startGame(); const lore = g.pickups.find(p => p.kind === 'lore'); if (!lore) throw new Error('Missing lore');
    g.px = lore.x; g.py = lore.y; g.interact(); g.interact(); expect(g.journal).toHaveLength(1); expect(g.journal[0]?.name).toBe('Mapa de Port Veilance');
  });
  it('does not replenish emotional Lumbre through idle waiting', () => {
    const g = startGame(); g.lumbre = 0; g.updateSurvival(10); expect(g.lumbre).toBe(0);
  });
  it('emits a dash sound only for an accepted dash, not held input', () => {
    const g = startGame(); g.enemies = []; g.eventT = 100; const sounds: string[] = []; g.onSound = s => sounds.push(s); const input = {...emptyInput(), dash: true};
    g.update(.016,input); g.update(.016,input); expect(sounds.filter(s => s === 'dash')).toHaveLength(1);
  });
});