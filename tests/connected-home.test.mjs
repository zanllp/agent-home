import test from 'node:test';
import assert from 'node:assert/strict';
import {HouseApp,loadContext} from '../runtime/test-app.mjs';
import {apartment,zoneAt} from '../house3d/shared/apartment.mjs';
import {createNavigation} from '../house3d/shared/navigation.mjs';
import {createWalker} from '../house3d/web/wander-navigation.js';
const ctx=loadContext('house3d');
function fixture(preset){
 const a=new HouseApp(ctx,':memory:','house3d','runtime/web');
 const cmd=(tool,args)=>a.handle({method:'POST',url:'/api/commands',headers:{},body:{id:crypto.randomUUID(),expected_revision:a.store.state().revision,tool,arguments:args}});
 assert.equal(cmd('apply_preset',{preset_id:preset,dry_run:false}).status,200);return {a,cmd};
}
for(const preset of ['family-home','childroom'])test(preset+' connects without replacing the occupied home; migration defaults to preview',()=>{
 const {a,cmd}=fixture(preset);try{
  const before=a.store.state(),old=before.objects.find(o=>o.kind==='lamp');
  assert.equal(cmd('update_object',{id:old.id,label:'我的灯',properties:{on:false}}).status,200);
  const saved=a.store.state(),preview=cmd('connect_rooms',{});assert.equal(preview.body.applied,false);assert.deepEqual(a.store.state(),saved);
  const r=cmd('connect_rooms',{dry_run:false});assert.equal(r.status,200,r.body.error);
  const s=r.body.state,plan=apartment(s.room);assert.equal(s.objects.length,96);
  for(const original of saved.objects){const item=s.objects.find(o=>o.id===original.id);assert.equal(item.asset_id,original.asset_id);assert.deepEqual(item.on,original.on);
   if(preset==='family-home'){assert.equal(item.x,original.x);assert.equal(item.z,original.z)}
   else assert.equal(zoneAt(plan,item).id,'child');
  }
  assert.equal(s.objects.find(o=>o.id===old.id).label,'我的灯');assert.equal(s.objects.find(o=>o.id===old.id).properties.on,false);
  assert.equal(cmd('connect_rooms',{dry_run:false}).status,400);assert.deepEqual(a.store.state(),s);
  const d=plan.doors.find(d=>d.b==='parent');assert.equal(cmd('update_furniture',{id:'bedroom-cabinet',x:d.at+0.67,z:d.center}).status,400);
 }finally{a.close()}
});
test('connected home supports reversible food, TV power and quilt airing',()=>{
 const {a,cmd}=fixture('family-home');try{
  cmd('connect_rooms',{dry_run:false});const act=(id,action)=>cmd('interact',{target_id:id,action}),prop=id=>a.store.state().objects.find(o=>o.id===id).properties;
  for(let i=0;i<5;i++){assert.equal(act('rice-bowl','serve_rice').status,200);assert.equal(act('rice-bowl','serve_rice').status,400);assert.equal(act('rice-bowl','eat_rice').status,200)}assert.equal(prop('rice-cooker').servings,4);
  for(const key of ['turn_on','turn_off','turn_on']){assert.equal(act('television',key).status,200);assert.equal(prop('television').on,key==='turn_on')}
  const rack='balcony-drying-rack';assert.equal(act(rack,'air_quilt').status,200);assert.equal(prop(rack).quilt_from,'childroom-bed');assert.equal(act(rack,'air_quilt').status,400);
  const trial=cmd('update_layout',{operations:[{op:'remove',id:'childroom-bed'}]});
  assert.ok(trial.body.layout.errors.some(e=>e.code==='quilt_outside'));assert.equal(prop(rack).quilt_from,'childroom-bed');
  assert.equal(act(rack,'bring_in_quilt').status,200);assert.equal(prop(rack).quilt_from,undefined);
 }finally{a.close()}
});
test('a child can break into a jog in the furnished hallway and brake without crossing a wall',()=>{
 const {a,cmd}=fixture('family-home');try{const {state:s}=cmd('connect_rooms',{dry_run:false}).body;
  const plan=apartment(s.room),hall=plan.zones.find(z=>z.id==='hall'),nav=createNavigation(s.objects,ctx.catalog,{assets:ctx.assets,room:s.room});
  const from={x:-3,z:hall.z,yaw:Math.PI/2},to={x:3,z:hall.z},walker=createWalker(nav,from);
  walker.setAutonomous(false);walker.setBrisk(true);assert.ok(walker.go(to));let peak=0,almostThere=1;
  for(let i=0;i<1200&&walker.state.route.length;i++){const w=walker.update(1/30,2);peak=Math.max(peak,w.runBlend);if(to.x-w.x<.12)almostThere=w.runBlend;assert.ok(nav.free(w))}
  assert.ok(peak>.85);assert.ok(almostThere<.15);assert.ok(Math.abs(walker.state.x-to.x)<.01);
 }finally{a.close()}
});
