import {createWaterInteraction} from './water-interaction.js';
import {shortestAngle} from './wander-navigation.js';
import {worldPoint,interactionApproach} from '../shared/interaction-approach.mjs';
export {worldPoint,chooseApproach} from '../shared/interaction-approach.mjs';
export const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
const mix=(a,b,t)=>a+(b-a)*t;
export function contactFrame(kind,start,target,progress){
 const p=Math.max(0,Math.min(1,progress)),sleep=kind==='sleep'||kind==='lie';
 let t=ease(sleep?Math.min(1,p/.4):p),r=sleep?ease((p-.4)/.6):0;
 const seatY=sleep?(target.seatY??.18):target.y;
 return {x:mix(start.x,target.x,t),z:mix(start.z,target.z,t),y:mix(start.y,seatY,t)+.08*Math.sin(Math.PI*t)+(target.y-seatY)*r,yaw:start.yaw+shortestAngle(start.yaw,target.yaw)*t,pitch:r?(-Math.PI/2+.125)*r:0,sit:t*(1-r),sleep:r,awake:kind==='lie'?r:0,sofa:target.sofa||0};
}
export function createObjectInteraction({context,onStart,onExit,onStatus,report}){
 const water=createWaterInteraction({context,onStart,onExit,onStatus,report});let watering=false;
 let switchFrom=null,exitStart=null,playSurface='软垫',job=null,phase='none',start,target,approachPoint,index=0,time=0,progress=0,leaveFrom=1,queue=Promise.resolve(),kind='sit',lastFrame=null;
 function send(next,error){const id=job.id,body={phase:next,approach_index:index,...(error?{error}: {}),...(next==='completed'&&job.action==='leave'?{position:((s)=>({x:s.x,z:s.z,yaw:s.yaw}))(context().walker.state)}:{})};queue=queue.then(()=>report(id,body)).catch(e=>{if(job?.id===id)onStatus('互动状态暂时没同步：'+e.message)});}
 function consume(next){
  if(next?.forced && next.phase==='failed'){
   if(job?.id===next.id && !watering && phase==='none')return;
   water.reset();watering=false;job=next;phase='none';lastFrame=null;switchFrom=null;exitStart=null;progress=0;
   const ctx=context();ctx.walker.stop();onStart();onExit({...ctx.walker.state,...next.recovery_position});
   onStatus('已强制退出，旧动作没有算作完成');return;
  }
  if(watering && next?.pose!=="water" && next?.id!==water.jobId)water.reset();
  if(next?.pose==="water"){watering=true;water.consume(next);return}watering=false;
  if(!next||next.id===job?.id||['completed','failed'].includes(next.phase))return;
  const old=job,oldPhase=phase,oldFrame=lastFrame;job=next;kind=next.pose;const ctx=context();
  if(kind==='walk'){
   onStart();progress=0;lastFrame=null;target=next.target;
   if(next.action==='leave'){ctx.walker.stop();phase='none';onExit({...ctx.walker.state});send('completed');return}
   if(!ctx.walker.go(target)){phase='none';onStatus('那里走不过去，换一块空地吧');send('failed','No collision-free route to the destination');return}
   phase='approaching';send('approaching');return;
  }
  const obj=ctx.objects.find(o=>o.id===next.target_id),config=ctx.assets[obj?.asset_id]?.interactions?.[['draw','read'].includes(kind)?'sit':kind];
  if(!config){phase='none';return}
  onStart();target=worldPoint(obj,config.root);target.yaw+=config.yaw||0;
  target.seatY=ctx.assets[obj.asset_id].interactions?.sit?.root[1]??.18;
  target.sofa=obj.kind==='sofa'?(config.yaw>0?-1:1):0;
  if(next.from_pose&&next.phase==='requested'){
   index=next.approach_index??0;start=worldPoint(obj,config.approaches[index]);start.y=ctx.groundHeight(start.x,start.z);
   const prior=ctx.assets[obj.asset_id].interactions[next.from_pose],priorTarget={...worldPoint(obj,prior.root),yaw:obj.yaw+(prior.yaw||0),sofa:obj.kind==='sofa'?(prior.yaw>0?-1:1):0};
   switchFrom=old?.target_id===next.target_id&&oldFrame?{...oldFrame}:contactFrame(next.from_pose,start,priorTarget,1);
   time=0;progress=0;phase='entering';send('entering');return;
  }
  switchFrom=null;
  if(kind==='play'){
   const rugKit=!!ctx.assets[obj.asset_id].assembly_guide,height=ctx.groundHeight(rugKit?target.x:obj.x,rugKit?target.z:obj.z);target.y+=height;
   playSurface=rugKit?(height>.006?'地毯':'地板'):'软垫';
  }
  if(next.action==='leave'){
   index=next.approach_index??index;start={...worldPoint(obj,config.approaches[index]),y:ctx.groundHeight(...['x','z'].map(k=>worldPoint(obj,config.approaches[index])[k]))};
   if(old?.target_id===next.target_id&&oldPhase==='approaching'||!next.from_active){ctx.walker.stop();phase='none';onExit({...ctx.walker.state});send('completed');return}
   leaveFrom=old?.target_id===next.target_id?progress:1;exitStart=oldFrame?{...oldFrame}:null;time=0;phase='leaving';send('leaving');return;
  }
  if(next.phase==='active'||next.phase==='entering'){
   index=next.approach_index??0;start=worldPoint(obj,config.approaches[index]);start.y=ctx.groundHeight(start.x,start.z);phase='active';progress=1;
   if(next.phase==='entering')send('active');return;
  }
  const choice=interactionApproach(obj,config,ctx.nav,ctx.walker.state,{objects:ctx.objects,catalog:ctx.catalog||{},assets:ctx.assets,room:ctx.room||{}});
  if(!choice){index=0;phase='none';onStatus('走不到那里，先挪开挡路的家具吧');send('failed','No reachable approach point; move blocking furniture and retry');return}
  index=choice.index;start=choice.point;approachPoint={...choice.point};start.y=ctx.groundHeight(start.x,start.z);ctx.walker.go(start);phase='approaching';progress=0;send('approaching');
 }
 function tick(dt){
  if(watering)return water.tick(dt);
  const ctx=context();
  if(phase==='approaching'&&kind==='walk'){
   onStatus('走过去，看看那边');
   if(!ctx.walker.state.route.length){const reached=Math.hypot(ctx.walker.state.x-target.x,ctx.walker.state.z-target.z)<.035;phase='none';onExit({...ctx.walker.state});send(reached?'completed':'failed',reached?null:'Route was interrupted before arrival')}
   return null;
  }
  if(phase==='approaching'){
   onStatus('走过去，准备'+(['sleep','lie'].includes(kind)?'躺下':'坐下'));
   if(!ctx.walker.state.route.length){
    if(Math.hypot(ctx.walker.state.x-approachPoint.x,ctx.walker.state.z-approachPoint.z)>=.035){phase='none';onStatus('还没走到家具旁，路线被打断了');send('failed','Route was interrupted before reaching the approach point');return null}
    const s=ctx.walker.state,delta=shortestAngle(s.yaw,target.yaw);s.yaw+=Math.sign(delta)*Math.min(Math.abs(delta),dt*2.2);
    if(Math.abs(delta)<.03){start={x:s.x,z:s.z,y:ctx.groundHeight(s.x,s.z),yaw:s.yaw};phase='entering';time=0;send('entering')}
   }
   return null;
  }
  if(!['entering','active','leaving'].includes(phase))return null;
  const duration=['sleep','lie'].includes(kind)?3.6:1.8;
  if(phase==='entering'){time+=dt;progress=Math.min(1,time/duration);onStatus(['sleep','lie'].includes(kind)?'坐稳，再慢慢躺下':'慢慢坐好');if(progress===1){phase='active';send('active')}}
  if(phase==='leaving'){time+=dt;progress=leaveFrom*(1-ease(time/duration));onStatus(['sleep','lie'].includes(kind)?'慢慢坐起，再站稳':'起身，站稳');if(time>=duration){phase='none';lastFrame=null;onExit(start);send('completed');return null}}
  lastFrame=contactFrame(kind,start,target,progress);
  if(switchFrom&&phase!=='leaving'){
   const end=contactFrame(kind,start,target,1),t=ease(progress);
   for(const key of ['x','y','z','pitch','sit','sleep','awake','sofa'])lastFrame[key]=mix(switchFrom[key]||0,end[key]||0,t);
   lastFrame.yaw=switchFrom.yaw+shortestAngle(switchFrom.yaw,end.yaw)*t;
  }
  if(phase==='leaving'&&exitStart){
   const t=ease(Math.min(1,time/duration));
   for(const key of ['x','y','z','pitch','sit','sleep','awake','sofa'])lastFrame[key]=mix(exitStart[key]||0,key==='x'?start.x:key==='z'?start.z:key==='y'?start.y:0,t);
   lastFrame.yaw=exitStart.yaw+shortestAngle(exitStart.yaw,start.yaw)*t;
  }lastFrame.read=kind==='read'?ease((progress-.65)/.35):0;
  lastFrame.draw=kind==='draw'?ease((progress-.55)/.45):0;
  lastFrame.play=kind==='play'?ease((progress-.22)/.78):0;
  if(phase==='active'){onStatus(kind==='sleep'?'呼……睡得香香的':kind==='lie'?'躺舒服啦，歇一会儿':kind==='play'?(ctx.objects.find(o=>o.id===job.target_id)?.properties?.packed?'玩具收好啦，在'+playSurface+'上歇一会儿':'坐在'+playSurface+'上，摆弄小机器人'):kind==='draw'?'扶着绘本，用蜡笔慢慢画':kind==='read'?'翻开书，安静读一会儿':'坐一会儿，歇歇小脚');lastFrame.y+=.0015*Math.sin(time*1.6);time+=dt}
  return lastFrame;
 }
 return {consume,tick,get busy(){if(watering)return water.busy;return ['approaching','entering','active','leaving'].includes(phase)},get phase(){return watering?water.phase:phase},get pose(){return watering?water.pose:kind},get frame(){return watering?water.frame:lastFrame},get targetId(){return watering?water.targetId:job?.target_id},get jobId(){return watering?water.jobId:job?.id},get relatedId(){return watering?water.relatedId:job?.related_id},flush(){return watering?water.flush():queue}};
}
