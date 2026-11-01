import {test} from 'node:test';
import assert from 'node:assert/strict';
import {baseHeight} from './web/wander-room.js';
import {createNavigation} from './web/wander-navigation.js';
import {Group} from 'three';
import {createRoomWalls} from './web/room-walls.js';
test('support height uses nested catalog surfaces, not stale world poses',()=>{
 const objects=[{id:'desk',asset_id:'desk'},{id:'tray',asset_id:'tray',on:{id:'desk',surface:'top'}},{id:'cup',asset_id:'cup',on:{id:'tray',surface:'top'}}];
 const assets={desk:{surfaces:{top:{height:.7}}},tray:{surfaces:{top:{height:.05}}},cup:{}};
 assert.equal(baseHeight(objects[1],objects,assets),.7);assert.equal(baseHeight(objects[2],objects,assets),.75);assert.equal(baseHeight({id:'wall',asset_id:'wall'},[],{wall:{elevation:1}}),1);
});
test('support cycles do not crash the preview',()=>{
 const objects=[{id:'a',asset_id:'tray',on:{id:'b',surface:'top'}},{id:'b',asset_id:'tray',on:{id:'a',surface:'top'}}];
 assert.ok(Number.isFinite(baseHeight(objects[0],objects,{tray:{surfaces:{top:{height:.05}}}})));
});
test('table props do not create floor barriers across a wider tabletop height',()=>{
 const nav=createNavigation([{id:'desk',kind:'desk',x:-2,z:-1.8,yaw:0},{id:'prop',kind:'prop',x:0,z:0,yaw:0,on:{id:'desk'}}],{desk:{size:[.5,.5]},prop:{size:[1,1]}},{radius:.2});
 assert.equal(nav.free({x:0,z:0}),true);assert.equal(nav.free({x:-2,z:-1.8}),false);
});
test('urban wall finish is reversible and does not hide the main wall',async()=>{
 const parent=new Group(),walls=createRoomWalls(parent);await walls.setFinish({style:'classic'});const back=parent.getObjectByName('wall-back');const count=()=>back.children.filter(c=>c.visible).length;const classic=count();await walls.setFinish({style:'urban'});assert.ok(count()<classic);assert.ok(back.children[0].visible);await walls.setFinish({style:'classic'});assert.equal(count(),classic);walls.dispose();
});
