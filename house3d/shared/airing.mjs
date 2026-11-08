import {regionAt} from './space.mjs';
// A loose sleep quilt, not the bed's fitted cover. The rack owns its location.
export function airingBed(state,rack){
 if(rack.kind!=='drying_rack')return null;
 const airing=new Set(state.objects.filter(o=>o.kind==='drying_rack').map(o=>o.properties?.quilt_from));
 return state.objects.find(o=>o.kind==='bed'&&!airing.has(o.id)&&o.asset_id==='whale-bed-v1')
  ??state.objects.find(o=>o.kind==='bed'&&!airing.has(o.id));
}

export function validHangingQuilt(room,objects,rack){
 const id=rack.properties?.quilt_from;
 return !id||(rack.kind==='drying_rack'&&regionAt(room,rack)==='balcony'&&objects.some(o=>o.kind==='bed'&&o.id===id));
}
