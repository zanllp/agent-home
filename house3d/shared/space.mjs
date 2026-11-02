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
export function regionAt(room,p){const b=balconyGeometry(room),q=b&&balconyLocal(room,p);return q&&Math.abs(q.u)<=b.width/2+1e-8&&q.v>0&&q.v<=b.depth+1e-8?'balcony':Math.abs(p.x)<=(room.width??6)/2+1e-8&&Math.abs(p.z)<=(room.depth??5)/2+1e-8?'interior':null}
export function spaceBounds(room={}){const b=balconyGeometry(room),x=(room.width??6)/2,z=(room.depth??5)/2;return {minX:Math.min(-x,b?.minX??-x),maxX:Math.max(x,b?.maxX??x),minZ:Math.min(-z,b?.minZ??-z),maxZ:Math.max(z,b?.maxZ??z)}}
export function fitsFootprint(room={},p,w,d,margin=.05){
 const x=(room.width??6)/2,z=(room.depth??5)/2,b=balconyGeometry(room);
 const within=(a,c,e,f)=>p.x-w/2>=a+margin-1e-8&&p.x+w/2<=c-margin+1e-8&&p.z-d/2>=e+margin-1e-8&&p.z+d/2<=f-margin+1e-8;
 return within(-x,x,-z,z)||!!(b&&within(b.minX,b.maxX,b.minZ,b.maxZ));
}
export function balconyDoor(room,objects){
 const b=balconyGeometry(room);if(!b)return null;const door=objects.find(o=>o.id===b.door_id);if(!door)return null;
 // Three sliding panels stack at the left; the clear opening is at local +0.4 m.
 const q=balconyLocal(room,door);return {id:door.id,u:q.u+.4,width:1.55,open:door.properties?.open!==false};
}
function distanceToSegment(p,a,b){const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz)}
export function spaceSegments(room={},objects=[]){
 const x=(room.width??6)/2,z=(room.depth??5)/2,b=balconyGeometry(room),door=balconyDoor(room,objects),segments=[];
 const add=(a,c)=>segments.push([a,c]);
 const walls=[['back',{x:-x,z:-z},{x:x,z:-z}],['right',{x:x,z:-z},{x:x,z:z}],['front',{x:x,z:z},{x:-x,z:z}],['left',{x:-x,z:z},{x:-x,z:-z}]];
 for(const [id,a,c] of walls){if(b&&id===b.wall&&door?.open){add(a,b.point(door.u-door.width/2,0));add(b.point(door.u+door.width/2,0),c)}else add(a,c)}
 if(b){add(b.point(-b.width/2,0),b.point(-b.width/2,b.depth));add(b.point(-b.width/2,b.depth),b.point(b.width/2,b.depth));add(b.point(b.width/2,b.depth),b.point(b.width/2,0))}
 return segments;
}
export function createSpace(room={},objects=[]){const segments=spaceSegments(room,objects);return {segments,clearance:p=>regionAt(room,p)?Math.min(...segments.map(([a,b])=>distanceToSegment(p,a,b)))-(room.balcony ? .10 : .15):-Infinity,free(p,radius=.57){return Number.isFinite(p.x)&&Number.isFinite(p.z)&&this.clearance(p)>=radius-1e-8}}}
// Glass remains visually transparent when shut; the surrounding room wall does not.
export function wallBlocksSight(room,objects,a,b){
 const d=balconyGeometry(room),door=d&&objects.find(o=>o.id===d.door_id),q=door&&balconyLocal(room,door),w=(room.width??6)/2,h=(room.depth??5)/2;
 for(const [id,axis,value,other,span] of [['left','x',-w,'z',h],['right','x',w,'z',h],['back','z',-h,'x',w],['front','z',h,'x',w]]){
  const delta=b[axis]-a[axis];if(Math.abs(delta)<1e-9)continue;const t=(value-a[axis])/delta;if(t<=.001||t>=.999)continue;
  const p={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t},y=a.y+(b.y-a.y)*t;
  if(Math.abs(p[other])>span||y<0||y>(room.height??2.4))continue;
  if(d&&id===d.wall&&q&&Math.abs(balconyLocal(room,p).u-q.u)<=1.21&&y>=.03&&y<=2.20)continue;
  return true;
 }return false;
}
