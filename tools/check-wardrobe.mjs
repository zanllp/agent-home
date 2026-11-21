import {execFile} from 'node:child_process';
import {promisify,parseArgs} from 'node:util';
import {mkdtemp,rm,mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {browserBinary} from '../house3d/server/browser-runner.ts';
import {studio,bed} from '../modeling/wardrobe/audit/views.mjs';
import {renderStudio} from '../modeling/wardrobe/audit/studio.mjs';
import {renderBed} from '../modeling/wardrobe/audit/home.mjs';
import {loadBaseline,writePage,digest} from '../modeling/wardrobe/audit/report.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),{values}=parseArgs({options:{out:{type:'string'},baseline:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('npm run check:wardrobe -- [--out 新目录] [--baseline 已认可的/report.json]');process.exit(0)}
const created=new Date().toISOString(),out=resolve(values.out||join(root,'artifacts','wardrobe','reports',created.replace(/[:.]/g,'-')));
await mkdir(dirname(out),{recursive:true});await mkdir(out); // Never overwrite a reviewed run.
await mkdir(join(out,'images'));
const tmp=await mkdtemp(join(tmpdir(),'home-wardrobe-')),current=new Map();
const report={format:1,created,automated:'failed',human:'pending',expected:0,outfits:[],checks:[],shots:[]};
const run=promisify(execFile);let baseline,chrome;
async function check(label,fn){
 process.stdout.write(label+'… ');
 try{await fn();report.checks.push({label,ok:true});console.log('OK')}
 catch(e){const detail=[e.message,e.stdout,e.stderr].filter(Boolean).join('\n').slice(-3000);report.checks.push({label,ok:false,detail});console.error(detail);process.exitCode=1}
}
const opts={tmp,root,async record(outfit,shot,buffer,ext,observed){
 const png=ext==='png',valid=png?buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP';
 if(!valid||buffer.length<500)throw Error('截图无效：'+outfit+'/'+shot.id);
 const key=outfit+'/'+shot.id,file='images/'+outfit+'-'+shot.id+'.'+ext;
 if(current.has(key))throw Error('重复截图：'+key);
 current.set(key,buffer);await writeFile(join(out,file),buffer);
 const sha256=digest(buffer),signature=digest(JSON.stringify([1,shot])),old=baseline?.get(key);
 const comparison=!baseline?'not_requested':!old?'no_baseline':old.signature!==signature?'different_view':old.sha256===sha256?'identical_bytes':'changed_bytes';
 report.shots.push({...shot,key,outfit,file,sha256,signature,comparison,observed});
}};
try{
 if(values.baseline)await check('读取对照基准',async()=>{baseline=await loadBaseline(resolve(values.baseline));report.baseline=JSON.parse(await readFile(resolve(values.baseline),'utf8')).created});
 await check('服装清单、资产指纹与骨架',async()=>{
  const m=JSON.parse(await readFile(join(root,'modeling/wardrobe/manifest.json'),'utf8'));
  report.outfits=[{id:'reference',label:'原装'},...m.outfits.map(({id,label})=>({id,label}))];
  if(report.outfits.some(o=>!/^[-a-z0-9]+$/.test(o.id))||new Set(report.outfits.map(o=>o.id)).size!==report.outfits.length)throw Error('套装 ID 无效');
  report.expected=report.outfits.length*(studio.length+bed.length);report.rig=m.base_sha256;
  report.assets=Object.fromEntries(m.outfits.map(o=>[o.id,o.sha256]));
  await run(process.execPath,['modeling/wardrobe/check.mjs'],{cwd:root});
 });
 for(const [name,files] of [
  ['穿上与换回原装',['home-outfit']],['抬头接缝与指尖',['outfit-jaw','finger-paint']],
  ['步态与脚部轮廓',['footwear']],['坐姿与被面接触',['floor-fit','floor-play','bedding','pajama-bedding']]
 ])await check(name,()=>run(process.execPath,['--experimental-sqlite','--test',...files.map(f=>'tests/'+f+'.test.mjs')],{cwd:root,timeout:90000}));
 await check('浏览器',()=>{chrome=browserBinary()});
 if(chrome&&report.expected){
  await check('试衣间定帧实拍',()=>renderStudio({...opts,chrome,outfits:report.outfits,views:studio}));
  await check('独立小家 · 床上仰睡与侧睡',()=>renderBed({...opts,chrome,outfits:report.outfits,views:bed}));
 }
 await check('镜头完整性',()=>{
  if(!report.expected||current.size!==report.expected)throw Error('实拍缺失：'+current.size+' / '+report.expected);
  for(const {id} of report.outfits)for(const v of [...studio,...bed])if(!current.has(id+'/'+v.id))throw Error('缺图：'+id+'/'+v.id);
 });
 report.automated=report.checks.every(c=>c.ok)?'passed':'failed';
}finally{
 await rm(tmp,{recursive:true,force:true,maxRetries:4});
 await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 await writeFile(join(out,'index.html'),await writePage(report,current,baseline));
 console.log('人工看图：'+join(out,'index.html')+'\nAgent 结果：'+join(out,'report.json'));
}
