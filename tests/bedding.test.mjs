import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {prepareBedding,poseBedding} from '../house3d/web/nap-quilt.js';

const catalog=JSON.parse(readFileSync('house3d/furniture-assets.json'));
for(const [id,name] of [['whale-bed-v1','Sleep-quilt'],['apartment-bed-v1','Channel-quilt']]){
 test(id+' has one reversible quilt, independently controlled per placed bed',async()=>{
  const raw=readFileSync('house3d/assets/furniture/'+id+'.glb'),n=raw.readUInt32LE(12);
  const doc=JSON.parse(raw.subarray(20,20+n));
  for(const m of doc.materials)delete m.pbrMetallicRoughness.baseColorTexture;
  const json=Buffer.from(JSON.stringify(doc)),pad=(4-json.length%4)%4;
  const buf=Buffer.concat([raw.subarray(0,20),json,Buffer.alloc(pad,32),raw.subarray(20+n)]);
  buf.writeUInt32LE(buf.length,8);buf.writeUInt32LE(json.length+pad,12);
  const {scene}=await new GLTFLoader().parseAsync(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.length),'');
  const quilt=scene.getObjectByName(name),geo=quilt.geometry;
  prepareBedding(scene,catalog[id]);
  const twin=scene.clone(true).getObjectByName(name);
  assert.equal(quilt.geometry,geo);
  assert.equal(geo.morphAttributes.position.length,3);
  for(const [w,cover,away,weights,vis] of [[1,true,false,[0,1,0],true],[1,false,false,[1,0,0],true],[0,true,true,[0,0,0],false],[0,true,false,[0,0,0],true]]){
   poseBedding(quilt,w,cover,away);assert.deepEqual(quilt.morphTargetInfluences,weights);
   assert.equal(quilt.visible,vis);assert.deepEqual(twin.morphTargetInfluences,[0,0,0]);
  }
  poseBedding(quilt,1,true,false,1);
  assert.deepEqual(quilt.morphTargetInfluences,[0,0,1]);
 });
}

import {sleepTurnClock} from '../house3d/web/sleep-turn.js';
test('sleep holds, rolls smoothly, freezes when paused and resets on a new nap',()=>{
 const clock=sleepTurnClock(()=>0),job={jobId:'nap',phase:'active',pose:'sleep'};
 const at=(ms,paused=false)=>clock.sample(ms,job,paused);
 assert.equal(at(0),0);assert.equal(at(15000),0);assert.equal(at(16600),.5);
 assert.equal(at(16610,true),.5);assert.equal(at(90000),.5);
 assert.equal(at(91600),1);assert.equal(at(123600),1);assert.equal(at(126800),0);
 job.jobId='new';assert.equal(at(200000),0);assert.equal(at(218200),1);
 job.phase='leaving';assert.equal(at(220000),1);
 job.phase='none';assert.equal(at(220200),0);
});
