import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {geometryOnly} from './helpers/geometry-only.mjs';
import {prepareBedding,poseBedding} from '../house3d/web/nap-quilt.js';

const catalog=JSON.parse(readFileSync('house3d/furniture-assets.json'));
for(const [id,name] of [['whale-bed-v1','Sleep-quilt'],['apartment-bed-v1','Channel-quilt']]){
 test(id+' has one reversible quilt, independently controlled per placed bed',async()=>{
  const {scene}=await geometryOnly('furniture/'+id);
  const quilt=scene.getObjectByName(name),geo=quilt.geometry;
  prepareBedding(scene,catalog[id]);
  const twin=scene.clone(true).getObjectByName(name);
  assert.equal(quilt.geometry,geo);
  assert.equal(geo.morphAttributes.position.length,4);
  for(const [w,cover,away,weights,vis] of [[1,true,false,[0,1,0],true],[1,false,false,[1,0,0],true],[0,true,true,[0,0,0],false],[0,true,false,[0,0,0],true]]){
   poseBedding(quilt,w,cover,away);assert.deepEqual(quilt.morphTargetInfluences,[...weights,0]);
   assert.equal(quilt.visible,vis);assert.deepEqual(twin.morphTargetInfluences,[0,0,0,0]);
  }
  poseBedding(quilt,1,true,false,1);
  assert.deepEqual(quilt.morphTargetInfluences,[0,0,1,0]);
  poseBedding(quilt,1,true,false,1,true);assert.deepEqual(quilt.morphTargetInfluences,[0,0,1,1]);
  poseBedding(quilt,1,false,false,0,true);assert.deepEqual(quilt.morphTargetInfluences,[1,0,0,0]);
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
