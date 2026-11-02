import {createSpace,spaceBounds} from '../shared/space.mjs';
import {roomDimensions} from './room-size.js';
// Pure navigation for the isolated preview. No writes to the house state service.
export function createNavigation(objects,catalog,{radius=.57,step=.1,assets={},room={}}={}){
 const size=roomDimensions(room),bounds={x:size.width/2-.15-radius,z:size.depth/2-.15-radius};
 const space=room.balcony?createSpace(room,objects):null,extent=spaceBounds(room);
 const obstacles=objects.filter(o=>o.kind!=='rug'&&!o.on&&(!room.balcony||o.id!==room.balcony.door_id)).map(o=>({x:o.x,z:o.z,yaw:o.yaw,w:(assets[o.asset_id]||catalog[o.kind]).size[0]/2,d:(assets[o.asset_id]||catalog[o.kind]).size[1]/2}));
 function free(p){
  if(!Number.isFinite(p.x)||!Number.isFinite(p.z)||(space?!space.free(p,radius):Math.abs(p.x)>bounds.x||Math.abs(p.z)>bounds.z))return false;
  return !obstacles.some(o=>{const dx=p.x-o.x,dz=p.z-o.z,c=Math.cos(o.yaw),s=Math.sin(o.yaw);const x=Math.abs(dx*c-dz*s),z=Math.abs(dx*s+dz*c);return Math.hypot(Math.max(0,x-o.w),Math.max(0,z-o.d))<radius});
 }
 function line(a,b){const d=Math.hypot(b.x-a.x,b.z-a.z),n=Math.max(1,Math.ceil(d/.025));for(let i=0;i<=n;i++)if(!free({x:a.x+(b.x-a.x)*i/n,z:a.z+(b.z-a.z)*i/n}))return false;return true}
 const minX=space?extent.minX:-bounds.x,minZ=space?extent.minZ:-bounds.z,maxX=space?extent.maxX:bounds.x,maxZ=space?extent.maxZ:bounds.z;
 const nx=Math.floor((maxX-minX)/step)+1,nz=Math.floor((maxZ-minZ)/step)+1;
 const point=i=>({x:minX+(i%nx)*step,z:minZ+Math.floor(i/nx)*step});
 const nodes=Array.from({length:nx*nz},(_,i)=>point(i));const valid=nodes.map(free);
 function nearest(p){let best=-1,d=Infinity;nodes.forEach((v,i)=>{if(!valid[i])return;const n=Math.hypot(p.x-v.x,p.z-v.z);if(n<d&&line(p,v)){d=n;best=i}});return best}
 function path(a,b){
  if(!free(a)||!free(b))return null;if(line(a,b))return [{...a},{...b}];
  const start=nearest(a),end=nearest(b);if(start<0||end<0)return null;
  const open=new Set([start]),prev=new Map(),cost=new Map([[start,0]]),score=new Map([[start,0]]);
  while(open.size){let current=-1,best=Infinity;for(const i of open)if(score.get(i)<best){best=score.get(i);current=i}
   if(current===end){let route=[b];for(let i=end;i!==undefined;i=prev.get(i))route.push(nodes[i]);route.push(a);route.reverse();const smooth=[route[0]];for(let i=0;i<route.length-1;){let j=route.length-1;while(j>i+1&&!line(route[i],route[j]))j--;smooth.push(route[j]);i=j}return smooth}
   open.delete(current);const x=current%nx,z=Math.floor(current/nx);
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
    const xx=x+dx,zz=z+dz;if(xx<0||xx>=nx||zz<0||zz>=nz)continue;const next=zz*nx+xx;if(!valid[next]||!line(nodes[current],nodes[next]))continue;
    const g=cost.get(current)+Math.hypot(dx,dz)*step;if(g>=(cost.get(next)??Infinity))continue;prev.set(next,current);cost.set(next,g);score.set(next,g+Math.hypot(nodes[next].x-nodes[end].x,nodes[next].z-nodes[end].z));open.add(next);
   }
  }return null;
 }
 function clearance(p){return Math.min(space?space.clearance(p)-radius:bounds.x-Math.abs(p.x),space?Infinity:bounds.z-Math.abs(p.z),...obstacles.map(o=>{const dx=p.x-o.x,dz=p.z-o.z,c=Math.cos(o.yaw),s=Math.sin(o.yaw);return Math.hypot(Math.max(0,Math.abs(dx*c-dz*s)-o.w),Math.max(0,Math.abs(dx*s+dz*c)-o.d))-radius}))}
 return {free,line,path,clearance,nodes:nodes.filter((_,i)=>valid[i]),bounds,radius};
}
export const shortestAngle=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
export function createWalker(nav,start,{random=Math.random}={}){
 const state={x:start.x,z:start.z,yaw:start.yaw||0,speed:0,phase:0,mode:'rest',route:[],wait:1.5,steps:0,runBlend:0};
 let destination=null,autonomous=true,brisk=false,lastHalf=0,tripLength=0,travelled=0;
 function go(p){const route=nav.path(state,p);if(!route)return false;state.route=route.slice(1);destination={...p};state.wait=0;tripLength=0;travelled=0;let previous=state;for(const q of state.route){tripLength+=Math.hypot(q.x-previous.x,q.z-previous.z);previous=q}return true}
 function pick(){for(let n=0;n<30;n++){const p=nav.nodes[Math.floor(random()*nav.nodes.length)];if(Math.hypot(p.x-state.x,p.z-state.z)<.6)continue;if(go(p))return true}state.wait=2;return false}
 function update(dt,scale=1){
  dt=Math.min(.05,Math.max(0,dt));let remaining=0,from=state;
  for(const p of state.route){remaining+=Math.hypot(p.x-from.x,p.z-from.z);from=p}
  if(!state.route.length){state.speed=0;state.runBlend=0;state.mode='rest';state.wait-=dt;if(autonomous&&state.wait<=0)pick();return state}
  let p=state.route[0],dx=p.x-state.x,dz=p.z-state.z,d=Math.hypot(dx,dz);
  if(d<.003){state.route.shift();if(!state.route.length){state.wait=1.8+random()*3.2;destination=null}return state}
  const angle=Math.atan2(dx,dz),error=shortestAngle(state.yaw,angle),turn=Math.sign(error)*Math.min(Math.abs(error),dt*2.5);state.yaw+=turn;
  const walking=.12/.62*scale*(brisk?1.4:1),running=.16/(.44*.75)*scale;
  const ahead={x:state.x+dx/d*.45,z:state.z+dz/d*.45};
  const canRun=brisk&&tripLength>=2.2&&travelled>.45&&remaining>.85&&d>.85&&Math.abs(error)<.15&&nav.clearance(state)>.10&&nav.clearance(ahead)>.15;
  const max=canRun?running:walking,target=Math.abs(error)>.35?0:Math.min(max,Math.sqrt(2*.65*remaining));
  state.speed+=Math.sign(target-state.speed)*Math.min(Math.abs(target-state.speed),dt*.65);
  const blend=Math.max(0,Math.min(1,(state.speed-walking)/(running-walking)));
  state.runBlend+=(blend-state.runBlend)*Math.min(1,dt*8);
  // Move exactly along a validated segment, never step across a shortcut/corner.
  const advance=Math.min(d,state.speed*dt),next={x:state.x+dx/d*advance,z:state.z+dz/d*advance};
  if(!nav.line(state,next)){state.route=[];state.wait=1;state.speed=0;return state}
  state.x=next.x;state.z=next.z;state.mode=state.speed>.002?'walk':'turn';
  travelled+=advance;state.phase+=advance/((.12/.62*(1-state.runBlend)+.16/.44*state.runBlend)*scale);const half=Math.floor(state.phase*2);if(half>lastHalf)state.steps+=half-lastHalf;lastHalf=half;
  return state;
 }
 return {state,update,go,get destination(){return destination},setAutonomous(v){autonomous=v;if(!v)state.wait=Infinity;else if(!Number.isFinite(state.wait))state.wait=1},setBrisk(v){brisk=v},stop(){state.route=[];state.speed=0;state.wait=2;destination=null}};
}

export function groundHeightAt(x,z,rugs,assets={}){
 let height=.006;
 for(const rug of rugs){
  const def=assets[rug.asset_id]||{size:[1.8,1.3],height:.018},dx=x-rug.x,dz=z-rug.z,c=Math.cos(rug.yaw),s=Math.sin(rug.yaw);
  const u=(dx*c-dz*s)/(def.size[0]/2),v=(dx*s+dz*c)/(def.size[1]/2);
  if(def.shape==='ellipse'?u*u+v*v<1:Math.abs(u)<1&&Math.abs(v)<1)height=Math.max(height,def.height+.004);
 }
 return height;
}
