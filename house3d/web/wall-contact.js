import * as T from 'three';
import {wallCells} from './room-lighting.js';

// Approximate the diffuse shadow immediately behind a wall-mounted object, not directional sunlight.
function imprint(item,a){
 if(a?.placement!=='wall'||!['wall_art','wall_shelf','air_conditioner'].includes(item.kind))return;
 let width=a.size[0],height=a.height,bottom=a.elevation||0;
 if(item.kind==='wall_art'&&(!bottom||item.asset_id.includes('-hooks-')))return;
 if(item.kind==='wall_shelf'){bottom+=height-.035;height=.035}
 const round=item.asset_id==='family-beech-clock-v1';
 return {x:Math.abs(item.yaw)<.001?item.x:-item.z,y:bottom+height/2,width,height,round,depth:a.size[1]};
}
function shadowTexture({width:w,height:h,round,depth},pad){
 const n=96,data=new Uint8Array(n*n*4),soft=.009+.16*depth,drop=.005+.105*depth,r=Math.min(.018,w/2,h/2);
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){
  const x=Math.abs(((i+.5)/n-.5)*(w+2*pad)),y=Math.abs(((j+.5)/n-.5)*(h+2*pad)+drop);
  const u=x-w/2+r,v=y-h/2+r;
  const d=round?(Math.hypot(x/(w/2),y/(h/2))-1)*h/2:Math.hypot(Math.max(u,0),Math.max(v,0))+Math.min(Math.max(u,v),0)-r;
  const a=.17*Math.exp(-(Math.max(d,0)**2)/(2*soft*soft));data[(j*n+i)*4+3]=Math.round(255*a);
 }
 const t=new T.DataTexture(data,n,n);t.magFilter=t.minFilter=T.LinearFilter;t.needsUpdate=true;return t;
}
export function wallContacts(items,assets){return items.flatMap(o=>{
 const shadow=imprint(o,assets[o.asset_id]);return shadow?[{...shadow,side:Math.abs(o.yaw)<.001?'back':'left'}]:[];
})}
export function createWallContact(side,ceiling,holes,shadow){
 const {x,y,width:w,height:h,depth}=shadow,pad=.08+.52*depth,sw=w+pad*2,sh=h+pad*2;
 const left=x-sw/2,bottom=y-sh/2,pos=[],uv=[],indices=[];
 for(const c of wallCells(side.width,ceiling,holes)){
  const l=Math.max(left,c.x-c.width/2),r=Math.min(left+sw,c.x+c.width/2),b=Math.max(bottom,c.y-c.height/2),t=Math.min(bottom+sh,c.y+c.height/2);
  if(l>=r||b>=t)continue;const first=pos.length/3;
  for(const [a,v] of [[l,b],[r,b],[r,t],[l,t]]){pos.push(a,v,0);uv.push((a-left)/sw,(v-bottom)/sh)}
  indices.push(first,first+1,first+2,first,first+2,first+3);
 }
 if(!indices.length)return;
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);
 const mat=new T.MeshBasicMaterial({map:shadowTexture(shadow,pad),color:0,transparent:true,depthWrite:false,toneMapped:false});
 const mesh=new T.Mesh(geo,mat);mesh.name='Wall fixture contact';mesh.position.z=.057;return mesh;
}
