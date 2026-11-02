import {Quaternion,Vector3,MeshBasicMaterial,DoubleSide} from 'three';
import {createFloorBib} from './floor-bib.js';
import {floorLegGeometry,floorBodiceGeometry,roundPosedKnees} from './floor-fit.js';

// Apply offsets to the existing seated rig, never bake them into the walking clips.
export function createFloorPlay(model,avatar){
 const bones=new Map();model.traverse(o=>{if(o.isBone)bones.set(o.name.replace(/^mixamorig[:_]?/,''),o)});
 const saved=new Map(),localOrigin=model.parent.position.y;
 function restore(){for(const [b,q] of saved)b.quaternion.copy(q);saved.clear();model.parent.position.y=localOrigin}
 function offset(b,q,w){if(!b)return;if(!saved.has(b))saved.set(b,b.quaternion.clone());b.quaternion.slerp(q,w)}
 const legs=model.getObjectByName('Legs'),original=legs?.geometry;let fitted=null,calibrated=false,soleLift=0,tailRotation=null;
 const feet=['Left','Right'].map(side=>{
  const bone=bones.get(side+'Foot');if(!bone||!legs?.isSkinnedMesh)return null;
  const i=legs.skeleton.bones.indexOf(bone);if(i<0)return null;
  const bind=legs.skeleton.boneInverses[i].clone().invert();return new Quaternion().setFromRotationMatrix(bind.extractRotation(bind));
 });
 const dir=new Vector3(),to=new Vector3(),a=new Vector3(),c=new Vector3(),p=new Quaternion(),q=new Quaternion(),world=new Quaternion();
 function aim(name,end,x,y,z,w){
  const bone=bones.get(name),tip=bones.get(end);if(!bone||!tip)return;
  dir.copy(tip.getWorldPosition(a)).sub(bone.getWorldPosition(c)).normalize();to.set(x,y,z).normalize().applyQuaternion(world);
  bone.parent.getWorldQuaternion(p);q.setFromUnitVectors(dir,to).multiply(bone.getWorldQuaternion(new Quaternion())).premultiply(p.invert());offset(bone,q,w);
 }

 const legPaint=legs?.material,skinPaint=new MeshBasicMaterial({vertexColors:true,side:DoubleSide,toneMapped:false});
 const bodice=[];model.traverse(o=>{if(o.isSkinnedMesh&&(/TorsoSeam/.test(o.name)||o.parent?.name==='Dress'||o.name==='Dress'))bodice.push({mesh:o,original:o.geometry,fit:null})});
 let bib=null;
 function fit(active){
  if(active&&bodice.length&&!bib){const dress=bodice.find(b=>b.mesh.parent?.name==='Dress'||b.mesh.name==='Dress');if(dress)bib=createFloorBib(dress.mesh)}
  if(bib)bib.mesh.visible=active;
  if(legs?.isSkinnedMesh){if(active)fitted??=floorLegGeometry(legs);legs.geometry=active?fitted:original;legs.material=active?skinPaint:legPaint}
  for(const b of bodice){if(active)b.fit??=floorBodiceGeometry(b.mesh);b.mesh.geometry=active?b.fit:b.original}
 }
 function fitTail(){
  const bone=bones.get('WhaleTail'),mesh=model.getObjectByName('Tail');if(!mesh?.isSkinnedMesh||!bone)return;
  mesh.updateWorldMatrix(true,false);bone.updateWorldMatrix(true,false);
  let low=new Vector3(0,Infinity,0);
  for(let i=0;i<mesh.geometry.attributes.position.count;i++){
   mesh.localToWorld(mesh.getVertexPosition(i,a));if(a.y<low.y)low.copy(a);
  }
  const floor=avatar.position.y+.026;
  if(low.y>=floor)return;
  const anchor=bone.getWorldPosition(c),from=low.sub(anchor),len=from.length();
  if(len<.01)return;const y=Math.min(len*.95,Math.max(-len*.95,floor-anchor.y));
  to.set(from.x,0,from.z).normalize().multiplyScalar(Math.sqrt(len*len-y*y));to.y=y;
  bone.parent.getWorldQuaternion(p);tailRotation=new Quaternion().setFromUnitVectors(from.normalize(),to.normalize()).multiply(bone.getWorldQuaternion(q)).premultiply(p.invert());
 }
 function fitSoles(){
  if(!fitted)return;
  avatar.updateWorldMatrix(true,true);legs.updateMatrixWorld(true);
  roundPosedKnees(legs);
  const heights=[];for(let i=0;i<fitted.attributes.position.count;i++){legs.getVertexPosition(i,a);heights.push(legs.localToWorld(a).y)}
  heights.sort((a,b)=>a-b);soleLift=Math.min(.055,Math.max(0,avatar.position.y+.006-heights[Math.floor(heights.length*.01)]));
 }
 let held=null,rest=new Vector3(),restQ=new Quaternion();
 function release(){if(held){held.position.copy(rest);held.quaternion.copy(restQ);held=null}}
 return {restore,release,get lookAt(){return held?held.localToWorld(new Vector3(0,.13,0)):null},dispose(){release();restore();fit(false);bib?.dispose();skinPaint.dispose();fitted?.dispose();for(const b of bodice)b.fit?.dispose()},update(frame,time,set){
  const w=frame?.play||0,piece=w&&set?.getObjectByName('Pick-up-robot');
  if(!w||!piece){fit(false);release();return}
  fit(true);
  if(piece.userData.packed)release();else if(piece!==held){release();held=piece;rest.copy(piece.position);restQ.copy(piece.quaternion)}
  avatar.getWorldQuaternion(world);model.parent.position.y=localOrigin-.245*w;
  for(const [side,s] of [['Left',1],['Right',-1]]){
   aim(side+'UpLeg',side+'Leg',s*(s===1?.40:.63),s===1?-.10:-.17,.88,w);
   aim(side+'Leg',side+'Foot',-s*.95,s===1?-.30:-.38,s===1?.50:.08,w);
   const foot=bones.get(side+'Foot'),bind=feet[s===1?0:1];
   if(foot&&bind){foot.parent.getWorldQuaternion(p);q.setFromAxisAngle(to.set(0,1,0),-s*(s===1?1.58:.46)).multiply(bind).premultiply(world).premultiply(p.invert());offset(foot,q,w)}
   const fore=bones.get(side+'ForeArm');if(fore){q.setFromAxisAngle(to.set(1,0,0),s*(side==='Left'?.055:.14)*Math.sin(time*1.4+s*.45));offset(fore,fore.quaternion.clone().multiply(q),w)}
  }
  const calibrate=w===1&&!calibrated;if(calibrate){fitSoles();calibrated=true}
  model.parent.position.y+=soleLift*w;
  if(calibrate)fitTail();
  if(tailRotation)offset(bones.get('WhaleTail'),tailRotation,w);
  const head=bones.get('Head');if(head){
   // The reading clip already looks down; keep only a slight nod over the toy.
   head.parent.getWorldQuaternion(p);to.set(1,0,0).applyQuaternion(world).applyQuaternion(p.invert());
   q.setFromAxisAngle(to,.012*Math.cos(time*1.4));offset(head,head.quaternion.clone().premultiply(q),w);
  }
  if(!held)return;
  const l=bones.get('LeftHandIndex1'),r=bones.get('RightHandIndex1');if(!l||!r)return;
  a.copy(l.getWorldPosition(a)).lerp(r.getWorldPosition(c),.5);piece.parent.worldToLocal(a);a.y-=.095;
  held.position.copy(rest).lerp(a,w);held.quaternion.copy(restQ).multiply(q.setFromAxisAngle(to.set(0,1,0),w*.24*Math.sin(time*1.65)));
 }};
}
