import {spawn} from 'node:child_process';
import {setTimeout as wait} from 'node:timers/promises';
import {join} from 'node:path';
import {createServer} from 'vite';

// Chromium's private debugging pipe, not the user's browser or a TCP debugger.
export async function renderStudio({root,tmp,chrome,outfits,views,record}){
 const vite=await createServer({root,configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false},cacheDir:join(tmp,'vite')});
 let chromeProcess,closed;
 try{
  await vite.listen();const url=vite.resolvedUrls.local[0]+'modeling/wardrobe/?audit';
  chromeProcess=spawn(chrome,['--headless','--no-first-run','--disable-extensions','--remote-debugging-pipe','--use-angle=swiftshader','--enable-unsafe-swiftshader','--user-data-dir='+join(tmp,'studio-profile'),'about:blank'],{stdio:['ignore','ignore','ignore','pipe','pipe']});
  const [input,output]=chromeProcess.stdio.slice(3);const pending=new Map();let seq=0,buf='';
  const fail=e=>{for(const f of pending.values())f({error:{message:e.message}});pending.clear()};
  closed=new Promise(resolve=>{chromeProcess.once('error',e=>{fail(e);resolve()});chromeProcess.once('exit',()=>{fail(Error('验收浏览器退出'));resolve()})});
  input.on('error',fail);output.setEncoding('utf8').on('data',s=>{
   buf+=s;let end;while((end=buf.indexOf('\0'))>=0){const msg=JSON.parse(buf.slice(0,end));buf=buf.slice(end+1);pending.get(msg.id)?.(msg)}
  });
  const rpc=(method,params={},sessionId)=>new Promise((resolve,reject)=>{
   const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error('浏览器超时：'+method))},45000);
   pending.set(id,msg=>{clearTimeout(timer);pending.delete(id);msg.error?reject(Error(msg.error.message)):resolve(msg.result)});
   input.write(JSON.stringify({id,method,params,sessionId})+'\0');
  });
  const {targetId}=await rpc('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await rpc('Target.attachToTarget',{targetId,flatten:true});
  async function evaluate(expression){
   const r=await rpc('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);
   if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
   return r.result.value;
  }
  await rpc('Page.navigate',{url},sessionId);
  const deadline=Date.now()+90000;
  while(!await evaluate('!!window.review?.capture')){if(Date.now()>deadline)throw Error('试衣间未就绪');await wait(150)}
  for(const {id} of outfits){
   await evaluate('review.dress('+JSON.stringify(id)+')');
   for(const v of views){const data=await evaluate('review.capture('+JSON.stringify(v)+')');await record(id,v,Buffer.from(data,'base64'),'webp')}
  }
 }finally{if(chromeProcess){chromeProcess.kill('SIGKILL');await closed}await vite.close()}
}
