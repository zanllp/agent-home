import {waterPlan} from '../shared/water-plan.mjs';
import {createNavigation} from '../shared/navigation.mjs';
import {interactionApproach} from '../shared/interaction-approach.mjs';
import {routeLength} from '../shared/object-destination.mjs';
import {objectList} from './objects.js';
import {type Context,type State,type Data} from './types.js';

const POSES=new Set(['sit','lie','sleep','read','draw','play','water']);

export function interactionList(state:State,ctx:Context,snapshot:Data|null,now:number,category?:string|null,capability?:string|null) {
  const fresh=!!snapshot?.visible && now-snapshot.received_at<6;
  const body=snapshot?.body;
  const viewerReason=!fresh?'没有新鲜的身体反馈，请打开小家页面':snapshot?.paused?'小家已暂停，请先恢复':null;
  let nav:ReturnType<typeof createNavigation>|undefined;
  const checked=new Map<string,ReturnType<typeof interactionApproach>>();
  const objects=objectList(state,ctx,category,capability,now).objects.flatMap(obj=>{
    if(!obj.actions.length)return [];
    const actions=obj.actions.filter(a=>!capability||a.id===capability).map(action=>{
      const pose=POSES.has(action.id),bodyAction=pose||action.id==='leave';
      let available=action.available,reason=action.reason??null;
      let reachability=bodyAction?'not_checked':'not_required';
      let approach:Data|null=null;
      if(available&&bodyAction&&viewerReason){available=false;reason=viewerReason}
      if(available&&pose) {
        if(obj.kind==='sofa' && state.interaction?.target_id===obj.id && state.interaction?.phase==='active' && ['sit','lie','sleep'].includes(body?.pose)) {
          reachability='not_required';
        } else if(body?.pose!=='stand') {available=false;reason='先起身站稳，再开始新的动作'}
        else if(action.id==='water'){
          nav??=createNavigation(state.objects,ctx.catalog,{assets:ctx.assets,room:state.room??{}});
          const plan:Data=waterPlan(state.objects,ctx.catalog,ctx.assets,state.room??{},body,obj.id,undefined,nav);
          if(plan.ok){reachability='reachable';approach={...plan.target,distance_m:Math.round(plan.distance*100)/100}}
          else{available=false;reachability='blocked';reason=plan.reason}
        } else {
          nav??=createNavigation(state.objects,ctx.catalog,{assets:ctx.assets,room:state.room??{}});
          const kind=['read','draw'].includes(action.id)?'sit':action.id;
          const key=obj.id+':'+kind;
          if(!checked.has(key))checked.set(key,interactionApproach(obj,ctx.assets[obj.asset_id!].interactions![kind],nav,body,
            {objects:state.objects,catalog:ctx.catalog,assets:ctx.assets,room:state.room??{}}));
          const plan=checked.get(key);
          if(plan) {
            reachability='reachable';
            approach={x:plan.point.x,z:plan.point.z,distance_m:Math.round(routeLength(plan.path)*100)/100};
          } else {available=false;reachability='blocked';reason='没有能走到并进入该姿势的路线，请先腾出通道'}
        }
      }
      if(action.id==='leave'&&available)reachability='not_required';
      return {...action,available,reason,reachability,execution:action.id==='water'?'fetch_water_return':pose?'walk_then_pose':bodyAction?'leave_pose':'state_update',
        ...(approach?{approach}:{}),command:{tool:'interact',arguments:{target_id:obj.id,action:action.id}}};
    });
    return [{id:obj.id,label:obj.label,category:obj.category,category_label:obj.category_label,actions}];
  });
  return {revision:state.revision,fresh,body_job_id:snapshot?.job_id??null,
    position:body?{x:body.x,z:body.z,yaw:body.yaw,pose:body.pose}:null,
    objects,limitations:['Reachability uses current body and furniture clearance; execution checks the route again. State updates do not imply a walking or manipulation animation.']};
}
