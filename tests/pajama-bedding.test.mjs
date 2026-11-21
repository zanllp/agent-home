import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {applySleepTurn} from '../house3d/web/sleep-turn.js';
import {prepareBedding,poseBedding} from '../house3d/web/nap-quilt.js';

import {geometryOnly} from './helpers/geometry-only.mjs';

const vertices=m=>Array.from({length:m.geometry.attributes.position.count},
 (_,i)=>m.localToWorld(m.getVertexPosition(i,new T.Vector3())));

// A vertical ray against only the quilt triangles in the vertex's X/Z grid cell.
// Exclude the uncovered collar opening; don't count visible hair as clothing.
function quiltRoof(quilt){
 const points=vertices(quilt),index=quilt.geometry.index,cells=new Map(),cell=v=>Math.floor(v*30);
 for(let i=0;i<index.count;i+=3){
  const tri=[0,1,2].map(k=>points[index.getX(i+k)]),xs=tri.map(p=>cell(p.x)),zs=tri.map(p=>cell(p.z));
  for(let x=Math.min(...xs);x<=Math.max(...xs);x++)for(let z=Math.min(...zs);z<=Math.max(...zs);z++){
   const key=x+','+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(tri);
  }
 }
 const ray=new T.Ray(new T.Vector3(),new T.Vector3(0,-1,0)),hit=new T.Vector3();
 return p=>{
  ray.origin.set(p.x,3,p.z);let top=-Infinity;
  for(const tri of cells.get(cell(p.x)+','+cell(p.z))||[])
   if(ray.intersectTriangle(...tri,false,hit))top=Math.max(top,hit.y);
  return top;
 };
}

for(const [bedId,quiltName] of [['whale-bed-v1','Sleep-quilt'],['apartment-bed-v1','Channel-quilt']]){
 for(const outfit of ['moon-tide','snow-letter'])test(bedId+' / '+outfit+': covered outfit clears quilt throughout a sleep turn',async()=>{
  const [{scene:bed},{scene:model,animations},{scene:pack}]=await Promise.all([
   geometryOnly('furniture/'+bedId),geometryOnly('dafeiyu-contact'),geometryOnly('outfits/'+outfit)]);
  const asset=JSON.parse(readFileSync('house3d/furniture-assets.json'))[bedId];
  prepareBedding(bed,asset);bed.updateMatrixWorld(true);
  const quilt=bed.getObjectByName(quiltName),avatar=new T.Group(),norm=new T.Group();
  const bounds=new T.Box3().setFromObject(model),center=bounds.getCenter(new T.Vector3());
  norm.scale.setScalar(1.3/bounds.getSize(new T.Vector3()).y);
  model.position.set(-center.x,-bounds.min.y,-center.z);norm.add(model);avatar.add(norm);
  const legs=model.getObjectByName('Legs'),cloth=pack.getObjectByProperty('isSkinnedMesh',true);
  if(cloth.morphTargetDictionary?.LyingFit!==undefined)cloth.morphTargetInfluences[cloth.morphTargetDictionary.LyingFit]=1;
  cloth.bind(legs.skeleton,legs.bindMatrix);legs.parent.add(cloth);
  const mixer=new T.AnimationMixer(model),clip=mixer.clipAction(animations.find(c=>c.name==='sleep-pose')).play();
  clip.time=.5;mixer.update(0);
  avatar.rotation.set(-Math.PI/2+.125,0,0,'YXZ');
  avatar.position.fromArray(asset.interactions.sleep.root);avatar.position.y+=.0015; // peak breath
  for(const side of [0,.25,.5,.75,1]){
   applySleepTurn(norm,side);avatar.updateMatrixWorld(true);
   poseBedding(quilt,1,true,false,side,true);
   const roof=quiltRoof(quilt);let count=0,min=Infinity;
   for(const p of vertices(cloth)){
    const top=roof(p);if(!Number.isFinite(top))continue;
    count++;min=Math.min(min,top-p.y);
   }
   assert.ok(count>cloth.geometry.attributes.position.count*.90,'must actually cover the garment');
   assert.ok(min>.004,`side=${side}, minimum vertical clearance ${min} m`);
  }
 });
}
