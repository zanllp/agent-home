import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3, Group, Scene, Vector3} from 'three';
import {createWaterPose} from '../house3d/web/water-pose.js';
import {geometryOnly} from './helpers/geometry-only.mjs';

test('watering keeps the handle at the palm through tilting and releases both arms',async()=>{
 const {scene:model}=await geometryOnly('dafeiyu-contact');
 const avatar=new Group(), fit=new Group(), scene=new Scene(), box=new Box3().setFromObject(model);
 const mid=box.getCenter(new Vector3());
 fit.scale.setScalar(1.3/box.getSize(new Vector3()).y);
 model.position.set(-mid.x,-box.min.y,-mid.z);
 scene.add(avatar);avatar.add(fit);fit.add(model);
 avatar.position.set(2,.03,-1);avatar.rotation.y=1.4;scene.updateMatrixWorld(true);
 const rig=createWaterPose(scene,model,avatar),can=scene.getObjectByName('Loop handle').parent;
 const bone=n=>model.getObjectByName('mixamorig'+n),v=new Vector3();
 const arms=['RightArm','RightForeArm','LeftArm','LeftForeArm'].map(bone),rest=arms.map(b=>b.quaternion.clone());
 let pivot;
 for(const pour of [0,.25,.55,.8,1,.5,0]){
  rig.restore();rig.update({carry:1,pour,soil:{x:2,y:.72,z:-.4}},1/30);
  const handle=can.localToWorld(new Vector3(-.165,.143,0));
  pivot??=handle.clone();
  assert.ok(handle.distanceTo(pivot)<1e-6);
  assert.ok(bone('RightHandMiddle1').getWorldPosition(v).distanceTo(handle)<.008);
  assert.ok(bone('LeftHandMiddle1').getWorldPosition(v).distanceTo(can.localToWorld(new Vector3(.012,.095,-.077)))<.009);
 }
 rig.restore();rig.update(null,1/30);assert.equal(can.visible,false);
 for(const [i,b] of arms.entries())assert.ok(b.quaternion.equals(rest[i]));
 rig.dispose();
});
