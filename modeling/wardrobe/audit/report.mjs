import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,join} from 'node:path';

export const digest=b=>createHash('sha256').update(b).digest('hex');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export async function loadBaseline(path){
 const r=JSON.parse(await readFile(path,'utf8'));
 if(r.format!==1||r.automated!=='passed'||!Array.isArray(r.shots))throw Error('基准必须是一次完整通过的 report.json');
 const images=new Map();
 for(const s of r.shots){
  if(!/^images\/[a-z0-9-]+\.(webp|png)$/.test(s.file))throw Error('基准图片路径无效');
  const b=await readFile(join(dirname(path),s.file));
  if(digest(b)!==s.sha256)throw Error('基准图片指纹不匹配：'+s.file);
  images.set(s.key,{...s,data:b});
 }
 return images;
}
export async function writePage(r,current,baseline){
 const template=await readFile(new URL('./report.html',import.meta.url),'utf8');
 // Each image appears only once in the file, including unchanged comparisons.
 const media=new Map();
 function pic(bytes,ext){
  const key=digest(bytes);if(!media.has(key))media.set(key,'data:image/'+ext+';base64,'+bytes.toString('base64'));return key;
 }
 const gallery=r.outfits.map(o=>{
  const shots=r.shots.filter(s=>s.outfit===o.id);
  return {id:o.id,label:o.label,shots:shots.map(s=>{
   const old=baseline?.get(s.key),match=old?.signature===s.signature;
   return {...s,image:pic(current.get(s.key),s.file.split('.').pop()),baseline:match?pic(old.data,old.file.split('.').pop()):null,
    note:baseline&&!match?(old?'机位或动作已变，不与旧图并排':'本项没有基准图'):null};
  })};
 });
 const payload=JSON.stringify({gallery,media:Object.fromEntries(media),hasBaseline:!!baseline}).replaceAll('<','\\u003c');
 return template.replace('<!--STAMP-->',esc(r.created)).replace('<!--STATUS-->',r.automated==='passed'?'自动检查通过':'验收未通过')
  .replace('<!--SUMMARY-->',esc(r.outfits.length+' 套服装 · '+r.shots.length+' / '+r.expected+' 张实拍'))
  .replace('<!--CHECKS-->',r.checks.map(c=>'<li>'+esc((c.ok?'通过 · ':'失败 · ')+c.label)+(c.ok?'':'<pre>'+esc(c.detail)+'</pre>')+'</li>').join(''))
  .replace('<!--DATA-->',()=>payload);
}
