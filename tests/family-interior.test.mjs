import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {Group,PerspectiveCamera,Vector3} from 'three';
import {HouseApp,loadContext} from '../runtime/test-app.mjs';
import {createNavigation} from '../house3d/web/wander-navigation.js';
import {createWindowDetail,disposeWindowDetail} from '../house3d/web/window-detail.js';
import {createRoomWalls} from '../house3d/web/room-walls.js';
import {broadcastPose,broadcastFov} from '../house3d/web/camera-presets.js';

test('family entry, dining and sofa items keep their supports, chair, play and balcony are reachable',()=>{
 const root=resolve('house3d'),a=new HouseApp(loadContext(root),':memory:',root,''),cmd=(t,args)=>a.command({id:crypto.randomUUID(),expected_revision:a.store.state().revision,tool:t,arguments:args},0);
 try{
  const r=cmd('apply_preset',{preset_id:'family-home',dry_run:false});assert.equal(r.status,200,r.body.error);
  const s=r.body.state,by=Object.fromEntries(s.objects.map(o=>[o.id,o]));
  for(const [child,parent] of [['sofa-throw','sofa'],['sofa-whale','sofa'],['sofa-pillow','sofa'],['fruit-dish','dining-linen'],['dining-linen','dining-table'],['kid-slippers','entry-mat'],['entry-keys','shoe-cabinet'],['rice-bowl','dining-table']])assert.equal(by[child].on.id,parent);
  const nav=createNavigation(s.objects,a.ctx.catalog,{assets:a.ctx.assets,room:s.room});
  const entry={x:3.31,z:-2.36};assert.ok(nav.path(s.character,entry));assert.ok(nav.path(entry,{x:-5,z:-1.65}));
  const report=cmd('update_layout',{operations:[{op:'update',id:'dining-table',yaw:.01}],dry_run:true}).body.layout;
  assert.ok(report.can_apply);assert.ok(report.navigation.interactions.filter(j=>['floor-workshop','child-chair'].includes(j.id)).every(j=>j.reachable));
  assert.ok(report.navigation.balcony.reachable_cells>0);
  assert.equal(cmd('set_camera',{preset:'broadcast'}).body.state.camera,'broadcast');
 }finally{a.close()}
});
test('wide opening keeps a fixed pane on each side of the original sliding leaves',()=>{
 const detail=createWindowDetail(new Group(),{walkable:true,openingWidth:3.04});
 assert.equal(detail.children.filter(m=>m.name==='Fixed-glass-sidelight').length,2);
 assert.deepEqual(detail.children.filter(m=>m.name==='Real-window-glass').map(m=>m.position.x),[-.8,-.8,-.8]);disposeWindowDetail(detail);
});
test('broadcast is inside the room for both aspect ratios; real ceiling is visible only indoors',()=>{
 const room={width:8,depth:6.5,height:2.4},group=new Group(),walls=createRoomWalls(group,{room}),roof=group.getObjectByName('Indoor-ceiling');
 for(const aspect of [.62,16/9]){
  const {position,target}=broadcastPose(room,aspect),cam=new PerspectiveCamera(broadcastFov,aspect,.05,40);cam.position.set(...position);cam.lookAt(...target);cam.updateMatrixWorld();
  walls.updateView(cam.position);assert.equal(roof.visible,true);assert.ok(Math.abs(position[0])<4&&Math.abs(position[2])<3.25);
  const upperRay=new Vector3(0,1,0).unproject(cam).sub(cam.position);assert.ok(upperRay.y>0);
 }
 walls.updateView({x:7,y:6,z:8});assert.equal(roof.visible,false);walls.dispose();
});

