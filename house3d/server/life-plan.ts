import {careStatus} from '../shared/home-care.mjs';
import {transition} from './transition.js';
import {actionsFor,busy} from './objects.js';
import {clone,extra,number,record,requireValue,type Context,type Data,type State} from './types.js';

const holds=new Set(['sit','read','play','draw','lie','sleep']);
const actions=new Set([...holds,'walk_to','water','serve_rice','eat_rice','cook_rice','tidy','unpack','turn_on','turn_off']);
export const lifeActive=(p?:Data)=>!!p&&['running','paused','cancelling'].includes(p.status);
const text=(v:unknown,max:number)=>typeof v==='string'&&v.trim().length>0&&[...v].length<=max;
function condition(c:unknown,state:State,canWait:boolean){
 requireValue(record(c)&&!extra(c,canWait?['condition','target_id','on_false','timeout_seconds']:['condition','target_id']),'Invalid life condition');
 const o=state.objects.find(o=>o.id===c.target_id);
 requireValue(o,'Condition target not found');
 requireValue(c.condition==='needs_water'&&o.kind==='plant'||c.condition==='rice_ready'&&o.asset_id==='home-rice-cooker-v1'||['bowl_empty','bowl_full'].includes(c.condition)&&o.asset_id==='home-rice-bowl-v1','Condition does not match target');
 if(canWait){
  requireValue(c.on_false===undefined||['skip','wait'].includes(c.on_false),'Invalid on_false');
  if(c.timeout_seconds!==undefined)number(c.timeout_seconds,5,3600);
 }
}
function matches(c:Data,state:State,now:number){
 const o=state.objects.find(o=>o.id===c.target_id);requireValue(o,'Condition target removed');
 if(c.condition==='needs_water')return careStatus(o,now)?.needs_water;
 if(c.condition==='rice_ready')return careStatus(o,now)?.status==='ready';
 return c.condition==='bowl_full'?o.properties?.filled===true:o.properties?.filled!==true;
}
function checkpoint(p:Data,now:number,outcome:string){
 p.history.push({index:p.index,label:p.steps[p.index].label,outcome,at:now});
 p.index++;p.phase='ready';p.job_id=null;p.deadline=null;p.wait_until=null;
 if(p.index>=p.steps.length){p.status='completed';p.finished_at=now}
}
function suspend(p:Data,now:number){p.suspended_at??=now}
function unsuspend(p:Data,now:number){
 if(p.suspended_at!=null){const delta=Math.max(0,now-p.suspended_at);if(p.deadline!=null)p.deadline+=delta;if(p.wait_until!=null)p.wait_until+=delta;delete p.suspended_at}
}
function issue(state:State,p:Data,ctx:Context,snapshot:Data,now:number,tool:string,args:Data,phase:string){
 const id=`${p.id}:${p.index}:${phase}`;
 const next=transition(state,{id,tool,arguments:args},ctx,{now,navigation_start:snapshot.body});
 Object.assign(state,next);state.life_plan=p;p.phase=phase;p.job_id=id;p.deadline=now+240;
}
export function lifeCommand(input:State,command:Data,ctx:Context,snapshot:Data|null,now:number):State{
 const state=clone(input),args=command.arguments;
 requireValue(record(args),'arguments must be an object');
 if(command.tool==='set_life_plan'){
  requireValue(!extra(args,['title','steps'])&&text(args.title,60)&&Array.isArray(args.steps)&&args.steps.length>0&&args.steps.length<=16,'Use a title and 1–16 steps');
  requireValue(!lifeActive(state.life_plan),'Cancel the previous life plan first');
  requireValue(!busy(state),'Finish the current action before scheduling a plan');
  const steps=args.steps.map((s:Data)=>{
   requireValue(record(s)&&!extra(s,['action','target_id','label','duration_seconds','when','until']),'Invalid life step');
   requireValue(actions.has(s.action)&&state.objects.some(o=>o.id===s.target_id),'Unknown life action/target');
   if(s.action!=='walk_to'){
    const idle={...state,interaction:undefined};
    requireValue(actionsFor(state.objects.find(o=>o.id===s.target_id)!,ctx,idle,now).some(a=>a.id===s.action||['tidy','unpack'].includes(s.action)&&['tidy','unpack'].includes(a.id)),`Action ${s.action} not supported by ${s.target_id}`);
   }
   if(s.label!==undefined)requireValue(text(s.label,32),'Invalid step label');
   if(holds.has(s.action))number(s.duration_seconds,5,1200);
   else requireValue(s.duration_seconds===undefined&&s.until===undefined,'Only posture activities accept duration/until');
   if(s.when!==undefined)condition(s.when,state,true);
   if(s.until!==undefined)condition(s.until,state,false);
   return {...s,label:s.label??s.action};
  });
  Object.assign(state,transition(state,{tool:'set_activity',arguments:{activity:'idle'}},ctx,{now}));
  state.life_plan={id:command.id,title:args.title,steps,index:0,status:'running',phase:'ready',job_id:null,created_at:now,history:[]};
 }else{
  requireValue(!extra(args,['action'])&&['pause','resume','cancel'].includes(args.action),'Use pause, resume or cancel');
  const p=state.life_plan;requireValue(lifeActive(p),'No active life plan');
  if(args.action==='pause'){
   requireValue(p.status!=='cancelling','Cancellation is already in progress');
   p.status='paused';suspend(p,now);
  }else if(args.action==='resume'){
   requireValue(p.status==='paused','Plan is not paused');
   requireValue(!p.job_id||state.interaction?.id===p.job_id,'Action replaced by manual control; cancel this plan and create a new one');
   p.status='running';delete p.error;
   // Keep its clock suspended until a fresh executor is available.
  }else if(p.job_id&&state.interaction?.id===p.job_id&&busy(state)){
   requireValue(snapshot,'Executor feedback required for safe cancellation');
   issue(state,p,ctx,snapshot,now,'cancel_action',{job_id:p.job_id},'cancelling');
   p.status='cancelling';
  }else{p.status='cancelled';p.finished_at=now}
 }
 state.revision=input.revision+1;return state;
}
export function interruptLife(state:State,now:number){
 const p=state.life_plan;if(!lifeActive(p)||p.status==='cancelling')return;
 p.status='paused';p.error='已让出控制，等待继续安排';suspend(p,now);
}

