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
test('low afternoon sun reaches the family rug through the left balcony door',()=>{
 const w={asset_id:'door',x:-3.86,z:-1.25,yaw:Math.PI/2};
 const {position,target}=windowSunPose([w],{door:{wall_opening:{width:3.04}}});
 const ray=new Vector3(...target).sub(new Vector3(...position));
 // Backtrace a point on the play rug to its intersection with the real opening.
 const distance=(w.x+1.55)/ray.x,entry=new Vector3(-1.55,0,1.02).addScaledVector(ray,distance);
 assert.ok(entry.y>0&&entry.y<2.17);assert.ok(Math.abs(entry.z-w.z)<3.04/2);
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

test('floor bounce lies on the window ray, follows relocated glazing and fits a narrow room',async()=>{
 const {floorBouncePose}=await import('./web/room-lighting.js'),hole={width:3.04,height:2.17},room={width:8,depth:6.5};
 for(const window of [{asset_id:'w',x:-3.86,z:-1.25,yaw:Math.PI/2},{asset_id:'w',x:0,z:-3.1,yaw:0}]){
  const {position,target}=windowSunPose([window],{w:{wall_opening:hole}});
  const ray=new Vector3(...target).sub(new Vector3(...position));
  const patch=floorBouncePose(window,hole,room,1.10);
  const floor=new Vector3(window.x,1.10,window.z).addScaledVector(ray,-1.10/ray.y);
  assert.ok(Math.abs(patch.x-floor.x)<1e-6&&Math.abs(patch.z-floor.z)<1e-6);
  const shifted=floorBouncePose({...window,x:9,z:-10},hole,{width:3.2,depth:5},1.10);
  const alongX=window.yaw===0;
  assert.ok(Math.abs(shifted.x)+(alongX?shifted.width:shifted.depth)/2<=1.60001);
  assert.ok(Math.abs(shifted.z)+(alongX?shifted.depth:shifted.width)/2<=2.50001);
 }
});

test('desk and hall surface contacts follow actual supported items, excluding hanging bags',async()=>{
 const {worktopReceivers}=await import('./web/contact-shadows.js');
 const assets={oak:{surfaces:{top:{height:.65,size:[1,.55]}}}};
 const desk={id:'study',kind:'desk',asset_id:'oak'},cab={id:'hall',kind:'sideboard',asset_id:'oak'},
  paper={id:'art',on:{id:'study',surface:'top'}},bag={id:'bag',on:{id:'study',surface:'bag-hook'}};
 assert.deepEqual(worktopReceivers([desk,cab,paper,bag],assets).map(r=>[r.item.id,r.children.map(x=>x.id)]),[['study',['art']]]);
 paper.on.id='hall';assert.deepEqual(worktopReceivers([desk,cab,paper,bag],assets).map(r=>r.item.id),['hall']);
 delete paper.on;assert.deepEqual(worktopReceivers([desk,cab,paper,bag],assets),[]);
});

test('daylight can reach the foreground dining area through the actual wide opening',()=>{
 const w={asset_id:'glass',x:-3.86,z:-1.25,yaw:Math.PI/2},hole={width:3.04,height:2.17};
 const {position,target}=windowSunPose([w],{glass:{wall_opening:hole}}),ray=new Vector3(...target).sub(new Vector3(...position));
 for(const [x,z] of [[1.77,2.69],[2.24,1.8],[-1.55,1.02]]){
  const aperture=new Vector3(x,0,z).addScaledVector(ray,(w.x-x)/ray.x);
  assert.ok(aperture.y>0&&aperture.y<hole.height&&Math.abs(aperture.z-w.z)<hole.width/2);
 }
});

test('urban oak has flush bevelled boards and metre-scale grain without extra meshes or per-frame geometry',async()=>{
 const {oakBoards,createOakFloor}=await import('./web/oak-floor.js'),{Texture}=await import('three');
 for(const [width,depth] of [[4,4],[8,6.5],[12,10]]){
  const g=oakBoards(width,depth),{position:p,normal:n,uv,boardRoughness:gloss}=g.attributes;
  assert.ok(Math.abs(g.boundingBox.min.x+width/2)<1e-6&&Math.abs(g.boundingBox.max.y-depth/2)<1e-6);
  assert.ok(g.boundingBox.min.z>=-.001&&g.boundingBox.max.z===0);
  assert.equal(gloss.count,p.count);assert.ok(new Set(gloss.array).size>12);
  assert.ok(uv.array.every(v=>v>=0&&v<=1));for(let i=0;i<n.count;i++)assert.ok(n.getZ(i)>.5);
  assert.ok(g.index.count/3<15000);g.dispose();
 }
 const map=new Texture(),floor=createOakFloor(map);const room={width:8,depth:6.5,style:'urban'};
 floor.update(room);const geo=floor.mesh.geometry;floor.update(room);assert.equal(geo,floor.mesh.geometry);assert.equal(map.repeat.x,1);
 floor.update({...room,style:'classic'});assert.equal(floor.mesh.geometry.type,'PlaneGeometry');assert.equal(map.repeat.x,8/3);
 floor.update(room);assert.equal(map.repeat.x,1);floor.dispose();
});
