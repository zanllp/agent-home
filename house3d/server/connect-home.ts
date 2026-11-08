import {apartment,zoneAt,CONNECTED_HOME} from '../shared/apartment.mjs';
import {clone,requireValue,type State,type Context,type Item} from './types.js';
import {validateLayout} from './geometry.js';

// Keep the installed room's IDs and properties, including artwork and parent
// references. Only seed the other rooms; never re-apply a template over a save.
export function connectHome(state:State,ctx:Context,start:{x:number,z:number,yaw:number}|null){
 requireValue(!state.room?.floorplan,'Rooms are already connected');
 const fromChild=state.preset_id==='childroom';
 requireValue(fromChild||state.preset_id==='family-home','Start from a family-home or childroom save; unlabelled layouts are not replaced');
 if(fromChild)requireValue(state.room?.width===6&&state.room?.depth===5,'Connecting a resized child room requires a custom floorplan');
 const family=ctx.presets['family-home'],child=ctx.presets.childroom;
 const room={...clone(fromChild?family.room:state.room),floorplan:CONNECTED_HOME,child_finish:clone(fromChild?state.room:child.room)};
 const plan=apartment(room)!,zone=(id:string)=>plan.zones.find(z=>z.id===id)!;
 const childZone=zone('child'),parent=zone('parent'),bath=zone('bath');
 const objects:Item[]=[],ids=new Set<string>();
 function insert(items:Item[],dx:number,dz:number,added:boolean,prefix:string){
  const renamed=new Map<string,string>();
  for(const o of items){
   let id=added&&prefix==='child'?'childroom-'+o.id:o.id;
   if(ids.has(id)&&added)id=prefix+'-'+o.id;
   requireValue(!ids.has(id)&&id.length<=64,'Cannot connect: duplicate item ID '+id);ids.add(id);renamed.set(o.id,id);
  }
  for(const original of items){const o=clone(original);o.id=renamed.get(o.id)!;
   if(o.on)o.on.id=renamed.get(o.on.id)??o.on.id;
   else {o.x+=dx;o.z+=dz}
   objects.push(o);
  }
  return renamed;
 }
 if(fromChild){
  insert(state.objects,childZone.x,childZone.z,false,'child');
  const names=insert(family.objects,0,0,true,'living');
  room.balcony.door_id=names.get(family.room.balcony.door_id);
 }else{insert(state.objects,0,0,false,'living');insert(child.objects,childZone.x,childZone.z,true,'child')}
 const add=(id:string,asset_id:string,x:number,z:number,label?:string,yaw=0)=>{
  requireValue(!ids.has(id),'New fixture ID already exists: '+id);ids.add(id);
  objects.push({id,asset_id,kind:ctx.assets[asset_id].kind!,x,z,yaw,...(label?{label}:{})});
 };
 add('child-footstool','apartment-step-v1',childZone.x-2.55,childZone.z-.95);
 add('child-nightstand','whale-nightstand-v1',childZone.x+.70,childZone.z-2.19);
 add('child-nightlight','family-shelf-lamp-v1',0,0,'床头小夜灯');
 objects.at(-1)!.on={id:'child-nightstand',surface:'top',x:0,z:0,yaw:0};
 objects.at(-1)!.properties={on:true,brightness:.36};
 add('bedroom-bed','apartment-bed-v1',parent.x+.72,parent.z-.92);
 add('bedroom-cabinet','oak-sideboard-v1',parent.x-1.47,parent.z-1.66);
 add('bath-basin','apartment-basin-v1',bath.minX+.34,bath.z-.78,undefined,Math.PI/2);
 add('bath-shower','apartment-shower-v1',bath.minX+.60,bath.z+.86,undefined,Math.PI/2);
 add('bath-toilet','apartment-toilet-v1',bath.x+1.13,bath.z-.82,undefined,-Math.PI/2);
 // The canonical preset owns these vignettes. Translate floor items with their
 // room; supported items keep their original parent-relative offsets.
 const furnished=ctx.presets['connected-home'],base=apartment(furnished.room)!;
 for(const id of ['parent','hall','bath']){
  const origin=base.zones.find(z=>z.id===id)!,destination=zone(id);
  const items=furnished.objects.filter((o:Item)=>o.id.startsWith('evening-')&&zoneAt(base,o)?.id===id);
  insert(items,destination.x-origin.x,destination.z-origin.z,true,'evening');
 }
 for(const pot of objects.filter(o=>o.asset_id==='home-rice-cooker-v1'&&o.properties?.keep_full===undefined))pot.properties={...pot.properties,keep_full:true,servings:4};
 state.objects=objects;state.room=room;state.preset_id=CONNECTED_HOME;
 Object.assign(state.character,start??state.character);
 if(fromChild){state.character.x+=childZone.x;state.character.z+=childZone.z}
 state.control_revisions={...state.control_revisions,position:state.revision+1,camera:state.revision+1};state.camera='home';
 validateLayout(state,ctx);
}
