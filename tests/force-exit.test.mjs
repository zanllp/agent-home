import test from 'node:test';
import assert from 'node:assert/strict';
import {HouseApp,loadContext} from '../runtime/test-app.mjs';
import {createObjectInteraction} from '../house3d/web/object-interaction.js';
import {createNavigation,createWalker} from '../house3d/web/wander-navigation.js';
import {createActions} from '../tools/agent-home.mjs';
const ctx=loadContext('house3d'),now=1800000000;
function fixture(){
 const app=new HouseApp(ctx,':memory:','house3d','runtime/web',()=>now);
 const state=()=>app.store.state();
 const cmd=(tool,args,id=crypto.randomUUID())=>app.handle({method:'POST',url:'/api/commands',headers:{},body:{id,tool,arguments:args,expected_revision:state().revision}});
 return {app,state,cmd};
}
for(const pose of ['water','walk','sit','lie','sleep','read','draw','play']){
 test(`forced exit releases a stuck ${pose} exit without a live executor`,()=>{
  const {app,state,cmd}=fixture();
  try{
   const old=state(),plant=old.objects.find(o=>o.kind==='plant'),before=structuredClone(plant.properties??{}),spawn={...old.character};
   old.interaction={id:'stuck',target_id:plant.id,pose,action:'leave',phase:'requested',carrying:true};
   app.store.save(old);
   assert.equal(cmd('walk_to',{x:spawn.x,z:spawn.z}).status,400);
   assert.equal(cmd('interact',{target_id:plant.id,action:'leave'}).status,400);
   const result=cmd('cancel_action',{job_id:'stuck',force:true},'emergency');
   assert.equal(result.status,200,JSON.stringify(result.body));
   assert.equal(result.body.unlocked,true);assert.equal(result.body.body_confirmed,false);
   assert.equal(state().interaction.phase,'failed');
   assert.equal(state().interaction.forced,true);
   assert.equal(state().interaction.cancelled_job_id,'stuck');
   assert.equal(state().interaction.carrying,false);
   assert.match(state().interaction.error,/not confirmed/);
   assert.deepEqual(state().objects.find(o=>o.id===plant.id).properties??{},before);
   const nav=createNavigation(state().objects,ctx.catalog,{assets:ctx.assets,room:state().room});
   assert.equal(nav.free(state().character),true);
   assert.equal(cmd('walk_to',{x:spawn.x,z:spawn.z}).status,200);
   const current=state();current.interaction.phase='completed';app.store.save(current);
   const seat=current.objects.find(o=>ctx.assets[o.asset_id]?.interactions?.sit);
   assert.equal(cmd('interact',{target_id:seat.id,action:'sit'}).status,200);
   assert.equal(app.handle({method:'POST',url:'/api/interactions/stuck/progress',headers:{},body:{phase:'completed'}}).status,409);
  }finally{app.close()}
 });
}
test('force requires the matching job and boolean flag; normal cancellation still uses safe exit',()=>{
 const {app,state,cmd}=fixture();
 try{
  const old=state();old.interaction={id:'sitting',pose:'sit',action:'sit',phase:'active',target_id:'seat'};app.store.save(old);
  assert.equal(cmd('cancel_action',{job_id:'other',force:true}).status,400);
  assert.equal(cmd('cancel_action',{job_id:'sitting',force:'true'}).status,400);
  const normal=cmd('cancel_action',{job_id:'sitting'});
  assert.equal(normal.status,200);assert.equal(state().interaction.phase,'requested');assert.equal(state().interaction.forced,undefined);
  const id=state().interaction.id;
  assert.equal(cmd('cancel_action',{job_id:id,force:true}).status,200);
  const retry=cmd('cancel_action',{job_id:state().interaction.id,force:true},'retry');
  assert.equal(retry.status,200);
  const repeated=app.handle({method:'POST',url:'/api/commands',headers:{},body:{id:'retry',tool:'cancel_action',arguments:{job_id:id,force:true},expected_revision:state().revision}});
  assert.equal(repeated.status,409);
 }finally{app.close()}
});
test('force recovers from an occupied furniture root to a walkable floor position',()=>{
 const {app,state,cmd}=fixture();
 try{
  const old=state(),obj=old.objects.find(o=>ctx.assets[o.asset_id]?.interactions?.sleep);
  old.character={...old.character,x:obj.x,z:obj.z,activity:'sleep'};
  old.interaction={id:'bed',pose:'sleep',action:'sleep',phase:'active',target_id:obj.id};app.store.save(old);
  const result=cmd('cancel_action',{job_id:'bed',force:true});
  assert.equal(result.status,200,JSON.stringify(result.body));
  assert.equal(createNavigation(old.objects,ctx.catalog,{assets:ctx.assets,room:old.room}).free(state().character),true);
 }finally{app.close()}
});
for(const pose of ['walk','sit','lie','sleep','read','draw','play','water']){
 test(`executor discards the old ${pose} controller and held props on forced exit`,async()=>{
  const nav=createNavigation([],{});let walker=createWalker(nav,{x:0,z:1.5,yaw:0}),exits=0;
  const reports=[],objects=[{id:'chair',kind:'chair',asset_id:'seat',x:0,z:0,yaw:0}];
  const assets={seat:{interactions:{sit:{root:[0,.4,0],approaches:[[0,0,1]]},sleep:{root:[0,.5,0],approaches:[[0,0,1]]},lie:{root:[0,.5,0],approaches:[[0,0,1]]},play:{root:[0,.1,0],approaches:[[0,0,1]]}}}};
  const engine=createObjectInteraction({context:()=>({walker,nav,objects,assets,groundHeight:()=>0}),onStart:()=>{walker.stop();walker.setAutonomous(false)},onExit:p=>{exits++;walker=createWalker(nav,p);walker.setAutonomous(false)},onStatus(){},report:async(id,p)=>reports.push({id,...p})});
  const job={id:'old',pose,action:pose==='walk'?'walk_to':pose,target_id:'chair',phase:pose==='water'||pose==='walk'?'requested':'active',approach_index:0,target:{x:1,z:1},water:{pickup:{x:0,z:1.5},target:{x:2,z:0,yaw:0},soil:{x:2,z:0,y:.3}}};
  engine.consume(job);engine.tick(.05);await engine.flush();
  const emergency={...job,id:'emergency',phase:'failed',forced:true,action:'leave',recovery_position:{x:1,z:1,yaw:0}};
  engine.consume(emergency);engine.tick(10);await engine.flush();
  assert.equal(engine.busy,false);assert.equal(engine.frame,null);assert.equal(walker.state.route.length,0);assert.equal(walker.state.x,1);
  assert.ok(!reports.some(p=>p.id==='emergency'));
  const count=exits;engine.consume(emergency);assert.equal(exits,count);
  engine.consume({id:'new',pose:'walk',action:'walk_to',phase:'requested',target:{x:2,z:1}});
  assert.equal(engine.busy,true);assert.equal(engine.jobId,'new');
 });
}
test('explicit client force exit unlocks without waiting for or pretending body completion',async()=>{
 const posts=[],client=createActions(async(method,path,body)=>{
  if(method==='GET')return {status:200,body:{revision:3,interaction:{id:'stuck',action:'leave',phase:'requested'}}};
  posts.push(body);return {status:200,body:{ok:true,state:{interaction:{id:body.id,phase:'failed',forced:true}}}};
 });
 const result=await client.cancel(true);
 assert.equal(result.unlocked,true);assert.equal(result.body_confirmed,false);
 assert.deepEqual(posts[0].arguments,{job_id:'stuck',force:true});
});

