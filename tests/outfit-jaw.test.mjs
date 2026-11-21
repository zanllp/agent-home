import test from 'node:test';
import assert from 'node:assert/strict';
import {AnimationMixer,Texture,Vector3} from 'three';
import {geometryOnly} from './helpers/geometry-only.mjs';
import {rebindPack,tryOn} from '../house3d/web/outfit-fit.js';

test('both outfit chin seams stay closed through head movement; undressing restores the original',async()=>{
 const {scene,animations}=await geometryOnly('dafeiyu-contact');
 const texture=new Texture();
 scene.traverse(o=>{if(o.isMesh&&o.material.name==='Original base color - unlit')o.material.map=texture});
 const painted=name=>scene.getObjectByName(name).children.find(o=>o.isSkinnedMesh&&o.material.map);
 const head=painted('HeadHair'),chin=painted('Dress'),headOriginal=head.geometry,chinOriginal=chin.geometry;
 const pv=new Vector3(),key=(g,i)=>pv.fromBufferAttribute(g.attributes.position,i).toArray().map(n=>n.toFixed(6)).join(',');
 const mixer=new AnimationMixer(scene),a=new Vector3(),b=new Vector3();
 for(const id of ['moon-tide','snow-letter','sailor-day','school-track','lilac-reader']){
  const {scene:pack}=await geometryOnly('outfits/'+id),worn=tryOn(scene,rebindPack(scene,pack),true);
  const chinPoints=new Map([...new Set(chin.geometry.index.array)].map(i=>[key(chin.geometry,i),i]));
  const pairs=[];
  for(let i=0;i<head.geometry.attributes.position.count;i++){
   const j=chinPoints.get(key(head.geometry,i));if(j!==undefined)pairs.push([i,j]);
  }
  assert.ok(pairs.length>=40);
  for(const name of ['curious','nod','look-around']){
   mixer.stopAllAction();const clip=animations.find(c=>c.name===name);mixer.clipAction(clip).play();
   for(let f=0;f<16;f++){
    mixer.setTime(clip.duration*f/16);scene.updateMatrixWorld(true);
    for(const [i,j] of pairs){
     head.localToWorld(head.getVertexPosition(i,a));chin.localToWorld(chin.getVertexPosition(j,b));
     assert.ok(a.distanceTo(b)<.00001,id+' / '+name+': open jaw seam');
    }
   }
  }
  worn.remove();assert.equal(head.geometry,headOriginal);assert.equal(chin.geometry,chinOriginal);
 }
 texture.dispose();
});
