import {test} from 'node:test';
import assert from 'node:assert/strict';
import {changedControls,LIGHTING} from './web/wander-state.js';
const state=()=>({revision:0,camera:'home',light:'day',note:'hello',character:{x:0,z:.5,yaw:0,activity:'idle'},objects:[]});
test('old saved preview poses do not unexpectedly replace local Canvas controls on startup',()=>assert.deepEqual(changedControls(null,state()),['light']));
test('same-value command revision applies again after local manual changes',()=>{
 const a={...state(),control_revisions:{camera:1,activity:2}},b={...a,revision:3,control_revisions:{camera:3,activity:2}};
 assert.deepEqual(changedControls(a,b),['camera']);
});
test('furniture changes do not reset camera, pause or local activity choices',()=>{
 const a=state(),b={...a,revision:1,objects:[{id:'chair'}]};assert.deepEqual(changedControls(a,b),[]);
});
test('position and activity are separate controls',()=>{
 const a=state(),b={...a,character:{...a.character,activity:'walk'},control_revisions:{activity:1}};assert.deepEqual(changedControls(a,b),['activity']);
 const c={...b,character:{...b.character,x:.5},control_revisions:{...b.control_revisions,position:2}};assert.deepEqual(changedControls(b,c),['position']);
});
test('saved explicit controls reapply on reload and lighting tint is reversible',()=>{
 const s={...state(),control_revisions:{camera:1,activity:2,note:3}};assert.deepEqual(changedControls(null,s),['camera','light','note','activity']);
 assert.equal(LIGHTING.day.opacity,0);assert.ok(LIGHTING.night.opacity>.2&&LIGHTING.night.opacity<.6);assert.ok(LIGHTING.evening.opacity<LIGHTING.night.opacity);
});
