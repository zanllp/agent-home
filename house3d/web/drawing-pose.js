import * as T from 'three';

// The page and crayon tip use the same coordinate system, even for a rotated chair.
export function createDrawingPose(scene, model, avatar){
 const bones={};model.traverse(b=>{if(b.isBone)bones[b.name.replace(/^mixamorig[:_]?/,'')]=b});
 const crayon=new T.Group();crayon.name='Drawing-crayon';scene.add(crayon);crayon.visible=false;
 const meshes=[];
 function segment(rTop,rBottom,height,y,color){
  const geo=new T.CylinderGeometry(rTop,rBottom,height,10),mat=new T.MeshStandardMaterial({color,roughness:.93});
  const m=new T.Mesh(geo,mat);m.position.y=y;crayon.add(m);meshes.push(m);
 }
 segment(.010,0,.020,.010,'#bd4d53');segment(.010,.010,.108,.074,'#dc6666');segment(.0106,.0106,.066,.082,'#f8cb88');segment(.0107,.0107,.007,.108,'#9b5853');
 const saved=new Map(),origin=new T.Vector3(),rotation=new T.Quaternion(),local=new T.Vector3(),rot=new T.Quaternion(),
   tip=new T.Vector3(),grip=new T.Vector3(),other=new T.Vector3(),axis=new T.Vector3(),world=new T.Quaternion(),
   joint=new T.Vector3(),from=new T.Vector3(),to=new T.Vector3(),delta=new T.Quaternion(),parentQ=new T.Quaternion(),up=new T.Vector3(0,1,0);
 const lapRotation=new T.Quaternion().setFromEuler(new T.Euler(.21,Math.PI,0,'YXZ'));
 let book=null,time=0;
 function restore(){for(const [bone,q] of saved)bone.quaternion.copy(q);saved.clear()}
 function release(){if(book){book.position.copy(origin);book.quaternion.copy(rotation);book=null}crayon.visible=false;time=0}
 function aim(side,goal,weight){
  const finger=bones[side+'HandIndex1'],joints=['ForeArm','Arm'].map(n=>bones[side+n]);if(!finger||joints.some(b=>!b))return;
  for(const j of joints)saved.set(j,j.quaternion.clone());
  const [fore,arm]=joints;
  const shoulder=arm.getWorldPosition(new T.Vector3()),elbow=fore.getWorldPosition(new T.Vector3()),end=finger.getWorldPosition(new T.Vector3());
  const direction=goal.clone().sub(shoulder).normalize(),a=shoulder.distanceTo(elbow),b=elbow.distanceTo(end);
  const d=T.MathUtils.clamp(shoulder.distanceTo(goal),Math.abs(a-b)+1e-5,a+b-1e-5),along=(a*a-b*b+d*d)/(2*d);
  const bend=elbow.clone().sub(shoulder);bend.addScaledVector(direction,-bend.dot(direction)).normalize();
  const elbowGoal=shoulder.clone().addScaledVector(direction,along).addScaledVector(bend,Math.sqrt(Math.max(0,a*a-along*along)));
  for(const [j,child,target] of [[arm,fore,elbowGoal],[fore,finger,goal]]){
   j.getWorldPosition(joint);from.copy(child.getWorldPosition(local)).sub(joint).normalize();to.copy(target).sub(joint).normalize();
   j.parent.getWorldQuaternion(parentQ);delta.setFromUnitVectors(from,to);
   rot.copy(parentQ).invert().multiply(delta).multiply(parentQ).multiply(j.quaternion);j.quaternion.copy(rot);
  }
  for(const j of joints)j.quaternion.slerp(saved.get(j),1-weight);
 }
 return {restore,get focus(){return crayon.visible?tip:null},dispose(){restore();release();scene.remove(crayon);for(const m of meshes){m.geometry.dispose();m.material.dispose()}},
  update(weight,dt,placed,poseTime){
   const page=placed?.getObjectByName('Picturebook-page-right')||placed?.getObjectByName('Workbook-page-right');
   if(!page||!weight){release();return}
   if(placed!==book){release();book=placed;origin.copy(book.position);rotation.copy(book.quaternion)}
   time=poseTime??(time+dt);avatar.getWorldQuaternion(world);
   local.set(0,.445,.29);avatar.localToWorld(local);book.parent.worldToLocal(local);
   book.position.copy(origin).lerp(local,weight);
   book.parent.getWorldQuaternion(parentQ);rot.copy(parentQ).invert().multiply(world).multiply(lapRotation);
   book.quaternion.copy(rotation).slerp(rot,weight);
   // Short groups of strokes, then lift the tip to start the next group.
   const phase=(time%2.4)/2.4, lift=Math.max(0,Math.sin(Math.PI*(phase-.72)/.28))*(phase>.72?.018:0);
   tip.set(.034*Math.sin(time*3.1),.030*Math.sin(time*5.4),.003+lift);page.localToWorld(tip);
   axis.set(-.26,.91,-.33).normalize().applyQuaternion(world);
   aim('Right',grip.copy(tip).addScaledVector(axis,.050),weight);
   other.set(.092,.466,.24);avatar.localToWorld(other);aim('Left',other,weight);
   const finger=bones.RightHandIndex1;if(!finger)return;
   crayon.visible=weight>.65;crayon.position.copy(finger.getWorldPosition(local)).addScaledVector(axis,-.050);
   crayon.quaternion.setFromUnitVectors(up,axis);
  }};
}
