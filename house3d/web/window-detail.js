import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

function box(parent,name,size,position,material,radius=.006){
 const mesh=new T.Mesh(new RoundedBoxGeometry(...size,2,Math.min(radius,Math.min(...size)/3)),material);mesh.name=name;mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function tube(parent,name,points,radius,material){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));const mesh=new T.Mesh(new T.TubeGeometry(curve,Math.max(8,points.length*2),radius,6,false),material);mesh.name=name;mesh.castShadow=true;parent.add(mesh);return mesh}
function curtain(parent,name,x0,width,bottom,height,material,{folds=5,depth=.055,z=.10}={}){
 const geometry=new T.PlaneGeometry(width,height,56,28),p=geometry.attributes.position;
 for(let i=0;i<p.count;i++){const u=(p.getX(i)+width/2)/width,t=(p.getY(i)+height/2)/height;p.setXYZ(i,x0+width*u+.012*Math.sin(t*Math.PI)*Math.sin(u*Math.PI),bottom+t*height,z+Math.cos(u*Math.PI*2*folds)*depth*(.8+.2*t))}geometry.computeVertexNormals();
 const mesh=new T.Mesh(geometry,material);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
export function createWindowDetail(original,{walkable=false,open=true}={}){
 const root=new T.Group();root.name='Detailed-window-balcony';root.userData.runtimeDetail=true;
 const oldView=original.getObjectByName('WindowView-city');original.traverse(o=>{if(o.isMesh)o.visible=false});if(oldView)oldView.visible=!walkable;
 const frame=new T.MeshStandardMaterial({color:'#647171',roughness:.34,metalness:.45}),seal=new T.MeshStandardMaterial({color:'#3c4747',roughness:.8}),white=new T.MeshStandardMaterial({color:'#eee9dc',roughness:.6}),oak=new T.MeshStandardMaterial({color:'#c8ae89',roughness:.65});
 const linen=new T.MeshStandardMaterial({color:'#a6b7ba',roughness:.98,side:T.DoubleSide});
 const sheer=new T.MeshStandardMaterial({color:'#fff9ec',roughness:1,transparent:true,opacity:.24,depthWrite:false,side:T.DoubleSide});
 // Reveal, inset seal, separate sliding leaves and sill are actual geometry, not painted borders.
 for(const x of [-1.23,1.23]){box(root,'Window-reveal',[.07,2.25,.20],[x,1.11,-.025],white,.008);box(root,'Window-outer-jamb',[.035,2.22,.115],[x,1.11,-.012],frame,.004);box(root,'Window-rubber-seal',[.009,2.15,.018],[x-Math.sign(x)*.023,1.11,.038],seal,.002)}
 for(const y of [.008,2.218]){box(root,'Window-outer-header',[2.49,.045,.13],[0,y,-.01],frame,.004);for(const z of [-.058,-.014,.028])box(root,'Sliding-track-ridge',[2.43,.009,.006],[0,y+.024,z],frame,.001)}
 box(root,'Window-sill',[2.59,.028,.26],[0,.015,.045],oak,.01);
 const glass=new T.MeshPhysicalMaterial({color:'#e0ece7',transparent:true,opacity:.095,roughness:.09,metalness:.04,clearcoat:1,clearcoatRoughness:.08,side:T.DoubleSide,depthWrite:false});
 const leaves=walkable?[-.8,0,.8]:[-.605,.605];
 for(const [index,closedX] of leaves.entries()){
  const width=walkable?.8:1.2,cx=walkable&&open?-.8:closedX,z=-.015-index*.04;
  for(const x of [cx-width/2+.01,cx+width/2-.01])box(root,'Sliding-leaf-stile',[.022,2.14,.036],[x,1.11,z],frame,.003);
  for(const y of [.05,2.17])box(root,'Sliding-leaf-rail',[width,.022,.036],[cx,y,z],frame,.003);
  const pane=box(root,'Real-window-glass',[width-.035,2.08,.008],[cx,1.11,z],glass,.001);pane.castShadow=false;pane.renderOrder=20;
  const x=cx+width/2-.065;box(root,'Handle-escutcheon',[.026,.19,.018],[x,1.06,z+.03],frame,.005);box(root,'Handle-grip',[.018,.12,.035],[x,1.06,z+.057],frame,.005);
  for(const y of [.986,1.134]){const screw=new T.Mesh(new T.CylinderGeometry(.004,.004,.002,10),seal);screw.rotation.x=Math.PI/2;screw.position.set(x,y,z+.041);screw.name='Handle-fixing';root.add(screw)}
 }
 box(root,'Curtain-ceiling-track',[2.95,.035,.07],[0,2.235,.14],white,.008);
 for(const side of [-1,1]){
  const x0=side<0?-1.46:.98;
  curtain(root,'Linen-curtain',x0,.48,.02,2.19,linen,{folds:5,depth:.048,z:.14});
  curtain(root,'Sheer-curtain',side<0?-1.2:.91,.29,.035,2.15,sheer,{folds:3,depth:.018,z:.075});
  const hem=Array.from({length:37},(_,i)=>[x0+.48*i/36,.075,.14+Math.cos(i/36*Math.PI*10)*.048]);tube(root,'Curtain-lower-hem',hem,.003,new T.MeshStandardMaterial({color:'#91a4a7',roughness:1}));
  for(let i=0;i<9;i++){const ring=new T.Mesh(new T.TorusGeometry(.012,.0025,6,18),frame);ring.rotation.y=Math.PI/2;ring.position.set(x0+.025+i*.052,2.212,.14);ring.name='Curtain-glider';root.add(ring)}
 }
 root.userData.walkable=walkable;root.userData.open=open;
 return root;
}

export function disposeWindowDetail(root){
 const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of [].concat(o.material||[]))materials.add(m)});
 geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
}
