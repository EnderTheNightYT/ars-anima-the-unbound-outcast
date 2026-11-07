import { describe, expect, it, vi } from 'vitest';
import { Game } from './engine';
import { CLASSES, type Item } from './data';
import { CARRY_LIMIT, carryWeight, fitsCarry, itemPrice, itemWeight, sellPrice } from './carry';
import { subclasses, subclassMods } from './subclasses';
import { WEAR, applyWear, ensureWear } from './weapon-wear';
import { NEEDS } from './momentum';
import { COLLAPSE_SPAWN } from './expedition';
import { placeMapLabel, type MapLabel } from './map-labels';

const weapon = (): Item => ({ uid: 1, name: 'Espada', kind: 'weapon', rarity: 0, base: { type: 'ESPADA', ranged: false, dice: [1,8], range: 2, rate: .36, breakB: 2, ammo: 0, color: '' }, dmgMult: 1, affixes: [] });
function game() { const g = new Game(); const cls = CLASSES[0]; if (!cls) throw Error('sin clase'); g.cls = cls; g.melee = weapon(); g.ranged = { ...weapon(), uid: 2 }; g.mode = 'play'; return g; }
describe('supervivencia espaciada', () => {
  it('100 golpes normales gastan sólo 20 de durabilidad', () => { const w = ensureWear(weapon()); for(let i=0;i<100;i++) applyWear(w, WEAR.meleeUse); expect(w.dur).toBeCloseTo(40); });
  it('100 disparos gastan sólo 12 de durabilidad', () => { const w = ensureWear(weapon()); for(let i=0;i<100;i++) applyWear(w, WEAR.shotUse); expect(w.dur).toBeCloseTo(48); });
  it('comida y agua duran cinco veces más', () => { expect(NEEDS.foodPerSec * 600).toBeCloseTo(42); expect(NEEDS.thirstPerSec * 600).toBe(60); });
  it('derrumbe da veinte segundos antes del primer refuerzo', () => { expect(COLLAPSE_SPAWN.grace).toBe(20); });
});
describe('mochila y valor', () => {
  it('capacidad de 2000 con límite efectivo', () => { expect(CARRY_LIMIT).toBe(2000); expect(fitsCarry(1999,1)).toBe(true); expect(fitsCarry(1999,2)).toBe(false); });
  it('pesa equipo, materiales y suministros por unidad', () => { expect(itemWeight(weapon())).toBe(3); expect(carryWeight([weapon()], [], { tela: 4 }, { agua: 2, venda: 2 },20,1,5)).toBe(12); });
  it('precio aumenta con calidad', () => { expect(itemPrice({...weapon(),rarity:2})).toBeGreaterThan(itemPrice(weapon())); });
  it('precio aumenta con efectos', () => { expect(itemPrice({...weapon(),affixes:['VORAZ']})).toBeGreaterThan(itemPrice(weapon())); });
  it('precio aumenta con daño', () => { expect(itemPrice({...weapon(),dmgMult:2})).toBeGreaterThan(itemPrice(weapon())); });
  it('desgaste reduce precio y venta nunca supera compra', () => { const w=ensureWear(weapon()); expect(itemPrice({...w,dur:0})).toBeLessThan(itemPrice(w)); expect(sellPrice(w)).toBeLessThan(itemPrice(w)); });
  it('no cobra una compra que no cabe', () => { const g=game(); g.mats={tela:8000};g.gold=100;g.makeShop(); const stock=g.shopStock.length;g.buy(2);expect(g.gold).toBe(100);expect(g.shopStock).toHaveLength(stock); });
  it('premio que no cabe permanece en suelo', () => { const g=game();g.mats={tela:8000};g.receiveItem(weapon());expect(g.bag).toHaveLength(0);expect(g.pickups.some(p=>p.kind==='item')).toBe(true); });
  it('tienda incluye cuatro raciones, aguas y vendas y dos espejos', () => { const g=game();g.makeShop(); for(const name of ['Ración','Agua hervida','Venda']) expect(g.shopStock.filter(s=>s.name===name)).toHaveLength(4);expect(g.shopStock.filter(s=>s.name.startsWith('Espejo'))).toHaveLength(2); });
});
describe('subclases y eventos', () => {
  it('el libro tiene prioridad sobre robar un enemigo cercano', () => { const g=game();g.pickups=[{x:5,y:5,kind:'palimpsest',bob:0}];g.px=4.2;g.py=5;g.ang=0;g.spawn('sombra',4.2,5); const e=g.enemies[0];if(!e)throw Error('sin enemigo');e.aware=false;e.face=0;g.interact();expect(g.palim.hasBook).toBe(true);expect(e.stolen).not.toBe(true); });
  it('cada piso normal tiene dos altares y dos sellos de pacto', () => { const g=game();g.start(g.cls); expect(g.pickups.filter(p=>p.kind==='altar')).toHaveLength(2);expect(g.pickups.filter(p=>p.kind==='pactstone')).toHaveLength(2); });
  it('elegir subclase se guarda con la partida', () => {const g=game();g.start(g.cls,'normal',false,'duelista-resguardo');g.saveRun();const raw=localStorage.getItem('ars_anima_run_save_v1');if(!raw)throw Error('sin guardado');expect(JSON.parse(raw).fields.subclassId).toBe('duelista-resguardo');expect(g.subclassFx().speed).toBe(1.08);});
  it('todas las clases tienen dos subclases jugables', () => { for(const cls of CLASSES.filter(c => c.id !== 'pariah')){const list=subclasses(cls.id);expect(list).toHaveLength(2); const [attack, defense] = list; if (!attack || !defense) throw Error('faltan subclases'); expect(subclassMods(cls.id,attack.id).damage).toBe(1.12);expect(subclassMods(cls.id,defense.id).taken).toBe(.9);} });
  it('subclase ajena no concede ventajas', () => { expect(subclassMods('guardian','duelista-ataque').damage).toBe(1); });
  it('terror muestra screamer y oscurece la luz', () => { const g=game();g.horrorCd=0;g.terror(4);expect(g.screamer).toBe(.55);expect(g.gloom).toBeGreaterThanOrEqual(.55); });
  it('el derrumbe cancela raids y no permite nuevos', () => { const g=game();g.collapse={ t:100, max:100, hazardT:2, toxicT:7, warned:0, spawnT:20, portal:null };g.beginRaid();expect(g.raid).toBeNull(); });
  it('un enemigo puede soltar comida, vendas y espejo', () => { const g=game();g.spawn('sombra',5,5);const e=g.enemies[0];if(!e)throw Error('sin enemigo');vi.spyOn(Math,'random').mockReturnValue(.01);g.killEnemy(e);vi.restoreAllMocks();expect(g.pickups.some(p=>p.kind==='food'||p.kind==='water')).toBe(true);expect(g.pickups.some(p=>p.item?.id==='venda')).toBe(true);expect(g.pickups.some(p=>p.item?.id==='espejo')).toBe(true); });
});
describe('etiquetas del mapa', () => {
  it('desplaza etiquetas coincidentes sin superponerlas', () => { const boxes: MapLabel[]=[];const a=placeMapLabel(100,100,140,480,boxes);const b=placeMapLabel(100,100,140,480,boxes);expect(a).not.toBeNull();expect(b).not.toBeNull();expect(Math.abs((a?.y??0)-(b?.y??0))).toBeGreaterThanOrEqual(17); });
});