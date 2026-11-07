import sheet from '@/assets/props-sheet.png';
import natureSheet from '@/assets/nature-sheet.png';
import fountain from '@/assets/props/fountain.png';
import skeleton from '@/assets/props/skeleton.png';
import leaves from '@/assets/props/leaves.png';
import crate from '@/assets/props/crate.png';
import powder from '@/assets/props/powder.png';
import thematicSheet from '@/assets/thematic-decor.png';
import { yieldToBrowser, type SpriteImage } from './render-performance';
const SINGLE: Record<string, string> = { fountain, skeleton, leaves, crate, powder };
// Tight bounds from the generated sheet; silhouettes retain their aspect ratio.
export const PROP_RECTS: Record<string, [number, number, number, number]> = {
  small_pillar: [40, 25, 174, 298], vegetation: [260, 80, 242, 222], crack: [520, 138, 248, 176],
  flowerpot: [802, 35, 188, 282], target: [15, 348, 224, 310], plant: [260, 355, 245, 296],
  litter: [510, 405, 260, 242], hole: [770, 418, 249, 217], spike_trap: [8, 725, 253, 255],
  fire: [282, 874, 197, 108], bench: [510, 724, 261, 256], healing_brazier: [802, 675, 190, 333],
};
export const PROP_SCALE: Record<string, number> = {
  small_pillar: .7, vegetation: .38, crack: .13, flowerpot: .45, target: .8, plant: .55,
  litter: .24, hole: .18, spike_trap: .3, fire: .24, bench: .5, healing_brazier: .7,
  tree: 1.5, dead_tree: 1.4, rocks: .3, pebbles: .12,
  fountain: .95, skeleton: .5, leaves: .1, crate: .42, powder: .45,
  gothic_lantern: 1.15, glass_shrine: 1.65, crystal: .75, moss_planter: .7, neon_pipe: 1.3, votive: 1.1,
};
export async function loadProps() {
  const source = new Image(); source.src = sheet; await source.decode();
  const sprites: Record<string, SpriteImage> = {};
  for (const [key, [x,y,w,h]] of Object.entries(PROP_RECTS)) {
    const canvas = document.createElement('canvas'); canvas.width = Math.round(w/3); canvas.height = Math.round(h/3);
    const ctx = canvas.getContext('2d'); if (!ctx) continue;
    ctx.imageSmoothingEnabled = false; ctx.drawImage(source,x,y,w,h,0,0,canvas.width,canvas.height);
    sprites[key] = canvas; await yieldToBrowser();
  }
  const nature=new Image();nature.src=natureSheet;await nature.decode();
  const rects:Record<string,[number,number,number,number]>={tree:[35,30,472,525],dead_tree:[570,35,420,520],rocks:[65,660,420,280],pebbles:[65,840,420,100]};
  for(const [key,[x,y,w,h]] of Object.entries(rects)){const c=document.createElement('canvas');c.width=Math.round(w/4);c.height=Math.round(h/4);const ctx=c.getContext('2d');if(!ctx)continue;ctx.imageSmoothingEnabled=false;ctx.drawImage(nature,x,y,w,h,0,0,c.width,c.height);sprites[key]=c;await yieldToBrowser();}
  await Promise.all(Object.entries(SINGLE).map(async([key,src])=>{const image=new Image();image.src=src;await image.decode();sprites[key]=image;}));
  const thematic=new Image();thematic.src=thematicSheet;await thematic.decode();
  for(const [i,key] of ['gothic_lantern','glass_shrine','crystal','moss_planter','neon_pipe','votive'].entries()){
    const cw=thematic.width/3,ch=thematic.height/2,c=document.createElement('canvas');c.width=Math.floor(cw);c.height=Math.floor(ch);
    const ctx=c.getContext('2d');if(!ctx)continue;ctx.drawImage(thematic,(i%3)*cw,Math.floor(i/3)*ch,cw,ch,0,0,c.width,c.height);
    const pixels=ctx.getImageData(0,0,c.width,c.height).data;let x0=c.width,y0=c.height,x1=0,y1=0;
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if((pixels[(y*c.width+x)*4+3]??0)>60){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
    if(x1<x0)continue;const out=document.createElement('canvas');out.height=120;out.width=Math.round(120*(x1-x0+1)/(y1-y0+1));const oc=out.getContext('2d');if(!oc)continue;oc.imageSmoothingEnabled=false;oc.drawImage(c,x0,y0,x1-x0+1,y1-y0+1,0,0,out.width,out.height);
    sprites[key]=out;await yieldToBrowser();
  }
  return sprites;
}