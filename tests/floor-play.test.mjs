import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {Bone,Group} from 'three';
import {HouseApp,loadContext} from '../runtime/test-app.mjs';
import {createFloorToys} from '../house3d/web/floor-toys.js';
import {createFloorPlay} from '../house3d/web/floor-play.js';

test('robot moves from its own rotated toy set to the hands and returns to its original slot',()=>{
 const avatar=new Group(),normalized=new Group(),model=new Group(),toys=createFloorToys();avatar.add(normalized);normalized.add(model);
 for(const [side,x] of [['Left',.1],['Right',-.1]]){const bone=new Bone();bone.name='mixamorig'+side+'HandIndex1';bone.position.set(x,.55,.32);model.add(bone)}
 toys.position.set(-1.5,0,1.2);toys.rotation.y=.61;avatar.position.copy(toys.position);avatar.rotation.y=.61;
 const piece=toys.getObjectByName('Pick-up-robot'),start=piece.position.clone(),pose=createFloorPlay(model,avatar);
 pose.update({play:1},2,toys);assert.ok(piece.position.distanceTo(start)>.1);assert.ok(pose.lookAt);
 pose.restore();pose.update(null,3,null);assert.deepEqual(piece.position,start);assert.equal(normalized.position.y,0);assert.equal(pose.lookAt,null);pose.dispose();
});
test('family kit is discoverable, validates relocation and accepts play only on the right object',()=>{
 const root=resolve('house3d'),a=new HouseApp(loadContext(root),':memory:',root,resolve('runtime/web'));
 const cmd=(tool,args)=>a.handle({method:'POST',url:'/api/commands',headers:{host:'localhost'},body:{id:crypto.randomUUID(),expected_revision:a.store.state().revision,tool,arguments:args}});
 try{
  assert.equal(cmd('apply_preset',{preset_id:'family-home',dry_run:false}).status,200);
  const list=a.handle({method:'GET',url:'/api/objects?capability=play',headers:{host:'localhost'}}).body;assert.deepEqual(list.objects.map(o=>o.id),['floor-workshop']);
  const before=structuredClone(a.store.state()),blocked=cmd('update_layout',{operations:[{op:'update',id:'floor-workshop',x:2.3,z:2}],dry_run:true});
  assert.equal(blocked.body.layout.can_apply,false);assert.deepEqual(a.store.state(),before);
  assert.notEqual(cmd('interact',{target_id:'sofa',action:'play'}).status,200);
  assert.equal(cmd('interact',{target_id:'floor-workshop',action:'play'}).body.state.interaction.phase,'requested');
 }finally{a.close()}
});

test('tidying packs the actual robot and three loose pieces in this tray, preserving the other set', async()=>{
 const {packFloorToys}=await import('../house3d/web/floor-toys.js');
 const source=createFloorToys(),placed=source.clone(true);placed.rotation.y=.7;placed.position.set(2,0,1);
 packFloorToys(placed);
 const tray=placed.getObjectByName('Tray-bottom').parent,robot=placed.getObjectByName('Pick-up-robot');
 assert.equal(robot.parent,tray);assert.equal(robot.userData.packed,true);
 assert.equal(tray.children.filter(o=>o.name.startsWith('Loose-piece')).length,3);
 assert.equal(source.getObjectByName('Pick-up-robot').parent,source);
 const avatar=new Group(),normalized=new Group(),model=new Group();avatar.add(normalized);normalized.add(model);
 const pose=createFloorPlay(model,avatar),at=robot.position.clone();pose.update({play:1},1,placed);
 assert.equal(pose.lookAt,null);assert.deepEqual(robot.position,at);assert.ok(normalized.position.y<0);pose.dispose();
});
test('packing/unpacking a placed kit preserves its pose job and is discoverable',()=>{
 const root=resolve('house3d'),a=new HouseApp(loadContext(root),':memory:',root,resolve('runtime/web'));
 const cmd=(tool,args)=>a.handle({method:'POST',url:'/api/commands',headers:{},body:{id:crypto.randomUUID(),expected_revision:a.store.state().revision,tool,arguments:args}});
 const act=action=>cmd('interact',{target_id:'floor-workshop',action});
 try{
  cmd('apply_preset',{preset_id:'family-home',dry_run:false});
  act('play');assert.equal(act('tidy').status,400);
  const s=a.store.state();s.interaction.phase='active';a.store.save(s);
  const packed=act('tidy');assert.equal(packed.status,200);assert.deepEqual(packed.body.state.interaction,s.interaction);
  const kit=a.handle({method:'GET',url:'/api/objects?capability=unpack',headers:{}}).body.objects[0];
  assert.equal(kit.properties.packed,true);assert.equal(act('tidy').status,400);
  assert.equal(act('unpack').status,200);assert.equal(a.store.state().objects.find(o=>o.id===kit.id).properties.packed,false);
 }finally{a.close()}
});

