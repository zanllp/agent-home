import {apartment,zoneAt,solidWallSegments,wallSpan,doorsOnWall} from './apartment.mjs';
// Shared world-space boundaries for renderer navigation and server layout checks.
export function balconyGeometry(room={}) {
 const b=room.balcony;if(!b)return null;
 const left=b.wall==='left',wall=left?-(room.width??6)/2:-(room.depth??5)/2;
 const origin=left?{x:wall,z:-b.center}:{x:b.center,z:wall};
 const along=left?{x:0,z:-1}:{x:1,z:0},outward=left?{x:-1,z:0}:{x:0,z:-1};
 const point=(u,v)=>({x:origin.x+along.x*u+outward.x*v,z:origin.z+along.z*u+outward.z*v});
 const a=point(-b.width/2,0),c=point(b.width/2,b.depth);
 return {...b,origin,along,outward,point,minX:Math.min(a.x,c.x),maxX:Math.max(a.x,c.x),minZ:Math.min(a.z,c.z),maxZ:Math.max(a.z,c.z)};
}
export function balconyLocal(room,p){const b=balconyGeometry(room);if(!b)return null;const x=p.x-b.origin.x,z=p.z-b.origin.z;return {u:x*b.along.x+z*b.along.z,v:x*b.outward.x+z*b.outward.z}}
export function regionAt(room,p,plan=apartment(room)){const b=balconyGeometry(room),q=b&&balconyLocal(room,p);return q&&Math.abs(q.u)<=b.width/2+1e-8&&q.v>0&&q.v<=b.depth+1e-8?'balcony':plan?(zoneAt(plan,p)?.id??null):Math.abs(p.x)<=(room.width??6)/2+1e-8&&Math.abs(p.z)<=(room.depth??5)/2+1e-8?'interior':null}
export function spaceBounds(room={}){const b=balconyGeometry(room),x=(room.width??6)/2,z=(room.depth??5)/2;const zones=apartment(room)?.zones||[];return {minX:Math.min(-x,b?.minX??-x,...zones.map(z=>z.minX)),maxX:Math.max(x,b?.maxX??x,...zones.map(z=>z.maxX)),minZ:Math.min(-z,b?.minZ??-z,...zones.map(z=>z.minZ)),maxZ:Math.max(z,b?.maxZ??z,...zones.map(z=>z.maxZ))}}
export function fitsFootprint(room={},p,w,d,margin=.05){
 const x=(room.width??6)/2,z=(room.depth??5)/2,b=balconyGeometry(room);
 const within=(a,c,e,f)=>p.x-w/2>=a+margin-1e-8&&p.x+w/2<=c-margin+1e-8&&p.z-d/2>=e+margin-1e-8&&p.z+d/2<=f-margin+1e-8;
 return within(-x,x,-z,z)||!!apartment(room)?.zones.some(z=>within(z.minX,z.maxX,z.minZ,z.maxZ))||!!(b&&within(b.minX,b.maxX,b.minZ,b.maxZ));
}
export function balconyDoor(room,objects){
 const b=balconyGeometry(room);if(!b)return null;const door=objects.find(o=>o.id===b.door_id);if(!door)return null;
 // Three sliding panels stack at the left; the clear opening is at local +0.4 m.
 const q=balconyLocal(room,door);return {id:door.id,u:q.u+.4,width:1.55,open:door.properties?.open!==false};
}

