import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Box3,Group} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {finishEntryDoor,finishEntryLanding} from './web/entry-finish.js';
import {createRoomWalls} from './web/room-walls.js';

const assets=JSON.parse(readFileSync(new URL('./furniture-assets.json',import.meta.url)));
const door={id:'d',asset_id:'family-entry-door-v1',x:3.38,z:-3.12,yaw:0};

test('foyer finishes stay inside the actual GLB placement envelopes',async()=>{
 for(const id of ['family-entry-door-v1','family-entry-landing-v1']){
  const b=readFileSync(new URL('./assets/furniture/'+id+'.glb',import.meta.url));
  const {scene}=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
  if(id===door.asset_id){
   const labels=[];finishEntryDoor(scene,()=>({getContext:()=>({beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(s){labels.push(s)}})}));
   assert.equal(labels.length,3);assert.equal(scene.getObjectByName('Lever').visible,false);assert.ok(scene.getObjectByName('Inside lever')?.isMesh);
  }else{
   finishEntryLanding(scene);const m=scene.getObjectByName('Bound inset doormat');
   assert.ok(m.position.z<0&&m.position.y>=assets[id].surfaces.top.height&&m.position.y<=assets[id].height);
  }
  const box=new Box3().setFromObject(scene,true),a=assets[id];
  for(const [axis,lim] of [['x',a.size[0]/2],['z',a.size[1]/2]])assert.ok(Math.max(-box.min[axis],box.max[axis])<=lim+.001);
  assert.ok(box.min.y>=-.001&&box.max.y<=a.height+.001);
 }
});

test('latch-side rocker follows a moved door, respects other wall objects and disappears with the door',()=>{
 const room=new Group(),shell=createRoomWalls(room,{room:{width:8,depth:6.5,height:2.4}});
 const plate=()=>room.getObjectByName('Entry rocker plate');
 try{
  shell.setOpenings([door],assets);const p=plate();assert.equal(p.parent.name,'wall-back');assert.ok(p.position.x<door.x-.505);
  shell.setOpenings([door],assets);assert.equal(plate(),p);
  shell.setOpenings([door,{id:'w',asset_id:'urban-floor-window-v2',x:p.position.x,z:door.z,yaw:0}],assets);assert.equal(plate(),undefined);
  shell.setOpenings([{...door,x:-3.41}],assets);assert.equal(plate(),undefined);
  shell.setOpenings([{...door,x:-3.92,z:-1,yaw:Math.PI/2}],assets);assert.equal(plate().parent.name,'wall-left');assert.ok(plate().position.x<1);
  shell.setOpenings([],assets);assert.equal(plate(),undefined);
 }finally{shell.dispose()}
});
