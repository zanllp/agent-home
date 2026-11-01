import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createHeadLook} from './web/wander-head-look.js';

function fixture(){
 const head=new T.Bone(),mixer=new T.AnimationMixer(head);
 const clip=new T.AnimationClip('rest',1,[new T.QuaternionKeyframeTrack('.quaternion',[0,1],[0,0,0,1,0,0,0,1])]);
 const rest=mixer.clipAction(clip).play();rest.time=1/24;mixer.update(0);
 return {head,mixer,look:createHeadLook(head)};
}

test('unchanged zero-delta mixer frames cannot accumulate idle head rotation',()=>{
 const {head,mixer,look}=fixture(),identity=new T.Quaternion();
 for(let i=0;i<18000;i++){
  look.restore();mixer.update(0);look.apply(.05*Math.sin(i/30*1.2));
  assert.ok(head.quaternion.angleTo(identity)<=.05000001);
 }
});

test('returning to movement removes idle offset even when mixer skips a write',()=>{
 const {head,mixer,look}=fixture();
 for(const angle of [.05,.05,-.05,0]){look.restore();mixer.update(0);look.apply(angle)}
 assert.ok(head.quaternion.angleTo(new T.Quaternion())<1e-7);
});

test('head look preserves changing animated poses and caps its own offset',()=>{
 const {head,look}=fixture(),axis=new T.Vector3(1,0,0);
 for(let i=0;i<300;i++){
  look.restore();const animated=new T.Quaternion().setFromAxisAngle(axis,.02*Math.sin(i));
  head.quaternion.copy(animated);look.apply(i%2?10:-10);
  assert.ok(Math.abs(head.quaternion.angleTo(animated)-.05)<1e-7);
  look.restore();assert.ok(head.quaternion.angleTo(animated)<1e-7);
 }
});