test('emergency exit also ends a stuck plan cancellation instead of leaving a second lock',()=>{
 const {app,state,cmd}=fixture();
 try{
  const old=state();old.interaction={id:'stuck',pose:'water',action:'leave',phase:'requested'};
  old.life_plan={status:'cancelling',job_id:'stuck',steps:[],index:0};app.store.save(old);
  assert.equal(cmd('cancel_action',{job_id:'stuck',force:true}).status,200);
  assert.equal(state().life_plan.status,'cancelled');
 }finally{app.close()}
});

test('fresh body position wins over the last desired position during emergency recovery',()=>{
 const {app,state,cmd}=fixture();
 try{
  const old=state(),nav=createNavigation(old.objects,ctx.catalog,{assets:ctx.assets,room:old.room});
  const actual=nav.nodes.find(p=>Math.hypot(p.x-old.character.x,p.z-old.character.z)>1);
  old.interaction={id:'moving',pose:'walk',action:'walk_to',phase:'approaching'};app.store.save(old);
  const feedback=app.handle({method:'POST',url:'/api/viewer',headers:{},body:{session_id:'force-test',visible:true,paused:false,job_id:'moving',body:{...actual,y:0,yaw:.4,pose:'stand',moving:true}}});
  assert.equal(feedback.status,200);
  assert.equal(cmd('cancel_action',{job_id:'moving',force:true}).status,200);
  assert.equal(state().character.x,actual.x);assert.equal(state().character.z,actual.z);assert.equal(state().character.yaw,.4);
 }finally{app.close()}
});

test('a subsequent command can replace the forced snapshot before the viewer polls it',async()=>{
 const nav=createNavigation([],{});let walker=createWalker(nav,{x:0,z:0,yaw:0});
 const engine=createObjectInteraction({context:()=>({walker,nav,objects:[],assets:{},groundHeight:()=>0}),onStart(){walker.stop()},onExit:p=>{walker=createWalker(nav,p)},onStatus(){},report:async()=>{}});
 engine.consume({id:'water',pose:'water',action:'water',phase:'requested',water:{pickup:{x:0,z:0},target:{x:2,z:0,yaw:0},soil:{x:2,z:0,y:.3}}});
 walker.state.route=[];engine.tick(.05);assert.equal(engine.frame.carry,1);
 engine.consume({id:'walk',pose:'walk',action:'walk_to',phase:'requested',target:{x:1,z:1}});
 assert.equal(engine.frame,null);assert.equal(engine.pose,'walk');
 await engine.flush();
});
