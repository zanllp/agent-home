import mask from './pajama-mask.json' with {type:'json'};
import {Vector3,Matrix4,Group} from 'three';

// Only keep the distal portion of the original hand, including its UVs and weights.
// Do not cut the source GLB: the original geometry is restored when undressing.
function handGeometry(mesh,side){
 const g=mesh.geometry,sk=mesh.skeleton,pivot=n=>new Vector3().setFromMatrixPosition(new Matrix4().copy(sk.boneInverses[sk.bones.findIndex(b=>b.name.endsWith(side+n))]).invert());
 const wrist=pivot('Hand'),axis=wrist.clone().sub(pivot('ForeArm')).normalize(),p=new Vector3(),pos=g.attributes.position,idx=g.index,out=[];
 for(let i=0;i<idx.count;i+=3){const face=[idx.getX(i),idx.getX(i+1),idx.getX(i+2)];if(face.every(v=>p.fromBufferAttribute(pos,v).sub(wrist).dot(axis)>-.004))out.push(...face)}
 const cut=g.clone();cut.setIndex(out);return cut;
}
// The original scan was split by height: the bottom of the chin is in Dress,
// not HeadHair. Keep that painted strip with the head on every replacement.
function bindToHead(mesh,geometry,vertices){
 const head=mesh.skeleton.bones.findIndex(b=>b.name.endsWith('Head'));
 for(const v of vertices){geometry.attributes.skinIndex.setXYZW(v,head,0,0,0);geometry.attributes.skinWeight.setXYZW(v,1,0,0,0)}
}
function chinGeometry(mesh){
 const g=mesh.geometry,pos=g.attributes.position,idx=g.index,out=[];
 for(let i=0;i<idx.count;i+=3){const face=[idx.getX(i),idx.getX(i+1),idx.getX(i+2)];
  const y=face.reduce((n,k)=>n+pos.getY(k),0)/3;
  if(y>.581&&face.every(k=>Math.abs(pos.getX(k)+.006)<.107&&pos.getZ(k)>.066))out.push(...face);
 }
 if(!out.length)return null;
 const cut=g.clone();cut.setIndex(out);
 bindToHead(mesh,cut,new Set(out));
 return cut;
}
// Reject a changed bind pose before hiding a single base mesh. The copy of the
// joint hierarchy in a portable GLB is metadata, not a second animated rig.
export function rebindPack(base,scene){
 const anchor=base.getObjectByName('Legs'),sk=anchor.skeleton,parts=[];
 scene.traverse(o=>{if(o.isSkinnedMesh)parts.push(o)});
 if(!parts.length)throw Error('Empty garment pack');
 for(const part of parts){
  const s=part.skeleton;
  if(s.bones.length!==sk.bones.length||s.bones.some((b,i)=>b.name!==sk.bones[i].name||
    s.boneInverses[i].elements.some((v,j)=>Math.abs(v-sk.boneInverses[i].elements[j])>1e-5)))throw Error('Incompatible garment bind pose');
 }
 const group=new Group();for(const part of parts){part.bind(sk,anchor.bindMatrix);part.frustumCulled=false;group.add(part)}
 return group;
}
function keptPatch(mesh,key){
 const src=mesh.geometry,idx=src.index,out=[];
 for(const [start,count] of mask[key])for(let i=start*3;i<(start+count)*3;i++)out.push(idx.getX(i));
 const g=src.clone();g.setIndex(out);
 if(key==='Dress')bindToHead(mesh,g,new Set(out));
 return g;
}
export function tryOn(base,group,paintedMask=false){
 const original=[],hands=[];base.traverse(o=>{
  if(!o.isSkinnedMesh)return;
  if(paintedMask&&o.parent.name==='HeadHair'&&o.material?.map){
   // Match both sides of the jaw split. Otherwise looking up opens the seam
   // between the rigid chin patch and vertices still influenced by the chest.
   const src=o.geometry,g=src.clone();bindToHead(o,g,mask.jawSeamVertices);
   hands.push([o,src]);o.geometry=g;return;
  }
  if(/^Arm[_.]?[LR]$/.test(o.name)){const g=o.geometry;o.geometry=paintedMask?keptPatch(o,'Arm.'+o.name.at(-1)):handGeometry(o,o.name.endsWith('L')?'Left':'Right');hands.push([o,g]);return}
  if(o.parent.name==='Dress'&&o.material?.map){const g=o.geometry,chin=paintedMask?keptPatch(o,'Dress'):chinGeometry(o);if(chin){o.geometry=chin;hands.push([o,g]);return}}
  if(o.name==='Legs'||o.name.startsWith('Arm')||o.name.startsWith('Dress')||o.parent.name==='Dress'){original.push([o,o.visible]);o.visible=false}
 });
 base.getObjectByName('Legs').parent.add(group);
 return {group,remove(){group.removeFromParent();for(const [o,g] of hands){o.geometry.dispose();o.geometry=g}for(const [o,v] of original)o.visible=v}};
}
