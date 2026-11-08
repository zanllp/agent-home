import {rugBelow} from '../shared/rug.mjs';
export {createNavigation} from '../shared/navigation.mjs';
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
  const angle=Math.atan2(dx,dz),error=shortestAngle(state.yaw,angle),turn=Math.sign(error)*Math.min(Math.abs(error),dt*(brisk?4.5:2.5));state.yaw+=turn;
  // Speeds are in room metres/second, independent of the imported rig's units.
  const walking=brisk ? .67 : .12/.62*scale,running=1.65,accel=brisk?2.85:.65;
  const ahead={x:state.x+dx/d*.45,z:state.z+dz/d*.45};
  const canRun=brisk&&tripLength>=1.6&&travelled>.30&&remaining>.72&&d>.46&&Math.abs(error)<.24&&nav.clearance(state)>.06&&nav.clearance(ahead)>.09;
  const max=canRun?running:walking,target=Math.abs(error)>.35?0:Math.min(max,Math.sqrt(2*accel*remaining));
  state.speed+=Math.sign(target-state.speed)*Math.min(Math.abs(target-state.speed),dt*accel);
  const blend=!brisk?0:Math.max(0,Math.min(1,(state.speed-walking)/(running-walking)));
  state.runBlend+=(blend-state.runBlend)*Math.min(1,dt*8);
  // Move exactly along a validated segment, never step across a shortcut/corner.
  const advance=Math.min(d,state.speed*dt),next={x:state.x+dx/d*advance,z:state.z+dz/d*advance};
  if(!nav.line(state,next)){state.route=[];state.wait=1;state.speed=0;return state}
  state.x=next.x;state.z=next.z;state.mode=state.speed>.002?'walk':'turn';
  travelled+=advance;state.phase+=advance/((brisk ? .41 : .12/.62*scale)*(1-state.runBlend)+.87*state.runBlend);const half=Math.floor(state.phase*2);if(half>lastHalf)state.steps+=half-lastHalf;lastHalf=half;
  return state;
 }
 return {state,update,go,get destination(){return destination},setAutonomous(v){autonomous=v;if(!v)state.wait=Infinity;else if(!Number.isFinite(state.wait))state.wait=1},setBrisk(v){brisk=v},stop(){state.route=[];state.speed=0;state.wait=2;destination=null}};
}

export function groundHeightAt(x,z,rugs,assets={}){
 const rug=rugBelow(x,z,rugs,assets);
 return rug?Math.max(.006,(assets[rug.asset_id]?.height??.018)+.004):.006;
}
