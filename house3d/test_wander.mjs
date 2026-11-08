import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createNavigation,createWalker} from './web/wander-navigation.js';
const catalog={desk:{size:[1.25,.65]},bed:{size:[1.2,1.9]},rug:{size:[1.8,1.3]}};
const objects=[{kind:'desk',x:-1.5,z:-1.4,yaw:0},{kind:'bed',x:1.95,z:-1.3,yaw:0},{kind:'rug',x:0,z:.6,yaw:0}];
const nav=createNavigation(objects,catalog);
let seed=42;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
test('room bounds, furniture, rugs and rotation clearance',()=>{
 assert.ok(nav.free({x:0,z:.6}));assert.ok(!nav.free({x:3,z:0}));assert.ok(!nav.free({x:1.95,z:-1.3}));assert.ok(!nav.free({x:1.1,z:-1.3}));
 const r=createNavigation([{kind:'desk',x:0,z:0,yaw:Math.PI/2}],catalog);assert.ok(!r.free({x:0,z:.8}));assert.ok(r.free({x:1,z:0}));assert.ok(!nav.free({x:NaN,z:0}));
});
test('path routes around furniture and rejects occupied goals',()=>{
 const a={x:.7,z:-1.7},b={x:2.25,z:.6},route=nav.path(a,b);assert.ok(route&&route.length>2);for(let i=1;i<route.length;i++)assert.ok(nav.line(route[i-1],route[i]));assert.equal(nav.path(a,{x:1.95,z:-1.3}),null);
});
test('ten simulated minutes of wandering stay free and include rest and turns',()=>{
 const w=createWalker(nav,{x:0,z:.5},{random});let travel=0,rest=0,turn=0,p={...w.state};
 for(let i=0;i<18000;i++){const s=w.update(1/30,1.3);assert.ok(nav.free(s));travel+=Math.hypot(s.x-p.x,s.z-p.z);if(s.mode==='rest')rest++;if(s.mode==='turn')turn++;assert.ok(s.speed<=.3);p={...s}}
 assert.ok(travel>50);assert.ok(rest>100);assert.ok(turn>100);assert.ok(w.state.steps>200);
});
test('gait phase is distance driven and speed changes do not teleport',()=>{
 const w=createWalker(nav,{x:0,z:.5},{random});w.setAutonomous(false);assert.ok(w.go({x:0,z:1.5}));let expectedPhase=0,p={...w.state};
 for(let i=0;i<160;i++){w.setBrisk(i>40);const s=w.update(1/30,1.3),delta=Math.hypot(s.x-p.x,s.z-p.z);assert.ok(delta<=(i>40?.67:.12/.62*1.3)/30+1e-8);expectedPhase+=delta/(i>40?.41:.12/.62*1.3);p={...s}}
 assert.ok(Math.abs(w.state.phase-expectedPhase)<1e-8);w.stop();p={...w.state};for(let i=0;i<90;i++)w.update(1/30,1.3);assert.equal(w.state.x,p.x);assert.equal(w.state.z,p.z);
});
test('viewer sends only explicit object commands, bounded progress and requested PNGs',()=>{
 const s=readFileSync(new URL('./web/wander.js',import.meta.url),'utf8');const direct=[...s.matchAll(/(?:fetch|ownerFetch)\((['`])([^'`]+)\1,\{method:'POST'/g)].map(m=>m[2]);
 const wrapped=[...s.matchAll(/\bpost\((['`])([^'`]+)\1/g)].map(m=>m[2]);
 assert.deepEqual([...new Set([...direct,...wrapped])].sort(),['/api/commands','/api/interactions/${id}/progress','/api/viewer','/api/screenshots/${shot.id}','/api/runtime/frame','/api/runtime/perf','/api/runtime/control','/api/runtime/fault'].sort());
 assert.ok(s.includes("'interact':'cancel_action'"));assert.ok(!s.includes("tool:'move_character'"));
 const b=readFileSync(new URL('./assets/dafeiyu-contact.glb',import.meta.url)),doc=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));assert.ok(doc.animations.some(a=>a.name==='little-walk'));assert.ok(!doc.nodes.some(n=>n.extras?.prop==='book'));
});

test('long clear trip walks, runs, then returns to walking before arrival',()=>{
 const room=createNavigation([],{}),w=createWalker(room,{x:-1.7,z:0,yaw:Math.PI/2});w.setAutonomous(false);w.setBrisk(true);assert.ok(w.go({x:1.7,z:0}));
 let ran=false,walkedAfter=false,walkedFirst=false;
 for(let i=0;i<900;i++){const s=w.update(1/30,1.3);assert.ok(room.free(s));if(s.x< -1.3&&s.speed>.05&&s.runBlend<.1)walkedFirst=true;if(s.runBlend>.7&&s.speed>1.45)ran=true;if(ran&&s.x>1.1&&s.runBlend<.15&&s.speed>.05)walkedAfter=true}
 assert.ok(walkedFirst);assert.ok(ran);assert.ok(walkedAfter);assert.ok(Math.abs(w.state.x-1.7)<.004);
});
test('short trips and slow setting never start running',()=>{
 for(const [distance,brisk] of [[1,true],[3,false]]){const room=createNavigation([],{}),w=createWalker(room,{x:-1.5,z:0,yaw:Math.PI/2});w.setAutonomous(false);w.setBrisk(brisk);w.go({x:-1.5+distance,z:0});for(let i=0;i<900;i++){w.update(1/30,1.3);assert.ok(w.state.runBlend<1e-8)}}
});

test('fast autonomous trips stay outside furniture and slow down near it',()=>{
 const w=createWalker(nav,{x:0,z:.5},{random});w.setBrisk(true);
 for(let i=0;i<18000;i++){const s=w.update(1/30,1.3);assert.ok(nav.free(s));assert.ok(s.speed<=1.65);assert.ok(s.runBlend>=0&&s.runBlend<=1)}
});
