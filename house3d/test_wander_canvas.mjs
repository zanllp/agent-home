import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {hudLayout,createCanvasHud} from './web/wander-hud.js';
import {createSecondaryMotion} from './web/wander-motion.js';

test('HUD can receive the first frame before ResizeObserver supplies a size',()=>{
 const previous=globalThis.document;
 globalThis.document={createElement:()=>({getContext:()=>({scale(){}})})};
 try{const hud=createCanvasHud();assert.doesNotThrow(()=>hud.update({light:'day'}));hud.dispose()}
 finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous}
});

test('canvas HUD targets remain inside desktop and narrow viewports',()=>{
 for(const [width,height] of [[1512,800],[390,844],[320,568],[844,390]]){
  const boxes=hudLayout(width,height);assert.equal(boxes.length,5);
  for(const r of boxes){assert.ok(r.x>=0&&r.x+r.w<=width);assert.ok(r.y>=0&&r.y+r.h<=height);assert.ok(r.w>=54&&r.h>=44)}
 }
});

test('wander entry contains no DOM sidebar or buttons and has one visible renderer',()=>{
 const s=readFileSync(new URL('./web/wander.js',import.meta.url),'utf8');
 assert.ok(!s.includes('createApp'));assert.ok(!s.includes('<aside'));assert.ok(!s.includes('<button'));
 assert.equal((s.match(/mount.appendChild/g)||[]).length,1);
 assert.ok(s.includes('hud.hit'));assert.ok(s.includes("'keydown'"));
});

function fixture(){
 const model=new T.Group(),hips=new T.Bone(),spine=new T.Bone(),head=new T.Bone(),foot=new T.Bone();
 hips.name='mixamorigHips';spine.name='mixamorigSpine';head.name='mixamorigHead';foot.name='mixamorigLeftFoot';
 model.add(hips);hips.add(spine,foot);spine.add(head);foot.position.set(.04,0,.02);
 for(const name of ['Spine1','LeftArm','RightArm','LeftForeArm','RightForeArm','WhaleTail']){const b=new T.Bone();b.name=name==='WhaleTail'?name:'mixamorig'+name;spine.add(b)}
 model.updateMatrixWorld(true);return {model,head,foot,motion:createSecondaryMotion(model)};
}
test('secondary sway is visible, bounded, non-accumulating and does not move planted feet',()=>{
 const {model,head,foot,motion}=fixture(),origin=foot.getWorldPosition(new T.Vector3()),identity=new T.Quaternion();let seen=0;
 for(let i=0;i<18000;i++){
  motion.restore();motion.apply({phase:i/30,time:i/30,weight:i%300<150?1:0,turn:2});model.updateMatrixWorld(true);
  assert.ok(head.quaternion.angleTo(identity)<.055);
  assert.ok(foot.getWorldPosition(new T.Vector3()).distanceTo(origin)<1e-9);
  seen=Math.max(seen,head.quaternion.angleTo(identity));
 }
 assert.ok(seen>.03);motion.restore();model.traverse(o=>{if(o.isBone)assert.ok(o.quaternion.angleTo(identity)<1e-7)});
});
test('secondary motion keeps the changing animated base pose',()=>{
 const {head,motion}=fixture(),animated=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),.1);
 motion.restore();head.quaternion.copy(animated);motion.apply({phase:.2,time:1,weight:1});motion.restore();assert.ok(head.quaternion.angleTo(animated)<1e-7);
});
