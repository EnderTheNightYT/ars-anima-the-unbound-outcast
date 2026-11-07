import { describe, expect, it } from 'vitest';
import { Game, emptyInput } from './engine';
import { CLASSES } from './data';
import { CHARGED_FAMILY } from './audio';

function game() { const cls = CLASSES[0]!; const g = new Game(); g.start(cls); g.map.fill(0); g.restRoom = null; g.enemies = []; g.pickups = []; g.alteredZones = []; g.bossRoom = null; g.zones = []; g.rooms = []; g.px = g.py = 15.5; g.pz = 0; g.ang = g.pitch = g.vx = g.vy = 0; return g; }

describe('disparo cargado', () => {
  it('cada arma a distancia tiene su propio sonido de disparo cargado', () => {
    const types = ['PISTOLA', 'REVOLVER', 'ESCOPETA', 'FUSIL', 'SUBFUSIL', 'AMETRALLADORA', 'ARCO', 'BALLESTA', 'FOCO'];
    expect(new Set(types.map(CHARGED_FAMILY)).size).toBe(types.length);
  });
  it('pequeños ajustes de mira no reinician la carga', () => {
    const g = game(); g.slot = 1;
    for (let i = 0; i < 10; i++) g.update(.05, { ...emptyInput(), alternate: true, lookX: .01 });
    expect(g.aimT).toBeGreaterThan(0);
  });
});

describe('asistencia táctil', () => {
  it('elige al enemigo cercano en la dirección de la mira, no al de detrás', () => {
    const g = game(); g.touchAssist = true; g.camera.mode = 'fp';
    g.spawn('sombra', 20.5, 15.8); g.spawn('sombra', 12.5, 15.5);
    expect(g.assistTarget(14)?.e).toBe(g.enemies[0]);
  });
  it('está apagada con ratón', () => {
    const g = game(); g.touchAssist = false; g.camera.mode = 'fp'; g.spawn('sombra', 20.5, 15.5);
    expect(g.assistTarget(14)).toBeNull();
  });
});

describe('recuperación ante estado inválido', () => {
  it('repara posiciones NaN en lugar de congelar la partida', () => {
    const g = game(); g.safeX = 15.5; g.safeY = 15.5; g.px = NaN; g.vx = Infinity;
    g.update(.05, emptyInput());
    expect(Number.isFinite(g.px) && Number.isFinite(g.vx)).toBe(true);
  });
});
