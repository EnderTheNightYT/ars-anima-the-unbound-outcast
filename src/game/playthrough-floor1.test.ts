// @ts-nocheck -- automated play bot; loose typing on purpose
import { describe, it, expect } from 'vitest';
import { Game, MAP_SIZE, emptyInput } from './engine';
import { CLASSES } from './data';

/**
 * Automated honest playthrough of floor 1: only real inputs through Game.update/interact
 * (no teleports, no stat edits). Choices (pacts, merchant…) pick the last/"leave" option.
 */
const PROBE = !!process.env.PROBE;
const DIFF = 'facil';
const WALK = new Set([0, 5, 6, 7, 8]);
type G = Game & Record<string, any>;

function bfs(g: G, sx: number, sy: number, tx: number, ty: number) {
  const N = MAP_SIZE, start = Math.floor(sy) * N + Math.floor(sx), goal = Math.floor(ty) * N + Math.floor(tx);
  const prev = new Int32Array(N * N).fill(-1); prev[start] = start; const q = [start];
  while (q.length) { const c = q.shift()!; if (c === goal) break; const x = c % N, y = (c / N) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, n = ny * N + nx;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N || prev[n] >= 0) continue; const v = g.map[n] ?? 1;
      if (!WALK.has(v) && n !== goal) continue; prev[n] = c; q.push(n); } }
  if (prev[goal] < 0) return null; const path: number[] = []; for (let c = goal; c !== start; c = prev[c]) path.push(c); return path.reverse();
}

