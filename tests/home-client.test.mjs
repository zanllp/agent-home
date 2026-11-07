import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {createActions, waitForJob} from '../tools/agent-home.mjs';

const walk={id:'walk-1',action:'walk_to',pose:'walk',target:{x:1,z:2}};
const standing={pose:'stand',moving:false,x:1,z:2};
const observe=(job,extra={})=>({job,body_job_id:job?.id??null,fresh:true,age_seconds:0,body:standing,execution:{paused:false},...extra});
function timeline(frames){
 let time=100,polls=0;
 const request=async()=>({status:200,body:frames[Math.min(polls++,frames.length-1)]});
 return {request,options:{now:()=>time,sleep:async ms=>{time+=ms},timeoutMs:600},polls:()=>polls};
}
test('only the requested completed job at its actual destination succeeds',async()=>{
 const t=timeline([observe({...walk,phase:'approaching'}),observe({...walk,phase:'completed'})]);
 assert.equal((await waitForJob(t.request,walk,t.options)).job.phase,'completed');
 assert.equal(t.polls(),2);
});
for(const [label,frames,code] of [
 ['failed route',[observe({...walk,phase:'failed',error:'No collision-free route'})],'failed'],
 ['replaced job',[observe({...walk,id:'someone-else',phase:'completed'})],'superseded'],
 ['cancelled',[observe({...walk,phase:'cancelled'})],'cancelled'],
 ['paused page',[observe({...walk,phase:'approaching'},{execution:{paused:true}})],'paused'],
 ['stale viewer',[observe({...walk,phase:'completed'},{fresh:false})],'viewer_unavailable'],
 ['missing job',[observe(null)],'timeout'],
 ['wrong destination',[observe({...walk,phase:'completed'},{body:{...standing,x:4}})],'timeout'],
 ['moving body',[observe({...walk,phase:'completed'},{body:{...standing,moving:true}})],'timeout'],
 ['pre-command body',[observe({...walk,phase:'completed'},{body_job_id:'previous'})],'timeout'],
]){
 test(label+' is not reported as success',async()=>{
  const t=timeline(frames);
  await assert.rejects(waitForJob(t.request,walk,t.options),e=>e.code===code);
 });
}
test('held poses require active job and a new nonmoving body in the matching pose',async()=>{
 const job={id:'read',action:'read',pose:'read'};
 const t=timeline([observe({...job,phase:'entering'}),observe({...job,phase:'active'},{body:{pose:'read',moving:false}})]);
 assert.equal((await waitForJob(t.request,job,t.options)).body.pose,'read');
 const wrong=timeline([observe({...job,phase:'active'},{body:{pose:'sit',moving:false}})]);
 await assert.rejects(waitForJob(wrong.request,job,wrong.options),e=>e.code==='timeout');
});
test('HTTP observation failures surface immediately, without masking them as timeout',async()=>{
 await assert.rejects(waitForJob(async()=>({status:503,body:{error:'offline'}}),walk),e=>e.code==='request_failed'&&e.details.status===503);
});

