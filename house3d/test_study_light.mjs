import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Vector3} from 'three';
import {readFileSync} from 'node:fs';
import {createStudyLamp} from './web/desk-models.js';
import {lightStudyDesk} from './web/task-light.js';

test('reading lamp fits its registered footprint; legacy fixture is unchanged',()=>{
 const assets=JSON.parse(readFileSync(new URL('./furniture-assets.json',import.meta.url)));
 const old=createStudyLamp(),tall=createStudyLamp(true);
 assert.ok(old.getObjectByName('Warm-task-light'));assert.equal(tall.getObjectByName('Warm-task-light'),undefined);
 const dims=model=>new Box3().setFromObject(model,true).getSize(new Vector3());
 const size=dims(tall),catalog=assets['family-task-lamp-v1'];assert.ok(size.y>dims(old).y+.1);
 assert.ok(size.x<=catalog.size[0]&&size.z<=catalog.size[1]&&size.y<=catalog.height);
});
test('reading pool follows its own fixture, and switching it off does not affect a second lamp',()=>{
 const master=createStudyLamp(true),a=master.clone(true),b=master.clone(true);
 const cleanA=lightStudyDesk(a,{on:false,brightness:1}),cleanB=lightStudyDesk(b,{on:true,brightness:.5});
 const face=g=>g.getObjectByName('Task-light-diffuser').material;
 assert.equal(face(master).emissiveIntensity,0);assert.notEqual(face(a),face(b));assert.equal(face(a).emissiveIntensity,0);assert.ok(face(b).emissiveIntensity>0);
 for(const name of ['Reading pool','Warm page reflection']){assert.equal(a.getObjectByName(name).visible,false);assert.ok(b.getObjectByName(name).intensity>0)}
 b.rotation.y=Math.PI;b.position.set(1,2,3);const target=b.getObjectByName('Reading pool').target.getWorldPosition(new Vector3());
 assert.ok(target.distanceTo(new Vector3(.75,2.01,3.08))<1e-5);cleanA();cleanB();
});
