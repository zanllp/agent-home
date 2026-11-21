import {Quaternion,Vector3,Matrix4,Mesh,MeshBasicMaterial,DoubleSide} from 'three';
import {createPlayContact} from './play-contact.js';
import {createFloorBib} from './floor-bib.js';
import {floorLegGeometry,floorBodiceGeometry,roundPosedKnees} from './floor-fit.js';

// Apply offsets to the existing seated rig, never bake them into the walking clips.
export function createFloorPlay(model,avatar){
 const bones=new Map();model.traverse(o=>{if(o.isBone)bones.set(o.name.replace(/^mixamorig[:_]?/,''),o)});
 const contact=createPlayContact(avatar,bones);
 const saved=new Map(),localOrigin=model.parent.position.y;
 function restore(){for(const [b,q] of saved)b.quaternion.copy(q);saved.clear();model.parent.position.y=localOrigin}
 function offset(b,q,w){if(!b)return;if(!saved.has(b))saved.set(b,b.quaternion.clone());b.quaternion.slerp(q,w)}
 const legs=model.getObjectByName('Legs'),original=legs?.geometry;let fitted=null,calibrated=false,soleLift=0,tailRotation=null,rugMode=false;
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

 const tail=model.getObjectByName('Tail'),originalTail=tail?.geometry;let rugTail,rugFluke;
 function setRugTail(active){
  if(!tail?.isSkinnedMesh)return;
  if(active&&!rugTail){
   const index=tail.skeleton.bones.indexOf(bones.get('WhaleTail'));if(index<0)return;
   // Some imported fluke vertices follow the head or thighs. Keep its painted rest shape together on the rug.
   rugTail=originalTail.clone();const {skinIndex,skinWeight}=rugTail.attributes;
   for(let i=0;i<skinIndex.count;i++){skinIndex.setXYZW(i,index,0,0,0);skinWeight.setXYZW(i,1,0,0,0)}
  }
  tail.geometry=active&&rugTail?rugTail:originalTail;
  tail.visible=!(active&&rugFluke);if(rugFluke)rugFluke.visible=active;
 }
 const legPaint=legs?.material,skinPaint=new MeshBasicMaterial({vertexColors:true,side:DoubleSide,toneMapped:false});
 const bodice=[];model.traverse(o=>{if(o.isSkinnedMesh&&(/TorsoSeam/.test(o.name)||o.parent?.name==='Dress'||o.name==='Dress'))bodice.push({mesh:o,original:o.geometry,fit:null})});
 let bib=null,referenceClothes=true;
 function fit(active){
  if(!referenceClothes)return;
  if(active&&bodice.length&&!bib){const dress=bodice.find(b=>b.mesh.parent?.name==='Dress'||b.mesh.name==='Dress');if(dress)bib=createFloorBib(dress.mesh)}
  if(bib)bib.mesh.visible=active;
  if(legs?.isSkinnedMesh){if(active)fitted??=floorLegGeometry(legs);legs.geometry=active?fitted:original;legs.material=active?skinPaint:legPaint}
  for(const b of bodice){if(active)b.fit??=floorBodiceGeometry(b.mesh);b.mesh.geometry=active?b.fit:b.original}
 }
 function fitTail(){
  const bone=bones.get('WhaleTail'),mesh=model.getObjectByName('Tail');if(!mesh?.isSkinnedMesh||!bone)return;
  avatar.updateWorldMatrix(true,true);mesh.updateMatrixWorld(true);bone.updateWorldMatrix(true,false);
  const pivot=bone.getWorldPosition(new Vector3()),verts=[];
  for(let i=0;i<mesh.geometry.attributes.position.count;i++)verts.push(mesh.localToWorld(mesh.getVertexPosition(i,new Vector3())).sub(pivot));
  bone.parent.getWorldQuaternion(p).invert();const base=bone.getWorldQuaternion(new Quaternion());
  if(rugMode){
   // Lay the original fluke beside her, not upright behind her hair. Solve both heading and roll.
   const long=verts.slice().sort((v,w)=>w.lengthSq()-v.lengthSq()),forward=new Vector3();
   for(const v of long.slice(0,Math.ceil(long.length*.15)))forward.add(v);forward.normalize();
   const spans=verts.map(v=>v.clone().addScaledVector(forward,-v.dot(forward))),wide=spans.reduce((m,v)=>m.lengthSq()>v.lengthSq()?m:v).clone().normalize();
   for(let i=0;i<6;i++){const next=new Vector3();for(const v of spans)next.addScaledVector(v,v.dot(wide));wide.copy(next).normalize()}
   const normal=new Vector3().crossVectors(forward,wide).normalize();if(normal.y<0){normal.negate();wide.negate()}
   const basis=(x,y,z)=>new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,y,z));
   const from=basis(forward,wide,normal).invert(),up=new Vector3(0,1,0),floor=avatar.position.y-.001;
   let best=-Infinity,restTurn;
   for(const lift of [.015,.05,.09,.14,.20,.28,.38]){
    const heading=new Vector3(.97,lift,-.22).normalize().applyQuaternion(world),cross=new Vector3().crossVectors(up,heading).normalize();
    const delta=basis(heading,cross,new Vector3().crossVectors(heading,cross)).multiply(from);
    let min=Infinity;for(const v of verts)min=Math.min(min,pivot.y+a.copy(v).applyQuaternion(delta).y);
    if(min>best){best=min;restTurn=delta}
    if(min>=floor)break;
   }
   // Cache the settled rigid skin in avatar space. This avoids re-skinning through
   // non-uniform parent transforms and preserves the source UVs and silhouette.
   const geo=originalTail.clone(),out=geo.attributes.position;
   for(let i=0;i<out.count;i++){a.copy(verts[i]).applyQuaternion(restTurn).add(pivot);avatar.worldToLocal(a);out.setXYZ(i,a.x,a.y,a.z)}
   geo.computeVertexNormals();geo.computeBoundingSphere();rugFluke=new Mesh(geo,tail.material);rugFluke.name='Resting-fluke';avatar.add(rugFluke);tail.visible=false;
   return;
  }
  const low=verts.reduce((m,v)=>v.y<m.y?v:m),floor=avatar.position.y+.026;
  if(low.y+pivot.y>=floor)return;
  const len=low.length();if(len<.01)return;
  const y=Math.min(len*.95,Math.max(-len*.95,floor-pivot.y));to.set(low.x,0,low.z).normalize().multiplyScalar(Math.sqrt(len*len-y*y));to.y=y;
  tailRotation=new Quaternion().setFromUnitVectors(low.normalize(),to.normalize()).multiply(base).premultiply(p);
 }
 function fitSoles(){
  if(!referenceClothes||!fitted)return;
  avatar.updateWorldMatrix(true,true);legs.updateMatrixWorld(true);
  roundPosedKnees(legs);
  const heights=[];for(let i=0;i<fitted.attributes.position.count;i++){legs.getVertexPosition(i,a);heights.push(legs.localToWorld(a).y)}
  heights.sort((a,b)=>a-b);soleLift=Math.min(.055,Math.max(0,avatar.position.y+.006-heights[Math.floor(heights.length*.01)]));
 }
 let held=null,rest=new Vector3(),restQ=new Quaternion();
 function release(){if(held){held.position.copy(rest);held.quaternion.copy(restQ);held=null}}
 return {restore,release,setReferenceClothes(enabled){
  if(enabled===referenceClothes)return;
  if(!enabled)fit(false);
  referenceClothes=enabled;soleLift=0;calibrated=false;
 },get lookAt(){return held?held.localToWorld(new Vector3(0,.13,0)):null},dispose(){contact.dispose();release();restore();setRugTail(false);rugTail?.dispose();if(rugFluke){rugFluke.removeFromParent();rugFluke.geometry.dispose()}fit(false);bib?.dispose();skinPaint.dispose();fitted?.dispose();for(const b of bodice)b.fit?.dispose()},update(frame,time,set){
  const w=frame?.play||0,piece=w&&set?.getObjectByName('Pick-up-robot');
  if(!w||!piece){contact.update(0);setRugTail(false);fit(false);release();return}
  const onRug=set.userData.rugPlay===true;
  if(rugMode!==onRug){if(rugFluke){rugFluke.removeFromParent();rugFluke.geometry.dispose();rugFluke=null}fitted?.dispose();fitted=null;calibrated=false;soleLift=0;tailRotation=null;rugMode=onRug}
  setRugTail(onRug&&w===1);fit(true);
  if(piece.userData.packed)release();else if(piece!==held){release();held=piece;rest.copy(piece.position);restQ.copy(piece.quaternion)}
  avatar.getWorldQuaternion(world);model.parent.position.y=localOrigin-(onRug ? .321 : .245)*w;
  for(const [side,s] of [['Left',1],['Right',-1]]){
   aim(side+'UpLeg',side+'Leg',s*(s===1?.40:.63),onRug?(s===1?-.035:-.105):(s===1?-.10:-.17),.88,w);
   aim(side+'Leg',side+'Foot',-s*.95,onRug?(s===1?.055:-.015):(s===1?-.30:-.38),s===1?.50:.08,w);
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
  contact.update(set.userData.rugPlay?w:0,set.position.y);
  if(!held)return;
  const l=bones.get('LeftHandIndex1'),r=bones.get('RightHandIndex1');if(!l||!r)return;
  a.copy(l.getWorldPosition(a)).lerp(r.getWorldPosition(c),.5);piece.parent.worldToLocal(a);a.y-=.095;
  held.position.copy(rest).lerp(a,w);held.quaternion.copy(restQ).multiply(q.setFromAxisAngle(to.set(0,1,0),w*.24*Math.sin(time*1.65)));
 }};
}
