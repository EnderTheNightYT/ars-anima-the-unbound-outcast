import {describe,it,expect} from 'vitest';
import {Game} from './engine';
import {CLASSES} from './data';
const refuge={x:2,y:2,w:5,h:5};
function start(){const cls=CLASSES[0];if(!cls)throw new Error('class');const g=new Game();g.start(cls);g.map.fill(0);g.enemies=[];g.pickups=[];g.rooms=[refuge,{x:12,y:12,w:9,h:9}];g.restRoom=refuge;g.px=15;g.py=15;g.pz=0;g.alteredZones=[];g.bossRoom=null;g.eventT=999;return g;}
describe('Enemy bodies',()=>{
 it('blocks player movement through an enemy at matching height',()=>{const g=start();g.spawn('sombra',16,15);const moved=g.sweepActor(15,15,0,4,0);expect(moved.hit).toBe(true);expect(moved.x).toBeLessThan(15.5);});
 it('lets an airborne player pass over an enemy',()=>{const g=start();g.spawn('sombra',16,15);const moved=g.sweepActor(15,15,1.2,2,0);expect(moved.x).toBeCloseTo(17);});
 it('blocks enemies moving through one another',()=>{const g=start();g.spawn('sombra',16,15);g.spawn('vigia',18,15);const a=g.enemies[0];if(!a)throw new Error('spawn');const moved=g.sweepActor(a.x,a.y,a.z,4,0,g.actorRadius(a),a);expect(moved.hit).toBe(true);expect(moved.x).toBeLessThan(17.5);});
 it('separates overlapping enemies without leaving floor geometry',()=>{const g=start();g.spawn('sombra',16,15);g.spawn('sombra',16,15);g.separateActors();const [a,b]=g.enemies;if(!a||!b)throw new Error('spawn');expect(Math.hypot(a.x-b.x,a.y-b.y)).toBeGreaterThanOrEqual(.56);expect(g.canOccupy(a.x,a.y,a.z,.28)).toBe(true);});
 it('allows projectiles to travel through body space until hit testing',()=>{const g=start();g.spawn('sombra',16,15);expect(g.sweep(15,15,.5,2,0,.025).x).toBeCloseTo(17);});
 it('talking with the vendor restores 2 lumbre once per cooldown',()=>{const g=start();g.px=4;g.py=4;g.lumbre=0;g.pickups.push({x:4,y:4,kind:'shop',bob:0});g.interact();g.choose(1);expect(g.lumbre).toBe(2);g.choose(1);expect(g.lumbre).toBe(2);});
});
describe('Vendor refuge',()=>{
 it('heals automatically only on the first injured entry, not on reentry',()=>{const g=start();g.hp=5;g.updateRest();g.px=4;g.py=4;g.updateRest();expect(g.hp).toBe(g.hpMax);expect(g.restHealed).toBe(true);g.px=15;g.py=15;g.updateRest();g.hp=5;g.px=4;g.py=4;g.updateRest();expect(g.hp).toBe(5);});
 it('preserves the one-time rest when the player arrives at full health',()=>{const g=start();g.px=4;g.py=4;g.updateRest();expect(g.restHealed).toBe(false);});
 it('blocks enemy spawns and raids inside the refuge',()=>{const g=start();g.spawn('sombra',4,4);expect(g.enemies).toHaveLength(0);g.px=4;g.py=4;g.beginRaid();expect(g.raid).toBeNull();});
 it('blocks pursuit through the refuge boundary',()=>{const g=start();g.spawn('sombra',8,4);const a=g.enemies[0];if(!a)throw new Error('spawn');const moved=g.sweepActor(8,4,0,-3,0,.28,a);expect(moved.hit).toBe(true);expect(moved.x).toBeGreaterThanOrEqual(7.28);});
 it('blocks enemy hits, explosions, poison, blood loss and burn damage',()=>{const g=start();g.px=4;g.py=4;g.hp=10;g.food=g.thirst=40;g.hurtPlayer(8,'proyectil');g.explode(4,4,2,20,false);g.poison=g.bleed=g.burn=3;g.updateSurvival(1);expect(g.hp).toBe(10);});
 it('keeps the vendor shop usable after resting',()=>{const g=start();g.px=4;g.py=4;g.hp=5;g.pickups.push({x:4,y:4,kind:'shop',bob:0});g.updateRest();g.interact();expect(g.mode).toBe('choice');g.choose(0);expect(g.hp).toBe(g.hpMax);expect(g.mode).toBe('menu');expect(g.menuTab).toBe('tienda');expect(g.shopStock.length).toBeGreaterThan(0);});
});