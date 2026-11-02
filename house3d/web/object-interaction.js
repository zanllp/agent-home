import {shortestAngle,createNavigation} from './wander-navigation.js';
export const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
export function worldPoint(obj,[x,y,z]){const c=Math.cos(obj.yaw),s=Math.sin(obj.yaw);return {x:obj.x+x*c+z*s,y,z:obj.z-x*s+z*c,yaw:obj.yaw}}
const mix=(a,b,t)=>a+(b-a)*t;
export function contactFrame(kind,start,target,progress){
 const p=Math.max(0,Math.min(1,progress)),sleep=kind==='sleep';
 let t=ease(sleep?Math.min(1,p/.4):p),r=sleep?ease((p-.4)/.6):0;
 const seatY=sleep?.18:target.y;
 return {x:mix(start.x,target.x,t),z:mix(start.z,target.z,t),y:mix(start.y,seatY,t)+.08*Math.sin(Math.PI*t)+(target.y-seatY)*r,yaw:start.yaw+shortestAngle(start.yaw,target.yaw)*t,pitch:r?-Math.PI/2*r:0,sit:t*(1-r),sleep:r};
}
export function chooseApproach(obj,config,nav,start){
 return config.approaches.map((p,index)=>({point:worldPoint(obj,p),index})).filter(v=>nav.free(v.point)).map(v=>({...v,path:nav.path(start,v.point)})).filter(v=>v.path).sort((a,b)=>length(a.path)-length(b.path))[0]||null;
}
function length(path){return path.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-path[i].x,p.z-path[i].z),0)}
export function createObjectInteraction({context,onStart,onExit,onStatus,report}){
 let job=null,phase='none',start,target,index=0,time=0,progress=0,leaveFrom=1,queue=Promise.resolve(),kind='sit',lastFrame=null;
 function send(next,error){const id=job.id,body={phase:next,approach_index:index,...(error?{error}: {}),...(next==='completed'&&job.action==='leave'?{position:((s)=>({x:s.x,z:s.z,yaw:s.yaw}))(context().walker.state)}:{})};queue=queue.then(()=>report(id,body)).catch(e=>onStatus('互动状态暂时没同步：'+e.message));}
 function consume(next){
  if(!next||next.id===job?.id||['completed','failed'].includes(next.phase))return;
  const old=job,oldPhase=phase;job=next;kind=next.pose;const ctx=context();
  if(kind==='walk'){
   onStart();progress=0;target=next.target;
   if(next.action==='leave'){ctx.walker.stop();phase='none';onExit({...ctx.walker.state});send('completed');return}
   if(!ctx.walker.go(target)){phase='none';onStatus('那里走不过去，换一块空地吧');send('failed','No collision-free route to the destination');return}
   phase='approaching';send('approaching');return;
  }
  const obj=ctx.objects.find(o=>o.id===next.target_id),config=ctx.assets[obj?.asset_id]?.interactions?.[['draw','read'].includes(kind)?'sit':kind];
  if(!config){phase='none';return}
  onStart();target=worldPoint(obj,config.root);target.yaw+=config.yaw||0;if(kind==='play')target.y+=ctx.groundHeight(obj.x,obj.z);
  if(next.action==='leave'){
   index=next.approach_index??index;start={...worldPoint(obj,config.approaches[index]),y:ctx.groundHeight(...['x','z'].map(k=>worldPoint(obj,config.approaches[index])[k]))};
   if(old?.target_id===next.target_id&&oldPhase==='approaching'||!next.from_active){ctx.walker.stop();phase='none';onExit({...ctx.walker.state});send('completed');return}
   leaveFrom=old?.target_id===next.target_id?progress:1;time=0;phase='leaving';send('leaving');return;
  }
  if(next.phase==='active'||next.phase==='entering'){
   index=next.approach_index??0;start=worldPoint(obj,config.approaches[index]);start.y=ctx.groundHeight(start.x,start.z);phase='active';progress=1;
   if(next.phase==='entering')send('active');return;
  }
  const entryNav=createNavigation(ctx.objects.filter(o=>o.id!==obj.id),ctx.catalog||{},{assets:ctx.assets,radius:.32,room:ctx.room});
  const candidates={...config,approaches:config.approaches};
  const entryChecked={...ctx.nav,free:p=>ctx.nav.free(p)&&entryNav.line(p,target)};
  const choice=chooseApproach(obj,candidates,entryChecked,ctx.walker.state);
  if(!choice){index=0;phase='none';onStatus('走不到那里，先挪开挡路的家具吧');send('failed','No reachable approach point; move blocking furniture and retry');return}
  index=choice.index;start=choice.point;start.y=ctx.groundHeight(start.x,start.z);ctx.walker.go(start);phase='approaching';progress=0;send('approaching');
 }
 function tick(dt){
  const ctx=context();
  if(phase==='approaching'&&kind==='walk'){
   onStatus('走过去，看看那边');
   if(!ctx.walker.state.route.length){const reached=Math.hypot(ctx.walker.state.x-target.x,ctx.walker.state.z-target.z)<.035;phase='none';onExit({...ctx.walker.state});send(reached?'completed':'failed',reached?null:'Route was interrupted before arrival')}
   return null;
  }
  if(phase==='approaching'){
   onStatus('走过去，准备'+(kind==='sleep'?'上床':'坐下'));
   if(!ctx.walker.state.route.length){
    const s=ctx.walker.state,delta=shortestAngle(s.yaw,target.yaw);s.yaw+=Math.sign(delta)*Math.min(Math.abs(delta),dt*2.2);
    if(Math.abs(delta)<.03){start={x:s.x,z:s.z,y:ctx.groundHeight(s.x,s.z),yaw:s.yaw};phase='entering';time=0;send('entering')}
   }
   return null;
  }
  if(!['entering','active','leaving'].includes(phase))return null;
  const duration=kind==='sleep'?3.6:1.8;
  if(phase==='entering'){time+=dt;progress=Math.min(1,time/duration);onStatus(kind==='sleep'?'坐稳，再慢慢躺下':'慢慢坐好');if(progress===1){phase='active';send('active')}}
  if(phase==='leaving'){time+=dt;progress=leaveFrom*(1-ease(time/duration));onStatus(kind==='sleep'?'醒一醒，慢慢下床':'起身，站稳');if(time>=duration){phase='none';lastFrame=null;onExit(start);send('completed');return null}}
  lastFrame=contactFrame(kind,start,target,progress);lastFrame.read=kind==='read'?ease((progress-.65)/.35):0;
  lastFrame.draw=kind==='draw'?ease((progress-.55)/.45):0;
  lastFrame.play=kind==='play'?ease((progress-.22)/.78):0;
  if(phase==='active'){onStatus(kind==='sleep'?'呼……睡得香香的':kind==='play'?(ctx.objects.find(o=>o.id===job.target_id)?.properties?.packed?'玩具收好啦，在软垫上歇一会儿':'坐在软垫上，摆弄小机器人'):kind==='draw'?'扶着绘本，用蜡笔慢慢画':kind==='read'?'翻开书，安静读一会儿':'坐一会儿，歇歇小脚');lastFrame.y+=.0015*Math.sin(time*1.6);time+=dt}
  return lastFrame;
 }
 return {consume,tick,get busy(){return ['approaching','entering','active','leaving'].includes(phase)},get phase(){return phase},get pose(){return kind},get frame(){return lastFrame},get targetId(){return job?.target_id},get jobId(){return job?.id},get relatedId(){return job?.related_id},flush(){return queue}};
}
