import {createNavigation} from './navigation.mjs';
import {routeLength} from './object-destination.mjs';

export function worldPoint(obj,[x,y,z]) {
  const c=Math.cos(obj.yaw),s=Math.sin(obj.yaw);
  return {x:obj.x+x*c+z*s,y,z:obj.z-x*s+z*c,yaw:obj.yaw};
}
export function chooseApproach(obj,config,nav,start) {
  return config.approaches.map((p,index)=>({point:worldPoint(obj,p),index}))
    .filter(v=>nav.free(v.point)).map(v=>({...v,path:nav.path(start,v.point)}))
    .filter(v=>v.path).sort((a,b)=>routeLength(a.path)-routeLength(b.path))[0]||null;
}
export function interactionApproach(obj,config,nav,start,{objects,catalog,assets,room}) {
  const target=worldPoint(obj,config.root);
  const entryNav=createNavigation(objects.filter(o=>o.id!==obj.id),catalog,{assets,radius:.32,room});
  return chooseApproach(obj,config,{...nav,free:p=>nav.free(p)&&entryNav.line(p,target)},start);
}
