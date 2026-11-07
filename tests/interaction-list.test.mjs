import test from 'node:test';
import assert from 'node:assert/strict';
import {HouseApp,loadContext} from '../runtime/test-app.mjs';
const ctx=loadContext('house3d');
const req=(app,url,body)=>app.handle({method:body?'POST':'GET',url,headers:{host:'localhost'},body});
const send=(app,tool,args,id=crypto.randomUUID())=>req(app,'/api/commands',{id,expected_revision:app.store.state().revision,tool,arguments:args});
const feedback=(app,{paused=false,visible=true,job_id=null,pose='stand',x=1.2,z=.3}={})=>req(app,'/api/viewer',{session_id:'list-test',visible,paused,job_id,body:{x,z,y:0,yaw:0,pose,moving:false}});
function setup(){const app=new HouseApp(ctx,':memory:','house3d','runtime/web');send(app,'apply_preset',{preset_id:'family-home',dry_run:false});return app}
const action=(list,id,kind)=>list.objects.find(o=>o.id===id)?.actions.find(a=>a.id===kind);

test('lists an executable one-call walk-and-draw action, without modifying state',()=>{
 const app=setup();try{
  feedback(app);const before=app.store.state();
  const list=req(app,'/api/interactions').body;
  const draw=action(list,'child-chair','draw');
  assert.equal(draw.available,true);assert.equal(draw.reachability,'reachable');assert.equal(draw.execution,'walk_then_pose');
  assert.deepEqual(draw.command,{tool:'interact',arguments:{target_id:'child-chair',action:'draw'}});
  assert.ok(draw.approach.distance_m>0);assert.deepEqual(app.store.state(),before);
  const accepted=send(app,draw.command.tool,draw.command.arguments);
  assert.equal(accepted.status,200);assert.equal(accepted.body.state.interaction.phase,'requested');
 }finally{app.close()}
});
test('missing or paused viewer retains actions with explicit reasons, but instant updates remain usable',()=>{
 const app=setup();try{
  let list=req(app,'/api/interactions').body;
  const draw=action(list,'child-chair','draw');assert.equal(draw.available,false);assert.match(draw.reason,/身体反馈/);assert.equal(draw.reachability,'not_checked');
  const lamp=list.objects.flatMap(o=>o.actions).find(a=>a.id==='turn_on');assert.equal(lamp.available,true);assert.equal(lamp.execution,'state_update');assert.equal(lamp.reachability,'not_required');
  feedback(app,{paused:true});list=req(app,'/api/interactions').body;assert.match(action(list,'child-chair','draw').reason,/暂停/);
 }finally{app.close()}
});
test('blocked entrances are unavailable, not hidden and not claimed reachable',()=>{
 const app=setup();try{
  // Place a conservative obstruction over every declared chair approach, directly in a test fixture.
  const state=app.store.state();const chair=state.objects.find(o=>o.id==='child-chair');
  ctx.assets['test-wall']={kind:'shelf',size:[3,2],height:1};
  state.objects.push({id:'test-wall',kind:'shelf',asset_id:'test-wall',x:chair.x,z:chair.z+.6,yaw:0});app.store.save(state);
  feedback(app,{x:1.4,z:.5});const a=action(req(app,'/api/interactions').body,'child-chair','sit');
  assert.equal(a.available,false);assert.equal(a.reachability,'blocked');assert.match(a.reason,/通道/);
 }finally{delete ctx.assets['test-wall'];app.close()}
});
test('active pose exposes leave and immediate tidy while retaining unavailable pose actions',()=>{
 const app=setup();try{
  const state=app.store.state();state.interaction={id:'play',target_id:'floor-workshop',action:'play',pose:'play',phase:'active'};app.store.save(state);
  feedback(app,{job_id:'play',pose:'play'});const list=req(app,'/api/interactions').body;
  assert.equal(action(list,'floor-workshop','leave').available,true);
  assert.equal(action(list,'floor-workshop','tidy').available,true);
  assert.equal(action(list,'child-chair','draw').available,false);
  assert.match(action(list,'child-chair','draw').reason,/先结束/);
 }finally{app.close()}
});
test('filters return only matching actions and discovery advertises the same endpoint',()=>{
 const app=setup();try{
  feedback(app);const list=req(app,'/api/interactions?capability=draw').body;
  assert.equal(list.objects.length,1);assert.deepEqual(list.objects[0].actions.map(a=>a.id),['draw']);
  assert.equal(req(app,'/api/interactions?category=lighting&capability=draw').body.objects.length,0);
  assert.deepEqual(req(app,'/api/tools').body.tools.list_interactions,{method:'GET',path:'/api/interactions'});
  assert.ok(req(app,'/api/tool-schemas').body.some(s=>s.function.name==='list_interactions'));
 }finally{app.close()}
});