function mock(initial,{fail=false,rejectCancel=false,instant=false}={}){
 let job=initial,posts=[],reads=0;
 const request=async(method,path,body)=>{
  if(path==='/api/state')return {status:200,body:{revision:2}};
  if(path==='/api/observe'){
   reads++;const body=job?.phase==='active'?{pose:job.pose,moving:false}:standing;
   return {status:200,body:observe(job,{body})};
  }
  posts.push(body);
  if(body.tool==='cancel_action'&&rejectCancel)return {status:409,body:{error:'Stale interaction'}};
  if(body.tool==='cancel_action')job={id:body.id,action:'leave',pose:initial.pose,phase:'completed'};
  else if(!instant)job={...walk,id:body.id,action:body.arguments.action??'walk_to',phase:fail?'failed':'completed'};
  return {status:200,body:{ok:true,state:{interaction:job}}};
 };
 return {client:createActions(request),posts,reads:()=>reads};
}
test('completed retained jobs do not cause cancellation or the old four-second wait',async()=>{
 const m=mock({...walk,id:'previous',phase:'completed'}),t=performance.now();
 await m.client.goto(1,2);
 assert.deepEqual(m.posts.map(x=>x.tool),['walk_to']);
 assert.ok(performance.now()-t<1500);
});
test('failed retained job does not get cancelled again',async()=>{
 const m=mock({...walk,phase:'failed'});await m.client.goto(1,2);
 assert.deepEqual(m.posts.map(x=>x.tool),['walk_to']);
});
test('a live pose is left exactly once, then the destination is submitted',async()=>{
 const m=mock({id:'seat',action:'sit',pose:'sit',phase:'active'});
 await m.client.goto(1,2);
 assert.deepEqual(m.posts.map(x=>x.tool),['cancel_action','walk_to']);
 assert.equal(m.posts[0].arguments.job_id,'seat');
});
test('failed cancellation stops the chain before a new movement',async()=>{
 const m=mock({id:'seat',action:'sit',pose:'sit',phase:'active'},{rejectCancel:true});
 await assert.rejects(m.client.goto(1,2),e=>e.details.status===409);
 assert.deepEqual(m.posts.map(x=>x.tool),['cancel_action']);
});
for(const action of ['tidy','unpack','turn_on','turn_off','cover','uncover','serve_rice']){
 test(action+' changes the object without cancelling the held pose or waiting for another job',async()=>{
  const m=mock({id:'play',action:'play',pose:'play',phase:'active'},{instant:true});
  const r=await m.client.doAction('object',action);
  assert.ok(r.ok);assert.equal(m.reads(),0);assert.equal(m.posts.length,1);assert.equal(m.posts[0].tool,'interact');
 });
}
test('leave is submitted once, not preceded by a second leave or cancel',async()=>{
 const m=mock({id:'play',action:'play',pose:'play',phase:'active'});
 await m.client.doAction('object','leave');
 assert.equal(m.posts.length,1);assert.equal(m.posts[0].arguments.action,'leave');
});
test('rejected coordinates do not generate exploratory movement commands',async()=>{
 const posts=[];const client=createActions(async(method,path,body)=>{
  if(path==='/api/state')return {status:200,body:{revision:1}};
  if(path==='/api/observe')return {status:200,body:observe(null)};
  posts.push(body);return {status:400,body:{error:'Destination blocked'}};
 });
 await assert.rejects(client.goto(1,2),e=>e.message==='Destination blocked');
 assert.equal(posts.length,1);
});
test('CLI exits nonzero with structured failure when an accepted route fails',async()=>{
 let job=null;
 const server=http.createServer(async(req,res)=>{
  let text='';for await(const b of req)text+=b;
  let body;
  if(req.url==='/api/state')body={revision:1};
  else if(req.url==='/api/observe')body=observe(job);
  else{
   const c=JSON.parse(text);job={...walk,id:c.id,phase:'failed',error:'No collision-free route'};
   body={ok:true,state:{interaction:job}};
  }
  res.setHeader('content-type','application/json');res.end(JSON.stringify(body));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const child=spawn(process.execPath,['tools/agent-home.mjs','goto','1','2'],{env:{...process.env,AGENT_HOME_URL:'http://127.0.0.1:'+server.address().port}});
  let stdout='';child.stdout.on('data',b=>stdout+=b);
  const code=await new Promise(r=>child.on('exit',r)),out=JSON.parse(stdout);
  assert.equal(code,1);assert.equal(out.ok,false);assert.equal(out.code,'failed');assert.equal(out.observe.job.error,'No collision-free route');
 }finally{await new Promise(r=>server.close(r))}
});


test('an already leaving job is awaited without submitting another cancellation',async()=>{
 let job={id:'leaving',action:'leave',pose:'sit',phase:'leaving'}, polls=0;
 const posts=[];
 const client=createActions(async(method,path,body)=>{
  if(path==='/api/state')return {status:200,body:{revision:1}};
  if(path==='/api/observe'){
   if(++polls===2)job={...job,phase:'completed'};
   return {status:200,body:observe(job)};
  }
  posts.push(body);job={...walk,id:body.id,phase:'completed'};
  return {status:200,body:{ok:true,state:{interaction:job}}};
 });
 await client.goto(1,2);
 assert.deepEqual(posts.map(x=>x.tool),['walk_to']);
});
test('a completed standing body cannot masquerade as an active read pose',async()=>{
 const job={id:'read',action:'read',pose:'read',phase:'completed'};
 const t=timeline([observe(job)]);
 await assert.rejects(waitForJob(t.request,job,t.options),e=>e.code==='timeout');
});
test('an unbound body sample cannot confirm a newly completed job',async()=>{
 const t=timeline([observe({...walk,phase:'completed'},{body_job_id:null})]);
 await assert.rejects(waitForJob(t.request,walk,t.options),e=>e.code==='timeout');
});
