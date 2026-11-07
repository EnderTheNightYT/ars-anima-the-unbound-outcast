import { describe, it, expect, vi, afterEach } from 'vitest';
import { Game, MAP_SIZE } from './engine';
import { CLASSES } from './data';
import { combatXpMultiplier, sealSatisfied } from './world-rules';
import { ALTERATIONS } from './alterations';
const cls = CLASSES[0];
if (!cls) throw new Error('Missing class');
const arena={x:12,y:12,w:10,h:10};
function game() { if(!cls)throw new Error('Missing class');const g=new Game();g.start(cls);g.enemies=[];g.pickups=[];g.map.fill(0);g.seals={};g.doorAnim={};g.alteredZones=[];g.rooms=[{x:2,y:2,w:7,h:7},arena];g.restRoom=g.rooms[0] ?? null;g.px=15.5;g.py=15.5;g.pz=0;g.bossRoom=null;g.eventT=999;return g; }
afterEach(()=>vi.restoreAllMocks());
describe('Volumetric world',()=>{
  it('sweeps a fast dash into a wall rather than tunnelling through',()=>{const g=game();g.map[15*MAP_SIZE+17]=1;const moved=g.sweep(15.5,15.5,0,8,0);expect(moved.hit).toBe(true);expect(moved.x).toBeLessThanOrEqual(16.75);});
  it('keeps the actor radius clear of diagonal corners',()=>{const g=game();g.map[16*MAP_SIZE+16]=2;expect(g.canOccupy(15.9,15.9,0)).toBe(false);});
  it('blocks platforms at ground level but supports standing on their tops',()=>{const g=game();g.map[15*MAP_SIZE+16]=8;expect(g.canOccupy(16.5,15.5,0)).toBe(false);expect(g.floorHeight(16.5,15.5)).toBe(1.08);expect(g.canOccupy(16.5,15.5,1.08)).toBe(true);});
  it('allows walking underneath a lintel but blocks jumping into it',()=>{const g=game();g.map[15*MAP_SIZE+16]=9;expect(g.canOccupy(16.5,15.5,0)).toBe(true);expect(g.canOccupy(16.5,15.5,.5)).toBe(false);});
  it('selects elevated positions for ranged guards',()=>{const g=game();g.map[14*MAP_SIZE+14]=8;g.tacticalSpawn('vigia',arena);expect(g.enemies[0]?.z).toBe(1.08);g.updateEnemies(.05);expect(g.enemies[0]?.z).toBe(1.08);});
  it('blocks line of sight through walls but not over a step',()=>{const g=game();g.map[15*MAP_SIZE+16]=7;expect(g.los(15.5,15.5,17.5,15.5,.8,.8)).toBe(true);g.map[15*MAP_SIZE+16]=1;expect(g.los(15.5,15.5,17.5,15.5,.8,.8)).toBe(false);});
});
describe('Progression and gates',()=>{
  it('raises experience gradually from attack combos and consecutive kills',()=>{expect(combatXpMultiplier(0,1)).toBe(1);expect(combatXpMultiplier(5,3)).toBe(1.9);expect(combatXpMultiplier(100,100)).toBe(3.5);});
  it('awards experience for a landed attack, not hitting a dead enemy',()=>{const g=game();g.spawn('sombra',16.5,15.5);const e=g.enemies[0];if(!e)throw new Error('spawn');e.hp=e.hpMax=9999;g.attackEnemy(e,g.melee,1,{noRoll:true});expect(g.xp).toBe(2);e.dead=true;g.attackEnemy(e,g.melee);expect(g.xp).toBe(2);});
  it('turns bonus kill XP into a level and a usable skill point',()=>{const g=game();g.xp=95;g.combo=5;g.killStreak=2;g.streakT=4;g.spawn('sombra',16.5,15.5);const e=g.enemies[0];if(!e)throw new Error('spawn');g.killEnemy(e);expect(g.level).toBe(2);expect(g.sp).toBe(2);g.learn('carga');expect(g.sp).toBe(2);g.learn('filo1');expect(g.has('filo1')).toBe(true);expect(g.sp).toBe(1);});
  it('keyed doors resist breaches and consume one key for both leaves',()=>{const g=game();const id=15*MAP_SIZE+16;g.map[id]=g.map[id+MAP_SIZE]=6;g.seals[id]=g.seals[id+MAP_SIZE]={kind:'key',value:1,group:[id,id+MAP_SIZE]};expect(g.breachDoor(16.5,15.5)).toBe(false);g.keys=1;expect(g.openDoor(16.5,15.5)).toBe(true);expect(g.keys).toBe(0);expect(g.seals[id+MAP_SIZE]).toBeUndefined();});
  it('note combinations accept the correct answer and reject the wrong one',()=>{const g=game(),id=15*MAP_SIZE+16;g.map[id]=6;g.seals[id]={kind:'code',value:0,code:'314'};expect(g.solveCode(id,'111')).toBe(false);expect(g.map[id]).toBe(6);expect(g.solveCode(id,'314')).toBe(true);expect(g.doorAnim[id]).toBe(0);});
  const state={keys:0,kills:2,hp:49,hpMax:100,level:1,bossDead:false};
  it('requires the stated kill count',()=>{expect(sealSatisfied({kind:'kills',value:3},state)).toBe(false);expect(sealSatisfied({kind:'kills',value:3},{...state,kills:3})).toBe(true);});
  it('requires the stated life percentage',()=>{expect(sealSatisfied({kind:'health',value:.5},state)).toBe(false);expect(sealSatisfied({kind:'health',value:.5},{...state,hp:50})).toBe(true);});
  it('requires the stated player level',()=>{expect(sealSatisfied({kind:'level',value:2},state)).toBe(false);expect(sealSatisfied({kind:'level',value:2},{...state,level:2})).toBe(true);});
  it('requires a defeated boss for a boss seal',()=>{expect(sealSatisfied({kind:'boss',value:1},state)).toBe(false);expect(sealSatisfied({kind:'boss',value:1},{...state,bossDead:true})).toBe(true);});
  it('Expedition Collapse: every floor requires its boss except the Garden sanctuary',()=>{const g=game();for(const floor of [1,2,3,4,5,6]){g.floor=floor;g.genFloor();expect(g.bossRequired).toBe(g.region.id!=='garden');}});
});
describe('Raids, horror and alterations',()=>{
  it('repopulates a room in three waves without spawning on the player',()=>{const g=game();g.beginRaid();g.updateWorld(1);const first=g.enemies.length;expect(first).toBeGreaterThan(0);expect(g.enemies.every(e=>Math.hypot(e.x-g.px,e.y-g.py)>=2.5)).toBe(true);g.updateWorld(7);expect(g.enemies.length).toBeGreaterThan(first);g.updateWorld(7);expect(g.raid).toBeNull();});
  it('temporarily denies a boss-fight action for four seconds then releases it',()=>{const g=game();g.spawn('librero',18.5,15.5);g.bossPulseT=0;g.updateHorror(.05);expect(g.denial?.t).toBe(4);expect(g.visionT).toBeGreaterThan(0);g.updateHorror(4.1);expect(g.denial).toBeNull();});
  it('blocks reload while it is sealed and allows it afterwards',()=>{const g=game();g.slot=1;g.ranged.mag=0;g.denial={action:'reload',t:4};g.beginReload();expect(g.reloadT).toBe(0);g.denial=null;g.beginReload();expect(g.reloadT).toBeGreaterThan(0);});
  it('head injuries cause impaired vision and a terror sound with cooldown',()=>{const g=game();const sounds:string[]=[];g.onSound=s=>sounds.push(s);g.wounds['CABEZA']=20;g.hurtPlayer(2,'golpe');expect(g.visionT).toBeGreaterThan(0);expect(sounds).toContain('terror');g.terror(3);expect(sounds.filter(s=>s==='terror')).toHaveLength(1);});
  it('destructible decoration breaks without granting experience',()=>{const g=game();g.pickups.push({x:16.5,y:15.5,kind:'decor',deco:'book',bob:0});g.environmentImpact(16.5,15.5,.5);expect(g.pickups[0]?.used).toBe(true);expect(g.parts.length).toBeGreaterThan(7);expect(g.xp).toBe(0);});
  it('altered zones spawn enhanced variants and increase experience',()=>{const g=game();const effect=ALTERATIONS[0];if(!effect)throw new Error('effect');g.alteredZones=[{...arena,effect}];g.spawn('sombra',16.5,15.5);expect(g.enemies[0]?.variant).toBe('echo');g.gainXp(20);expect(g.xp).toBe(25);expect(g.snapshot().alteration?.id).toBe('echo');g.px=2.5;expect(g.alterationAt()).toBeUndefined();});
});
describe('Damage cause announcements',()=>{
  it('announces the cause of every life loss',()=>{const g=game();g.hurtPlayer(5,'veneno');expect(g.floats.some(f=>f.text.includes('VENENO'))).toBe(true);g.floats=[];g.hurtPlayer(5,'Perro sarnoso');expect(g.floats.some(f=>f.text.includes('ATAQUE DE PERRO SARNOSO'))).toBe(true);expect(g.lastHurt).toBe('Ataque de Perro sarnoso');});
  it('warns while burn, poison or bleed drain life, without spamming every frame',()=>{const g=game();g.restRoom=null;g.burn=3;g.poison=3;g.bleed=3;g.updateSurvival(0.1);const t=g.floats.map(f=>f.text).join(' ');expect(t).toContain('FUEGO');expect(t).toContain('VENENO');expect(t).toContain('SANGRADO');const n=g.floats.length;g.updateSurvival(0.1);expect(g.floats.length).toBe(n);});
  it('records the cause of death in the log',()=>{const g=game();g.hurtPlayer(9999,'trampa');expect(g.mode).toBe('dead');expect(g.log[0]).toContain('Trampa');});
});
