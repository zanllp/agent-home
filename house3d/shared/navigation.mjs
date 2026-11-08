import {createSpace,spaceBounds} from './space.mjs';
// Shared by the visible walker and object-destination planning. No state writes.
export function createNavigation(objects,catalog,{radius=.57,step=.1,assets={},room={}}={}){
 const size={width:room.width??6,depth:room.depth??5},bounds={x:size.width/2-.15-radius,z:size.depth/2-.15-radius};
 const space=room.balcony||room.floorplan?createSpace(room,objects):null,extent=spaceBounds(room);
 const obstacles=objects.filter(o=>o.kind!=='rug'&&!o.on&&(!room.balcony||o.id!==room.balcony.door_id)).map(o=>({x:o.x,z:o.z,c:Math.cos(o.yaw),s:Math.sin(o.yaw),w:(assets[o.asset_id]||catalog[o.kind]).size[0]/2,d:(assets[o.asset_id]||catalog[o.kind]).size[1]/2}));
 function free(p){
  if(!Number.isFinite(p.x)||!Number.isFinite(p.z)||(space?!space.free(p,radius):Math.abs(p.x)>bounds.x||Math.abs(p.z)>bounds.z))return false;
  return !obstacles.some(o=>{const dx=p.x-o.x,dz=p.z-o.z,c=o.c,s=o.s;const x=Math.abs(dx*c-dz*s),z=Math.abs(dx*s+dz*c);return Math.hypot(Math.max(0,x-o.w),Math.max(0,z-o.d))<radius});
 }
 function line(a,b){const d=Math.hypot(b.x-a.x,b.z-a.z),n=Math.max(1,Math.ceil(d/.025));for(let i=0;i<=n;i++)if(!free({x:a.x+(b.x-a.x)*i/n,z:a.z+(b.z-a.z)*i/n}))return false;return true}
 const minX=space?extent.minX:-bounds.x,minZ=space?extent.minZ:-bounds.z,maxX=space?extent.maxX:bounds.x,maxZ=space?extent.maxZ:bounds.z;
 const nx=Math.floor((maxX-minX)/step)+1,nz=Math.floor((maxZ-minZ)/step)+1;
 const point=i=>({x:minX+(i%nx)*step,z:minZ+Math.floor(i/nx)*step});
 const nodes=Array.from({length:nx*nz},(_,i)=>point(i));const valid=nodes.map(free);
 // Start at the local grid cell. Scanning every cell in a multi-room floorplan
 // and tracing back to every improving candidate used to dominate path queries.
 function nearest(p){
  const ix=Math.min(nx-1,Math.max(0,Math.round((p.x-minX)/step))),iz=Math.min(nz-1,Math.max(0,Math.round((p.z-minZ)/step)));
  let best=-1,d=Infinity;
  function visit(x,z){
   if(x<0||z<0||x>=nx||z>=nz)return;
   const i=z*nx+x;if(!valid[i])return;
   const q=nodes[i],distance=Math.hypot(p.x-q.x,p.z-q.z);
   if(distance<d&&line(p,q)){d=distance;best=i}
  }
  for(let ring=0;ring<Math.max(nx,nz);ring++){
   for(let x=ix-ring;x<=ix+ring;x++){visit(x,iz-ring);if(ring)visit(x,iz+ring)}
   for(let z=iz-ring+1;z<iz+ring;z++){visit(ix-ring,z);visit(ix+ring,z)}
   if(d<=(ring+.5)*step)return best;
  }
  return best;
 }
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
 function clearance(p){return Math.min(space?space.clearance(p)-radius:bounds.x-Math.abs(p.x),space?Infinity:bounds.z-Math.abs(p.z),...obstacles.map(o=>{const dx=p.x-o.x,dz=p.z-o.z,c=o.c,s=o.s;return Math.hypot(Math.max(0,Math.abs(dx*c-dz*s)-o.w),Math.max(0,Math.abs(dx*s+dz*c)-o.d))-radius}))}
 return {free,line,path,clearance,nodes:nodes.filter((_,i)=>valid[i]),bounds,radius};
}
