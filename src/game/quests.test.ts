import { describe, expect, it } from 'vitest';
import { Game, emptyInput } from './engine';
import { CLASSES } from './data';
import { questInput } from './quests';
const makeGame = () => { const cls=CLASSES.find(c=>c.id==='duelista'); if(!cls) throw new Error('Missing class');const g=new Game();g.start(cls);return g; };
describe('Replayable quests',()=>{
  it('accepts player level and the four requested play styles',()=>{
    for(const style of ['Combate','Exploración','Supervivencia','Acrobacias']) expect(questInput.parse({level:12,style,floor:1,previous:[]}).level).toBe(12);
    expect(questInput.safeParse({level:0,style:'Combate',floor:1,previous:[]}).success).toBe(false);
  });
  it('counts successful jumps and grants the completion reward exactly once',()=>{
    const g=makeGame();g.acceptQuest({title:'Encargo',story:'Port Veilance',kind:'jump',count:1},12);g.enemies=[];
    const gold=g.gold;g.update(.016,{...emptyInput(),jump:true});expect(g.sideQuest?.progress).toBe(1);expect(g.sideQuest?.complete).toBe(true);expect(g.gold).toBe(gold+51);
    g.questEvent('jump');expect(g.gold).toBe(gold+51);
  });
  it('does not count failed crafting and resets a quest on a new run',()=>{
    const g=makeGame();g.acceptQuest({title:'Encargo',story:'Babel',kind:'craft',count:1},1);g.mats={};g.craft('bomba');expect(g.sideQuest?.progress).toBe(0);
    const cls=CLASSES[0];if(!cls)throw new Error('Missing class');g.start(cls);expect(g.sideQuest).toBeNull();
  });
});