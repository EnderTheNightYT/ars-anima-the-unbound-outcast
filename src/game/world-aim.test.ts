import { describe,it,expect } from 'vitest';
import { traceAim,viewPosition } from './world-aim';
import { Game } from './engine';
import { CLASSES } from './data';
import { rangedProfile } from './combat-fx';
describe('alternate-view aim',()=>{
  it('stops the reticle at the actual enemy collider before the wall',()=>{
    const p=traceAim({x:0,y:0,z:.5},0,0,8,x=>x>=6,[{x:3,y:0,z:0,radius:.3}]);
    expect(p.enemy).toBe(true);expect(p.x).toBeGreaterThanOrEqual(2.5);expect(p.x).toBeLessThan(3);
  });
  it('vertical pitch uses the same projectile direction and stops at cover',()=>{
    const p=traceAim({x:0,y:0,z:.5},0,Math.PI/4,10,(_x,_y,z)=>z>=2,[]);
    expect(p.enemy).toBe(false);expect(p.z).toBeLessThan(2);expect(p.z-.5).toBeCloseTo(p.x,5);
  });
  it('all four spectator cameras keep the aim origin independent of the camera',()=>{
    for(const mode of ['shoulder','front','top','iso'] as const){const v=viewPosition(mode,4,4,0,0,2);expect(v.z).toBeGreaterThan(1);expect(traceAim({x:4,y:4,z:.5},0,0,2,()=>false,[])).toMatchObject({x:6,y:4,z:.5});}
  });
  it('real shot and melee targeting use the displayed aim in every camera',()=>{
    const cls=CLASSES[0];if(!cls)throw new Error('Missing class');
    for(const mode of ['shoulder','front','top','iso'] as const){
      localStorage.clear();const g=new Game();g.start(cls);g.map.fill(0);g.enemies=[];g.pickups=[];g.restRoom=null;g.px=10;g.py=10;g.pz=0;g.ang=0;g.pitch=0;g.setCamera({mode});g.spawn('sombra',11,10);
      const e=g.enemies[0];if(!e)throw new Error('Missing enemy');e.z=0;
      expect(g.nearestFacing(1.5)?.id).toBe(e.id);
      const ranged=g.ranged;if(!ranged?.base)throw new Error('Missing ranged weapon');
      g.fireVolley(ranged,{...rangedProfile(ranged.base.type),spread:0},1,true);
      const p=g.projs[0];if(!p)throw new Error('Missing shot');expect(p.dx).toBeGreaterThan(0);// Hip-fire keeps a tiny intentional jitter (±0.005 rad); assert the angle, not a speed-dependent offset.
      expect(Math.abs(Math.atan2(p.dy,p.dx))).toBeLessThan(.012);expect(p.z).toBe(.5);
    }
  });
});