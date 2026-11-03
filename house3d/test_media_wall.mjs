import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Box3,Group,Texture} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {finishWallAC} from './web/wall-ac.js';
import {createRoomWalls} from './web/room-walls.js';
import {wallContacts} from './web/wall-contact.js';

const assets=JSON.parse(readFileSync(new URL('./furniture-assets.json',import.meta.url)));
const ac={id:'ac',kind:'air_conditioner',asset_id:'urban-wall-ac-v1',x:-3.845,z:1.65,yaw:Math.PI/2};

test('the original installed AC gains physical blades and a front cover inside its catalog envelope',async()=>{
 const b=readFileSync(new URL('./assets/furniture/urban-wall-ac-v1.glb',import.meta.url));
 // Only the original geometry is needed for bounds; PNGs are checked by the browser render.
 const loader=new GLTFLoader().register(()=>({name:"geometry-test",loadTexture:async()=>new Texture()}));
 const {scene}=await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 finishWallAC(scene);
 for(const name of ['Lift-up enamel cover','Tilted air deflector','Outlet guide vanes','Top return grille','IR receiver lens'])assert.ok(scene.getObjectByName(name)?.isMesh,name);
 assert.equal(scene.getObjectByName('Vent_blade').visible,false);
 const bounds=new Box3().setFromObject(scene,true),a=assets[ac.asset_id];
 assert.ok(bounds.min.y>=-.001&&bounds.max.y<=a.height+.001);
 assert.ok(Math.max(-bounds.min.x,bounds.max.x)<=a.size[0]/2+.001);
 assert.ok(Math.max(-bounds.min.z,bounds.max.z)<=a.size[1]/2+.001);
});
test('wall contacts sit behind the right fixture, move with it, and are cut out at actual openings',async()=>{
 const g=new Group(),walls=createRoomWalls(g,{room:{width:8,depth:6.5,height:2.4}}),side=g.getObjectByName('wall-left');
 const win={id:'w',kind:'window',asset_id:'urban-floor-window-v2',x:ac.x,z:0,yaw:ac.yaw};
 const contact=()=>side.getObjectByName('Wall fixture contact');
 try{
  walls.setOpenings([ac,win],assets);const old=contact(),p=old.geometry.attributes.position;
  const half=assets[win.asset_id].wall_opening.width/2,top=assets[win.asset_id].elevation+assets[win.asset_id].wall_opening.height;
  for(let i=0;i<p.count;i+=4){
   const [x0,x1,y0,y1]=[p.getX(i),p.getX(i+1),p.getY(i),p.getY(i+2)];
   assert.ok(!(x0<half-.0001&&x1>-half+.0001&&y0<top-.0001&&y1>.08),'shadow quad inside glazing');
  }
  await walls.setFinish({style:'urban',wallpapers:{left:'harbor-blue'}});walls.setOpenings([ac,win],assets);assert.equal(contact(),old,'static rooms reuse the shadow');
  let disposed=false;old.material.map.addEventListener('dispose',()=>{disposed=true});
  walls.setOpenings([{...ac,z:2},win],assets);assert.ok(disposed);assert.notEqual(contact(),old);
  walls.setOpenings([win],assets);assert.equal(contact(),undefined);
  assert.equal(wallContacts([win],assets).length,0);
 }finally{walls.dispose()}
});

test('beech clock numerals are stationary and sit between the original dial and its moving hands',async()=>{
 const {finishClockFace}=await import('./web/clock-face.js');
 const b=readFileSync(new URL('./assets/furniture/family-beech-clock-v1.glb',import.meta.url));
 const {scene}=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 const nums=[],ctx=new Proxy({fillText:(v,x,y)=>nums.push([v,x,y])},{get:(o,k)=>o[k]??(()=>{})});
 finishClockFace(scene,()=>({getContext:()=>ctx}));const dial=scene.getObjectByName('Ivory_dial'),print=scene.getObjectByName('Printed minute dial'),hand=scene.getObjectByName('Hour_hand');
 assert.deepEqual(nums.map(n=>n[0]),['12','3','6','9']);assert.ok(nums[0][2]<nums[2][2]);assert.ok(nums[1][1]>nums[3][1]);
 assert.equal(print.parent,dial.parent);assert.ok(print.position.z>dial.position.z+.0025&&print.position.z<hand.position.z);
});
