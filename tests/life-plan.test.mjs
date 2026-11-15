import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {HouseApp,loadContext} from '../runtime/test-app.mjs';
const ctx=loadContext('house3d'),epoch=1800000000;
function fixture(db=':memory:',clock={now:epoch},initialize=true){
 const app=new HouseApp(ctx,db,'house3d','runtime/web',()=>clock.now);
 const req=(url,body)=>app.handle({method:body?'POST':'GET',url,headers:{},body});
 const read=()=>req('/api/state').body,plan=()=>req('/api/life-plan').body.plan;
 const cmd=(tool,args,id=crypto.randomUUID())=>req('/api/commands',{id,expected_revision:read().revision,tool,arguments:args});
 const beat=(pose='stand',options={})=>{
  const s=read();return req('/api/viewer',{session_id:'life-test',visible:true,paused:false,job_id:s.interaction?.id??null,body:{x:s.character.x,z:s.character.z,y:0,yaw:0,pose,moving:false},...options});
 };
 const tick=()=>app.tickLifePlan();
 const progress=(phase,error)=>{
  const job=read().interaction;
  const r=req('/api/interactions/'+job.id+'/progress',{viewer_session:'life-test',phase,approach_index:job.pose==='walk'?null:job.target_id==='sofa'?4:0,...(error?{error}:{})});
  assert.equal(r.status,200,JSON.stringify(r.body));return r;
 };
 const active=(pose)=>{progress('approaching');progress('entering');progress('active');beat(pose);tick()};
 const completed=()=>{if(read().interaction.action==='leave')progress('leaving');else if(read().interaction.phase==='requested')progress('approaching');progress('completed');beat();tick()};
 const start=(steps)=>{const r=cmd('set_life_plan',{title:'放学后的小安排',steps});assert.equal(r.status,200,JSON.stringify(r.body));beat();tick();return r};
 if(initialize){assert.equal(cmd('apply_preset',{preset_id:'connected-home',dry_run:false}).status,200);beat()}
 return {app,req,read,plan,cmd,beat,tick,progress,active,completed,start,clock};
}
const step=(action,target_id,duration_seconds,extra={})=>({action,target_id,...(duration_seconds?{duration_seconds}:{}),...extra});
test('bounded typed plans reject invalid targets, conditions, durations and shell-like actions',()=>{
 const f=fixture();try{
  for(const steps of [[],Array(17).fill(step('sit','sofa',5)),[step('shell','sofa')],[step('water','missing')],[step('sit','sofa')],[step('sit','sofa',Infinity)],[step('water','ficus-window',5)],[step('sit','sofa',5,{until:{condition:'rice_ready',target_id:'sofa'}})],[{...step('sit','sofa',5),command:'rm -rf /'}]])
   assert.equal(f.cmd('set_life_plan',{title:'test',steps}).status,400);
  assert.equal(f.plan(),null);const revision=f.read().revision;
  assert.equal(f.req('/api/life-plan').status,200);assert.equal(f.read().revision,revision);
  assert.ok(f.req('/api/tool-schemas').body.some(x=>x.function.name==='set_life_plan'));
 }finally{f.app.close()}
});
test('hold clock starts only after matching actual posture; safely leave then continue without a model',()=>{
 const f=fixture();try{
  f.start([step('sit','sofa',5),step('walk_to','television')]);
  assert.equal(f.plan().phase,'performing');assert.equal(f.plan().index,0);
  f.tick();assert.equal(f.plan().phase,'performing');
  f.progress('approaching');f.progress('entering');f.progress('active');
  f.beat('sit',{job_id:null});f.tick();assert.equal(f.plan().phase,'performing');
  f.beat('stand');f.tick();assert.equal(f.plan().phase,'performing');
  f.beat('sit');f.tick();assert.equal(f.plan().phase,'holding');
  f.clock.now+=6;f.beat('sit');f.tick();assert.equal(f.plan().phase,'leaving');
  f.completed();assert.equal(f.plan().index,1);assert.equal(f.plan().phase,'ready');
  f.tick();assert.equal(f.plan().phase,'walking',JSON.stringify(f.plan()));f.completed();
  assert.equal(f.plan().status,'completed');assert.equal(f.plan().history.length,2);
  const events=f.req('/api/observe').body.events;assert.ok(events.some(e=>e.kind==='life_plan_progress'));
 }finally{f.app.close()}
});
test('offline or paused executor freezes clocks, no periodic writes while stable',()=>{
 const f=fixture();try{
  f.start([step('sit','sofa',20)]);f.active('sit');
  const revision=f.read().revision;f.tick();f.tick();assert.equal(f.read().revision,revision);
  f.clock.now+=3;f.beat('sit',{paused:true});f.tick();const deadline=f.plan().deadline;
  f.clock.now+=100;f.tick();assert.equal(f.plan().deadline,deadline);
  f.beat('sit');f.tick();assert.equal(f.plan().deadline,deadline+100);
  f.clock.now+=10;f.tick();assert.ok(f.plan().suspended_at);assert.equal(f.plan().index,0);
  f.clock.now+=1000;f.beat('sit');f.tick();assert.equal(f.plan().phase,'holding');
 }finally{f.app.close()}
});
test('pause/resume and manual takeover do not compete with a new body job',()=>{
 const f=fixture();try{
  f.start([step('sit','sofa',10)]);f.active('sit');
  assert.equal(f.cmd('control_life_plan',{action:'pause'}).status,200);
  f.clock.now+=100;f.beat('sit');f.tick();assert.equal(f.plan().status,'paused');
  assert.equal(f.cmd('control_life_plan',{action:'resume'}).status,200);f.tick();assert.equal(f.plan().phase,'holding');
  assert.equal(f.cmd('interact',{target_id:'sofa',action:'leave'}).status,200);assert.equal(f.plan().status,'paused');
  assert.equal(f.cmd('control_life_plan',{action:'resume'}).status,400);
  const id=f.read().interaction.id;f.tick();assert.equal(f.read().interaction.id,id);
  assert.equal(f.cmd('control_life_plan',{action:'cancel'}).status,200);assert.equal(f.plan().status,'cancelled');assert.equal(f.read().interaction.id,id);
 }finally{f.app.close()}
});
test('cancel leaves its own posture before declaring cancelled',()=>{
 const f=fixture();try{
  f.start([step('sit','sofa',10)]);f.active('sit');
  f.cmd('control_life_plan',{action:'cancel'});assert.equal(f.plan().status,'cancelling');assert.equal(f.read().interaction.action,'leave');
  f.completed();assert.equal(f.plan().status,'cancelled');assert.equal(f.plan().history.length,0);
 }finally{f.app.close()}
});
test('plant condition skips; rice condition waits then walks before serving, exactly once',()=>{
 const f=fixture();try{
  const s=f.read();const pot=s.objects.find(o=>o.id==='rice-cooker');pot.properties={servings:0,ready_at:epoch+30};f.app.store.save(s);
  f.start([step('water','ficus-window',null,{when:{condition:'needs_water',target_id:'ficus-window'}}),step('serve_rice','rice-bowl',null,{when:{condition:'rice_ready',target_id:'rice-cooker',on_false:'wait',timeout_seconds:60}})]);
  assert.equal(f.plan().index,1);assert.equal(f.plan().history[0].outcome,'skipped');f.tick();assert.equal(f.plan().phase,'waiting');
  f.clock.now+=30;f.beat();f.tick();assert.equal(f.plan().phase,'approaching');
  const potNow=()=>f.read().objects.find(o=>o.id==='rice-cooker');assert.equal(potNow().properties.servings,3);
  f.completed();assert.equal(f.plan().status,'completed');assert.equal(potNow().properties.servings,2);
  f.tick();assert.equal(potNow().properties.servings,2);
 }finally{f.app.close()}
});
test('water completes its return trip, not just the pour; failure/timeout needs attention without replay',()=>{
 const f=fixture();try{
  f.start([step('water','balcony-ficus'),step('sit','sofa',5)]);
  f.active('water');assert.equal(f.plan().phase,'performing');assert.equal(f.plan().index,0);
  f.progress('leaving');f.progress('completed');f.beat();f.tick();assert.equal(f.plan().index,1);
  f.tick();f.progress('failed','路被挡住了');f.beat();f.tick();assert.equal(f.plan().status,'needs_attention');assert.match(f.plan().error,/路被挡/);
  const id=f.read().interaction.id;f.tick();assert.equal(f.read().interaction.id,id);
 }finally{f.app.close()}
});
test('until event safely ends a hold; wait timeout is explicit',()=>{
 const f=fixture();try{
  f.start([step('sit','sofa',1200,{until:{condition:'rice_ready',target_id:'rice-cooker'}})]);f.active('sit');f.tick();assert.equal(f.plan().phase,'leaving');f.completed();
  const s=f.read();s.objects.find(o=>o.id==='rice-cooker').properties={servings:0};f.app.store.save(s);
  f.start([step('walk_to','rice-cooker',null,{when:{condition:'rice_ready',target_id:'rice-cooker',on_false:'wait',timeout_seconds:5}})]);
  f.clock.now+=6;f.beat();f.tick();assert.equal(f.plan().status,'needs_attention');assert.match(f.plan().error,/timed out/);
 }finally{f.app.close()}
});
test('restart retains checkpoint and remaining hold; cannot silently repeat a consumed step',()=>{
 const dir=mkdtempSync(join(tmpdir(),'life-plan-')),db=join(dir,'state.sqlite'),clock={now:epoch};let f=fixture(db,clock);
 try{
  f.start([step('sit','sofa',20)]);f.active('sit');const job=f.plan().job_id;
  clock.now+=3;f.beat('sit');f.app.close();clock.now+=1000;f=fixture(db,clock,false);
  f.beat('sit');f.tick();assert.equal(f.plan().job_id,job);assert.equal(f.plan().phase,'holding');assert.equal(f.plan().deadline,epoch+1020);
  clock.now+=18;f.beat('sit');f.tick();assert.equal(f.plan().phase,'leaving');f.completed();
 }finally{f.app.close();rmSync(dir,{recursive:true,force:true})}
});
test('completed job still requires a later body at the destination',()=>{
 const f=fixture();try{
  f.start([step('walk_to','television')]);f.progress('approaching');
  f.clock.now++;f.beat();f.clock.now++;f.progress('completed');f.tick();assert.equal(f.plan().index,0);
  const position=f.read().character;
  f.beat('stand',{body:{x:position.x+.15,z:position.z,y:0,yaw:0,pose:'stand',moving:false}});f.tick();assert.equal(f.plan().index,0);
  f.beat();f.tick();assert.equal(f.plan().status,'completed');
 }finally{f.app.close()}
});
test('plan command retries preserve one id; timed out actor does not get retried',()=>{
 const f=fixture();try{
  const args={title:'retry',steps:[step('sit','sofa',5)]},id='one-plan';
  const first=f.cmd('set_life_plan',args,id);assert.equal(first.status,200);
  assert.deepEqual(f.req('/api/commands',{id,expected_revision:first.body.state.revision-1,tool:'set_life_plan',arguments:args}).body,first.body);
  f.beat();f.tick();const job=f.read().interaction.id;f.clock.now+=241;f.beat();f.tick();
  assert.equal(f.plan().status,'needs_attention');f.tick();assert.equal(f.read().interaction.id,job);
 }finally{f.app.close()}
});
test('a plan may unpack then tidy the same set without inventing a new target capability',()=>{
 const f=fixture();try{
  const s=f.read();s.objects.find(o=>o.id==='floor-workshop').properties={packed:true};f.app.store.save(s);
  const r=f.cmd('set_life_plan',{title:'玩好再收',steps:[step('unpack','floor-workshop'),step('play','floor-workshop',5),step('tidy','floor-workshop')]});
  assert.equal(r.status,200,JSON.stringify(r.body));
  assert.equal(f.cmd('control_life_plan',{action:'cancel'}).status,200);
  assert.equal(f.cmd('set_life_plan',{title:'invalid',steps:[step('tidy','sofa')]}).status,400);
 }finally{f.app.close()}
});
import {lifePlanButtons} from '../house3d/web/wander-hud.js';
test('small-screen plan buttons sit below the title and existing top-right controls',()=>{
 for(const width of [320,534,640]){
  const buttons=lifePlanButtons(width);assert.ok(buttons.every(b=>b.y>=64));assert.ok(buttons[0].x+buttons[0].w<buttons[1].x);
 }
 assert.equal(lifePlanButtons(1280)[0].y,4);
});
