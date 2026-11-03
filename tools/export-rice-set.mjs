// Authoring step: export only removable food, never overwrite the generated vessels.
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(v=>{this.result=v;this.onloadend?.()})}};
const mat=(color,roughness)=>new T.MeshStandardMaterial({color,roughness,side:T.DoubleSide});
function mesh(p,name,geo,mat){const o=new T.Mesh(geo,mat);o.name=name;p.add(o);return o}
function rice(parent,r,y,depth,count){
 const food=new T.Group();food.name='Steamed-rice';food.position.y=y;parent.add(food);
 const colors=['#fbf9ec','#fffdf6','#eeeada','#fffffb'].map(s=>mat(s,.7));
 const dome=mesh(food,'Rice-mound',new T.SphereGeometry(1,40,18),colors[0]);dome.position.y=-.004;dome.scale.set(r,depth,r);
 const pieces=colors.map(()=>[]);let seed=3919;const rand=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
 const grain=new T.SphereGeometry(1,6,4),transform=new T.Object3D();
 for(let i=0;i<count;i++){
  const a=i*2.39996+rand()*.14,d=r*.975*Math.sqrt((i+.5)/count),x=Math.cos(a)*d,z=Math.sin(a)*d;
  transform.position.set(x,dome.position.y+depth*Math.sqrt(1-(d/r)**2),z);
  transform.rotation.set((rand()-.5)*.6,rand()*Math.PI,rand()*.3);transform.scale.set(.0038+rand()*.002,.0020,.0028);transform.updateMatrix();
  pieces[i%4].push(grain.clone().applyMatrix4(transform.matrix));
 }
 pieces.forEach((gs,i)=>mesh(food,'Rice-grains-'+i,mergeGeometries(gs),colors[i]));
}
const folder=process.argv[2];if(!folder)throw Error('Supply an output folder for the two food layers');
for(const [id,radius,y,depth,count,x,z] of [['cooker',.109,.237,.023,530,-.0065,-.006],['bowl',.067,.070,.018,160,0,0]]){
 const root=new T.Group();rice(root,radius,y,depth,count);root.children[0].position.set(x,y,z);
 const bytes=await new GLTFExporter().parseAsync(root,{binary:true});
 writeFileSync(join(folder,id+'-rice.glb'),new Uint8Array(bytes));
}
