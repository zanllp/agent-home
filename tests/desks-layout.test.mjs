import {test} from 'node:test';import assert from 'node:assert/strict';import {resolve} from 'node:path';import {HouseApp,loadContext} from '../runtime/test-app.mjs';
const root=resolve('house3d'),ctx=loadContext(root);
const command=(a,tool,args)=>a.handle({method:'POST',url:'/api/commands',headers:{host:'localhost'},body:{id:crypto.randomUUID(),expected_revision:a.store.state().revision,tool,arguments:args}});
function family(){const a=new HouseApp(ctx,':memory:',root,resolve('runtime/web'));assert.equal(command(a,'apply_preset',{preset_id:'family-home',dry_run:false}).status,200);return a}
test('refined family workspaces keep support heights, paths and independent props',()=>{const a=family();try{let s=a.store.state();assert.equal(s.objects.length,56);assert.equal(s.objects.find(o=>o.id==='workbook').on.x,-.025);assert.equal(s.objects.find(o=>o.id==='parent-computer').on.z,-.10);
 const before=structuredClone(s),args={operations:[{op:'update',id:'parent-desk',x:-.55,yaw:.03}],dry_run:true};let r=command(a,'update_layout',args);assert.equal(r.body.layout.can_apply,true,JSON.stringify(r.body));assert.deepEqual(a.store.state(),before);r=command(a,'update_layout',{...args,dry_run:false});assert.equal(r.status,200);s=a.store.state();const mug=s.objects.find(o=>o.id==='work-mug');assert.ok(Math.abs(mug.x-(-.55+Math.cos(.03)*.545+Math.sin(.03)*.03))<1e-8);
 assert.equal(command(a,'update_layout',{operations:[{op:'remove',id:'work-mug'}],dry_run:false}).status,200);assert.ok(a.store.state().objects.some(o=>o.id==='parent-desk'));
 const missing=command(a,'update_layout',{operations:[{op:'remove',id:'child-desk'}],dry_run:true});assert.equal(missing.body.layout.can_apply,false);assert.ok(missing.body.layout.errors.some(e=>e.code==='support_missing'));
 }finally{a.close()}});
test('child study clutter follows the desk and still rejects support overhang and collisions',()=>{
 const a=family();try{
  const before=structuredClone(a.store.state());let r=command(a,'update_layout',{operations:[{op:'update',id:'child-desk',yaw:.03}],dry_run:true});assert.equal(r.body.layout.can_apply,true,JSON.stringify(r.body.layout.errors));assert.deepEqual(a.store.state(),before);
  r=command(a,'update_layout',{operations:[{op:'update',id:'child-desk',yaw:.03}],dry_run:false});assert.equal(r.status,200);
  const bag=a.store.state().objects.find(o=>o.id==='schoolbag');assert.ok(Math.abs(bag.x-(1.1+.42*Math.cos(.03)+.30*Math.sin(.03)))<1e-8);assert.ok(Math.abs(bag.z-(-2.82-.42*Math.sin(.03)+.30*Math.cos(.03)))<1e-8);
  r=command(a,'update_layout',{operations:[{op:'update',id:'schoolbag',on:{id:'child-desk',surface:'bag-hook',x:.05,z:0,yaw:0}}],dry_run:true});assert.equal(r.body.layout.can_apply,false);assert.ok(r.body.layout.errors.some(e=>e.code==='support_overhang'));
  r=command(a,'update_layout',{operations:[{op:'update',id:'workbook',on:{id:'child-desk',surface:'top',x:-.16,z:-.13,yaw:0}}],dry_run:true});assert.equal(r.body.layout.can_apply,false);assert.ok(r.body.layout.errors.some(e=>e.code==='overlap'));
  assert.equal(command(a,'update_layout',{operations:[{op:'remove',id:'schoolbag'}],dry_run:false}).status,200);assert.ok(a.store.state().objects.some(o=>o.id==='child-desk'));
 }finally{a.close()}
});