// Called by the existing server, not by a second actor or a model polling loop.
export function tickLife(input:State,ctx:Context,snapshot:Data|null,now:number):State|null{
 if(!lifeActive(input.life_plan)||input.life_plan.status==='paused')return null;
 const state=clone(input),p=state.life_plan,before=JSON.stringify(p);
 const fresh=snapshot?.visible&&!snapshot.paused&&now-snapshot.received_at<6;
 if(!fresh){suspend(p,Math.min(now,(snapshot?.received_at??now)+6));p.wait_reason='等待小家恢复活动'}
 else{
  unsuspend(p,now);delete p.wait_reason;
  try{
   const step=p.steps[p.index],job=state.interaction;
   if(p.phase==='ready'||p.phase==='waiting'){
    requireValue(!busy(state),'Body is occupied by another action');
    if(snapshot!.body.pose!=='stand'||snapshot!.body.moving)return null;
    if(step.when&&!matches(step.when,state,now)){
     if((step.when.on_false??'skip')==='skip')checkpoint(p,now,'skipped');
     else {p.phase='waiting';p.wait_until??=now+(step.when.timeout_seconds??1900);requireValue(now<p.wait_until,'Condition wait timed out');p.wait_reason='等一等，再继续'}
    }else{
     p.wait_until=null;
     if(step.action==='walk_to')issue(state,p,ctx,snapshot!,now,'walk_to',{target_id:step.target_id},'walking');
     else if(holds.has(step.action)||step.action==='water')issue(state,p,ctx,snapshot!,now,'interact',{target_id:step.target_id,action:step.action},'performing');
     else issue(state,p,ctx,snapshot!,now,'walk_to',{target_id:step.target_id},'approaching');
    }
   }else{
    requireValue(job&&job.id===p.job_id,'Action replaced; a new plan is required');
    requireValue(job.phase!=='failed',job.error||'Action failed');
    if(p.deadline!=null)requireValue(now<=p.deadline+(p.phase==='holding'?240:0),'Action timed out');
    const body=snapshot!.body,confirmed=snapshot!.job_id===p.job_id&&!body.moving&&snapshot!.received_at>=(job.feedback_after??0);
    if(confirmed&&job.phase==='completed'&&body.pose==='stand'&&Math.hypot(body.x-state.character.x,body.z-state.character.z)<=.08){
     if(p.status==='cancelling'){p.status='cancelled';p.finished_at=now}
     else if(p.phase==='approaching'){
      const next=transition(state,{tool:'interact',arguments:{target_id:step.target_id,action:step.action}},ctx,{now,navigation_start:body});
      Object.assign(state,next);state.life_plan=p;checkpoint(p,now,'completed');
     }else checkpoint(p,now,'completed');
    }else if(confirmed&&job.phase==='active'&&body.pose===step.action&&p.phase==='performing'&&holds.has(step.action)){
     p.phase='holding';p.deadline=now+step.duration_seconds;
    }else if(confirmed&&p.phase==='holding'){
     requireValue(job.phase==='active'&&body.pose===step.action,'Posture no longer matches the plan');
     if(now>=p.deadline||step.until&&matches(step.until,state,now))
      issue(state,p,ctx,snapshot!,now,'cancel_action',{job_id:p.job_id},'leaving');
    }
   }
  }catch(error){p.status='needs_attention';p.error=(error as Error).message;p.finished_at=now}
 }
 if(JSON.stringify(p)===before)return null;
 state.revision=input.revision+1;return state;
}
