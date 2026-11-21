import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(new URL(p,import.meta.url));
const catalog=JSON.parse(read('./manifest.json')),hash=b=>createHash('sha256').update(b).digest('hex');
function glb(raw){
 assert.equal(raw.toString('ascii',0,4),'glTF');assert.equal(raw.readUInt32LE(8),raw.length);
 const len=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+len));
 return {doc,accessor(i){const a=doc.accessors[i],v=doc.bufferViews[a.bufferView],size={SCALAR:1,VEC3:3,VEC4:4,MAT4:16}[a.type],off=28+len+(v.byteOffset||0)+(a.byteOffset||0);
 const Type={5121:Uint8Array,5123:Uint16Array,5126:Float32Array}[a.componentType];
 return new Type(raw.buffer,raw.byteOffset+off,a.count*size)}};
}
const base=read('../../house3d/assets/dafeiyu-contact.glb');assert.equal(hash(base),catalog.base_sha256);
const rig=glb(base),skin=rig.doc.skins[0],names=skin.joints.map(i=>rig.doc.nodes[i].name.replace(':','')),inverses=rig.accessor(skin.inverseBindMatrices);
for(const {file,sha256,id} of catalog.outfits){
 const bytes=read(file);assert.equal(hash(bytes),sha256);const {doc,accessor}=glb(bytes),s=doc.skins[0];
 assert.equal(doc.skins.length,1);assert.equal(doc.meshes.length,1);assert.equal(doc.animations?.length||0,0);assert.deepEqual(s.joints.map(i=>doc.nodes[i].name),names);
 const bind=accessor(s.inverseBindMatrices);assert.ok(bind.every((v,i)=>Math.abs(v-inverses[i])<1e-5));
 const mesh=doc.meshes[0];assert.ok(mesh.extras.targetNames.includes('SeatedFit'));
 assert.ok(doc.materials.every(m=>m.extensions?.KHR_materials_unlit));assert.ok(doc.images.every(i=>Number.isInteger(i.bufferView)));
 for(const p of mesh.primitives){
  const weights=accessor(p.attributes.WEIGHTS_0),joints=accessor(p.attributes.JOINTS_0);
  assert.ok(joints.every(i=>i<names.length));for(let k=0;k<weights.length;k+=4)assert.ok(Math.abs(weights[k]+weights[k+1]+weights[k+2]+weights[k+3]-1)<1e-5);
 }
 console.log(id,bytes.length+' bytes',names.length+' matching joints');
}
