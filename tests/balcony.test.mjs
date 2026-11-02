import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {HouseApp,loadContext} from '../runtime/test-app.mjs';
import {createNavigation,createWalker} from '../house3d/web/wander-navigation.js';
import {createSpace,balconyGeometry,regionAt} from '../house3d/shared/space.mjs';
import {mapPoint,selfMapLayout} from '../house3d/web/self-map.js';
import {Group,Mesh,PlaneGeometry,MeshBasicMaterial,Texture} from 'three';
import {createBalcony,disposeBalcony} from '../house3d/web/balcony.js';
const root=resolve('house3d'),ctx=loadContext(root),web=resolve('runtime/web');
function app(){return new HouseApp(ctx,':memory:',root,web,()=>100)}
function command(a,tool,args,id=crypto.randomUUID()){return a.handle({method:'POST',url:'/api/commands',headers:{host:'localhost'},body:{id,expected_revision:a.store.state().revision,tool,arguments:args}})}
function family(a){const r=command(a,'apply_preset',{preset_id:'family-home',dry_run:false});assert.equal(r.status,200,JSON.stringify(r.body));return r.body.state}
function nav(s){return createNavigation(s.objects,ctx.catalog,{assets:ctx.assets,room:s.room})}
const target={x:-5,z:-1.65};
test('family balcony is a connected region; every walk segment remains inside door and rail boundaries',()=>{
 const a=app();try{const s=family(a),n=nav(s),path=n.path(s.character,target);assert.ok(path&&path.length>2);assert.equal(regionAt(s.room,target),'balcony');assert.ok(n.path(target,s.character));
 for(let i=1;i<path.length;i++)assert.ok(n.line(path[i-1],path[i]));
 assert.equal(n.line({x:-3.1,z:-2.5},{x:-5,z:-2.5}),false,'cannot shortcut through adjacent wall');assert.equal(n.free({x:-6.1,z:-1.65}),false,'outside railing');
 const w=createWalker(n,s.character);w.setAutonomous(false);assert.ok(w.go(target));for(let i=0;i<10000&&w.state.route.length;i++){w.update(.05,1.3);assert.ok(n.free(w.state))}assert.ok(Math.hypot(w.state.x-target.x,w.state.z-target.z)<.004);assert.ok(w.go(s.character));
 }finally{a.close()}
});
test('agent furniture dry-runs list independent balcony items, remain read-only, and apply/reload normal positions',()=>{
 const a=app();try{family(a);const before=a.store.state(),objects=a.handle({method:'GET',url:'/api/objects',headers:{host:'localhost'}}).body.objects;
 for(const id of ['balcony-washer','balcony-ficus','balcony-drying-rack'])assert.equal(objects.find(o=>o.id===id).area,'balcony');
 const args={operations:[{op:'update',id:'balcony-washer',x:-5.1,z:-2.6,yaw:Math.PI/2}],dry_run:true};let r=command(a,'update_layout',args);assert.equal(r.status,200);assert.equal(r.body.layout.can_apply,true,JSON.stringify(r.body));assert.deepEqual(a.store.state(),before);assert.ok(r.body.layout.navigation.balcony.reachable_cells>0);
 r=command(a,'update_layout',{...args,dry_run:false});assert.equal(r.status,200);assert.equal(a.store.state().objects.find(o=>o.id==='balcony-washer').x,-5.1);
 assert.equal(command(a,'update_layout',{operations:[{op:'remove',id:'balcony-drying-rack'}],dry_run:false}).status,200);assert.equal(a.store.state().objects.some(o=>o.id==='balcony-drying-rack'),false);
 }finally{a.close()}
});
test('dry-run reports overlap, outside boundaries, doorway obstruction and invalid/missing door',()=>{
 const a=app();try{family(a);
 for(const [item,code] of [[{op:'update',id:'balcony-washer',x:-6,z:-2.6},'outside_room'],[{op:'update',id:'balcony-washer',x:-5.4,z:.06},'overlap'],[{op:'remove',id:'window'},'balcony_invalid']]){const r=command(a,'update_layout',{operations:[item],dry_run:true});assert.equal(r.body.layout.can_apply,false);assert.ok(r.body.layout.errors.some(e=>e.code===code),JSON.stringify(r.body))}
 const blocked=command(a,'update_layout',{operations:[{op:'update',id:'balcony-washer',x:-4.6,z:-1.65}],dry_run:true});assert.ok(blocked.body.layout.warnings.some(e=>e.code==='balcony_unreachable'),JSON.stringify(blocked.body));
 }finally{a.close()}
});
test('door close breaks routes but never permits walking through glass; reopen restores them',()=>{
 const a=app();try{family(a);let r=command(a,'update_object',{id:'window',properties:{open:false}});assert.equal(r.status,200,JSON.stringify(r.body));let s=a.store.state();assert.equal(nav(s).path(s.character,target),null);assert.equal(command(a,'walk_to',target).status,200,'may request a point outside, viewer must report no route rather than teleport');
 command(a,'cancel_action',{job_id:a.store.state().interaction.id});a.store.save({...a.store.state(),interaction:undefined});
 r=command(a,'update_object',{id:'window',properties:{open:true}});assert.equal(r.status,200);s=a.store.state();assert.ok(nav(s).path(s.character,target));
 }finally{a.close()}
});
test('body feedback accepts actual balcony positions and rejects coordinates beyond its railing',()=>{
 const a=app();try{family(a);const input={session_id:'balcony-viewer',visible:true,paused:false,body:{...target,y:.006,yaw:Math.PI/2,pose:'stand',moving:false},job_id:null};
 const request=b=>a.handle({method:'POST',url:'/api/viewer',headers:{host:'localhost'},body:b});assert.equal(request(input).status,200);
 const feedback=a.handle({method:'GET',url:'/api/observe',headers:{host:'localhost'}}).body;assert.equal(feedback.fresh,true);assert.equal(feedback.area,'balcony');assert.match(feedback.summary,/阳台/);assert.equal(feedback.walls[0].id,'balcony-railing');
 assert.equal(request({...input,body:{...input.body,x:-6.1}}).status,400);
 }finally{a.close()}
});
test('direct close/resize cannot crush a fresh body in the doorway or silently remove its balcony',()=>{
 const a=app();try{const s=family(a),input={session_id:'door-viewer',visible:true,paused:false,body:{x:-4,y:.006,z:-1.65,yaw:0,pose:'stand',moving:false},job_id:null};
 assert.equal(a.handle({method:'POST',url:'/api/viewer',headers:{host:'localhost'},body:input}).status,200);
 assert.equal(command(a,'update_object',{id:'window',properties:{open:false}}).status,400);
 a.handle({method:'POST',url:'/api/viewer',headers:{host:'localhost'},body:{...input,body:{...input.body,...target}}});assert.equal(command(a,'update_room',{balcony:null,dry_run:true}).status,400);assert.deepEqual(a.store.state().room,s.room);
 }finally{a.close()}
});
test('balcony dimensions and supporting doorway are explicitly validated; dry-run never changes schema/state',()=>{
 const a=app();try{const s=family(a);for(const patch of [{width:2},{depth:1},{center:3},{door_id:'missing'},{wall:'right'},{depth:NaN}]){const r=command(a,'update_room',{balcony:{...s.room.balcony,...patch},dry_run:true});assert.equal(r.status,400,JSON.stringify(patch));assert.deepEqual(a.store.state(),s)}
 assert.equal(command(a,'apply_preset',{preset_id:'childroom',dry_run:false}).status,200);assert.equal(a.store.state().room.balcony,undefined);assert.ok(a.store.state().objects.every(o=>!o.id.startsWith('balcony-')));
 }finally{a.close()}
});
test('back-wall balconies and position map use the same world coordinates',()=>{
 const room={width:8,depth:6.5,balcony:{wall:'back',center:0,width:3.6,depth:2,door_id:'door'}},door={id:'door',x:0,z:-3.1,yaw:0},b=balconyGeometry(room),space=createSpace(room,[door]);assert.equal(regionAt(room,b.point(.4,1)),'balcony');assert.ok(space.free(b.point(.4,1)));assert.ok(space.free(b.point(.4,0)));assert.equal(space.free({x:3,z:-3.25}),false);
 const l=selfMapLayout(600,800,room),p=mapPoint(b.point(.4,1),l.map,room);assert.ok(p.x>=l.map.x&&p.x<=l.map.x+l.map.w&&p.y>=l.map.y&&p.y<=l.map.y+l.map.h);
});
test('balcony shell owns only structure/background, not independent furniture, and releases its geometry',()=>{
 const view=new Mesh(new PlaneGeometry(2.4,2.1),new MeshBasicMaterial({map:new Texture()})),room=ctx.presets['family-home'].room,root=createBalcony(room,view);assert.equal(root.name,'Walkable-balcony');assert.ok(root.getObjectByName('Balcony-floor'));assert.equal(root.getObjectByName('Balcony-washer'),undefined);assert.equal(root.getObjectByName('Freestanding-drying-rack'),undefined);
 let disposed=0,mapDisposed=0;root.getObjectByName('Balcony-floor').geometry.addEventListener('dispose',()=>disposed++);view.material.map.addEventListener('dispose',()=>mapDisposed++);disposeBalcony(root);assert.equal(disposed,1);assert.equal(mapDisposed,0);
});

test('character vision never uses the spectator cutaway through the connecting wall',async()=>{
 const {createRoomWalls}=await import('../house3d/web/room-walls.js'),parent=new Group(),walls=createRoomWalls(parent,{room:ctx.presets['family-home'].room});
 walls.updateView({x:-5,z:0});assert.equal(parent.getObjectByName('wall-left').visible,false);walls.updateView({x:-5,z:0},{cutaway:false});assert.equal(parent.getObjectByName('wall-left').visible,true);walls.dispose();
 const {wallBlocksSight}=await import('../house3d/shared/space.mjs'),s=ctx.presets['family-home'];
 assert.equal(wallBlocksSight(s.room,s.objects,{x:-5,z:-1.65,y:.9},{x:-3,z:-1.65,y:.9}),false);
 assert.equal(wallBlocksSight(s.room,s.objects,{x:-5,z:0,y:.9},{x:-3,z:1,y:.9}),true);
});
