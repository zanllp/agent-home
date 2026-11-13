// Virtual household rules, not species-specific horticulture. All timestamps are UTC seconds.
export const RICE_CAPACITY=3,COOK_SECONDS=1800,WATER_INTERVAL=3*86400,WATER_COOLDOWN=12*3600;
export function initializeCare(state,now){
 for(const o of state.objects){
  if(o.kind==='plant'){o.properties??={};o.properties.care_started_at??=now}
  if(o.asset_id==='home-rice-cooker-v1'){
   o.properties??={};delete o.properties.keep_full;
   o.properties.servings=Math.max(0,Math.min(RICE_CAPACITY,Math.floor(o.properties.servings??RICE_CAPACITY)));
  }
 }
 return state;
}
export function settleCare(state,now){
 for(const o of state.objects)if(o.asset_id==='home-rice-cooker-v1'&&o.properties?.ready_at<=now){
  o.properties.servings=RICE_CAPACITY;o.properties.cooked_at=o.properties.ready_at;
  delete o.properties.ready_at;delete o.properties.cooking_started_at;
 }
 return state;
}
export function careStatus(o,now){
 const p=o.properties||{};
 if(o.kind==='plant'){
  const anchor=p.last_watered_at??p.care_started_at??now,age=Math.max(0,now-anchor);
  return {moisture:Math.max(0,Math.round(100*(1-age/(7*86400)))),needs_water:age>=WATER_INTERVAL,
   water_due_at:anchor+WATER_INTERVAL,water_available:p.last_watered_at==null||now-p.last_watered_at>=WATER_COOLDOWN};
 }
 if(o.asset_id==='home-rice-cooker-v1')return {status:p.ready_at>now?'cooking':(p.servings??RICE_CAPACITY)>0?'ready':'empty',
  servings:p.servings??RICE_CAPACITY,ready_at:p.ready_at??null,remaining_seconds:Math.max(0,Math.ceil((p.ready_at??now)-now))};
 return null;
}
