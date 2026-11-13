import test from 'node:test';
import assert from 'node:assert/strict';
import {HouseApp,loadContext} from '../runtime/test-app.mjs';
import {contactFrame,createObjectInteraction} from '../house3d/web/object-interaction.js';
import {sofaRest} from '../house3d/web/sofa-rest.js';
import {Group} from 'three';
const ctx=loadContext('house3d');
const req=(app,path,data)=>app.handle({method:data?'POST':'GET',url:path,headers:{host:'localhost'},body:data});
const send=(app,tool,args)=>req(app,'/api/commands',{id:crypto.randomUUID(),expected_revision:app.store.state().revision,tool,arguments:args});
test('sofas expose sit, lie, sleep; office chair sit; resting changes stay on the same support',()=>{
 const app=new HouseApp(ctx,':memory:','house3d','runtime/web');
 try{
  send(app,'apply_preset',{preset_id:'connected-home',dry_run:false});
  const objects=req(app,'/api/objects').body.objects;
  for(const id of ['sofa','childroom-sofa'])assert.deepEqual(objects.find(o=>o.id===id).actions.map(a=>a.id),['sit','lie','sleep']);
  assert.deepEqual(objects.find(o=>o.id==='parent-chair').actions.map(a=>a.id),['sit']);
  const state=app.store.state();
  state.interaction={id:'sitting',target_id:'sofa',pose:'sit',action:'sit',phase:'active',approach_index:4};
  app.store.save(state);
  assert.equal(send(app,'interact',{target_id:'parent-chair',action:'sit'}).status,400);
  const lying=send(app,'interact',{target_id:'sofa',action:'lie'});
  assert.equal(lying.status,200);
  let job=lying.body.state.interaction;
  assert.equal(job.from_pose,'sit');assert.equal(job.approach_index,4);
  assert.equal(lying.body.state.objects.find(o=>o.id==='sofa').properties.covered,false);
  req(app,'/api/viewer',{session_id:'rest-test',visible:true,paused:false,job_id:job.id,body:{x:0,z:0,y:0,yaw:0,pose:'stand',moving:false}});
  assert.equal(req(app,'/api/interactions/'+job.id+'/progress',{viewer_session:'rest-test',phase:'entering',approach_index:4}).status,200);
  assert.equal(req(app,'/api/interactions/'+job.id+'/progress',{viewer_session:'rest-test',phase:'active',approach_index:4}).status,200);
  req(app,'/api/viewer',{session_id:'rest-test',visible:true,paused:false,job_id:job.id,body:{x:0,z:0,y:.4,yaw:0,pose:'lie',moving:false}});
  const o=req(app,'/api/observe').body;assert.equal(o.sight.status,'open');assert.equal(o.touch[0].kind,'lying_support');assert.match(o.touch[0].description,/沙发/);
  assert.equal(send(app,'interact',{target_id:'sofa',action:'cover'}).status,200);
  assert.equal(send(app,'interact',{target_id:'sofa',action:'uncover'}).status,200);
  const sleep=send(app,'interact',{target_id:'sofa',action:'sleep'});assert.equal(sleep.status,200);
  assert.equal(sleep.body.state.interaction.from_pose,'lie');
  assert.equal(sleep.body.state.objects.find(o=>o.id==='sofa').properties.covered,true);
 }finally{app.close()}
});
test('same-sofa switch has no first-frame teleport and can leave midway',async()=>{
 const asset=ctx.assets['family-wide-lounge-v1'],obj={id:'s',kind:'sofa',asset_id:'family-wide-lounge-v1',x:0,z:0,yaw:0};
 const walker={state:{x:0,z:1.16,yaw:0,route:[]},stop(){},go(){return true}};
 const reports=[],c=createObjectInteraction({context:()=>({objects:[obj],assets:ctx.assets,walker,groundHeight:()=>0}),onStart(){},onExit(){},onStatus(){},report:async(id,b)=>reports.push([id,b.phase])});
 c.consume({id:'sit',target_id:'s',pose:'sit',phase:'active',action:'sit',approach_index:0});
 const before=c.tick(0);
 c.consume({id:'lie',target_id:'s',pose:'lie',phase:'requested',action:'lie',approach_index:0,from_pose:'sit'});
 const start=c.tick(0);for(const k of ['x','y','z','yaw','pitch','sit','sleep'])assert.equal(start[k],before[k]);
 c.tick(1);
 const midway=c.frame;
 c.consume({id:'leave',target_id:'s',pose:'lie',phase:'requested',action:'leave',from_active:true,approach_index:0});
 const leaving=c.tick(0);for(const k of ['x','y','z','yaw','pitch'])assert.equal(leaving[k],midway[k]);
 c.tick(4);await c.flush();assert.ok(reports.some(([id,phase])=>id==='leave'&&phase==='completed'));
 const end=contactFrame('lie',{x:0,y:0,z:1,yaw:0},{x:0,y:.4,z:0,yaw:0},1);
 assert.equal(end.awake,1);assert.equal(end.sleep,1);assert.equal(end.sit,0);
});
test('one sofa blanket replaces the arm throw while covered and restores it on leaving',()=>{
 const group=new Group(),drape=new Group(),soft=new Group();soft.position.set(0,.44,.15);
 const rest=sofaRest(group,ctx.assets['family-wide-lounge-v1'],{properties:{covered:true}},drape,[soft]);
 rest.update(1);
 assert.equal(drape.visible,false);assert.equal(group.getObjectByName('Sofa-blanket').visible,true);
 rest.update(0);assert.equal(drape.visible,true);assert.equal(group.getObjectByName('Sofa-blanket').visible,false);
 assert.equal(soft.position.x,0);assert.equal(soft.position.z,.15);
 rest.dispose();
});

import {Bone,Vector3} from 'three';
import {sofaGlance} from '../house3d/web/sofa-rest.js';
test('TV glance respects the mirrored rig, stays small and restores without accumulating',()=>{
 const normalized=new Group(),model=new Group(),head=new Bone();head.name='mixamorigHead';model.scale.x=-1;model.add(head);normalized.add(model);normalized.updateMatrixWorld(true);
 const gaze=sofaGlance(model,normalized),original=head.quaternion.toArray();
 const localFace=new Vector3(0,0,1).transformDirection(model.matrixWorld.clone().invert());
 gaze.update(1,{x:3,z:0},{x:0,z:0});assert.ok(Math.abs(gaze.yaw-.36)<1e-8);
 model.updateMatrixWorld(true);
 const face=localFace.transformDirection(head.matrixWorld);
 assert.ok(Math.abs(Math.atan2(face.x,face.z)-.36)<1e-8);
 gaze.restore();assert.deepEqual(head.quaternion.toArray(),original);assert.equal(gaze.yaw,undefined);
 gaze.update(0,{x:3,z:0},{x:0,z:0});assert.deepEqual(head.quaternion.toArray(),original);
});
