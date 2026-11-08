// The living room stays at the original world origin: saved furniture and the
// existing balcony door do not move when the neighbouring rooms are connected.
export const CONNECTED_HOME='connected-home';
export function apartment(room={}){
 if(room.floorplan!==CONNECTED_HOME)return null;
 const w=room.width??8,d=room.depth??6.5,entry=d/2,hallZ=entry+1.1;
 const rect=(id,label,x,z,width,depth)=>({id,label,x,z,width,depth,minX:x-width/2,maxX:x+width/2,minZ:z-depth/2,maxZ:z+depth/2});
 const bathWidth=Math.min(3.2,w-1),bathX=w/2-bathWidth/2;
 const zones=[rect('living','家庭客厅',0,0,w,d),rect('hall','走廊',0,hallZ,w,2.2),
  rect('child','鲸鱼儿童房',-w/2-3,hallZ-.45,6,5),rect('parent','饲养员的卧室',w/2+2.5,hallZ,5,4.4),
  rect('bath','浴室',bathX,entry+2.2+1.7,bathWidth,3.4)];
 const doors=[
  {a:'living',b:'hall',axis:'z',at:entry,center:-w*.12,width:Math.min(3.6,w-.6)},
  {a:'hall',b:'child',axis:'x',at:-w/2,center:hallZ,width:1.48},
  {a:'hall',b:'parent',axis:'x',at:w/2,center:hallZ,width:1.72},
  {a:'hall',b:'bath',axis:'z',at:entry+2.2,center:bathX,width:1.6},
 ];
 return {zones,doors};
}
export function zoneAt(plan,p){
 return plan?.zones.find(z=>p.x>=z.minX-1e-8&&p.x<=z.maxX+1e-8&&p.z>=z.minZ-1e-8&&p.z<=z.maxZ+1e-8);
}
export function wallSpan(zone,side){
 const axis=['left','right'].includes(side)?'x':'z',cross=axis==='x'?'z':'x';
 const at={left:zone.minX,right:zone.maxX,back:zone.minZ,front:zone.maxZ}[side];
 return {axis,cross,at,min:axis==='x'?zone.minZ:zone.minX,max:axis==='x'?zone.maxZ:zone.maxX};
}
export function doorsOnWall(plan,zone,side){
 const wall=wallSpan(zone,side);return plan.doors.filter(d=>(d.a===zone.id||d.b===zone.id)&&d.axis===wall.axis&&Math.abs(d.at-wall.at)<1e-7);
}
export function solidWallSegments(plan,zone,side,extra=[]){
 const {axis,cross,at,min,max}=wallSpan(zone,side),holes=[...doorsOnWall(plan,zone,side),...extra].sort((a,b)=>a.center-b.center);
 let start=min;const segments=[];
 const add=(a,b)=>{if(b-a>1e-8)segments.push([{[axis]:at,[cross]:a},{[axis]:at,[cross]:b}])};
 for(const hole of holes){add(start,Math.min(max,hole.center-hole.width/2));start=Math.max(start,hole.center+hole.width/2)}
 add(start,max);return segments;
}

export function mountedInRoom(room,p,w,d){
 const plan=apartment(room),zone=zoneAt(plan,p);
 const back=(zone?.minZ??-(room?.depth??5)/2)+.05+d/2,left=(zone?.minX??-(room?.width??6)/2)+.05+w/2;
 const a=Math.atan2(Math.sin(p.yaw),Math.cos(p.yaw));
 return (Math.abs(a)<.001&&Math.abs(p.z-back)<.025)||(Math.abs(a-Math.PI/2)<.001&&Math.abs(p.x-left)<.025);
}
export function blocksDoor(room,p,w,d){
 const plan=apartment(room);
 return !!plan?.doors.some(door=>{
  const along=door.axis==='x'?p.z:p.x,half=door.axis==='x'?d/2:w/2,depth=door.axis==='x'?w/2:d/2;
  return Math.abs(p[door.axis]-door.at)<depth+.57&&Math.abs(along-door.center)<half+door.width/2;
 });
}