test('rug kit packs all seven complete parts and keeps both printed pages in place',async()=>{
 const {createRugWorkshop,printAssemblyGuide}=await import('../house3d/web/workshop-kit.js');
 const {packFloorToys}=await import('../house3d/web/floor-toys.js');
 const source=createRugWorkshop(),placed=source.clone(true),tray=placed.getObjectByName('Tray-bottom').parent;
 assert.equal(source.getObjectByName('Seat-cushion'),undefined);
 printAssemblyGuide(placed,{width:1152,height:768});
 const pages=['Diagram-left','Diagram-right'].map(name=>placed.getObjectByName(name));
 assert.deepEqual(pages.map(p=>p.material.map.offset.x),[0,.5]);assert.ok(pages.every(p=>p.material.map.repeat.x===.5));
 packFloorToys(placed);const loose=tray.children.filter(o=>o.name.startsWith('Loose-piece'));
 assert.equal(loose.length,7);assert.equal(new Set(loose.map(o=>o.position.toArray().join(','))).size,7);
 assert.ok(loose.every(o=>o.children.length>=2));assert.ok(pages.every(p=>p.parent.name==='Assembly-booklet'));
 assert.equal(source.getObjectByName('Loose-piece-4').parent,source);
});

test('contact shade belongs to the rug pose only and is cleaned up when she gets up',async()=>{
 const {createPlayContact}=await import('../house3d/web/play-contact.js');
 const avatar=new Group(),bones=new Map();
 for(const k of ['Hips','LeftLeg','RightLeg','LeftFoot','RightFoot']){const bone=new Bone();avatar.add(bone);bones.set(k,bone)}
 avatar.position.set(1,.028,-1);avatar.rotation.y=.48;
 const contact=createPlayContact(avatar,bones),mesh=avatar.getObjectByName('Seated-rug-contact');contact.update(1,.020);
 assert.equal(mesh.visible,true);assert.ok(Math.abs(mesh.position.y+avatar.position.y-.0206)<1e-8);
 contact.update(0);assert.equal(mesh.visible,false);contact.dispose();assert.equal(mesh.parent,null);
});

test('both assembled toys and all loose parts fit the actual rug kit, including when tidied',async()=>{
 const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),{Box3}=await import('three');
 const {readFileSync}=await import('node:fs'),{finishRugKit}=await import('../house3d/web/scout-model.js'),{packFloorToys}=await import('../house3d/web/floor-toys.js');
 const bytes=readFileSync(resolve('house3d/assets/furniture/family-rug-robot-v2.glb'));
 const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 finishRugKit(scene);const placed=scene.clone(true),box=o=>new Box3().setFromObject(o,true);
 const scout=placed.getObjectByName('Standing-scout'),bot=placed.getObjectByName('Pick-up-robot'),tray=placed.getObjectByName('Parts-tray');
 const cat=JSON.parse(readFileSync(resolve('house3d/furniture-assets.json')))['family-rug-robot-v2'];
 const checkBounds=()=>{placed.updateMatrixWorld(true);const b=box(placed);assert.ok(b.max.y<=cat.height&&b.min.y>=-.00001);assert.ok(Math.max(b.max.x,-b.min.x)<=cat.size[0]/2);assert.ok(Math.max(b.max.z,-b.min.z)<=cat.size[1]/2)};
 const parts=Array.from({length:7},(_,i)=>placed.getObjectByName('Loose-piece-'+i));
 checkBounds();for(const other of [bot,tray,...parts])assert.equal(box(scout).intersectsBox(box(other)),false,other.name);
 packFloorToys(placed);checkBounds();assert.equal(scout.parent,tray);assert.equal(bot.parent,tray);
 for(const other of [bot,...parts])assert.equal(box(scout).intersectsBox(box(other)),false,other.name);
 assert.ok(parts.every(p=>p.parent===tray));assert.equal(scene.getObjectByName('Standing-scout').parent,scene);
});

test('agent contact identifies the rug under the seat rather than reporting a nonexistent cushion',()=>{
 const root=resolve('house3d'),a=new HouseApp(loadContext(root),':memory:',root,resolve('runtime/web'),()=>100);
 const cmd=(tool,args)=>a.command({id:crypto.randomUUID(),expected_revision:a.store.state().revision,tool,arguments:args},100);
 try{
  cmd('apply_preset',{preset_id:'family-home',dry_run:false});cmd('interact',{target_id:'floor-workshop',action:'play'});
  const s=a.store.state();s.interaction.phase='active';a.store.save(s);
  const feedback=(x,z)=>{
   const body={session_id:'floor-contact',visible:true,paused:false,job_id:s.interaction.id,body:{x,z,y:.02,yaw:0,pose:'play',moving:false}};
   assert.equal(a.handle({method:'POST',url:'/api/viewer',headers:{},body}).status,200);
   return a.handle({method:'GET',url:'/api/observe',headers:{}}).body;
  };
  const on=feedback(-.64,1.40);assert.equal(on.touch[0].object_id,'rug');assert.match(on.summary,/地毯/);assert.equal(on.hands.holding,'toy_robot');
  // The furniture set can live on bare flooring too: do not mistake its own footprint for a seat.
  const bare={...s,objects:s.objects.filter(o=>o.id!=='rug')};a.store.save(bare);
  const off=feedback(-.64,1.40);assert.deepEqual(off.touch,[]);assert.match(off.summary,/地板/);
  const kit=bare.objects.find(o=>o.id==='floor-workshop');kit.asset_id='floor-robot-kit-v1';a.store.save(bare);
  const cushion=feedback(-.64,1.40);assert.equal(cushion.touch[0].object_id,kit.id);assert.match(cushion.summary,/软垫/);
 }finally{a.close()}
});
