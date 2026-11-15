import {execFileSync} from 'node:child_process';
import {existsSync,lstatSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';

const rules=[
 ['private-key',/-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/g],
 ['github-token',/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})/g],
 ['model-key',/\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{24,}/g],
 ['aws-access-key',/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
 ['literal-credential',/\b(?:password|passwd|api_key|apiKey|client_secret|access_token|refresh_token)["']?\s*[:=]\s*["']([^"'\s]{8,})["']/gi],
 ['authenticated-url',/https?:\/\/[^\s/:"'<>]+:[^\s/@"'<>]+@/g],
 ['signed-download',/https?:\/\/[^\s"'<>]+[?&](?:X-Amz-Signature|OSSAccessKeyId|X-Goog-Signature|Signature)=[^\s"'<>]+/gi],
];
export function inspectText(text){
 const found=[];
 for(const [rule,pattern] of rules){
  pattern.lastIndex=0;
  for(const m of text.matchAll(pattern)){
   if(rule==='literal-credential'&&/^(?:(?:test|fake|dummy|example|placeholder)(?:[-_](?:password|token|secret|key))?|your[-_](?:password|token|secret|key)|<[^>]+>|\$\{[^}]+\}|process\.env\.[A-Z0-9_]+)$/i.test(m[1]))continue;
   found.push({rule,line:text.slice(0,m.index).split('\n').length});
  }
 }
 const paths=/\/(?:Users|home)\/[^\s/"'<>]+\//g;
 for(const m of text.matchAll(paths))found.push({rule:'personal-absolute-path',line:text.slice(0,m.index).split('\n').length,review:true});
 return found;
}
export function inspectPath(path){
 if(/(?:^|\/)(?:node_modules|artifacts|\.git|\.venv)(?:\/|$)|^house3d\/(?:data|run)\//.test(path))return 'local-directory';
 if(/(?:^|\/)\.env(?:\..*)?$/.test(path)&&!/(?:example|sample|template)$/.test(path))return 'environment-file';
 if(/(?:^|\/)(?:\.npmrc|\.netrc|\.pypirc|id_rsa|id_ed25519|cookies(?:\.json|\.txt)?)$|\.(?:sqlite(?:-wal|-shm)?|db|log|pid|har|pem|p12|pfx|key|zip|blend)$/.test(path))return 'private-or-local-file';
 return null;
}
export function textPayload(bytes,path){
 if(bytes.subarray(0,4).toString()==='glTF'){
  if(bytes.length<20||bytes.readUInt32LE(16)!==0x4e4f534a)throw Error('Invalid GLB metadata: '+path);
  return bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8');
 }
 if(path.endsWith('.gz'))return gunzipSync(bytes,{maxOutputLength:64*1024*1024}).toString('utf8');
 if(/\.(?:png|jpe?g|webp|woff2?)$/i.test(path)||bytes.subarray(0,8192).includes(0))return null;
 return bytes.toString('utf8');
}
export function imageMetadata(bytes){
 // Read only TIFF IFD tags in JPEG EXIF; do not strip metadata or rewrite pixels.
 if(bytes[0]!==255||bytes[1]!==216)return [];
 let at=2;
 while(at+4<bytes.length){
  if(bytes[at]!==255)break;
  const marker=bytes[at+1];if(marker===0xda||marker===0xd9)break;
  const size=bytes.readUInt16BE(at+2);if(size<2||at+2+size>bytes.length)break;
  if(marker===0xe1&&bytes.subarray(at+4,at+10).toString('binary')==='Exif\x00\x00'){
   const t=bytes.subarray(at+10,at+2+size),le=t.subarray(0,2).toString()==='II';
   const u16=i=>le?t.readUInt16LE(i):t.readUInt16BE(i),u32=i=>le?t.readUInt32LE(i):t.readUInt32BE(i);
   if(t.length<8)return ['invalid-exif'];
   const tags=[],seen=new Set(),visit=offset=>{
    if(seen.has(offset)||offset+2>t.length)return;seen.add(offset);
    for(let i=0,n=u16(offset);i<n;i++){
     const p=offset+2+i*12;if(p+12>t.length)break;
     const tag=u16(p);
     if([0x8825,0x013b,0x9c9d,0xa430,0xa431,0xa435].includes(tag))tags.push(tag===0x8825?'gps-ifd':'identity-tag-'+tag.toString(16));
     if([0x8769].includes(tag))visit(u32(p+8));
    }
   };visit(u32(4));return tags;
  }
  at+=size+2;
 }
 return [];
}
export function audit(root,{history=false}={}){
 const git=(args,input)=>execFileSync('git',args,{cwd:root,input,maxBuffer:256*1024*1024});
 const findings=[],current=[...new Set(git(['ls-files','--cached','--others','--exclude-standard','-z']).toString().split('\0').filter(Boolean))];
 const scan=(path,bytes,scope,object)=>{
  const where={scope,path,...(object?{object}:{})},bad=inspectPath(path);
  if(bad)findings.push({...where,rule:bad});
  const text=textPayload(bytes,path);
  if(text!==null)for(const f of inspectText(text))findings.push({...where,...f});
  if(scope==='working-tree')for(const tag of imageMetadata(bytes))findings.push({...where,rule:'image-'+tag,review:true});
 };
 let currentBytes=0,currentFiles=0,glbMetadata=0;
 for(const path of current){if(!existsSync(resolve(root,path)))continue;currentFiles++;if(lstatSync(resolve(root,path)).isSymbolicLink()){findings.push({scope:'working-tree',path,rule:'symlink-review',review:true});continue}const bytes=readFileSync(resolve(root,path));currentBytes+=bytes.length;if(bytes.subarray(0,4).toString()==='glTF')glbMetadata++;scan(path,bytes,'working-tree')}
 let historyBlobs=0;
 if(history){
  const objects=git(['rev-list','--objects','--all']).toString().trim().split('\n').map(line=>{const i=line.indexOf(' ');return {id:i<0?line:line.slice(0,i),path:i<0?'':line.slice(i+1)}});
  const metadata=git(['cat-file','--batch-check=%(objectname) %(objecttype)'],objects.map(o=>o.id).join('\n')+'\n').toString().trim().split('\n');
  const blobs=objects.filter((o,i)=>metadata[i]?.endsWith(' blob'));
  for(let start=0;start<blobs.length;start+=16){
   const batch=blobs.slice(start,start+16),raw=git(['cat-file','--batch'],batch.map(o=>o.id).join('\n')+'\n');let cursor=0;
   for(const o of batch){
    const end=raw.indexOf(10,cursor),size=Number(raw.subarray(cursor,end).toString().split(' ')[2]);
    if(end<0||!Number.isSafeInteger(size))throw Error('Invalid Git object stream');
    const bytes=raw.subarray(end+1,end+1+size);scan(o.path,bytes,'reachable-history',o.id);historyBlobs++;cursor=end+size+2;
   }
  }
 }
 return {checked_at:new Date().toISOString(),scope:{working_tree_files:currentFiles,working_tree_bytes:currentBytes,glb_metadata:glbMetadata,history_requested:history,reachable_history_blobs:historyBlobs},blockers:findings.filter(f=>!f.review),review:findings.filter(f=>f.review),limitations:['Pattern scan only; not a guarantee that all secrets or personal information have been detected.','History covers reachable local refs, not unreachable objects, remote-only refs, GitHub Issues/PRs, LFS storage or old release attachments.','Asset licences and redistribution rights require separate human review; no clean-rights certificate is issued.','Binary pixels and embedded model textures need visual review; only GLB JSON, gzip text and selected JPEG EXIF identity/GPS tags are inspected.']};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),history=args.includes('--history'),oi=args.indexOf('--output');
 if(args.some((v,i)=>!['--history','--output'].includes(v)&&!(oi>=0&&i===oi+1))||oi>=0&&!args[oi+1])throw Error('Usage: node tools/check-public.mjs [--history] [--output FILE]');
 const root=fileURLToPath(new URL('../',import.meta.url)),report=audit(root,{history});
 if(oi>=0){const file=resolve(args[oi+1]);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,JSON.stringify(report,null,2)+'\n')}
 console.log(JSON.stringify(report,null,2));if(report.blockers.length)process.exitCode=1;
}
