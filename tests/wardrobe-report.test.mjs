import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {digest,loadBaseline,writePage} from '../modeling/wardrobe/audit/report.mjs';
import {studio,bed} from '../modeling/wardrobe/audit/views.mjs';

test('visual checks have stable unique IDs; both hands, head lift, stride and bed turns are represented',()=>{
 const ids=[...studio,...bed].map(v=>v.id);
 assert.equal(new Set(ids).size,ids.length);
 for(const key of ['front','back','side','left-hand','right-hand','chin','stride','hem','bed-back','bed-side'])assert.ok(ids.includes(key));
});
test('offline report compares only matched framing and checks baseline image integrity',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'wardrobe-report-'));
 try{
  const data=Buffer.from('image'),shot={key:'reference/front',outfit:'reference',id:'front',part:'全身',label:'正面',file:'images/reference-front.webp',sha256:digest(data),signature:'one'};
  const report={format:1,created:'now',outfits:[{id:'reference',label:'原装'}],automated:'passed',expected:1,checks:[],shots:[shot]};
  const path=join(dir,'report.json');await mkdir(join(dir,'images'));await writeFile(join(dir,shot.file),data);await writeFile(path,JSON.stringify(report));
  const base=await loadBaseline(path),current=new Map([[shot.key,data]]);
  const page=async()=>JSON.parse((await writePage(report,current,base)).match(/id="payload">(.*?)<\/script>/s)[1]);
  const matched=await page();assert.equal(matched.gallery[0].shots[0].baseline,shot.sha256);assert.equal(Object.keys(matched.media).length,1);
  shot.signature='new angle';assert.equal((await page()).gallery[0].shots[0].baseline,null);
  await writeFile(join(dir,shot.file),'different');await assert.rejects(loadBaseline(path),/指纹/);
 }finally{await rm(dir,{recursive:true,force:true})}
});