test('tabletop occlusion follows real supports when props move between table, mat and floor',async()=>{
 const {diningReceivers}=await import('../house3d/web/contact-shadows.js');
 const a=new HouseApp(loadContext(resolve('house3d')),':memory:',resolve('house3d'),'');
 try{
  const objects=structuredClone(a.ctx.presets['family-home'].objects),assets=a.ctx.assets;
  const layers=()=>Object.fromEntries(diningReceivers(objects,assets).map(({item,children})=>[item.id,children.map(o=>o.id)]));
  assert.ok(layers()['dining-table'].includes('rice-cooker'));assert.deepEqual(layers()['dining-linen'],['fruit-dish']);
  const fruit=objects.find(o=>o.id==='fruit-dish');fruit.on={id:'dining-table',surface:'top'};
  assert.ok(layers()['dining-table'].includes(fruit.id));assert.equal(layers()['dining-linen'],undefined);
  delete fruit.on;assert.ok(!Object.values(layers()).flat().includes(fruit.id));
 }finally{a.close()}
});

test('family wall pieces remain movable, with no physical joint across a window or in the classic room',async()=>{
 const group=new Group(),walls=createRoomWalls(group,{room:{width:8,depth:6.5,height:2.4}}),wall=group.getObjectByName('wall-back'),joins=wall.getObjectByName('Plaster-panel-joints');
 try{
  await walls.setFinish({style:'urban'});
  walls.setOpenings([{asset_id:'slide',x:0,z:-3.2,yaw:0}],{slide:{wall_opening:{width:3,height:2.17,bottom:.02}}});
  const pos=joins.geometry.attributes.position;assert.ok(joins.visible&&pos.count>0);
  for(let i=0;i<pos.count;i++)assert.ok(Math.abs(pos.getX(i))>=1.4999||pos.getY(i)<=.021||pos.getY(i)>=2.189);
  await walls.setFinish({style:'classic'});assert.equal(joins.visible,false);
 }finally{walls.dispose()}
 const root=resolve('house3d'),app=new HouseApp(loadContext(root),':memory:',root,'');
 const cmd=(tool,args)=>app.command({id:crypto.randomUUID(),expected_revision:app.store.state().revision,tool,arguments:args},0);
 try{
  const s=cmd('apply_preset',{preset_id:'family-home',dry_run:false}).body.state;
  for(const id of ['picnic-print','hall-clock','outing-hooks'])assert.equal(app.ctx.assets[s.objects.find(o=>o.id===id).asset_id].placement,'wall');
  assert.equal(s.objects.find(o=>o.id==='work-plant').on.id,'wall-shelf-parent');
  assert.equal(s.objects.find(o=>o.id==='reading-glow').on.id,'parent-desk');
  assert.equal(cmd('update_layout',{operations:[{op:'update',id:'outing-hooks',x:2.36}],dry_run:true}).body.layout.can_apply,true);
 }finally{app.close()}
});

test('family study chair swaps the hard arms without moving the calibrated drawing seat',()=>{
 const root=resolve('house3d'),ctx=loadContext(root),a=new HouseApp(ctx,':memory:',root,''),cmd=(tool,args)=>a.command({id:crypto.randomUUID(),expected_revision:a.store.state().revision,tool,arguments:args},0);
 try{
  const state=cmd('apply_preset',{preset_id:'family-home',dry_run:false}).body.state;
  const chair=state.objects.find(o=>o.id==='child-chair');assert.equal(chair.asset_id,'family-study-chair-v1');
  assert.deepEqual(ctx.assets[chair.asset_id].interactions.sit,ctx.assets['whale-chair-v1'].interactions.sit);
  const draw=cmd('interact',{target_id:chair.id,action:'draw'});assert.equal(draw.body.state.interaction.pose,'draw');
 }finally{a.close()}
});

test('family textiles stay on their seat and the low drying rack leaves the walk to the balcony open',()=>{
 const root=resolve('house3d'),ctx=loadContext(root),a=new HouseApp(ctx,':memory:',root,'');
 const cmd=(tool,args)=>a.command({id:crypto.randomUUID(),expected_revision:a.store.state().revision,tool,arguments:args},0);
 try{
  const s=cmd('apply_preset',{preset_id:'family-home',dry_run:false}).body.state,by=Object.fromEntries(s.objects.map(o=>[o.id,o]));
  for(const id of ['sofa-pillow','sofa-whale','sofa-throw'])assert.equal(by[id].on.surface,'seat');
  assert.equal(by['balcony-drying-rack'].asset_id,'family-linen-rail-v1');
  const delta=.36,move=cmd('update_layout',{operations:[{op:'update',id:'sofa',yaw:by.sofa.yaw+delta}],dry_run:true});
  assert.ok(!move.body.layout.errors.some(e=>['support_overlap','support_outside','support_missing'].includes(e.code)));
  const nav=createNavigation(s.objects,ctx.catalog,{assets:ctx.assets,room:s.room});assert.ok(nav.path({x:3.31,z:-2.36},{x:-5,z:-1.65}));
 }finally{a.close()}
});

