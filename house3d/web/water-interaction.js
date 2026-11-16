// Finite job: fetch the placed can, pour at the plant, return the same can.
export function createWaterInteraction({context,onStart,onExit,onStatus,report}){
 let job=null,phase='none',leg='fetch',time=0,carry=0,frame=null,queue=Promise.resolve();
 const send=(next,extra={})=>{const id=job.id;queue=queue.then(()=>report(id,{phase:next,approach_index:0,...extra})).catch(e=>{if(job?.id===id)onStatus(e.message)})};
 const done=()=>{const ctx=context();phase='none';carry=0;frame=null;onExit({...ctx.walker.state});send('completed',{carrying:false,position:{x:ctx.walker.state.x,z:ctx.walker.state.z,yaw:ctx.walker.state.yaw}})};
 const walk=(p)=>{if(context().walker.go(p))return true;phase='none';carry=0;frame=null;send('failed',{error:'浇水路线被挡住了，请先留出通道'});return false};
 return {reset(){job=null;phase='none';carry=0;frame=null;time=0;context().walker.stop()},consume(next){
  if(!next||job?.id===next.id||['failed','completed'].includes(next.phase))return;
  const held=carry;job=next;onStart();time=0;
  if(next.action==='leave'){
   if(held||next.carrying){carry=1;phase='leaving';leg='return';walk(next.water.pickup);send('leaving')}else done();
   return;
  }
  carry=next.carrying?1:0;
  if(next.phase==='leaving'){phase='leaving';leg='return';walk(next.water.pickup);return}
  if(['entering','active'].includes(next.phase)){
   if(next.watered_at){phase='leaving';leg='return';walk(next.water.pickup);send('leaving');return}
   phase='entering';leg='pour';return;
  }
  phase='approaching';leg=carry?'plant':'fetch';walk(carry?next.water.target:next.water.pickup);send('approaching');
 },tick(dt){
  if(phase==='none')return null;
  const ctx=context(),s=ctx.walker.state,plan=job.water;
  if(['fetch','plant','return'].includes(leg)){
   onStatus(leg==='fetch'?'去拿小水壶':leg==='return'?'浇好啦，把水壶放回去':'提着水壶去浇花');
   const target=leg==='plant'?plan.target:plan.pickup;
   if(!s.route.length){
    if(Math.hypot(s.x-target.x,s.z-target.z)>.04){phase='none';carry=0;frame=null;send('failed',{error:'还没走到浇水落点，路线中断了'});return null}
    if(leg==='fetch'){carry=1;leg='plant';send('approaching',{carrying:true});walk(plan.target)}
    else if(leg==='return'){done();return null}
    else{
     const delta=Math.atan2(Math.sin(plan.target.yaw-s.yaw),Math.cos(plan.target.yaw-s.yaw));s.yaw+=Math.sign(delta)*Math.min(Math.abs(delta),dt*2.2);
     if(Math.abs(delta)<.025){leg='pour';phase='entering';time=0;send('entering')}
    }
   }
  }else if(leg==='pour'){
   time+=dt;onStatus('扶稳水壶，慢慢浇在土里');
   if(time>=3.2){phase='leaving';leg='return';send('active');send('leaving');walk(plan.pickup)}
  }
  frame=carry?{x:s.x,y:ctx.groundHeight(s.x,s.z),z:s.z,yaw:s.yaw,pitch:0,sit:0,sleep:0,
   walking:leg!=='pour',carry:1,pour:leg==='pour'?Math.sin(Math.PI*Math.min(1,time/3.2))**2:0,soil:plan.soil}:null;
  return frame;
 },get busy(){return phase!=='none'},get phase(){return phase},get pose(){return 'water'},get frame(){return frame},get jobId(){return job?.id},get targetId(){return job?.target_id},get relatedId(){return job?.related_id},flush(){return queue}};
}
