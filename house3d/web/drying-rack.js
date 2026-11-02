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