test('maple library supports the existing book groups and bins without consuming another layout slot',()=>{
 const root=resolve('house3d'),ctx=loadContext(root),a=new HouseApp(ctx,':memory:',root,'');
 const cmd=(tool,args)=>a.command({id:crypto.randomUUID(),expected_revision:a.store.state().revision,tool,arguments:args},0);
 try{
  const s=cmd('apply_preset',{preset_id:'family-home',dry_run:false}).body.state,bookcase=s.objects.find(o=>o.id==='bookcase'),asset=ctx.assets[bookcase.asset_id];
  assert.equal(bookcase.asset_id,'family-maple-library-v1');assert.equal(s.objects.length,79);
  const contents=s.objects.filter(o=>o.on?.id==='bookcase');assert.equal(contents.length,10);
  assert.deepEqual(new Set(contents.map(o=>o.on.surface)),new Set(Object.keys(asset.surfaces)));
  for(const o of contents){
   const {height,size}=asset.surfaces[o.on.surface],item=ctx.assets[o.asset_id];
   assert.ok(height+(item.support_offset||0)+item.height<=asset.height);
   if(item.ledge_mount){
    const {pot_center:[x,z],pot_radius:r}=item.ledge_mount,c=Math.cos(o.on.yaw),sn=Math.sin(o.on.yaw);
    assert.ok(Math.abs(o.on.x+x*c+z*sn)+r<=size[0]/2);assert.ok(Math.abs(o.on.z-x*sn+z*c)+r<=size[1]/2);
   }else{
    assert.ok(Math.abs(o.on.x)+item.size[0]/2<=size[0]/2);assert.ok(Math.abs(o.on.z)+item.size[1]/2<=size[1]/2);
   }
  }
  assert.equal(s.objects.find(o=>o.id==='pothos-child').on.id,'wall-shelf-child');
  const r=cmd('update_layout',{operations:[{op:'update',id:'reading-whale',on:{id:'bookcase',surface:'shelf-3',x:-.28,z:.02,yaw:.1}}],dry_run:true});
  assert.ok(r.body.layout.can_apply);assert.ok(r.body.layout.navigation.interactions.every(i=>i.reachable));assert.ok(r.body.layout.navigation.balcony.reachable_cells>0);
 }finally{a.close()}
});

test('media cabinet bays preserve agent placement, height checks and separate contact layers',async()=>{
 const {mediaReceivers}=await import('../house3d/web/contact-shadows.js');
 const root=resolve('house3d'),ctx=loadContext(root),app=new HouseApp(ctx,':memory:',root,'');
 const cmd=(tool,args)=>app.command({id:crypto.randomUUID(),expected_revision:app.store.state().revision,tool,arguments:args},0);
 try{
  const s=cmd('apply_preset',{preset_id:'family-home',dry_run:false}).body.state;
  assert.equal(s.room.wallpapers.left,'harbor-blue');
  assert.deepEqual(mediaReceivers(s.objects,ctx.assets).map(r=>r.level).sort(),['lower_bay','top']);
  const on=(surface)=>({id:'media-console',surface,x:0,z:0,yaw:0});
  const bad=cmd('update_layout',{operations:[{op:'update',id:'pothos-tv',on:on('upper_bay')}],dry_run:true});
  assert.ok(!bad.body.layout.can_apply&&bad.body.layout.errors.some(e=>e.code==='support_clearance'));
  const fit=cmd('update_layout',{operations:[{op:'update',id:'media-games',on:on('upper_bay')}],dry_run:true});assert.ok(fit.body.layout.can_apply);
  // Use a tray that actually fits this bay: its own surface cannot bypass the enclosing roof.
  ctx.assets['test-low-tray']={...ctx.assets['family-flax-mat-v1'],size:[.4,.32],height:.03,surfaces:{top:{height:.03,size:[.38,.30]}}};
  const nesting=cmd('update_layout',{operations:[{op:'add',id:'test-tray',asset_id:'test-low-tray',on:{...on('lower_bay'),x:.25}},{op:'update',id:'pothos-tv',on:{id:'test-tray',surface:'top',x:0,z:0,yaw:0}}],dry_run:true});
  assert.ok(nesting.body.layout.errors.some(e=>e.code==='support_clearance'&&e.ids.includes('pothos-tv')));
  assert.equal(app.store.state().objects.find(o=>o.id==='pothos-tv').on.surface,'top');
 }finally{app.close()}
});

