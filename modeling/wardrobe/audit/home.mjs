import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';

// Use the shipped home and its actual screenshot queue, never an existing save.
export async function renderBed({root,tmp,chrome,outfits,views,record}){
 const probe=createServer().listen(0,'127.0.0.1');await once(probe,'listening');
 const {port}=probe.address();await new Promise(done=>probe.close(done));
 const base='http://127.0.0.1:'+port;
 const server=spawn(process.execPath,['--experimental-sqlite','runtime/server.mjs'],{cwd:root,stdio:['ignore','pipe','pipe'],env:{
  ...process.env,HOUSE_ROOT:join(root,'house3d'),HOUSE_WEB_ROOT:join(root,'runtime/web'),HOUSE_DB:join(tmp,'home.sqlite'),HOUSE_LOG_DIR:tmp,
  HOUSE_WEATHER:'clear',HOUSE_DAYLIGHT:'day',HOUSE_PORT:String(port),HOUSE_RUNNER:'1',HOUSE_CHROME:chrome}});
 let log='';for(const s of [server.stdout,server.stderr])s.on('data',chunk=>{log=(log+chunk).slice(-3000)});
 const closed=once(server,'close');
 const fetchLocal=(url,opts={})=>fetch(base+url,{signal:AbortSignal.timeout(6000),...opts});
 async function api(path,body){const r=await fetchLocal(path,body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{});const j=await r.json();if(!r.ok)throw Error(path+': '+JSON.stringify(j));return j}
 async function until(label,test,ms=90000){
  const end=Date.now()+ms;while(Date.now()<end){if(server.exitCode!==null||server.signalCode)throw Error('隔离小家退出：'+log);
   const v=await test();if(v)return v;await sleep(300)}throw Error('等待超时：'+label+' '+log);
 }
 async function command(tool,args){const id=crypto.randomUUID();await api('/api/commands',{id,tool,arguments:args,expected_revision:(await api('/api/state')).revision});return id}
 async function frame(){
  const abort=new AbortController();try{
   const r=await fetchLocal('/api/runtime/stream',{signal:AbortSignal.any([abort.signal,AbortSignal.timeout(6000)])});
   let buf='';for await(const chunk of r.body){buf+=Buffer.from(chunk).toString();const m=buf.match(/data: ([^\n]+)\n/);if(m)return JSON.parse(m[1])}
  }finally{abort.abort()}
 }
 try{
  // Do not send commands to a pre-existing process if the ephemeral port raced.
  await until('独立服务启动',()=>log.includes('Agent Home: '+base+'/'),15000);
  await until('执行者上线',async()=>(await api('/api/runtime')).online);
  await command('set_camera',{preset:views[0].camera});
  const target=views[0].target,job=await command('interact',{target_id:target,action:'sleep'});
  const matches=(p,v)=>p?.jobId===job&&p.targetId===target&&p.phase==='active'&&p.body?.pose==='sleep'&&p.contact?.sleep>.99&&p.gait?.sleepSide===v.side;
  for(const v of views){
   await until(v.label,async()=>{const p=await frame();if(p?.jobId===job&&p.phase==='failed')throw Error('未能上床');return matches(p,v)});
   await api('/api/runtime/control',{paused:true});
   await until('冻结睡姿',async()=>{const p=await frame();return matches(p,v)&&p.paused},10000);
   for(const {id} of outfits){
    await command('set_outfit',{outfit:id});
    // The runner loads the outfit and then consumes pending shots in its state poll.
    // Let an already-in-flight previous poll finish before requesting the kept image.
    async function shot(){const {id}=await api('/api/screenshots',{view:'spectator'});return until('卧室照片',async()=>{
     const r=await fetchLocal('/api/screenshots/'+id);if(r.status===410)throw Error('截图过期');if(r.status!==200||!r.headers.get('content-type')?.startsWith('image/png'))return false;
     return Buffer.from(await r.arrayBuffer())},30000)}
    await shot();const bytes=await shot(),p=await frame();
    if(!matches(p,v)||!p.paused)throw Error('截图与指定睡姿不一致');
    await record(id,v,bytes,'png',{target,job,side:p.gait.sleepSide});
   }
   await api('/api/runtime/control',{paused:false});
  }
 }finally{
  server.kill('SIGTERM');const timer=setTimeout(()=>server.kill('SIGKILL'),12000);
  try{await closed}finally{clearTimeout(timer)}
 }
}
