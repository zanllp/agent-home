import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {floorLegGeometry,floorBodiceGeometry,roundPosedKnees} from '../house3d/web/floor-fit.js';

// Load the shipped rig and animations. These CPU checks need no image decoder.
const raw=readFileSync(new URL('../house3d/assets/dafeiyu-contact.glb',import.meta.url)),len=raw.readUInt32LE(12);
const doc=JSON.parse(raw.subarray(20,20+len));for(const m of doc.materials)delete m.pbrMetallicRoughness.baseColorTexture;
const json=Buffer.from(JSON.stringify(doc)),pad=(4-json.length%4)%4,header=Buffer.alloc(20),tail=raw.subarray(20+len);
header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(20+json.length+pad+tail.length,8);header.writeUInt32LE(json.length+pad,12);header.writeUInt32LE(0x4e4f534a,16);
const bytes=Buffer.concat([header,json,Buffer.alloc(pad,32),tail]);
const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
test('play knees never span both leg chains and leave the original seated mesh intact',()=>{
 const legs=scene.getObjectByName('Legs'),original=legs.geometry,fit=floorLegGeometry(legs);
 const side=i=>legs.skeleton.bones[fit.attributes.skinIndex.getX(i)].name.includes('Left');
 for(let i=0;i<fit.index.count;i+=3){
  const a=side(fit.index.getX(i));assert.equal(side(fit.index.getX(i+1)),a);assert.equal(side(fit.index.getX(i+2)),a);
 }
 const w=fit.attributes.skinWeight;for(let i=0;i<w.count;i++)assert.ok(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)-1)<1e-5);
 assert.equal(legs.geometry,original);assert.ok(original.morphAttributes.position.length);
 legs.geometry=fit;scene.updateMatrixWorld(true);roundPosedKnees(legs);assert.ok(fit.attributes.position.array.every(Number.isFinite));
 assert.equal(fit.attributes.uv,undefined);assert.equal(fit.attributes.color.count,w.count);legs.geometry=original;fit.dispose();
});
test('chest and matching underarm patches follow the torso, without rebinding the skirt',()=>{
 scene.traverse(o=>{
  if(!o.isSkinnedMesh||!(o.name.includes('TorsoSeam')||o.parent.name==='Dress'))return;
  const src=o.geometry,g=floorBodiceGeometry(o),{position,skinIndex,skinWeight}=g.attributes;
  for(let i=0;i<position.count;i++){
   if(position.getY(i)>=.345){
    assert.ok(o.skeleton.bones[skinIndex.getX(i)].name.endsWith('Hips'));assert.ok(o.skeleton.bones[skinIndex.getY(i)].name.endsWith('Spine2'));assert.equal(skinWeight.getZ(i),0);
   }else for(let k=0;k<4;k++)assert.equal(skinWeight.getComponent(i,k),src.attributes.skinWeight.getComponent(i,k));
  }
  assert.equal(o.geometry,src);g.dispose();
 });
});
