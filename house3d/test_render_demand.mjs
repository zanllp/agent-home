import test from 'node:test';
import assert from 'node:assert/strict';
import {createRenderDemand} from './web/render-demand.js';
import {screenPlayback} from './web/screen-detail.js';
const rest={ready:true,controller:true,paused:false,auto:false,routeLength:0,phase:'none'};
test('unchanged room submits no frames; screen frames reuse shadows',()=>{
 const d=createRenderDemand();
 assert.deepEqual(d.frame({key:'same'}),{render:true,shadows:true});
 for(let i=0;i<300;i++)assert.deepEqual(d.frame({key:'same'}),{render:false,shadows:false});
 assert.deepEqual(d.frame({key:'same',screenChanged:true}),{render:true,shadows:false});
 assert.deepEqual(d.frame({key:'camera changed'}),{render:true,shadows:true});
 d.invalidate();assert.equal(d.frame({key:'camera changed'}).shadows,true);
 assert.equal(d.frame({key:'camera changed',bodyChanged:true}).shadows,true);
});
test('idle settles then freezes; every execution phase and autonomous wait wakes',()=>{
 const d=createRenderDemand();assert.equal(d.animate(0,rest),false);
 assert.equal(d.animate(100,{...rest,routeLength:1}),true);
 assert.equal(d.animate(500,rest),true);assert.equal(d.animate(801,rest),false);
 for(const phase of ['approaching','entering','leaving'])assert.equal(d.animate(1000,{...rest,phase}),true);
 assert.equal(d.animate(2000,{...rest,auto:true}),true);
 assert.equal(d.animate(3000,{...rest,weight:.1}),true);
 for(const pose of ['draw','play'])assert.equal(d.animate(4000,{...rest,phase:'active',pose}),true);
 for(const pose of ['read','sit','sleep'])assert.equal(d.animate(5000,{...rest,phase:'active',pose,weight:1}),false);
 for(const flag of [{paused:true},{controller:false},{ready:false}])assert.equal(d.animate(5001,{...rest,auto:true,...flag}),false);
});
test('screen player signals only newly painted frames and keeps programme timing',()=>{
 let paints=0;const tick=screenPlayback('television',()=>paints++,()=>.4);
 assert.equal(paints,1); // initial channel guide
 for(let i=0;i<100;i++)assert.equal(tick(.03),false);
 assert.equal(tick(3.1),true); // guide advances to cartoon
 const count=paints;assert.equal(tick(.001),false);assert.equal(paints,count);
 assert.equal(tick(.09),true);assert.equal(paints,count+1);
});
test('offscreen playback advances without painting; returning guide refreshes immediately',()=>{
 const frames=[],tick=screenPlayback('television',(p,t)=>frames.push([p,t]),()=>.4);
 for(let i=0;i<70;i++)assert.equal(tick(.1,false),false);
 assert.equal(frames.length,1);assert.equal(tick(0,true),true);assert.notEqual(frames.at(-1)[0],'guide');
 assert.ok(frames.at(-1)[1]>.5);assert.equal(tick(0,true),false);
});
test('visibility uses rendered instance transforms, parent visibility and all shared screens',async()=>{
 const T=await import('three'),{createScreenVisibility}=await import('./web/screen-visibility.js');
 const visible=createScreenVisibility(),camera=new T.PerspectiveCamera(60,1,.1,10),map=new T.Texture();
 const a=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({map})),group=new T.Group();group.add(a);group.position.z=-3;
 assert.equal(visible([a],camera).has(map),true);
 group.position.x=20;assert.equal(visible([a],camera).size,0);
 const b=a.clone();b.position.z=-3;assert.equal(visible([a,b],camera).has(map),true);
 b.visible=false;assert.equal(visible([a,b],camera).size,0);
 group.position.x=0;group.visible=false;assert.equal(visible([a,b],camera).size,0);
 group.visible=true;assert.equal(visible([a,b],camera).has(map),true);
});
test('resting OrbitControls numerical jitter does not invalidate the camera cache',()=>{
 const d=createRenderDemand();assert.equal(d.frame({key:'same',camera:[1,2,3]}).render,true);
 for(let i=0;i<100;i++)assert.equal(d.frame({key:'same',camera:[1+Math.sin(i)*1e-12,2,3]}).render,false);
 assert.equal(d.frame({key:'same',camera:[1.00001,2,3]}).render,true);
 assert.equal(d.frame({key:'same',camera:[1.00001,2,3]}).render,false);
});
