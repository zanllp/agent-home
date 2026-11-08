import test from 'node:test';
import assert from 'node:assert/strict';
import {apartment,zoneAt} from '../house3d/shared/apartment.mjs';
import {createSpace,regionAt,spaceBounds,fitsFootprint} from '../house3d/shared/space.mjs';
import {createNavigation} from '../house3d/shared/navigation.mjs';
import {readFileSync} from 'node:fs';
const read=n=>JSON.parse(readFileSync('house3d/'+n+'.json')),family=read('room-presets')['family-home'];
const room={...family.room,floorplan:'connected-home'},plan=apartment(room);
test('living room and balcony keep world coordinates while annex rooms share bounded openings',()=>{
 const space=createSpace(room,family.objects),bounds=spaceBounds(room);
 for(const d of plan.doors){const cross=d.axis==='x'?'z':'x',point={[d.axis]:d.at,[cross]:d.center};
  assert.equal(space.free(point),true,d.b);assert.equal(space.free({...point,[cross]:d.center+d.width/2}),false,d.b+' jamb');
 }
 assert.equal(regionAt(room,{x:-4.96,z:-1}),'balcony');assert.equal(regionAt(room,family.spawn),'living');
 for(const z of plan.zones){assert.equal(zoneAt(plan,z).id,z.id);assert.ok(fitsFootprint(room,z,.8,.6));assert.ok(z.minX>=bounds.minX&&z.maxZ<=bounds.maxZ)}
 assert.equal(regionAt(room,{x:bounds.minX+.1,z:bounds.minZ+.1}),null);
});
test('every annex is connected to the actual furnished living room and original balcony',()=>{
 const nav=createNavigation(family.objects,read('server-data').catalog,{assets:read('furniture-assets'),room});
 for(const z of plan.zones.filter(o=>o.id!=='living')){
  const route=nav.path(family.spawn,z);assert.ok(route,z.id);assert.ok(route.slice(1).every((p,i)=>nav.line(route[i],p)));
 }
 assert.ok(nav.path(plan.zones.find(z=>z.id==='child'),{x:-4.96,z:-1}));
});

test('eyes see through passages, not adjacent plaster or door lintels',async()=>{
 const {wallBlocksSight}=await import('../house3d/shared/space.mjs');
 for(const d of plan.doors){
  const cross=d.axis==='x'?'z':'x',p={[d.axis]:d.at-.25,[cross]:d.center,y:1},q={...p,[d.axis]:d.at+.25};
  assert.equal(wallBlocksSight(room,[],p,q),false);
  assert.equal(wallBlocksSight(room,[],{...p,y:2.18},{...q,y:2.18}),true);
  assert.equal(wallBlocksSight(room,[],{...p,[cross]:d.center+d.width/2+.08},{...q,[cross]:d.center+d.width/2+.08}),true);
 }
});