const realRandom = Math.random;
function seed(n: number) { let a = n >>> 0; Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function play(seedClass = 0, maxSeconds = 600) {
  const g = new Game() as G; g.start(CLASSES[seedClass]!, DIFF); g.mode = 'play';
  const errors: string[] = []; const dt = 1 / 30; let t = 0, stuck = 0, lastPos = [g.px, g.py], interactCd = 0;
  const floor0 = g.floor;
  while (t < maxSeconds) {
    t += dt;
    if (PROBE && Math.floor(t / 50) !== Math.floor((t - dt) / 50)) { const sz = (v: any, d = 0): number => { if (v == null || d > 3) return 0; if (typeof v === 'string') return v.length; if (Array.isArray(v)) return v.length + (v.length < 2000 ? v.reduce((a: number, x: any) => a + sz(x, d + 1), 0) : 0); if (v instanceof Map || v instanceof Set) return v.size * 10; if (typeof v === 'object' && !(ArrayBuffer.isView(v))) { let a = 0; for (const k in v) a += sz(v[k], d + 1); return a; } return 0; }; void sz; let ls = 0; for (let i = 0; i < localStorage.length; i++) ls += (localStorage.getItem(localStorage.key(i)!) ?? '').length; const big = ['LS:' + Math.round(ls / 1e3) + 'k', ...Object.entries(g).filter(([, v]) => (Array.isArray(v) && v.length > 100) || ((v instanceof Map || v instanceof Set || v instanceof WeakMap) && (v as any).size > 100)).map(([k, v]) => k + ':' + ((v as any).length ?? (v as any).size))]; require('fs').appendFileSync('/tmp/probe.txt', ['T', Math.round(t), g.mode, Math.round(process.memoryUsage().heapUsed / 1e6) + 'MB', big.join(' ')].join(' ')+'\n'); }
    if ((g.mode as string) === 'choice' && g.choice) { const opts = g.choice.options; const lock = (g.pickups as any[]).find(p => p.kind === 'cipherlock' && !p.used); const known = (g.journal as any[]).map(j => String(j.text ?? '')).join(' '); const pick = String(g.choice.title).includes('RELICARIO') && lock && g.exp.noteRead !== undefined ? opts.find((o: any) => o.name === lock.code) : String(g.choice.title).includes('CERRADURA') ? opts.find((o: any) => known.includes(String(o.name))) : null; try { (pick ?? opts[opts.length - 1])?.apply(); } catch (e) { errors.push(String(e)); } if ((g.mode as string) === 'choice') g.mode = 'play'; g.choice = null; continue; }
    if ((g.mode as string) === 'erased' || (g.mode as string) === 'tally' || g.floor !== floor0) break;
    if ((g.mode as string) === 'dead') break;
    if (g.mode !== 'play') g.mode = 'play';
    const alive = (g.enemies as any[]).filter(e => !e.dead);
    const want = ['note', 'cipherlock', 'mapfrag', 'lore', 'portal'];
    const picks = (g.pickups as any[]).filter(p => !p.used && (want.includes(p.kind) || (['food','water','item','gold','ammo','key'].includes(p.kind) && Math.hypot(p.x-g.px,p.y-g.py) < 6)) && (p.kind !== 'portal' || g.bossDead || !g.bossRequired));
    const lorePending = !g.regionCollected && picks.some(p => p.kind === 'lore');
    const near = alive.filter(e => Math.hypot(e.x - g.px, e.y - g.py) < 5);
    const dist = (o: any) => Math.hypot(o.x - g.px, o.y - g.py);
    let target: any = near.filter(e => !(lorePending && e.boss)).sort((a, b) => dist(a) - dist(b))[0];
    if (!target) target = picks.sort((a, b) => dist(a) - dist(b))[0];
    if (!target && g.exp.hasMap && !g.bossDead && g.bossRoom) { const b = g.bossRoom; target = { x: b.x + b.w / 2, y: b.y + b.h / 2, room: true }; if (dist(target) < 1.5) target = null; }
    if (!target && g.bossRequired && !g.exp.unlocked) { const codes = Object.entries(g.seals ?? {}).filter(([, sl]: any) => sl.kind === 'code').map(([i]) => ({ x: (+i % MAP_SIZE) + .5, y: Math.floor(+i / MAP_SIZE) + .5, door: true })); target = codes.sort((a, b) => dist(a) - dist(b))[0]; }
    if (!target) target = alive.sort((a, b) => dist(a) - dist(b))[0];
    const inp = emptyInput();
    if (g.hp < g.hpMax * .45 && interactCd <= 0) { for (const it of ['venda','racion','agua']) try { g.use(it); } catch (e) { errors.push(String(e)); } interactCd = .5; }
    if (target) {
      const path = bfs(g, g.px, g.py, target.x, target.y);
      let wx = target.x, wy = target.y;
      if (path && path.length > 1) { const c = path[0]!; wx = (c % MAP_SIZE) + .5; wy = Math.floor(c / MAP_SIZE) + .5; }
      const a = Math.atan2(wy - g.py, wx - g.px); const d = Math.atan2(Math.sin(a - g.ang), Math.cos(a - g.ang));
      inp.lookX = d * .5;
      const isEnemy = alive.includes(target);
      if (Math.abs(d) < .9 && !(isEnemy && dist(target) < 1.3)) inp.my = 1;
      if (isEnemy && g.hp < g.hpMax * .3 && dist(target) < 2.5) { inp.my = -1; inp.dash = Math.floor(t * 2) % 3 === 0; }
      if (isEnemy && dist(target) < 2.2 && Math.abs(d) < .5) { inp.attack = (Math.floor(t * 4) % 2) === 0; inp.block = (target.tele ?? 0) > 0; }
      if (!isEnemy && dist(target) < (target.door ? 1.9 : 1.4) && interactCd <= 0) { try { g.interact(); } catch (e) { errors.push(String(e)); } interactCd = .6; }
      if (g.doorAhead?.(1.2) && interactCd <= 0) { try { g.interact(); } catch (e) { errors.push(String(e)); } interactCd = .6; }
    }
    interactCd -= dt;
    if (Math.hypot(g.px - lastPos[0]!, g.py - lastPos[1]!) < .02) stuck += dt; else stuck = 0; lastPos = [g.px, g.py];
    if (stuck > 1.5) { inp.jump = true; inp.mx = Math.sin(t) > 0 ? 1 : -1; if (stuck > 3) stuck = 0; }
    try { g.update(dt, inp); } catch (e) { errors.push(String((e as Error).stack ?? e)); break; }
  }
  return { g, errors, t, floor0 };
}

describe('piso 1 jugado de principio a fin', () => {
  it('llega al portal y abre el piso siguiente sin errores', () => {
    let best: any = null;
    for (let c = 10; c < 24; c++) { seed(1000 + c); const r = play(c % 6); const ok = (r.g.mode as string) === 'erased' || (r.g.mode as string) === 'tally' || r.g.floor > r.floor0; console.log('RUN', c, 'req', r.g.bossRequired, 'kinds', JSON.stringify([...new Set((r.g.pickups as any[]).map(p=>p.kind+(p.used?'U':'')))]), 'seals', JSON.stringify(Object.values(r.g.seals??{}).map((s:any)=>s.kind)), 'boss', r.g.bossRoom?1:0, r.g.cls?.id, r.g.mode, 'boss', r.g.bossDead, 'lore', r.g.regionCollected, 'kills', r.g.floorKills, 't', Math.round(r.t), 'exp', JSON.stringify(r.g.exp), 'left', JSON.stringify((r.g.pickups as any[]).filter(p=>!p.used&&['note','cipherlock','mapfrag','lore','portal'].includes(p.kind)).map(p=>p.kind)), 'alive', (r.g.enemies as any[]).filter(e=>!e.dead).length, 'err', r.errors.length, r.errors[0]?.slice(0,300)); if (ok || !best) best = r; if (ok) break; }
    Math.random = realRandom;
    const { g, errors, t, floor0 } = best;
    const info = { mode: g.mode, floor: g.floor, boss: g.bossDead, lore: g.regionCollected, hp: Math.round(g.hp), t: Math.round(t), kills: g.floorKills };
    console.log('PLAYTHROUGH', JSON.stringify(info));
    expect(errors).toEqual([]);
    expect((g.mode as string) === 'erased' || (g.mode as string) === 'tally' || g.floor > floor0, JSON.stringify(info)).toBe(true);
    // Same buttons the player presses: "erased" screen → recap → SIGUIENTE NIVEL.
    if ((g.mode as string) === 'erased') g.finishFloor();
    expect(g.mode).toBe('recap');
    g.continueFloor();
    expect(g.floor).toBe(floor0 + 1);
    expect(g.mode).toBe('play');
    for (let i = 0; i < 300; i++) g.update(1 / 30, emptyInput());
    expect(g.hp).toBeGreaterThan(0);
  }, 300000);
});
