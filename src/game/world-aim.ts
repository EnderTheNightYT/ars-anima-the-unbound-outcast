import type { CameraMode } from './camera-view';
export interface AimPoint { x: number; y: number; z: number; distance: number; enemy: boolean }
export interface AimActor { x: number; y: number; z: number; radius: number; dead?: boolean }
/** Same origin, direction and collider as the playable shot; never from the spectator camera. */
export function traceAim(origin: {x:number;y:number;z:number}, angle:number,pitch:number,range:number,solid:(x:number,y:number,z:number)=>boolean,actors:AimActor[]):AimPoint {
  const dx=Math.cos(angle)*Math.cos(pitch),dy=Math.sin(angle)*Math.cos(pitch),dz=Math.sin(pitch);
  let point:AimPoint={...origin,distance:0,enemy:false};
  for(let d=.06;d<=range+.06;d+=.06){const distance=Math.min(range,d),x=origin.x+dx*distance,y=origin.y+dy*distance,z=origin.z+dz*distance;
    if(solid(x,y,z))return point;
    point={x,y,z,distance,enemy:actors.some(a=>!a.dead&&Math.hypot(a.x-x,a.y-y)<=a.radius+.2&&Math.abs(a.z+.5-z)<.75)};
    if(point.enemy||distance===range)return point;
  }
  return point;
}
export function viewPosition(mode:CameraMode,px:number,py:number,pz:number,angle:number,distance:number){
  const dx=Math.cos(angle),dy=Math.sin(angle);
  if(mode==='top')return{x:px,y:py+1,z:pz+7.5+distance*1.2};
  if(mode==='iso')return{x:px-2.6-distance*1.1,y:py-2.6-distance*1.1,z:pz+5.2+distance*1.1};
  const side=mode==='shoulder'?.35:0,sign=mode==='front'?1:-1;
  return{x:px+sign*dx*distance-dy*side,y:py+sign*dy*distance+dx*side,z:pz+(mode==='front'?3.8:1.7+distance*.32)};
}