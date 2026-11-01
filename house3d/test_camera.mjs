import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CAMERA_PRESETS,cameraPose,cameraZoom} from './web/camera-presets.js';
test('every listed camera has a finite pose',()=>{for(const [id] of CAMERA_PRESETS){const p=cameraPose(id,{x:1,z:-1,yaw:0});assert.equal(p.position.length,3);assert.ok([...p.position,...p.target].every(Number.isFinite));assert.notDeepEqual(p.position,p.target)}});
test('front camera aligns with positive local Z',()=>{const p=cameraPose('front',{x:1,z:2,yaw:0});assert.equal(p.position[0],1);assert.equal(p.position[2],5.1);assert.deepEqual(p.target,[1,.72,2])});
test('front view follows character turning',()=>{const p=cameraPose('front',{x:1,z:2,yaw:Math.PI/2});assert.ok(Math.abs(p.position[0]-4.1)<1e-8);assert.ok(Math.abs(p.position[2]-2)<1e-8)});
test('side and back are distinct from front',()=>{assert.deepEqual(cameraPose('back',{x:0,z:0,yaw:0}).position,[0,.85,-2.8]);assert.equal(cameraPose('side',{x:0,z:0,yaw:0}).position[2],0)});
test('mobile fits room while retaining readable character closeups',()=>{assert.ok(cameraZoom('home',.7)<cameraZoom('face',.7));assert.equal(cameraZoom('front',1.5),1)});
test('unknown camera rejected',()=>{assert.throws(()=>cameraPose('bad',{}))});
