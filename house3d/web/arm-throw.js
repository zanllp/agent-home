import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import arm from './throw-arm-profile.json' with {type:'json'};

function cloth(u,v){
 // The seat-side corner is turned back onto the blanket, not a second floating patch.
 const across=1.1,along=.289,a=1/(.22*across),b=1/(.66*along),n=Math.hypot(a,b);
 const inset=Math.max(0,(1-u/.22-v/.66)/n);
 if(inset){u+=2*inset*a/n/across;v+=2*inset*b/n/along}
 const lifted=.014*(1-Math.exp(-inset*110))+.012*Math.sin(inset*22);
 const s=u*(arm[0].length-1),t=v*(arm.length-1),i=Math.min(Math.floor(s),arm[0].length-2),j=Math.min(Math.floor(t),arm.length-2);
 const xyz=arm[j][i].map((a,k)=>T.MathUtils.lerp(
  T.MathUtils.lerp(a,arm[j][i+1][k],s-i),T.MathUtils.lerp(arm[j+1][i][k],arm[j+1][i+1][k],s-i),t-j)/1000);
 const turn=Math.PI/2*T.MathUtils.clamp((u-.5)*4,0,1);
 // The seat carries the blanket; gravity draws the outer portion into longer, fuller pleats.
 const ridge=(.5+.5*Math.cos(v*21+u*2.2+.72*Math.sin(v*8+u*3)))**1.8;
 const slack=.007+(.012+.026*u)*ridge+.021*Math.exp(-((u-.19-.12*v)**2)/.006)*Math.sin(Math.PI*v);
 const phi=.80*v**3;return new T.Vector3(xyz[0]+Math.sin(turn)*Math.cos(phi)*slack,xyz[1]+Math.cos(turn)*slack+lifted,xyz[2]+Math.sin(turn)*Math.sin(phi)*slack);
}
export function createArmThrow(){
 const root=new T.Group(),weave=new T.MeshStandardMaterial({color:'#8799ad',roughness:.99,side:T.DoubleSide});
 const binding=new T.MeshStandardMaterial({color:'#b9c4ce',roughness:1}),cotton=new T.MeshStandardMaterial({color:'#ded9c8',roughness:.97});
 const geo=new T.PlaneGeometry(1,1,84,42),p=geo.attributes.position,uv=geo.attributes.uv;
 for(let i=0;i<p.count;i++){const q=cloth(uv.getX(i),uv.getY(i));p.setXYZ(i,q.x,q.y,q.z)}
 geo.computeVertexNormals();
 const sheet=new T.Mesh(geo,weave);sheet.name='Wool_drape';root.add(sheet);
 const tube=(points,r,steps)=>new T.TubeGeometry(new T.CatmullRomCurve3(points),steps,r,5,false);
 const seams=[0,1].map(v=>tube(Array.from({length:45},(_,i)=>cloth(i/44,v)),.0026,66));
 const hem=Array.from({length:43},(_,i)=>cloth(1,i/42));seams.push(tube(hem,.0035,55));
 function merge(parts,name,material){const m=new T.Mesh(mergeGeometries(parts),material);parts.forEach(g=>g.dispose());m.name=name;root.add(m)}
 merge(seams,'Rolled wool edges',binding);
 const fringe=[];
 for(let i=0;i<26;i++){
  const v=(i+.5)/26,o=cloth(1,v),k=o.clone().add(new T.Vector3(.002,-.009,.002*Math.sin(5*i)));
  fringe.push(tube([o,o.clone().lerp(k,.5).add(new T.Vector3(.001,0,0)),k],.0032,5));
  for(let j=-1;j<=1;j++){
   const len=.038+.005*Math.cos(i*1.61+j*.52);
   const end=k.clone().add(new T.Vector3(.002*Math.sin(i*2+j),-len,.0028*j+.0028*Math.sin(i)));
   fringe.push(tube([k,k.clone().lerp(end,.5).add(new T.Vector3(.002,.001,.001*j)),end],.00135,5));
  }
 }
 merge(fringe,'Knotted cotton tassels',cotton);
 root.traverse(m=>{if(m.isMesh)m.castShadow=m.receiveShadow=true});
 const b=new T.Box3().setFromObject(root,true),c=b.getCenter(new T.Vector3()),size=b.getSize(new T.Vector3());
 root.userData.armFit={x:c.x,z:c.z,bottom:b.min.y,size:size.toArray()};
 for(const mesh of root.children)mesh.position.set(-c.x,-b.min.y,-c.z);
 return root;
}
