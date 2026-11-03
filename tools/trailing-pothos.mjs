// Origin is the centre of the pot foot; +Z points over the open edge of a shelf.
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export function makeTrailingPothos(group){
 const material=(color,roughness=.85)=>new T.MeshStandardMaterial({color,roughness,side:T.DoubleSide});
 const add=(name,geometry,mat)=>{const m=new T.Mesh(geometry,mat);m.name=name;group.add(m);return m};
 const lathe=(name,profile,mat)=>add(name,new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),40),mat);
 const clay=material('#eee0bd',.48),glaze=material('#88a399',.4);
 lathe('Glazed stoneware',[[0,0],[.057,0],[.061,.007],[.073,.027],[.080,.097],[.083,.108],[.083,.116],[.077,.120],[.071,.115],[.069,.095],[.052,.015],[0,.015]],clay);
 lathe('Celadon foot ring',[[.061,.008],[.065,.009],[.066,.015],[.064,.016]],glaze);
 lathe('Celadon rim',[[.081,.105],[.084,.108],[.084,.114],[.081,.117]],glaze);
 lathe('Potting soil',[[0,.104],[.072,.103],[.072,.098],[0,.098]],material('#564736'));
 const stems=[],points=[],colors=[],idx=[];
 const stem=(pts,r)=>stems.push(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p))),Math.max(8,pts.length*4),r,5,false));
 function leaf(base,heading,len,wide,tilt,hue){
  const offset=points.length/3,col=new T.Color(hue);
  const phase=offset*1.37,turn=.54*Math.sin(phase+.37),ct=Math.cos(turn),st=Math.sin(turn);
  const cols=[-1,-.90,-.52,-.18,-.035,0,.035,.18,.52,.90,1];
  const rows=[0,.06,.13,.22,.237,.255,.32,.43,.448,.467,.55,.66,.68,.70,.82,.92,1];
  for(const t of rows)for(const s of cols){
   const mid=Math.abs(s),mt=t+.11*mid*Math.sin(t*Math.PI),rib=rows.indexOf(t);
   const breadth=Math.sin(Math.PI*t)**.68*(1-.52*t)*(1+.035*s*Math.sin(t*7+phase));
   const u=s*wide*breadth,v=len*(mt-.38*mid*Math.sin(Math.PI*Math.min(t/.45,1))**1.4);
   const xx=u*Math.cos(heading)+v*Math.sin(heading),y=u*Math.sin(heading)-v*Math.cos(heading);
   const fold=v*tilt+len*(.19*Math.sin(mt*Math.PI)-.13*mt*mt)-.38*Math.abs(u)+u*mt*.28;
   points.push(base[0]+xx*ct+fold*st,base[1]+y,base[2]-xx*st+fold*ct);
   const vein=(rib===4||rib===8||rib===12)&&mid<.91;
   const shade=(s===0?1.27:vein?1.13:s<0?1.06:.87)*(1-.11*t)*(mid===1?.87:1);
   const fleck=.09*Math.max(0,Math.sin(5*mt+phase+s*2)-.32);
   colors.push(col.r*shade+fleck,col.g*shade+fleck*.83,col.b*shade+fleck*.35);
  }
  for(let i=0;i<rows.length-1;i++)for(let j=0;j<cols.length-1;j++){
   const a=offset+i*cols.length+j;idx.push(a,a+cols.length,a+1,a+1,a+cols.length,a+cols.length+1);
  }
 }
 const greens=['#71933e','#8eac53','#568249','#9bb155','#628946'];
 // A loose crown with new upright leaves and older blades hanging beyond the rim.
 for(let i=0;i<15;i++){const a=i*2.40,r=.047+(i%4)*.014,x=r*Math.cos(a),z=r*Math.sin(a),h=.17+(i%5)*.018;
  stem([[0,.10,0],[x*.56,h-.007,z*.56],[x,h,z]],.0028);
  leaf([x,h,z],Math.sin(a)*.6+Math.cos(a)*1.14,.082+(i%3)*.011,.036,.18+Math.sin(a)*.32,greens[i%5]);
 }
 for(const [trail,{x,end,depth,drift}] of [
  {x:-.105,end:-.39,depth:.227,drift:-.042},{x:.038,end:-.24,depth:.244,drift:.041},{x:.103,end:-.085,depth:.216,drift:.023}
 ].entries()){
  const pts=[[0,.108,0],[x*.45,.18,.055],[x*.9,.139,.141],[x,.075,depth-.012]];
  const n=[8,6,4][trail];
  for(let i=0;i<n;i++){const t=i/(n-1),side=i%2?1:-1,px=x+drift*t+.013*Math.sin(t*6),py=.048+(end-.048)*t,pz=depth+.011*Math.sin(t*4);
   pts.push([px,py,pz]);const base=[px+side*.014,py+.014,pz+.011];stem([[px,py,pz],base],.0018);
   leaf(base,side*(.71+.16*(i%3)),(.106-.035*t)*(trail===2?.8:1),.038-.010*t,.30+(i%2)*.14,greens[(i+trail)%5]);
  }
  stem(pts,.0031);
  for(let j=1;j<=3;j++){const t=j/4,side=j%2===0?-1:1;
   const base=[x*(.45+t*.5),.18-t*.052,.052+t*.111];
   leaf(base,side*(.82+trail*.17),.095+.012*t,.039,.40+t*.24,greens[(j+trail)%5]);
  }
 }
 const blades=new T.BufferGeometry();blades.setAttribute('position',new T.Float32BufferAttribute(points,3));blades.setAttribute('color',new T.Float32BufferAttribute(colors,3));blades.setIndex(idx);blades.computeVertexNormals();
 const leafMat=material('#ffffff',.72);leafMat.vertexColors=true;add('Heart shaped foliage',blades,leafMat);
 add('Trailing stems',mergeGeometries(stems),material('#75804b'));stems.forEach(s=>s.dispose());
}

// Include the intersection of every crossing edge with the shelf plane. Inspecting
// just submerged vertices misses triangles that slope back towards the mounting lip.
export function hangingBounds(meshes, planeY){
 const bounds=new T.Box2(),triangle=[new T.Vector3(),new T.Vector3(),new T.Vector3()];
 const include=p=>bounds.expandByPoint(new T.Vector2(p.x,p.z));
 for(const mesh of meshes){
  const p=mesh.geometry.attributes.position,idx=mesh.geometry.index;
  for(let i=0;i<(idx?.count??p.count);i+=3){
   triangle.forEach((v,j)=>v.fromBufferAttribute(p,idx?idx.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld));
   for(let j=0;j<3;j++){
    const a=triangle[j],b=triangle[(j+1)%3];if(a.y<=planeY)include(a);
    if((a.y<planeY)!==(b.y<planeY))include(a.clone().lerp(b,(planeY-a.y)/(b.y-a.y)));
   }
  }
 }
 return bounds;
}
