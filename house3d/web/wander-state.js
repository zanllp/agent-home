import {roomDimensions} from './room-size.js';
// Repeated same-value commands must still reach a viewer changed by local controls.
const values=(s,key)=>key==='position'?[s.character.x,s.character.z,s.character.yaw]:key==='activity'?s.character.activity:s[key];
export function changedControls(previous,next){
 return ['camera','light','note','position','activity'].filter(key=>{
  const revision=next.control_revisions?.[key];
  if(!previous)return key==='light'||revision!==undefined;
  return revision!==previous.control_revisions?.[key]||JSON.stringify(values(previous,key))!==JSON.stringify(values(next,key));
 });
}
export const LIGHTING={
 day:{sky:'#f3efe6',sun:2.15,ambient:.68,environment:.60,exposure:1.05,sunColor:'#fff0d8',window:2.8,bounce:1.1,tint:'#ffffff',opacity:0},
 evening:{sky:'#efe1cc',sun:1.4,ambient:.42,environment:.45,exposure:1.05,sunColor:'#ffd2a0',window:1.4,bounce:.85,tint:'#b76331',opacity:.06},
 night:{sky:'#354258',sun:.09,ambient:.25,environment:.25,exposure:1.05,sunColor:'#bccff1',window:.18,bounce:.12,tint:'#172a47',opacity:.38},
};

// Property / label changes must not throw away an in-flight walking route.
export function navigationKey(objects,room={}){return JSON.stringify([roomDimensions(room),objects.map(({id,kind,asset_id,x,z,yaw,properties})=>({id,kind,asset_id,x,z,yaw,...(id===room.balcony?.door_id?{open:properties?.open!==false}:{})}))])}
