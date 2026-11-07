import type { Game } from './engine';
import { ENEMY_TYPES } from './data';
export interface WorldMarker { key: string; x: number; y: number; wiki: string; label: string; kind: string }
const PICKUP_WIKI: Record<string,string> = { shop:'El Mercader', chest:'Cofre', altar:'Altar de pacto', portal:'Portal / Umbral', key:'Llave de hueso', lore:'Fragmento de mapa', note:'Documento con código', mapfrag:'Fragmento de mapa', cipherlock:'Relicario sellado', palimpsest:'Libro antiguo y folios', folio:'Libro antiguo y folios', pactstone:'Piedra de pacto', sanctuary:'Rosa del santuario', trap:'Trampa de púas', item:'Comida, agua, munición, fichas y materiales' };
export function worldMarkers(g: Game): WorldMarker[] {
  const markers: WorldMarker[] = g.enemies.filter(e=>!e.dead&&!e.ambush).map(e=>({key:`enemy-${e.id}`,x:e.x,y:e.y,wiki:`enemy:${e.kind}`,label:ENEMY_TYPES[e.kind].name,kind:'enemy'}));
  g.pickups.forEach((p,i)=>{const name=PICKUP_WIKI[p.kind];if(!p.used&&name)markers.push({key:`pickup-${i}`,x:p.x,y:p.y,wiki:p.item?.kind==='weapon'&&p.item.base?`weapon:${p.item.base.type}`:`world:${name}`,label:p.item?.name??name,kind:p.kind});});
  const seen=new Set<number>();
  for(const room of g.roomIntel())for(const d of room.doors){if(seen.has(d.id))continue;seen.add(d.id);const name=d.blocked?'Puerta sellada':'Puerta';markers.push({key:`door-${d.id}`,x:d.x+.5,y:d.y+.5,wiki:`world:${name}`,label:name,kind:'door'});}
  return markers;
}
export function nearestMarker(markers: WorldMarker[],x:number,y:number,radius=.9){return markers.map(m=>({m,d:Math.hypot(m.x-x,m.y-y)})).filter(v=>v.d<=radius).sort((a,b)=>a.d-b.d)[0]?.m;}