import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir,platform,arch,cpus} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';
import {browserBinary,launchRunner} from '../house3d/server/browser-runner.ts';
import {evaluateHomePerf,compareHomeTiming} from './perf-gates.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),dir=await mkdtemp(join(tmpdir(),'home-perf-'));
const connected=process.env.HOUSE_PERF_SCENE==='connected';
const report={scenario:(connected?'connected-home':'family-home')+' / home camera / default 960x720 headless viewer',machine:[platform(),arch(),cpus()[0]?.model],samples:{},errors:[]};
const limits={callsPerFrame:2050,trianglesPerFrame:1500000,shadowRatio:.67,idleFps:15};
const output=join(root,'artifacts',connected?'perf-connected.json':'perf-baseline.json');
let server,closed,viewer,failure='',interrupted=false;
function stop(){interrupted=true}
process.once('SIGINT',stop);process.once('SIGTERM',stop);
async function waitFor(label,fn,timeout=95000){
 const end=Date.now()+timeout;
 while(Date.now()<end){if(interrupted||failure||server?.exitCode!=null||server?.signalCode)throw Error(failure||'Benchmark interrupted or server exited');
  const result=await fn();if(result)return result;await sleep(250)}
 throw Error('Timeout: '+label);
}
try{
 let reference=null;
 if(process.argv.length>2){if(process.argv.length!==4||process.argv[2]!=='--compare')throw Error('Usage: npm run test:perf -- --compare prior-report.json');reference=JSON.parse(await readFile(process.argv[3],'utf8'))}
 const chrome=browserBinary();
 const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(done=>probe.close(done));
 const base='http://127.0.0.1:'+port;
 server=spawn(process.execPath,['start.mjs'],{cwd:root,env:{...process.env,HOUSE_CHROME:chrome,HOUSE_RUNNER:'1',HOUSE_WEATHER:'clear',HOUSE_DAYLIGHT:'day',HOUSE_PORT:String(port),HOUSE_DB:join(dir,'test.sqlite'),HOUSE_LOG_DIR:dir},stdio:['ignore','ignore','inherit']});closed=once(server,'exit');
 async function api(path,body){const r=await fetch(base+path,{signal:AbortSignal.timeout(10000),...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const value=await r.json();if(!r.ok)throw Error(path+': '+JSON.stringify(value));return value}
 async function command(tool,args){const id=crypto.randomUUID();await api('/api/commands',{id,expected_revision:(await api('/api/state')).revision,tool,arguments:args});return id}
 async function sample(role,from,count){return waitFor(role+' performance windows',async()=>{
  let text;try{text=await readFile(join(dir,'performance.jsonl'),'utf8')}catch(e){if(e.code==='ENOENT')return;throw e}
  const rows=text.split('\n').slice(0,-1).map(line=>JSON.parse(line)).filter(r=>r.event==='browser'&&r.role===role&&Date.parse(r.at)-r.window_ms>=from);
  return rows.length>=count?rows.slice(0,count):null;
 })}
 await waitFor('http',()=>api('/api/runtime').catch(()=>null));await waitFor('runner',async()=>(await api('/api/runtime')).online);
 await command('apply_preset',{preset_id:'family-home',dry_run:false});await command('set_activity',{activity:'idle'});
 await waitFor('spawn',async()=>{const o=await api('/api/observe');return o.fresh&&!o.body.moving&&Math.hypot(o.body.x-1.2,o.body.z-.3)<.03});
 if(connected)await command('connect_rooms',{dry_run:false});
 viewer=launchRunner(chrome,base+'/',why=>{failure='Viewer stopped: '+why});
 console.log('Measuring idle family room…');report.samples.idle=await sample('viewer',Date.now()+4000,1);
 const id=await command('interact',{target_id:'child-chair',action:'draw'});
 await waitFor('walk and draw',async()=>{const o=await api('/api/observe');if(o.job?.phase==='failed')throw Error(o.job.error);return o.fresh&&o.body_job_id===id&&o.job?.phase==='active'&&o.body.pose==='draw'});
 console.log('Measuring drawing…');const from=Date.now()+2000;
 [report.samples.draw,report.samples.runner]=await Promise.all([sample('viewer',from,2),sample('runner',from,2)]);
 await api('/api/runtime/control',{paused:true});await waitFor('paused',async()=>(await api('/api/observe')).execution.paused);
 console.log('Measuring paused room…');report.samples.paused=await sample('viewer',Date.now()+2000,1);
 report.errors=evaluateHomePerf(report.samples,limits);if(reference)report.errors.push(...compareHomeTiming(report,reference));
}catch(e){report.errors.push(e.message)}finally{
 if(viewer)await viewer.stop();if(server){server.kill('SIGTERM');const limit=setTimeout(()=>{report.errors.push('Server shutdown exceeded 10s');server.kill('SIGKILL')},10000);try{await closed}finally{clearTimeout(limit)}}await rm(dir,{recursive:true,force:true});
 await mkdir(join(root,'artifacts'),{recursive:true});await writeFile(output,JSON.stringify({...report,limits},null,2)+'\n');
}
console.log((report.errors.length?'FAIL '+report.errors.join('; '):'PASS')+' — '+output);
if(report.errors.length)process.exitCode=1;
