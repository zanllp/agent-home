import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {HouseApp,loadContext} from '../runtime/test-app.mjs';
import {createWaterInteraction} from '../house3d/web/water-interaction.js';
const ctx=loadContext('house3d'),epoch=1800000000;
function fixture(path=':memory:',clock=()=>epoch){
 const app=new HouseApp(ctx,path,'house3d','runtime/web',clock);
 const read=(path='/api/state')=>app.handle({method:'GET',url:path,headers:{}}).body;
 const cmd=(tool,args,id=crypto.randomUUID())=>app.handle({method:'POST',url:'/api/commands',headers:{},body:{id,expected_revision:read().revision,tool,arguments:args}});
 return {app,read,cmd};
}
test('three servings, empty bowl rule, half-hour cooking boundary and no refill bypass',()=>{
 let now=epoch;const {app,read,cmd}=fixture(':memory:',()=>now);
 const act=(id,action,key)=>cmd('interact',{target_id:id,action},key),pot=()=>read().objects.find(o=>o.id==='rice-cooker');
 try{
  cmd('apply_preset',{preset_id:'connected-home',dry_run:false});
  assert.equal(pot().properties.servings,3);
  for(let i=0;i<3;i++){
   assert.equal(act('rice-bowl','serve_rice').status,200);
   assert.equal(pot().properties.servings,2-i);
   assert.equal(act('rice-bowl','serve_rice').status,400);
   assert.equal(act('rice-bowl','eat_rice').status,200);
  }
  assert.equal(act('rice-bowl','serve_rice').status,400);
  assert.equal(act('rice-cooker','refill_rice').status,400);
  assert.equal(cmd('update_object',{id:'rice-cooker',properties:{keep_full:true}}).status,400);
  assert.equal(act('rice-cooker','cook_rice').status,200);
  assert.equal(pot().properties.ready_at,epoch+1800);
  const deadline=pot().properties.ready_at;
  assert.equal(act('rice-cooker','cook_rice').status,400);assert.equal(pot().properties.ready_at,deadline);
  now+=1799;assert.equal(act('rice-bowl','serve_rice').status,400);
  now++;assert.equal(pot().properties.servings,3);
  assert.equal(read('/api/objects').objects.find(o=>o.id==='rice-cooker').care.status,'ready');
  assert.equal(act('rice-bowl','serve_rice').status,200);assert.equal(pot().properties.servings,2);
 }finally{app.close()}
});
test('plant clock, read-only moisture and cooking survive restart without a timer or a viewer',()=>{
 const dir=mkdtempSync(join(tmpdir(),'home-care-'));let now=epoch,one=fixture(join(dir,'home.sqlite'),()=>now);
 try{
  one.cmd('apply_preset',{preset_id:'connected-home',dry_run:false});
  const state=one.read(),pot=state.objects.find(o=>o.id==='rice-cooker');pot.properties={servings:0};one.app.store.save(state);
  one.cmd('interact',{target_id:'rice-cooker',action:'cook_rice'});
  const plant=()=>one.read('/api/objects').objects.find(o=>o.id==='ficus-window');
  assert.equal(plant().care.needs_water,false);
  one.app.close();now+=3*86400;one=fixture(join(dir,'home.sqlite'),()=>now);
  assert.equal(plant().care.needs_water,true);assert.equal(plant().care.moisture,57);
  const p=one.read().objects.find(o=>o.id==='rice-cooker');assert.equal(p.properties.servings,3);
  assert.equal(one.cmd('update_object',{id:'ficus-window',properties:{last_watered_at:now}}).status,400);
 }finally{one.app.close();rmSync(dir,{recursive:true,force:true})}
});
test('water requires an accessible can, full pour feedback; cancel before pouring does not water',()=>{
 let now=epoch;const {app,read,cmd}=fixture(':memory:',()=>now);
 const progress=(id,phase,extra={})=>app.handle({method:'POST',url:'/api/interactions/'+id+'/progress',headers:{},body:{viewer_session:'care-test',phase,approach_index:0,...extra}});
 const feedback=(position={x:-4.96,z:-1,yaw:0})=>app.handle({method:'POST',url:'/api/viewer',headers:{},body:{session_id:'care-test',visible:true,paused:false,body:{...position,y:0,pose:'stand',moving:false}}});
 try{
  cmd('apply_preset',{preset_id:'connected-home',dry_run:false});feedback();
  const accepted=cmd('interact',{target_id:'balcony-ficus',action:'water'});
  assert.equal(accepted.status,200,JSON.stringify(accepted.body));
  const job=accepted.body.state.interaction;
  assert.equal(job.related_id,'watering-can');
  assert.equal(read().objects.find(o=>o.id==='balcony-ficus').properties.last_watered_at,undefined);
  assert.equal(progress(job.id,'approaching').status,200);
  assert.equal(progress(job.id,'approaching',{carrying:true}).status,200);
  assert.equal(read().character.x,job.water.pickup.x);
  assert.equal(progress(job.id,'entering').status,200);
  assert.equal(progress(job.id,'active').status,200);
  assert.equal(read().objects.find(o=>o.id==='balcony-ficus').properties.last_watered_at,now);
  progress(job.id,'leaving');assert.equal(progress(job.id,'completed',{carrying:false,position:{...job.water.pickup,yaw:0}}).status,200);
  assert.equal(cmd('interact',{target_id:'balcony-ficus',action:'water'}).status,400);
  now+=43200;feedback();assert.equal(cmd('interact',{target_id:'balcony-ficus',action:'water'}).status,200);
  const pending=read().interaction;progress(pending.id,'approaching',{carrying:true});
  const leave=cmd('interact',{target_id:'balcony-ficus',action:'leave'});
  assert.equal(leave.status,200);assert.deepEqual(leave.body.state.interaction.water,pending.water);assert.equal(leave.body.state.interaction.carrying,true);
  const s=read();s.interaction.phase='completed';app.store.save(s);
  feedback();
  assert.match(cmd('interact',{target_id:'work-plant',action:'water'}).body.error,/太高/);
  const st=read();st.objects=st.objects.filter(o=>o.asset_id!=='home-watering-can-v1');app.store.save(st);
  assert.equal(cmd('interact',{target_id:'ficus-window',action:'water'}).status,400);
 }finally{app.close()}
});
test('watering controller fetches, pours then returns; cancelled approach never reports a pour',async()=>{
 const reports=[],s={x:0,z:0,yaw:0,route:[]},walker={state:s,go(p){s.route=[p];return true}};
 const job={id:'water',pose:'water',action:'water',phase:'requested',water:{pickup:{x:1,z:0},target:{x:2,z:0,yaw:0},soil:{x:2,y:.3,z:1}}};
 const engine=createWaterInteraction({context:()=>({walker,groundHeight:()=>0}),onStart(){},onStatus(){},onExit(){},report:async(id,p)=>reports.push(p)});
 const arrive=()=>{Object.assign(s,s.route.at(-1));s.route=[];engine.tick(.05)};
 engine.consume(job);arrive();assert.equal(engine.frame.carry,1);arrive();
 for(let i=0;i<70;i++)engine.tick(.05);
 arrive();await engine.flush();
 assert.equal(engine.busy,false);assert.deepEqual(reports.map(r=>r.phase),['approaching','approaching','entering','active','leaving','completed']);
 const before=reports.length;engine.consume({...job,id:'second'});engine.consume({...job,id:'cancel',action:'leave'});
 await engine.flush();assert.ok(!reports.slice(before).some(r=>r.phase==='active'));
});
