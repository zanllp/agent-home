import * as T from 'three';
import {createWateringCan} from './watering-can.js';
export function createWaterPose(scene,model,avatar){
 const can=createWateringCan();scene.add(can);can.visible=false;
 const bones={};model.traverse(b=>{if(b.isBone)bones[b.name.replace(/^mixamorig[:_]?/,'')]=b});
 const saved=new Map(),up=new T.Vector3(0,1,0),pourAxis=new T.Vector3(0,0,1);
 const handle=new T.Vector3(-.165,.143,0),support=new T.Vector3(.012,.095,-.077);
 const pivot=new T.Vector3(),offset=new T.Vector3();
 const drops=new T.InstancedMesh(new T.SphereGeometry(.004,6,4),new T.MeshBasicMaterial({color:'#9edbe5',transparent:true,opacity:.85}),20);scene.add(drops);drops.visible=false;
 let time=0;
 function restore(){for(const [b,q] of saved)b.quaternion.copy(q);saved.clear()}
 function reach(side,target){
  const end=bones[side+'HandMiddle1'],joints=[bones[side+'ForeArm'],bones[side+'Arm']];if(!end||joints.some(b=>!b))return;
  for(const b of joints)if(!saved.has(b))saved.set(b,b.quaternion.clone());
  for(let pass=0;pass<8;pass++)for(const b of joints){
   b.updateWorldMatrix(true,true);
   const origin=b.getWorldPosition(new T.Vector3()),inverse=b.parent.matrixWorld.clone().invert();
   const from=end.getWorldPosition(new T.Vector3()).sub(origin).normalize().transformDirection(inverse);
   const to=target.clone().sub(origin).normalize().transformDirection(inverse);
   b.quaternion.premultiply(new T.Quaternion().setFromUnitVectors(from,to));
  }
 }
 return {restore,update(frame,dt){
  const held=!!frame?.carry;can.visible=held;drops.visible=held&&frame.pour>.03;
  if(!held)return;
  time+=dt;const tilt=frame.pour||0;
  // Pour around the handle in her palm, not around the middle of the can.
  // Soil height controls the stream endpoint, not the child's reach.
  pivot.copy(avatar.localToWorld(new T.Vector3(-.037,.66,.197)));
  can.quaternion.copy(avatar.getWorldQuaternion(new T.Quaternion())).multiply(new T.Quaternion().setFromAxisAngle(up,-1.12)).multiply(new T.Quaternion().setFromAxisAngle(pourAxis,-.73*tilt));
  can.position.copy(pivot).sub(offset.copy(handle).applyQuaternion(can.quaternion));
  can.updateMatrixWorld(true);
  reach('Right',pivot);
  reach('Left',can.localToWorld(support.clone()));
  if(drops.visible){
   const tip=can.localToWorld(new T.Vector3(.19,.22,0)),end=new T.Vector3(frame.soil.x,frame.soil.y,frame.soil.z);
   for(let i=0;i<20;i++){const t=(i/20+time*1.7)%1,point=tip.clone().lerp(end,t);point.y+=.055*Math.sin(Math.PI*t);drops.setMatrixAt(i,new T.Matrix4().makeTranslation(point.x,point.y,point.z))}
   drops.instanceMatrix.needsUpdate=true;
  }
 },dispose(){restore();scene.remove(can,drops);can.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});drops.geometry.dispose();drops.material.dispose()}};
}
