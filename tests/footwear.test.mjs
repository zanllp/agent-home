import test from 'node:test';
import assert from 'node:assert/strict';
import {AnimationMixer,Vector3} from 'three';
import {geometryOnly} from './helpers/geometry-only.mjs';

for(const outfit of ['reference','snow-letter','moon-tide','sailor-day','school-track','lilac-reader'])test(outfit+': shoes move independently throughout the run cycle',async()=>{
 const {scene,animations}=await geometryOnly('dafeiyu-contact'),legs=scene.getObjectByName('Legs');
 let mesh=legs;
 if(outfit!=='reference'){
  mesh=(await geometryOnly('outfits/'+outfit)).scene.getObjectByProperty('isSkinnedMesh',true);
  mesh.bind(legs.skeleton,legs.bindMatrix);legs.parent.add(mesh);
 }
 const g=mesh.geometry,{position,skinIndex,skinWeight}=g.attributes,edges=[],used=new Set();
 for(let i=0;i<g.index.count;i+=3){
  const face=[0,1,2].map(k=>g.index.getX(i+k));
  if(face.some(v=>position.getY(v)>=.14))continue;
  const sides=new Set();
  for(const v of face){
   used.add(v);
   for(let k=0;k<4;k++)if(skinWeight.getComponent(v,k)>.0001){
    const bone=mesh.skeleton.bones[skinIndex.getComponent(v,k)].name;
    sides.add(bone.includes('Left')?'left':bone.includes('Right')?'right':bone);
   }
  }
  assert.equal(sides.size,1,'a shoe face follows both feet');
  for(let j=0;j<3;j++){
   const a=face[j],b=face[(j+1)%3];
   edges.push([a,b,new Vector3().fromBufferAttribute(position,a).distanceTo(new Vector3().fromBufferAttribute(position,b))]);
  }
 }
 assert.ok(used.size>100);
 const clip=animations.find(c=>c.name==='little-run'),mixer=new AnimationMixer(scene);
 mixer.clipAction(clip).play();
 const points=new Map([...used].map(v=>[v,new Vector3()]));
 for(let k=0;k<16;k++){
  mixer.setTime(clip.duration*k/16);scene.updateMatrixWorld(true);
  for(const [v,p] of points)mesh.getVertexPosition(v,p);
  for(const [a,b,d] of edges)assert.ok(points.get(a).distanceTo(points.get(b))-d<.012,'shoe edge stretched more than 12 mm');
 }
});

test('pajama toe boxes have one continuous rounded outline on each foot',async()=>{
 const {scene}=await geometryOnly('outfits/moon-tide');
 const g=scene.getObjectByProperty('isSkinnedMesh',true).geometry;
 const p=g.attributes.position, edges=[];
 for(let i=0;i<g.index.count;i+=3){
  const f=[0,1,2].map(k=>g.index.getX(i+k));
  if(f.some(v=>p.getY(v)>.046)||f.every(v=>p.getZ(v)<.117))continue;
  for(let j=0;j<3;j++)edges.push([f[j],f[(j+1)%3]]);
 }
 for(const cx of [-.061,.050]){
  const tip=[];
  for(let mm=-28;mm<=28;mm++){
   const x=cx+mm*.001;let z=-Infinity;
   for(const [a,b] of edges){
    const ax=p.getX(a),bx=p.getX(b);
    if((ax<=x)===(bx<=x))continue;
    z=Math.max(z,p.getZ(a)+(p.getZ(b)-p.getZ(a))*(x-ax)/(bx-ax));
   }
   assert.ok(z>.118,'front of the sock should cover the forefoot');tip.push(z);
  }
  const peak=tip.indexOf(Math.max(...tip));
  for(let i=1;i<tip.length;i++)assert.ok((tip[i]-tip[i-1])*(i<=peak?1:-1)>-.00035,'separate toes create notches in the outline');
 }
});
