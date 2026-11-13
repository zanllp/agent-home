import * as T from 'three';
import {createWateringCan} from './watering-can.js';
export function createWaterPose(scene,model,avatar){
 const can=createWateringCan();scene.add(can);can.visible=false;
 const bones={};model.traverse(b=>{if(b.isBone)bones[b.name.replace(/^mixamorig[:_]?/,'')]=b});
 const saved=new Map(),up=new T.Vector3(0,1,0);
 const drops=new T.InstancedMesh(new T.SphereGeometry(.004,6,4),new T.MeshBasicMaterial({color:'#9edbe5',transparent:true,opacity:.85}),20);scene.add(drops);drops.visible=false;
 let time=0;
 function restore(){for(const [b,q] of saved)b.quaternion.copy(q);saved.clear()}
 function reach(side,target){
  const end=bones[side+'Hand'],joints=[bones[side+'ForeArm'],bones[side+'Arm']];if(!end||joints.some(b=>!b))return;
  for(const b of joints)if(!saved.has(b))saved.set(b,b.quaternion.clone());
  for(let pass=0;pass<3;pass++)for(const b of joints){
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
  time+=dt;const tilt=frame.pour||0,y=Math.max(.53,(frame.soil?.y||.3)+.05);
  can.position.copy(avatar.localToWorld(new T.Vector3(.13,y,.31)));
  can.quaternion.copy(avatar.getWorldQuaternion(new T.Quaternion())).multiply(new T.Quaternion().setFromAxisAngle(up,-Math.PI/2)).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),-.85*tilt));
  can.updateMatrixWorld(true);
  reach('Right',can.localToWorld(new T.Vector3(-.14,.15,0)));
  reach('Left',can.localToWorld(new T.Vector3(.02,.09,.065)));
  if(drops.visible){
   const tip=can.localToWorld(new T.Vector3(.19,.22,0)),end=new T.Vector3(frame.soil.x,frame.soil.y,frame.soil.z);
   for(let i=0;i<20;i++){const t=(i/20+time*1.7)%1,point=tip.clone().lerp(end,t);point.y+=.055*Math.sin(Math.PI*t);drops.setMatrixAt(i,new T.Matrix4().makeTranslation(point.x,point.y,point.z))}
   drops.instanceMatrix.needsUpdate=true;
  }
 },dispose(){restore();scene.remove(can,drops);can.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});drops.geometry.dispose();drops.material.dispose()}};
}
