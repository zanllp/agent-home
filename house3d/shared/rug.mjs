// Both the renderer and the observer need the actual support at the seat, not just the toy's centre.
export function rugBelow(x,z,objects,assets){
 let highest=null,best=-Infinity;
 for(const rug of objects){
  if(rug.kind!=='rug')continue;
  const def=assets[rug.asset_id]||{size:[1.8,1.3],height:.018},dx=x-rug.x,dz=z-rug.z,c=Math.cos(rug.yaw),s=Math.sin(rug.yaw);
  const u=(dx*c-dz*s)/(def.size[0]/2),v=(dx*s+dz*c)/(def.size[1]/2);
  if((def.shape==='ellipse'?u*u+v*v<1:Math.abs(u)<1&&Math.abs(v)<1)&&def.height>best){highest=rug;best=def.height}
 }
 return highest;
}
