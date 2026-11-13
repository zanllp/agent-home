import {createNavigation} from './navigation.mjs';
import {planObjectDestination} from './object-destination.mjs';
export function supportHeight(o,objects,assets,seen=new Set()){
 if(!o||seen.has(o.id))return 0;seen.add(o.id);
 if(!o.on)return assets[o.asset_id]?.elevation||0;
 const p=objects.find(p=>p.id===o.on.id);
 return supportHeight(p,objects,assets,seen)+(assets[p?.asset_id]?.surfaces?.[o.on.surface]?.height||0)+(assets[o.asset_id]?.support_offset||0);
}
export function waterPlan(objects,catalog,assets,room,start,id,canId,nav){
 const plant=objects.find(o=>o.id===id),fail=reason=>({ok:false,reason});
 if(plant?.kind!=='plant')return fail('先选择一盆绿植');
 const height=supportHeight(plant,objects,assets)+(assets[plant.asset_id]?.watering_height||.16);
 if(height>1.02)return fail('这盆花太高，先移到够得到的地方');
 nav??=createNavigation(objects,catalog,{assets,room});
 const cans=objects.filter(o=>o.asset_id==='home-watering-can-v1'&&(!canId||o.id===canId)&&supportHeight(o,objects,assets)<.95);
 let best;
 for(const can of cans){
  const pickup=planObjectDestination(objects,catalog,assets,room,start,can.id,nav);if(!pickup.ok)continue;
  const dest=planObjectDestination(objects,catalog,assets,room,pickup.point,plant.id,nav);if(!dest.ok)continue;
  if(Math.hypot(dest.point.x-plant.x,dest.point.z-plant.z)>1.12)continue;
  const distance=pickup.distance+dest.distance;
  if(!best||distance<best.distance)best={ok:true,can_id:can.id,pickup:pickup.point,target:{...dest.point,yaw:Math.atan2(plant.x-dest.point.x,plant.z-dest.point.z)},soil:{x:plant.x,y:height,z:plant.z},distance};
 }
 return best||fail(cans.length?'走不到水壶或花盆旁，请先留出通道':'先放一个小水壶，再来浇花');
}
