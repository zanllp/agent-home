import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

function box(parent,name,size,position,material,radius=.006){
 const mesh=new T.Mesh(new RoundedBoxGeometry(...size,2,Math.min(radius,Math.min(...size)/3)),material);mesh.name=name;mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function tube(parent,name,points,radius,material){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));const mesh=new T.Mesh(new T.TubeGeometry(curve,Math.max(8,points.length*2),radius,6,false),material);mesh.name=name;mesh.castShadow=true;parent.add(mesh);return mesh}
function clothPoint(u,t,x0,width,bottom,height,{folds,depth,z,side}){
 const hanging=1-t;
 // Pleats are pinched at the carrier. Lower down the same pleats fan out, bow and settle unevenly.
 const fan=1+.18*hanging,mid=Math.sin(Math.PI*t);
 const drift=side*(.026*mid+.013*hanging*hanging)+.012*mid*Math.sin(5*u+side);
 const warp=.044*Math.sin(5.3*u+1.4*t+side)*hanging+.026*mid*Math.sin(6*u-1.6*t);
 const phase=(u+warp)*Math.PI*2*folds+side*.52,fold=Math.cos(phase);
 const belly=depth*(.70+.30*hanging)*(fold+.18*Math.cos(2*phase+.6))*(1+.15*Math.sin(8*u+t));
 const dip=.015*(1-fold)*Math.exp(-13*hanging);
 return [x0+width*(.5+(u-.5)*fan)+drift,bottom+height*t-dip+.018*hanging*hanging*(.52+.48*fold),z+belly+.018*mid+.012*hanging*hanging];
}
function curtain(parent,name,x0,width,bottom,height,material,options){
 const geometry=new T.PlaneGeometry(1,1,72,36),p=geometry.attributes.position;
 for(let i=0;i<p.count;i++)p.setXYZ(i,...clothPoint(p.getX(i)+.5,p.getY(i)+.5,x0,width,bottom,height,options));
 geometry.computeVertexNormals();
 if(name==='Sheer-curtain'){
  // Denser yarn at a fold or at the doubled selvage, without painting the view onto the fabric.
  const colors=new Float32Array(p.count*4),normal=geometry.attributes.normal,uv=geometry.attributes.uv;
  for(let i=0;i<p.count;i++){
   const u=uv.getX(i),t=uv.getY(i),edge=Math.min(u,1-u)*width<.010||t<.03||t>.978;
   colors.set([1,1,1,edge?.73:.23+.45*(1-Math.abs(normal.getZ(i)))],i*4);
  }
  geometry.setAttribute('color',new T.BufferAttribute(colors,4));
 }
 const mesh=new T.Mesh(geometry,material);mesh.name=name;mesh.castShadow=name!=='Sheer-curtain';mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function curtainLinen(){
 const size=128,pixels=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const warp=(x%3===0?4:-1)+(y%4===0?3:-1)+Math.sin(x*17.7+y*13.1)*1.7;
  pixels.set([137+warp,151+warp,170+warp,255],(y*size+x)*4);
 }
 const map=new T.DataTexture(pixels,size,size);map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(2.5,10);
 map.colorSpace=T.SRGBColorSpace;map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;map.generateMipmaps=true;map.anisotropy=4;map.needsUpdate=true;
 return new T.MeshStandardMaterial({map,roughness:.98,side:T.DoubleSide});
}
export function createWindowDetail(original,{walkable=false,open=true,openingWidth=2.42}={}){
 const root=new T.Group();root.name='Detailed-window-balcony';root.userData.runtimeDetail=true;
 const oldView=original.getObjectByName('WindowView-city');original.traverse(o=>{if(o.isMesh)o.visible=false});if(oldView)oldView.visible=!walkable;
 const frame=new T.MeshStandardMaterial({color:'#647171',roughness:.34,metalness:.45}),seal=new T.MeshStandardMaterial({color:'#3c4747',roughness:.8}),white=new T.MeshStandardMaterial({color:'#eee9dc',roughness:.6}),oak=new T.MeshStandardMaterial({color:'#c8ae89',roughness:.65});
 const linen=curtainLinen();
 const sheer=new T.MeshStandardMaterial({color:'#fff7e5',roughness:1,vertexColors:true,transparent:true,opacity:.87,depthWrite:false,side:T.DoubleSide});
 // Reveal, inset seal, separate sliding leaves and sill are actual geometry, not painted borders.
 const wing=Math.max(0,(openingWidth-2.42)/2),outer=1.23+wing;
 for(const x of [-outer,outer]){box(root,'Window-reveal',[.07,2.25,.20],[x,1.11,-.025],white,.008);box(root,'Window-outer-jamb',[.035,2.22,.115],[x,1.11,-.012],frame,.004);box(root,'Window-rubber-seal',[.009,2.15,.018],[x-Math.sign(x)*.023,1.11,.038],seal,.002)}
 for(const y of [.008,2.218]){box(root,'Window-outer-header',[2.49+2*wing,.045,.13],[0,y,-.01],frame,.004);for(const z of [-.058,-.014,.028])box(root,'Sliding-track-ridge',[2.43+2*wing,.009,.006],[0,y+.024,z],frame,.001)}
 box(root,'Window-sill',[2.59+2*wing,.028,.26],[0,.015,.045],oak,.01);
 const glass=new T.MeshPhysicalMaterial({color:'#e0ece7',transparent:true,opacity:.045,roughness:.065,metalness:.02,clearcoat:.8,clearcoatRoughness:.07,side:T.FrontSide,depthWrite:false});
 if(wing>.001)for(const sign of [-1,1]){
  const cx=sign*(1.20+wing/2);
  const fixed=box(root,'Fixed-glass-sidelight',[wing,2.12,.009],[cx,1.11,-.02],glass,.002);fixed.castShadow=false;
  for(const y of [.08,1.08,2.15])box(root,'Sidelight-transom',[wing,.025,.038],[cx,y,-.01],frame,.003);
  box(root,'Fixed-jamb',[.035,2.15,.070],[sign*1.205,1.11,-.016],frame,.004);
 }
 const leaves=walkable?[-.8,0,.8]:[-.605,.605];
 for(const [index,closedX] of leaves.entries()){
  const width=walkable?.8:1.2,cx=walkable&&open?-.8:closedX,z=-.015-index*.04;
  for(const x of [cx-width/2+.01,cx+width/2-.01])box(root,'Sliding-leaf-stile',[.022,2.14,.036],[x,1.11,z],frame,.003);
  for(const y of [.05,2.17])box(root,'Sliding-leaf-rail',[width,.022,.036],[cx,y,z],frame,.003);
  const pane=box(root,'Real-window-glass',[width-.035,2.08,.008],[cx,1.11,z],glass,.001);pane.castShadow=false;pane.renderOrder=20;
  const x=cx+width/2-.065;box(root,'Handle-escutcheon',[.026,.19,.018],[x,1.06,z+.03],frame,.005);box(root,'Handle-grip',[.018,.12,.035],[x,1.06,z+.057],frame,.005);
  for(const y of [.986,1.134]){const screw=new T.Mesh(new T.CylinderGeometry(.004,.004,.002,10),seal);screw.rotation.x=Math.PI/2;screw.position.set(x,y,z+.041);screw.name='Handle-fixing';root.add(screw)}
 }
 const trackLength=2.95+2*wing;
 const ceilingMount=new T.MeshStandardMaterial({color:'#a99b85',roughness:.48,metalness:.23});
 box(root,'Curtain-ceiling-track',[trackLength,.027,.046],[0,2.235,.157],white,.006);
 box(root,'Sheer-inner-track',[trackLength-.065,.022,.024],[0,2.23,.069],ceilingMount,.005);
 const seam=new T.MeshStandardMaterial({color:'#95a3b3',roughness:1});
 const binding=new T.MeshStandardMaterial({color:'#fbf2df',roughness:.96,transparent:true,opacity:.51,depthWrite:false});
 const gliders=new T.InstancedMesh(new T.TorusGeometry(.012,.002,6,14),ceilingMount,18);
 gliders.name='Curtain-gliders';const carrier=new T.Object3D();carrier.rotation.y=Math.PI/2;
 for(const side of [-1,1]){
  const outerX=(side<0?-1.46:1.46)+side*wing;
  const w=.51,x0=side<0?outerX:outerX-w;
  const opts={folds:side<0?4:3.7,depth:wing>0?.070:.050,z:.174,side};
  curtain(root,'Linen-curtain',x0,w,.012,2.19,linen,opts);
  const innerW=.49,innerX=x0-side*.23+(w-innerW)/2;
  const voile={folds:3.2,depth:.021,z:.080,side};
  const gauze=curtain(root,'Sheer-curtain',innerX,innerW,.029,2.175,sheer,voile);
  // Keep translucent fabric in front of distant glazing, including the city stencil.
  gauze.renderOrder=21;
  function across(name,t,start,width,base,height,options,r,material){
   const points=Array.from({length:65},(_,i)=>{const p=clothPoint(i/64,t,start,width,base,height,options);p[2]+=.002;return p});
   return tube(root,name,points,r,material);
  }
  across('Curtain-lower-hem',.022,x0,w,.012,2.19,opts,.0018,seam);
  const lead=Array.from({length:39},(_,i)=>clothPoint(side<0?1:0,i/38,x0,w,.012,2.19,opts));
  tube(root,'Turned linen edge',lead,.0032,seam);
  const sheerHem=across('Voile woven hem',.026,innerX,innerW,.029,2.175,voile,.0024,binding);
  sheerHem.castShadow=false;sheerHem.renderOrder=22;
  for(let i=0;i<9;i++){
   const x=x0+w*(i+.5)/9;
   carrier.position.set(x,2.215,.157);carrier.updateMatrix();
   gliders.setMatrixAt((side<0?0:9)+i,carrier.matrix);
  }
 }
 gliders.instanceMatrix.needsUpdate=true;root.add(gliders);
 root.userData.walkable=walkable;root.userData.open=open;
 return root;
}

export function disposeWindowDetail(root){
 const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)geometries.add(o.geometry);for(const m of [].concat(o.material||[]))materials.add(m)});
 const maps=new Set([...materials].map(m=>m.map).filter(Boolean));maps.forEach(t=>t.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
}
