import {createNavigation} from './navigation.mjs';

export function routeLength(path) {
  return path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x-path[i].x, p.z-path[i].z), 0);
}

// Approach the floor support, not the occupied centre or the floating tabletop item.
export function planObjectDestination(objects, catalog, assets, room, start, targetId, nav) {
  const target = objects.find(o => o.id === targetId);
  if (!target) return {ok:false, code:'target_missing', reason:'Target object not found'};
  nav ??= createNavigation(objects, catalog, {assets, room});
  if (!nav.free(start)) return {ok:false, code:'start_blocked', reason:'The current body position has no walking clearance'};
  let support=target;
  const seen=new Set();
  while(support.on) {
    if(seen.has(support.id)) return {ok:false, code:'invalid_support', reason:'Support cycle'};
    seen.add(support.id);
    support=objects.find(o=>o.id===support.on.id);
    if(!support) return {ok:false, code:'invalid_support', reason:'Support object missing'};
  }
  const def=assets[support.asset_id]||catalog[support.kind];
  if(!def?.size) return {ok:false, code:'invalid_support', reason:'Object footprint missing'};
  const [width,depth]=def.size, margin=nav.radius+.035;
  const c=Math.cos(support.yaw),s=Math.sin(support.yaw);
  const world=(x,z)=>({x:support.x+x*c+z*s,z:support.z-x*s+z*c});
  const dx=target.x-support.x,dz=target.z-support.z;
  const local={x:dx*c-dz*s,z:dx*s+dz*c};
  const candidates=[];
  if(support.kind==='rug') candidates.push({x:target.x,z:target.z});
  // Project toward each edge first, then sample along the edge for blocked approaches.
  const clamp=(v,n)=>Math.max(-n,Math.min(n,v));
  for(const sign of [-1,1]) {
    candidates.push(world(sign*(width/2+margin),clamp(local.z,depth/2)));
    candidates.push(world(clamp(local.x,width/2),sign*(depth/2+margin)));
    for(let i=0;i<=Math.ceil(depth/.25);i++)candidates.push(world(sign*(width/2+margin),-depth/2+depth*i/Math.ceil(depth/.25)));
    for(let i=0;i<=Math.ceil(width/.25);i++)candidates.push(world(-width/2+width*i/Math.ceil(width/.25),sign*(depth/2+margin)));
  }
  for(const sx of [-1,1])for(const sz of [-1,1])for(let i=1;i<8;i++) {
    const angle=i*Math.PI/16;
    candidates.push(world(sx*(width/2+margin*Math.cos(angle)),sz*(depth/2+margin*Math.sin(angle))));
  }
  const unique=new Map(candidates.filter(p=>nav.free(p)).map(p=>[`${p.x.toFixed(5)},${p.z.toFixed(5)}`,p]));
  const goals=[...unique.values()].sort((a,b)=>Math.hypot(a.x-start.x,a.z-start.z)-Math.hypot(b.x-start.x,b.z-start.z));
  let best=null;
  for(const p of goals) {
    if(best && Math.hypot(p.x-start.x,p.z-start.z)>=best.distance)break;
    const path=nav.path(start,p);
    if(!path)continue;
    const distance=routeLength(path);
    if(!best||distance<best.distance)best={point:p,path,distance};
  }
  return best ? {ok:true,target_id:targetId,support_id:support.id,...best} :
    {ok:false,code:'unreachable',reason:'No collision-free route to the object edge; clear a passage'};
}
