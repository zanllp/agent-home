import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {createActions} from '../tools/agent-home.mjs';

test('zero-viewer runner: child bed → television → balcony, real walk feedback and photograph', {
 skip:process.env.HOUSE_TEST_APARTMENT!=='1', timeout:230000
},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'connected-runner-')),probe=createServer();
 probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(done=>probe.close(done));
 const url='http://127.0.0.1:'+port,server=spawn(process.execPath,['start.mjs'],{env:{...process.env,HOUSE_DB:join(dir,'isolated.sqlite'),HOUSE_LOG_DIR:dir,HOUSE_PORT:String(port),HOUSE_WEATHER:'off',HOUSE_RUNNER:'1'},stdio:'ignore'});
 const closed=once(server,'exit'),request=async(method,path,data)=>{
  const r=await fetch(url+path,{method,headers:{'content-type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(10000)});
  return {status:r.status,body:await r.json()};
 };
 const {goto,command}=createActions(request);
 const wait=async fn=>{const until=Date.now()+35000;while(Date.now()<until){const result=await fn();if(result)return result;await delay(200)}throw Error('Timed out waiting for runner')};
 try{
  await wait(()=>request('GET','/api/runtime').then(r=>r.body.online).catch(()=>false));
  await command('apply_preset',{preset_id:'family-home',dry_run:false});await command('set_activity',{activity:'idle'});
  await wait(async()=>{const {body:o}=await request('GET','/api/observe');return o.fresh&&!o.body.moving&&Math.hypot(o.body.x-1.2,o.body.z-.3)<.03});
  await command('connect_rooms',{dry_run:false});
  for(const [target,area] of [['childroom-bed','child'],['television','living'],[[-4.96,-1],'balcony']]){
   const {observe}=await goto(...(Array.isArray(target)?target:[target]));
   assert.equal(observe.area,area);assert.equal(observe.job.phase,'completed');assert.equal(observe.body.moving,false);
  }
  const {body:shot}=await request('POST','/api/screenshots',{view:'character'});
  const bytes=await wait(async()=>{const r=await fetch(url+shot.url);return r.headers.get('content-type')==='image/png'&&Buffer.from(await r.arrayBuffer())});
  assert.equal(bytes.readUInt32BE(0),0x89504e47);assert.ok(bytes.length>1000);
 }finally{server.kill('SIGTERM');await closed;await rm(dir,{recursive:true,force:true})}
});
