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
