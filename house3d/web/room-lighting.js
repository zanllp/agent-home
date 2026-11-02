export function windowSunPose(objects,assets){
 const window=objects.find(o=>assets[o.asset_id]?.wall_opening);
 if(!window)return {position:[-5,5.8,-3],target:[.5,0,.5]};
 const inward={x:Math.sin(window.yaw),z:Math.cos(window.yaw)},along={x:Math.cos(window.yaw),z:-Math.sin(window.yaw)};
 return {position:[window.x-inward.x*5-along.x*2.2,4.6,window.z-inward.z*5-along.z*2.2],target:[window.x+inward.x*3,.15,window.z+inward.z*3]};
}
export function wallCells(width,height,holes=[]){
 const clean=holes.map(h=>({x0:Math.max(-width/2,h.x-h.width/2),x1:Math.min(width/2,h.x+h.width/2),y0:Math.max(0,h.bottom),y1:Math.min(height,h.bottom+h.height)})).filter(h=>h.x1>h.x0&&h.y1>h.y0);
 const xs=[...new Set([-width/2,width/2,...clean.flatMap(h=>[h.x0,h.x1])])].sort((a,b)=>a-b),ys=[...new Set([0,height,...clean.flatMap(h=>[h.y0,h.y1])])].sort((a,b)=>a-b),cells=[];
 for(let i=0;i<xs.length-1;i++)for(let j=0;j<ys.length-1;j++){
  const x=(xs[i]+xs[i+1])/2,y=(ys[j]+ys[j+1])/2;
  if(!clean.some(h=>x>h.x0&&x<h.x1&&y>h.y0&&y<h.y1))cells.push({x,y,width:xs[i+1]-xs[i],height:ys[j+1]-ys[j]});
 }
 return cells;
}