export function spaceSegments(room={},objects=[]){
 const x=(room.width??6)/2,z=(room.depth??5)/2,b=balconyGeometry(room),door=balconyDoor(room,objects),segments=[];
 const add=(a,c)=>segments.push([a,c]);
 const walls=[['back',{x:-x,z:-z},{x:x,z:-z}],['right',{x:x,z:-z},{x:x,z:z}],['front',{x:x,z:z},{x:-x,z:z}],['left',{x:-x,z:z},{x:-x,z:-z}]];
 const plan=apartment(room);
 if(plan){for(const zone of plan.zones)for(const side of ['back','right','front','left']){
   const extra=zone.id==='living'&&side===b?.wall&&door?.open?[{center:b.wall==='left'?b.point(door.u,0).z:b.point(door.u,0).x,width:door.width}]:[];
   segments.push(...solidWallSegments(plan,zone,side,extra));
 }}else for(const [id,a,c] of walls){if(b&&id===b.wall&&door?.open){add(a,b.point(door.u-door.width/2,0));add(b.point(door.u+door.width/2,0),c)}else add(a,c)}
 if(b){add(b.point(-b.width/2,0),b.point(-b.width/2,b.depth));add(b.point(-b.width/2,b.depth),b.point(b.width/2,b.depth));add(b.point(b.width/2,b.depth),b.point(b.width/2,0))}
 return segments;
}
export function createSpace(room={},objects=[]){
 const segments=spaceSegments(room,objects),plan=apartment(room),balcony=balconyGeometry(room);
 const regions=plan?[...plan.zones]:[{minX:-(room.width??6)/2,maxX:(room.width??6)/2,minZ:-(room.depth??5)/2,maxZ:(room.depth??5)/2}];if(balcony)regions.push(balcony);
 // All room walls and railings are axis-aligned, including door jamb endpoints.
 const spans=segments.map(([a,b])=>({x0:Math.min(a.x,b.x),x1:Math.max(a.x,b.x),z0:Math.min(a.z,b.z),z1:Math.max(a.z,b.z)}));
 function clearance(p){
  if(!regions.some(z=>p.x>=z.minX-1e-8&&p.x<=z.maxX+1e-8&&p.z>=z.minZ-1e-8&&p.z<=z.maxZ+1e-8))return -Infinity;
  let d=Infinity;for(const s of spans){const dx=Math.max(s.x0-p.x,p.x-s.x1,0),dz=Math.max(s.z0-p.z,p.z-s.z1,0);d=Math.min(d,dx*dx+dz*dz)}
  return Math.sqrt(d)-(balcony ? .10 : .15);
 }
 return {segments,clearance,free(p,radius=.57){return Number.isFinite(p.x)&&Number.isFinite(p.z)&&clearance(p)>=radius-1e-8}};
}
// Glass remains visually transparent when shut; the surrounding room wall does not.
export function wallBlocksSight(room,objects,a,b,assets={}){
 const d=balconyGeometry(room),door=d&&objects.find(o=>o.id===d.door_id),q=door&&balconyLocal(room,door),w=(room.width??6)/2,h=(room.depth??5)/2;
 const plan=apartment(room);
 if(plan){
  for(const zone of plan.zones)for(const side of ['left','right','back','front']){
   const {axis,cross,at,min,max}=wallSpan(zone,side),delta=b[axis]-a[axis];
   if(Math.abs(delta)<1e-9)continue;
   const t=(at-a[axis])/delta,u=a[cross]+(b[cross]-a[cross])*t,y=a.y+(b.y-a.y)*t;
   if(t<=.001||t>=.999||u<min||u>max||y<0||y>(room.height??2.4))continue;
   if(y<=2.10&&doorsOnWall(plan,zone,side).some(d=>Math.abs(d.center-u)<d.width/2))continue;
   const glass=objects.some(o=>{
    const win=assets[o.asset_id]?.wall_opening,sliding=o.id===door?.id;
    if(!win||zoneAt(plan,o)?.id!==zone.id||side!==(Math.abs(o.yaw)<.001?'back':'left'))return false;
    const bottom=sliding ? .03 :(assets[o.asset_id].elevation||0)+(win.bottom||0);
    return Math.abs(o[cross]-u)<=win.width/2&&y>=bottom&&y<=(sliding?2.20:bottom+win.height);
   });
   if(!glass)return true;
  }
  return false;
 }
 for(const [id,axis,value,other,span] of [['left','x',-w,'z',h],['right','x',w,'z',h],['back','z',-h,'x',w],['front','z',h,'x',w]]){
  const delta=b[axis]-a[axis];if(Math.abs(delta)<1e-9)continue;const t=(value-a[axis])/delta;if(t<=.001||t>=.999)continue;
  const p={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t},y=a.y+(b.y-a.y)*t;
  if(Math.abs(p[other])>span||y<0||y>(room.height??2.4))continue;
  if(d&&id===d.wall&&q&&Math.abs(balconyLocal(room,p).u-q.u)<=(assets[door.asset_id]?.wall_opening?.width??2.42)/2&&y>=.03&&y<=2.20)continue;
  return true;
 }return false;
}
