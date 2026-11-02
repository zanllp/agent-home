import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DirectionalLight,Vector3,Group,Mesh,BoxGeometry,MeshStandardMaterial} from 'three';
import {spaceBounds} from './shared/space.mjs';
import {contactBounds} from './web/contact-shadows.js';
import {interiorRadiance,fitSunShadow} from './web/interior-lighting.js';
import {windowSunPose} from './web/room-lighting.js';
import {createRoomWalls} from './web/room-walls.js';
import {useFurnitureLighting,furnitureSurface} from './web/furniture-material.js';

test('indoor radiance has a localized bright window rather than uniform ambient',()=>{
 const t=interiorRadiance(64,32),d=t.image.data;
 assert.ok(d.every(Number.isFinite));const r=x=>d[(18*64+x)*4];assert.ok(r(62)>r(32)*4);t.dispose();
});
test('room and balcony corners fit the directional shadow projection',()=>{
 for(const wall of ['back','left']){
  const room={width:8,depth:6.5,height:2.8,balcony:{wall,center:0,width:4,depth:1.5}};
  const b=spaceBounds(room),foot=contactBounds(room),s=new DirectionalLight(),camera=s.shadow.camera;
  const pose=windowSunPose([{asset_id:'w',x:wall==='left'?-4:0,z:wall==='back'?-3.25:0,yaw:wall==='left'?Math.PI/2:0}],{w:{wall_opening:{}}});
  s.position.set(...pose.position);s.target.position.set(...pose.target);fitSunShadow(s,room);
  for(const x of [b.minX,b.maxX])for(const z of [b.minZ,b.maxZ])for(const y of [0,room.height]){
   assert.ok(new Vector3(x,y,z).project(camera).toArray().every(n=>Math.abs(n)<=1));
   assert.ok(Math.abs(x-foot.x)<foot.width/2&&Math.abs(z-foot.z)<foot.depth/2);
  }
 }
});
test('a cutaway window room blocks overhead sun without rendering a visible ceiling',()=>{
 const group=new Group(),walls=createRoomWalls(group),lid=group.getObjectByName('ceiling-shadow');
 walls.setOpenings([],{});assert.equal(lid.visible,false);
 walls.setOpenings([{asset_id:'w',x:0,z:-2.5,yaw:0}],{w:{wall_opening:{width:2,height:2,bottom:.1}}});
 walls.updateView({x:0,z:5});assert.ok(lid.visible&&lid.castShadow);assert.equal(lid.material.colorWrite,false);assert.equal(lid.material.depthWrite,false);walls.dispose();
});
test('furniture keeps its paint without self illumination; only cloth gets a weave',()=>{
 const root=new Group(),mesh=new Mesh(new BoxGeometry(),new MeshStandardMaterial({color:'#bba988'}));root.add(mesh);useFurnitureLighting(root,{kind:'sofa'});
 assert.equal(mesh.material.color.getHex(),0xbba988);assert.equal(mesh.material.emissive.getHex(),0);assert.ok(mesh.material.bumpMap);
 assert.equal(furnitureSurface({kind:'chair'},'brushed steel bracket'),'metal');assert.equal(furnitureSurface({kind:'washer'}),'coated');assert.equal(furnitureSurface({kind:'desk'}),'timber');
 mesh.material.bumpMap.dispose();mesh.geometry.dispose();mesh.material.dispose();
});