test('weekend lounge keeps the complete tea set on its real table and the workshop inside the rug',async()=>{
 const root=resolve('house3d'),ctx=loadContext(root),app=new HouseApp(ctx,':memory:',root,'');
 const cmd=(tool,args)=>app.command({id:crypto.randomUUID(),expected_revision:app.store.state().revision,tool,arguments:args},0);
 try{
  const s=cmd('apply_preset',{preset_id:'family-home',dry_run:false}).body.state,by=Object.fromEntries(s.objects.map(o=>[o.id,o]));
  const rug=by.rug,toy=by['floor-workshop'],table=by['coffee-table'],asset=ctx.assets[rug.asset_id],kit=ctx.assets[toy.asset_id];
  assert.equal(s.objects.length,79);assert.ok(asset.rug_fabric);
  const bounds=(size,yaw)=>[Math.abs(Math.cos(yaw))*size[0]+Math.abs(Math.sin(yaw))*size[1],Math.abs(Math.sin(yaw))*size[0]+Math.abs(Math.cos(yaw))*size[1]];
  for(const item of [toy,table]){
   const footprint=bounds(ctx.assets[item.asset_id].size,item.yaw);
   for(const [i,axis] of ['x','z'].entries())assert.ok(Math.abs(item[axis]-rug[axis])+footprint[i]/2<=asset.size[i]/2);
  }
  const {diningReceivers}=await import('../house3d/web/contact-shadows.js');
  assert.deepEqual(diningReceivers(s.objects,ctx.assets).find(g=>g.item.id===table.id).children.map(c=>c.id),['coffee-essentials']);
  const nav=createNavigation(s.objects,ctx.catalog,{assets:ctx.assets,room:s.room});assert.ok(nav.path({x:3.31,z:-2.36},{x:-5,z:-1.65}));
  assert.ok(kit.interactions.play);assert.ok(cmd('interact',{target_id:toy.id,action:'play'}).body.ok);
 }finally{app.close()}
});

test('family entry and study walls are individually placeable without blocking the walk across the room',()=>{
 const root=resolve('house3d'),ctx=loadContext(root),app=new HouseApp(ctx,':memory:',root,'');
 const cmd=(tool,args)=>app.command({id:crypto.randomUUID(),expected_revision:app.store.state().revision,tool,arguments:args},0);
 try{
  const s=cmd('apply_preset',{preset_id:'family-home',dry_run:false}).body.state,by=Object.fromEntries(s.objects.map(o=>[o.id,o]));
  const cabinet=by['shoe-cabinet'],hooks=by['outing-hooks'],board=by['study-pinboard'];
  assert.ok(by.bookcase.x<cabinet.x&&cabinet.x<by['front-door'].x);assert.equal(cabinet.yaw,0);
  assert.equal(hooks.x,cabinet.x);assert.equal(board.x,by['child-desk'].x);
  assert.equal(ctx.assets[board.asset_id].placement,'wall');assert.equal(by['entry-keys'].on.id,cabinet.id);
  for(const id of ['adult-slippers','kid-slippers'])assert.equal(by[id].on.id,'entry-mat');
  const trial=cmd('update_layout',{operations:[{op:'update',id:hooks.id,x:hooks.x+.02}],dry_run:true}).body.layout;
  assert.ok(trial.can_apply,JSON.stringify(trial.errors));assert.ok(trial.navigation.interactions.every(i=>i.reachable));
  const nav=createNavigation(s.objects,ctx.catalog,{assets:ctx.assets,room:s.room});assert.ok(nav.path({x:3.31,z:-2.36},{x:-5,z:-1.65}));
 }finally{app.close()}
});

