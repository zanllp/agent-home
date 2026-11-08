import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from 'three';
import {balconyGeometry} from './shared/space.mjs';
import {CAMERA_PRESETS,cameraPose,cameraZoom,homePose,homeFov,companionPose,companionObstruction,drawingViewPose} from './web/camera-presets.js';
test('every listed camera has a finite pose',()=>{for(const [id] of CAMERA_PRESETS){const p=cameraPose(id,{x:1,z:-1,yaw:0});assert.equal(p.position.length,3);assert.ok([...p.position,...p.target].every(Number.isFinite));assert.notDeepEqual(p.position,p.target)}});
test('front camera aligns with positive local Z',()=>{const p=cameraPose('front',{x:1,z:2,yaw:0});assert.equal(p.position[0],1);assert.equal(p.position[2],5.1);assert.deepEqual(p.target,[1,.72,2])});
test('front view follows character turning',()=>{const p=cameraPose('front',{x:1,z:2,yaw:Math.PI/2});assert.ok(Math.abs(p.position[0]-4.1)<1e-8);assert.ok(Math.abs(p.position[2]-2)<1e-8)});
test('side and back are distinct from front',()=>{assert.deepEqual(cameraPose('back',{x:0,z:0,yaw:0}).position,[0,.85,-2.8]);assert.equal(cameraPose('side',{x:0,z:0,yaw:0}).position[2],0)});
test('mobile fits room while retaining readable character closeups',()=>{assert.ok(cameraZoom('top',.7)<cameraZoom('face',.7));assert.equal(cameraZoom('front',1.5),1)});
test('unknown camera rejected',()=>{assert.throws(()=>cameraPose('bad',{}))});

test('home lens fits the visible shell and balcony above the HUD on portrait and desktop',()=>{
 for(const [width,height] of [[390,844],[1440,830],[844,390]])for(const wall of ['back','left']){
  const room={width:8,depth:6.5,height:2.4,balcony:{center:1.25,width:3.6,depth:2,wall}};
  const p=homePose(room,width/height,height),camera=new PerspectiveCamera(homeFov,width/height,.05,100);
  camera.position.set(...p.position);camera.lookAt(...p.target);camera.updateMatrixWorld();
  const points=[[-4,-.14,-3.25],[4,-.14,-3.25],[-4,-.14,3.25],[4,-.14,3.25],[-4,2.4,3.25],[-4,2.4,-3.25],[4,2.4,-3.25]],b=balconyGeometry(room);
  for(const u of [-1.8,1.8])for(const y of [-.1,1.1]){const q=b.point(u,2);points.push([q.x,y,q.z])}
  const frame=points.map(v=>new Vector3(...v).project(camera));
  assert.ok(frame.every(p=>Math.abs(p.x)<=.961&&p.y<.941&&p.y>=-1+Math.min(.34,156/height)-1e-6));
  assert.ok(Math.max(...frame.map(p=>Math.abs(p.x)))>.95||Math.max(...frame.map(p=>p.y))>.93);
 }
});
test('draw camera takes the other side if shelving hides the face and paper',()=>{
 const p={x:0,z:0},obstacle={x:-.71,z:.66,base:0,size:[.5,.75],height:2,yaw:.16};
 assert.ok(drawingViewPose(p,0,[]).position[0]<0);assert.ok(drawingViewPose(p,0,[obstacle]).position[0]>0);
 const chair={...obstacle,x:.8,z:0};assert.ok(drawingViewPose(p,0,[chair],true).position[0]<0);
});

test('album exposes the inhabited wall tops and floor edge, without the control-bar margin',async()=>{
 const {albumPose,albumFov}=await import('./web/camera-presets.js');
 for(const [w,d,h] of [[8,6.5,2.4],[6,5,2.4],[4,10,4],[12,4,2.4]])for(const a of [.52,1,1.75,2.6]){
  const {position,target}=albumPose({width:w,depth:d,height:h},a);
  const camera=new PerspectiveCamera(albumFov,a,.05,200);camera.position.set(...position);camera.lookAt(...target);camera.updateMatrixWorld();
  const points=[];
  for(const x of [-w/2,w/2])for(const z of [-d/2,d/2]){points.push(new Vector3(x,-.14,z));if(x<0||z<0)points.push(new Vector3(x,h,z))}
  const frame=points.map(p=>p.project(camera));assert.ok(frame.every(p=>Math.abs(p.x)<=.975&&p.y<=.985&&p.y>=-.981&&p.z<1));
  const span=k=>Math.max(...frame.map(p=>p[k]))-Math.min(...frame.map(p=>p[k]));
  assert.ok(Math.max(span('x'),span('y'))>1.94,'at least one axis should nearly fill the photo');
 }
 assert.equal(cameraZoom('album',.52),1);
});

test('floor play reframes the hands and spread even when the default front angle is blocked',async()=>{
 const {rugPlayViewPose}=await import('./web/camera-presets.js');
 const p={x:0,y:.03,z:0},clear=rugPlayViewPose(p,0,[]),chair={x:.42,z:1.55,base:0,size:[.55,.45],height:1.6,yaw:.12};
 assert.ok(clear.position[0]>0);assert.ok(rugPlayViewPose(p,0,[chair]).position[0]<0);
 for(const aspect of [.56,1.78])for(const portrait of [false,true]){
  const shot=rugPlayViewPose(p,.47,[],portrait),c=new PerspectiveCamera(36,aspect,.05,40);c.zoom=cameraZoom('front',aspect);c.updateProjectionMatrix();
  c.position.set(...shot.position);c.lookAt(...shot.target);c.updateMatrixWorld();
  for(const [x,y,z] of [[0,1.05,0],[0,.36,.16],[-.38,.31,.46],[.31,.03,.46]]){
   const q=new Vector3(x,y+p.y,z).applyAxisAngle(new Vector3(0,1,0),.47).project(c);
   assert.ok(Math.abs(q.x)<1&&Math.abs(q.y)<1,'head, toys and booklet stay in the shot');
  }
 }
});

test('companion keeps a full-length adult-eye shot and changes shoulder for opaque obstacles',()=>{
 const child={x:0,y:0,z:0},first=companionPose(child,[]);
 const obstacle={x:first.position[0]*.5,z:first.position[2]*.5,yaw:.35,base:0,height:2,size:[.9,.7]};
 assert.equal(companionObstruction(child,first.position,[obstacle]),7);
 const clear=companionPose(child,[obstacle],first);
 assert.equal(clear.loss,0);assert.equal(clear.position[1],1.6);
 const next=companionPose({...child,yaw:Math.PI},[obstacle],clear);
 assert.deepEqual(next,clear);
 const radius=Math.hypot(clear.position[0],clear.position[2]),pitch=Math.atan2(1.6-.65,radius);
 for(const y of [0,1.3])assert.ok(Math.abs(Math.atan2(1.6-y,radius)-pitch)<26*Math.PI/180);
});
