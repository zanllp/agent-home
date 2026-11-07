import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createNavigation} from '../house3d/shared/navigation.mjs';
import {planObjectDestination} from '../house3d/shared/object-destination.mjs';
import {createWalker} from '../house3d/web/wander-navigation.js';
import {HouseApp,loadContext} from '../runtime/test-app.mjs';
const assets=JSON.parse(readFileSync('house3d/furniture-assets.json'));
const presets=JSON.parse(readFileSync('house3d/room-presets.json'));
const catalog=JSON.parse(readFileSync('house3d/server-data.json')).catalog;
const ctx=loadContext('house3d');
const request=(app,url,body)=>app.handle({method:body?'POST':'GET',url,headers:{host:'localhost'},body});
const command=(app,args,id='walk')=>request(app,'/api/commands',{id,expected_revision:app.store.state().revision,tool:'walk_to',arguments:args});
const pulse=(app,body,job_id=null)=>request(app,'/api/viewer',{session_id:'test-body',visible:true,body:{y:0,yaw:0,pose:'stand',moving:false,...body},job_id});

test('real family objects resolve to safe endpoints and one walker traverses the whole route',()=>{
 const p=presets['family-home'],nav=createNavigation(p.objects,catalog,{assets,room:p.room});
 for(const id of ['child-desk','child-chair','dining-table','floor-workshop','balcony-washer']){
  const plan=planObjectDestination(p.objects,catalog,assets,p.room,p.spawn,id,nav);
  assert.ok(plan.ok,id+': '+plan.reason);assert.ok(nav.free(plan.point));
  const walker=createWalker(nav,p.spawn);walker.setAutonomous(false);walker.setBrisk(true);
  assert.ok(walker.go(plan.point));let ticks=0;
  while(walker.state.route.length && ticks++<20000){walker.update(1/30,1.3);assert.ok(nav.free(walker.state),id)}
  assert.ok(ticks<20000,id);assert.ok(Math.hypot(walker.state.x-plan.point.x,walker.state.z-plan.point.z)<.035,id);
 }
});
test('tabletop destination uses its support and never puts the body in the table',()=>{
 const objects=[{id:'table',kind:'table',x:0,z:0,yaw:Math.PI/4},{id:'cup',kind:'cup',x:0,z:0,yaw:0,on:{id:'table'}}];
 const cat={table:{size:[1.8,.8]},cup:{size:[.15,.15]}};
 const nav=createNavigation(objects,cat),plan=planObjectDestination(objects,cat,{}, {},{x:0,z:1.6},'cup',nav);
 assert.ok(plan.ok);assert.equal(plan.support_id,'table');assert.ok(nav.free(plan.point));assert.ok(Math.hypot(plan.point.x,plan.point.z)>.8);
});
test('enclosed object, invalid start and closed balcony report failure without relocating the target',()=>{
 const objects=[{id:'target',kind:'box',x:0,z:0,yaw:0},...[[0,-1],[0,1],[-1,0],[1,0]].map(([x,z],i)=>({id:'wall'+i,kind:'box',x,z,yaw:0}))];
 const cat={box:{size:[.8,.8]}};
 assert.equal(planObjectDestination(objects,cat,{}, {},{x:2,z:1.5},'target').code,'unreachable');
 assert.equal(planObjectDestination(objects,cat,{}, {},{x:0,z:0},'target').code,'start_blocked');
 const p=structuredClone(presets['family-home']);
 p.objects.find(o=>o.id===p.room.balcony.door_id).properties={open:false};
 assert.equal(planObjectDestination(p.objects,catalog,assets,p.room,p.spawn,'balcony-washer').code,'unreachable');
 assert.equal(planObjectDestination([],{}, {}, {},{x:0,z:0},'missing').code,'target_missing');
});
test('HTTP object destination uses fresh body, validates exclusive arguments, and persists the resolved endpoint',()=>{
 const app=new HouseApp(ctx,':memory:','house3d','runtime/web');
 try{
  request(app,'/api/commands',{id:'family',expected_revision:0,tool:'apply_preset',arguments:{preset_id:'family-home',dry_run:false}});
  assert.equal(command(app,{target_id:'child-desk'},'no-viewer').status,400);
  pulse(app,{...presets['family-home'].spawn});
  for(const args of [{},{x:1},{target_id:'child-desk',x:1,z:0},{target_id:5},{target_id:'missing'}])assert.equal(command(app,args,JSON.stringify(args)).status,400);
  const result=command(app,{target_id:'child-desk'});assert.equal(result.status,200);
  const job=result.body.state.interaction;assert.equal(job.target_id,'child-desk');assert.equal(job.phase,'requested');
  const plan=planObjectDestination(presets['family-home'].objects,catalog,assets,presets['family-home'].room,presets['family-home'].spawn,'child-desk');
  assert.deepEqual(job.target,plan.point);
  assert.deepEqual(request(app,'/api/commands',{id:'walk',expected_revision:result.body.state.revision-1,tool:'walk_to',arguments:{target_id:'child-desk'}}).body,result.body,'same command id is idempotent even after revision advances');
 }finally{app.close()}
});
test('stale or paused body cannot plan a new object destination',()=>{
 let now=100;const app=new HouseApp(ctx,':memory:','house3d','runtime/web',()=>now);
 try{
  pulse(app,{x:0,z:.5});now+=7;
  assert.equal(command(app,{target_id:'desk'},'stale').status,400);
  request(app,'/api/viewer',{session_id:'test-body',visible:true,paused:true,body:{x:0,y:0,z:.5,yaw:0,pose:'stand',moving:false},job_id:null});
  assert.equal(command(app,{target_id:'desk'},'paused').status,400);
 }finally{app.close()}
});