test('trailing pot stays anchored and hanging foliage clears both shelf lips without displacing lower books',()=>{
 const ctx=loadContext(resolve('house3d')),app=new HouseApp(ctx,':memory:',resolve('house3d'),'');
 const cmd=(tool,args)=>app.command({id:crypto.randomUUID(),expected_revision:app.store.state().revision,tool,arguments:args},0).body;
 try{
  const state=cmd('apply_preset',{preset_id:'family-home',dry_run:false}).state;
  const plant=state.objects.find(o=>o.id==='pothos-child'),lib=state.objects.find(o=>o.id==='shelf-item-4-0');
  assert.equal(plant.asset_id,lib.asset_id);assert.equal(plant.asset_id,'family-trailing-pothos-v1');
  assert.equal(state.objects.filter(o=>o.on?.id==='bookcase').length,10);
  const trial=(on,dry_run=true)=>cmd('update_layout',{operations:[{op:'update',id:plant.id,on:{...plant.on,...on}}],dry_run});
  for(const [patch,code] of [[{yaw:Math.PI,z:-.08},'foliage_clearance'],[{x:.34},'support_overhang'],[{id:'child-desk',x:.02,z:.1},'foliage_clearance']]){
   assert.ok(trial(patch).layout.errors.some(e=>e.code===code));
   assert.ok(trial(patch,false).applied!==true);assert.deepEqual(app.store.state(),state);
  }
  const move=cmd('update_layout',{operations:[{op:'update',id:'wall-shelf-child',x:-2.62}],dry_run:false});assert.ok(move.applied);
  assert.ok(Math.abs(move.state.objects.find(o=>o.id===plant.id).x+2.59)<1e-6);
 }finally{app.close()}
});

test('dry-run distinguishes objects under the pot from items in the hanging silhouette',()=>{
 const ctx=loadContext(resolve('house3d')),app=new HouseApp(ctx,':memory:',resolve('house3d'),'');
 const cmd=(tool,args)=>app.command({id:crypto.randomUUID(),expected_revision:app.store.state().revision,tool,arguments:args},0).body;
 try{
  const s=cmd('apply_preset',{preset_id:'family-home',dry_run:false}).state;
  const p=s.objects.find(o=>o.id==='pothos-child');
  // A test ledge can carry a narrow book below the plant, in front of the wall.
  const ledge=ctx.assets['urban-floating-shelf-high-v1'];
  ledge.surfaces.test={size:[.6,.65],height:-.04,center:[0,.14]};
  ctx.assets['test-book']={kind:'books',size:[.06,.06],height:.12,placement:'surface'};
  const place=z=>cmd('update_layout',{operations:[{op:'add',id:'test-book',asset_id:'test-book',on:{id:'wall-shelf-child',surface:'test',x:0,z,yaw:0}}],dry_run:true}).layout;
  assert.ok(place(-.09).can_apply);
  assert.ok(place(.12).errors.some(e=>e.code==='overlap'&&e.ids.includes(p.id)));
 }finally{app.close()}
});

test('vine bounds include the part of a sloped leaf triangle crossing the shelf plane',async()=>{
 const {hangingBounds}=await import('../tools/trailing-pothos.mjs');
 const {BufferGeometry,Mesh,Float32BufferAttribute}=await import('three');
 const geo=new BufferGeometry();geo.setAttribute('position',new Float32BufferAttribute([0,-1,1,1,1,-1,-1,1,-1],3));
 const m=new Mesh(geo);m.position.x=.25;m.updateMatrixWorld(true);
 const box=hangingBounds([m],0);assert.deepEqual(box.min.toArray(),[-.25,0]);assert.deepEqual(box.max.toArray(),[.75,1]);
 geo.dispose();m.material.dispose();
});

