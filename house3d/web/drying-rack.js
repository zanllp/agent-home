import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
export function createDryingRack(){
 const root=new T.Group();root.name='Freestanding-drying-rack';
 const metal=new T.MeshStandardMaterial({color:'#899792',roughness:.45,metalness:.3,side:T.DoubleSide});
 function bar(a,b,r=.013){const v=new T.Vector3(...b).sub(new T.Vector3(...a)),mesh=new T.Mesh(new T.CylinderGeometry(r,r,v.length(),12),metal);mesh.position.copy(new T.Vector3(...a).add(new T.Vector3(...b)).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());mesh.name='Drying-rack-tube';root.add(mesh)}
 for(const x of [-.46,.46]){bar([x,.045,-.20],[x,1.50,-.08]);bar([x,.045,.20],[x,1.50,.08]);bar([x,1.50,-.08],[x,1.50,.08]);bar([x,.045,-.20],[x,.045,.20])}
 for(const z of [-.08,.08])bar([-.46,1.5,z],[.46,1.5,z]);
 for(const [i,color] of ['#d7b697','#dce3d9','#afc6d0'].entries()){
  const geo=new T.PlaneGeometry(.24,.51-i*.045,18,24),p=geo.attributes.position;
  for(let k=0;k<p.count;k++){const u=(p.getX(k)+.12)/.24;p.setZ(k,.055+Math.cos(u*Math.PI*6)*.014)}geo.computeVertexNormals();
  const material=new T.MeshStandardMaterial({color,roughness:.98,side:T.DoubleSide});const towel=new T.Mesh(geo,material);towel.position.set(-.30+i*.30,1.23+i*.02,0);towel.name='Hanging-towel';root.add(towel);
  const fold=new T.Mesh(new RoundedBoxGeometry(.24,.025,.12,2,.007),material);fold.position.set(-.30+i*.3,1.495,0);root.add(fold);
 }
 root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});return root;
}

// Low balcony rail: the shirt hangs from a hanger; linens fold over the top tube.
export function createFamilyDryingRack(){
 const g=new T.Group();g.name='Family-laundry-rack';
 const mat=(name,color,roughness=.88)=>new T.MeshStandardMaterial({name,color,roughness,side:T.DoubleSide});
 const pipe=mat('Powdercoated metal','#babbb0',.43),shoe=mat('Rubber foot','#777b76'),peg=mat('Maple wood','#c9a57f');
 const put=(name,geo,m)=>{const o=new T.Mesh(geo,m);o.name=name;g.add(o);return o};
 function bar(name,a,b,r,m=pipe){
  const p=new T.Vector3(...a),q=new T.Vector3(...b),o=put(name,new T.CylinderGeometry(r,r,p.distanceTo(q),12),m);o.position.copy(p).lerp(q,.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),q.sub(p).normalize());return o
 }
 const rail=1.18;
 for(const x of [-.455,.455]){
  for(const side of [-1,1]){
   bar('Splayed leg',[x,.027,side*.195],[x,rail,-side*.052],.012);
   bar('Rubber shoe',[x,.019,side*.202],[x,.027,side*.164],.017,shoe)
  }
  bar('End bridge',[x,rail,-.054],[x,rail,.054],.013);
 }
 for(const z of [-.052,.052])bar('Laundry rail',[-.456,rail,z],[.456,rail,z],.012);
 bar('Lower brace',[-.455,.24,-.151],[.455,.24,-.151],.008);
 const cotton=mat('Cotton fabric','#ffffff',.98);cotton.vertexColors=true;
 function panel(name,point,color){
  const geo=new T.PlaneGeometry(1,1,28,50),pos=geo.attributes.position,cols=[];
  for(let i=0;i<pos.count;i++){const u=pos.getX(i)+.5,v=pos.getY(i)+.5;pos.setXYZ(i,...point(u,v));cols.push(...color(u,v).toArray())}
  geo.setAttribute('color',new T.Float32BufferAttribute(cols,3));geo.computeVertexNormals();put(name,geo,cotton);
 }
 function pin(x){
  const o=put('Wooden clothespin',new RoundedBoxGeometry(.013,.057,.014,1,.002),peg);o.position.set(x,rail+.011,.072);o.rotation.z=.11;
  bar('Clothespin spring',[x-.007,rail+.015,.081],[x+.007,rail+.015,.081],.0025,pipe)
 }
 for(const [cx,w,len,base,ink] of [[-.295,.29,.49,'#ead0a5','#d09169'],[.322,.198,.34,'#d5e0d1','#8da8a1']]){
  const body=new T.Color(base),stripe=new T.Color(ink),path=new T.CatmullRomCurve3([[.011,rail-len*.67],[.032,rail-.03],[.052,rail+.015],[.072,rail-.02],[.083,rail-len]].map(([z,y])=>new T.Vector3(z,y,0)));
  panel('Folded cotton towel',(u,v)=>{const p=path.getPoint(v),hang=Math.abs(v-.5)*2;return [cx+(u-.5)*w,p.y+.007*hang*Math.sin(u*7+cx),p.x+.010*hang*Math.sin(u*13+v)]},(u,v)=>v>.82&&v<.86||v>.9&&v<.93?stripe:body);pin(cx-w*.25);
 }
 const hook=[[0,rail-.085,.05],[-.008,rail-.036,.05],[.018,rail-.012,.05],[.012,rail+.016,.05],[-.008,rail+.018,.05],[-.014,rail+.004,.05]];
 for(let i=1;i<hook.length;i++)bar('Hanger hook',hook[i-1],hook[i],.0025,pipe);
 for(const s of [-1,1])bar('Hanger shoulder',[0,rail-.082,.05],[s*.103,rail-.145,.05],.006,peg);
 const blue=new T.Color('#99b6ce'),band=new T.Color('#e3e2d2');
 panel('Small blue cotton shirt',(u,v)=>{const x=(u-.5)*(.22-.014*v),y=.64+v*(.423+.032*Math.sin(Math.abs(u-.5)*Math.PI*2))+.004*Math.sin(u*7)*(1-v);return [x,y,.057+.009*Math.cos(u*13+v)*(.42+.58*(1-v))]},(u,v)=>v>.07&&v<.10?band:blue);
 for(const s of [-1,1])panel('Short shirt sleeve',(u,v)=>[s*(.09+.08*u+.008*v),1.059-.048*u-.076*(1-v),.058+.005*Math.sin(v*3)],(u,v)=>u>.85?band:blue);
 const matCollar=mat('Cotton fabric binding','#e4e1cf');
 const collar=[];for(let i=0;i<=12;i++){const t=i/12;collar.push([-.047+.094*t,1.081-.020*Math.sin(t*Math.PI),.068])}for(let i=1;i<collar.length;i++)bar('Cream collar binding',collar[i-1],collar[i],.004,matCollar);
 return g;
}

// One linen map per cached rail model. Shape and dyed borders remain in the GLB.
export function finishLinenRail(root){
 const fabric=[];root.traverse(o=>{if(o.isMesh&&o.material.vertexColors)fabric.push(o)});
 if(!fabric.length)return;
 const n=64,data=new Uint8Array(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const thread=(x%4===0?-8:0)+(y%4===0?-5:0)+((x+(y>>2)*2)%4===1?4:0);
  const v=249+thread;data.set([v,v,v,255],4*(y*n+x));
 }
 const t=new T.DataTexture(data,n,n);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;
 t.repeat.set(6,8);t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.generateMipmaps=true;t.anisotropy=4;t.needsUpdate=true;
 for(const o of fabric){o.material.map=t;o.material.roughness=.98;o.material.needsUpdate=true}
}