test('the two dining seats have reachable sit contacts but do not advertise drawing or eating',()=>{
 const root=resolve('house3d'),ctx=loadContext(root),app=new HouseApp(ctx,':memory:',root,'');
 const cmd=(tool,args)=>app.command({id:crypto.randomUUID(),expected_revision:app.store.state().revision,tool,arguments:args},0).body;
 try{
  const s=cmd('apply_preset',{preset_id:'family-home',dry_run:false}).state,chairs=s.objects.filter(o=>o.kind==='dining_chair');
  assert.equal(chairs.length,2);
  const report=cmd('update_layout',{operations:[{op:'update',id:chairs[0].id,x:chairs[0].x+.01}],dry_run:true}).layout;
  for(const o of chairs){
   const def=ctx.assets[o.asset_id];assert.deepEqual(Object.keys(def.interactions),['sit']);
   assert.equal(def.interactions.sit.seat_height,.449);assert.ok(report.navigation.interactions.some(i=>i.id===o.id&&i.action==='sit'&&i.reachable));
  }
  assert.ok(report.can_apply);assert.deepEqual(app.store.state(),s);
 }finally{app.close()}
});

test('album changes only the view; the family still has routes from the entry to all seats and to the balcony',()=>{
 const root=resolve('house3d'),ctx=loadContext(root),a=new HouseApp(ctx,':memory:',root,'');
 const cmd=(tool,args)=>a.command({id:crypto.randomUUID(),expected_revision:a.store.state().revision,tool,arguments:args},0).body;
 try{
  const s=cmd('apply_preset',{preset_id:'family-home',dry_run:false}).state;
  const job=cmd('interact',{target_id:'floor-workshop',action:'play'}).state.interaction;
  const album=cmd('set_camera',{preset:'album'}).state;assert.equal(album.camera,'album');assert.deepEqual(album.interaction,job);assert.deepEqual(album.objects,s.objects);
  const nav=createNavigation(s.objects,ctx.catalog,{assets:ctx.assets,room:s.room});assert.ok(nav.path({x:3.31,z:-2.36},{x:-5,z:-1.65}));
  const report=cmd('update_layout',{operations:[{op:'update',id:'sofa',yaw:s.objects.find(o=>o.id==='sofa').yaw}],dry_run:true}).layout;
  assert.ok(report.navigation.interactions.every(i=>i.reachable));
 }finally{a.close()}
});

test('wider sofa advertises its real footprint and keeps its textiles and routes in the family layout',()=>{
 const root=resolve('house3d'),ctx=loadContext(root),app=new HouseApp(ctx,':memory:',root,'');
 const cmd=(tool,args)=>app.command({id:crypto.randomUUID(),expected_revision:app.store.state().revision,tool,arguments:args},0).body;
 try{
  const state=cmd('apply_preset',{preset_id:'family-home',dry_run:false}).state,sofa=state.objects.find(o=>o.id==='sofa');
  assert.equal(sofa.asset_id,'family-wide-lounge-v1');const def=ctx.assets[sofa.asset_id];assert.equal(def.size[0],2.64);
  assert.deepEqual(state.objects.filter(o=>o.on?.id==='sofa').map(o=>o.id).sort(),['sofa-pillow','sofa-throw','sofa-whale']);
  const report=cmd('update_layout',{operations:[{op:'update',id:'sofa',yaw:sofa.yaw}],dry_run:true}).layout;
  assert.ok(report.can_apply);assert.ok(report.navigation.interactions.every(o=>o.reachable));
  const nav=createNavigation(state.objects,ctx.catalog,{assets:ctx.assets,room:state.room});assert.ok(nav.path({x:3.31,z:-2.36},{x:-5,z:-1.65}));
  const bad=cmd('update_layout',{operations:[{op:'update',id:'sofa',x:-3.0,z:2.2}],dry_run:true}).layout;
  assert.ok(!bad.can_apply&&bad.errors.some(e=>['outside_room','overlap'].includes(e.code)));
 }finally{app.close()}
});

test('desk light controls preserve a drawing job and the other desk light',()=>{
 const root=resolve('house3d'),a=new HouseApp(loadContext(root),':memory:',root,'');
 const cmd=(tool,args)=>a.command({id:crypto.randomUUID(),expected_revision:a.store.state().revision,tool,arguments:args},0);
 try{
  assert.equal(cmd('apply_preset',{preset_id:'family-home',dry_run:false}).status,200);
  const job=cmd('interact',{target_id:'child-chair',action:'draw'}).body.state.interaction;
  const prop=id=>a.store.state().objects.find(o=>o.id===id).properties,other=structuredClone(prop('reading-glow'));
  assert.equal(cmd('update_object',{id:'study-lamp',properties:{brightness:.35}}).status,200);
  for(const on of [false,true]){
   assert.equal(cmd('interact',{target_id:'study-lamp',action:on?'turn_on':'turn_off'}).status,200);
   assert.deepEqual(prop('study-lamp'),{brightness:.35,on});assert.equal(a.store.state().interaction.id,job.id);
   assert.deepEqual(prop('reading-glow'),other);
  }
  assert.equal(cmd('update_object',{id:'study-lamp',properties:{brightness:1.1}}).status,400);assert.equal(prop('study-lamp').brightness,.35);
 }finally{a.close()}
});

test('arm blanket can be removed or replaced without consuming a furniture slot or changing the sofa',()=>{
 const root=resolve('house3d'),a=new HouseApp(loadContext(root),':memory:',root,'');
 const cmd=(tool,args)=>a.command({id:crypto.randomUUID(),expected_revision:a.store.state().revision,tool,arguments:args},0);
 try{
  const s=cmd('apply_preset',{preset_id:'family-home',dry_run:false}).body.state,blanket=s.objects.find(o=>o.id==='sofa-throw'),sofa=s.objects.find(o=>o.id==='sofa');
  assert.equal(blanket.asset_id,'family-arm-throw-v1');assert.equal(s.objects.length,79);
  const ops=[{op:'update',id:blanket.id,asset_id:'family-fringed-throw-v1',on:{...blanket.on,x:1.166,z:.153}}];
  const report=cmd('update_layout',{operations:ops,dry_run:true}).body.layout;assert.ok(report.can_apply);assert.ok(report.navigation.interactions.every(j=>j.reachable));
  assert.deepEqual(a.store.state(),s);const restored=cmd('update_layout',{operations:ops,dry_run:false}).body.state;assert.equal(restored.objects.find(o=>o.id===blanket.id).asset_id,'family-fringed-throw-v1');assert.deepEqual(restored.objects.find(o=>o.id===sofa.id),sofa);
 }finally{a.close()}
});

test('family supper example only previews the extra seat; all chairs, play area and balcony stay reachable',()=>{
 const root=resolve('house3d'),a=new HouseApp(loadContext(root),':memory:',root,'');
 const cmd=(tool,args)=>a.command({id:crypto.randomUUID(),expected_revision:a.store.state().revision,tool,arguments:args},0);
 try{
  const start=cmd('apply_preset',{preset_id:'family-home',dry_run:false}).body.state;
  const recipe=JSON.parse(readFileSync(new URL('../docs/examples/family-supper.json',import.meta.url)));
  const r=cmd('update_layout',recipe).body.layout;assert.ok(r.can_apply);assert.deepEqual(a.store.state(),start);
  assert.ok(r.navigation.interactions.every(i=>i.reachable));assert.equal(r.navigation.balcony.reachable_cells,r.navigation.balcony.free_cells);
  const dinner=cmd('update_layout',{...recipe,dry_run:false}).body.state;assert.equal(dinner.objects.filter(o=>o.kind==='dining_chair').length,3);
  const remove=cmd('update_layout',{dry_run:false,operations:[{op:'remove',id:'family-guest-chair'}]});
  assert.deepEqual(remove.body.state.objects,start.objects);
 }finally{a.close()}
});
