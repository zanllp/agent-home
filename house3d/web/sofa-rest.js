import {Mesh,MeshStandardMaterial,PlaneGeometry,DataTexture,SRGBColorSpace,RepeatWrapping,DoubleSide,Float32BufferAttribute,Vector3,Quaternion} from 'three';
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=v=>{const t=clamp(v);return t*t*(3-2*t)};

// The arm throw is put back when she gets up. It is never drawn twice.
export function sofaRest(group,asset,item,throwGroup,softProps=[]){
 const config=asset.interactions.sleep,seat=config.surface_height,flip=config.yaw>0?-1:1;
 const geo=new PlaneGeometry(1,1,32,22),p=geo.attributes.position,uv=geo.attributes.uv;
 const folded=[],covered=[],mapBytes=new Uint8Array(32*32*4);
 for(let y=0;y<32;y++)for(let x=0;x<32;x++){
  const stripe=x<2||x>29,shade=((x+y)%2)*5;
  mapBytes.set([...(stripe?[206,218,222]:[151,174,191]).map(v=>v-shade),255],4*(y*32+x));
 }
 const map=new DataTexture(mapBytes,32,32);map.colorSpace=SRGBColorSpace;
 map.wrapS=map.wrapT=RepeatWrapping;map.repeat.set(3,4);map.needsUpdate=true;
 const material=new MeshStandardMaterial({map,roughness:.98,side:DoubleSide});
 for(let i=0;i<p.count;i++){
  const u=uv.getX(i),v=uv.getY(i),x=-.62+u*.76,z=.20+(v-.5)*.72;
  const ridge=Math.exp(-Math.pow((z-.18)/.30,4))*(.31-.07*(1-u));
  const drop=.16*smooth((z-.37)/.20);
  covered.push(x*flip,seat+.025+ridge-drop+.009*Math.sin(u*28+v*9),z);
  const fx=asset.size[0]/2-.14+(u-.5)*.21;
  folded.push(fx,seat+.19+.035*Math.sin(u*12)+(v-.5)*.04,.03+(v-.5)*.34);
  p.setXYZ(i,...folded.slice(-3));
 }
 geo.morphAttributes.position=[new Float32BufferAttribute(covered,3)];
 geo.computeVertexNormals();const copy=geo.clone();copy.morphAttributes={};copy.setAttribute('position',geo.morphAttributes.position[0]);copy.computeVertexNormals();geo.morphAttributes.normal=[copy.attributes.normal];copy.dispose();
 const cloth=new Mesh(geo,material);cloth.name='Sofa-blanket';cloth.castShadow=cloth.receiveShadow=true;
 cloth.updateMorphTargets();group.add(cloth);
 const positions=softProps.map(o=>[o,o.position.clone()]);
 const idle=()=>{cloth.visible=!throwGroup};
 idle();
 return {update(weight){
  const t=smooth(weight),cover=item.properties?.covered===true;
  cloth.visible=cover&&t>.02||!throwGroup;
  cloth.morphTargetInfluences[0]=cover?t:0;
  if(throwGroup)throwGroup.visible=!(cover&&t>.02);
  // Nest the loose cushions at the free end, instead of lying through them.
  for(const [o,position] of positions){
   o.position.copy(position);
   o.position.x+=(-flip*(asset.size[0]/2-.28)-position.x)*t;
   o.position.z+=(-.14-position.z)*t;
  }
 },dispose(){geo.dispose();material.dispose();map.dispose()}};
}

// Keep the neck turn small. Use the full parent transform (the imported rig is mirrored).
export function sofaGlance(model,normalized){
 let head,saved,yaw;model.traverse(o=>{if(o.isBone&&o.name.replace(/^mixamorig[:_]?/,'')==='Head')head=o});
 return {restore(){if(saved)head.quaternion.copy(saved);saved=null;yaw=undefined},get yaw(){return yaw},
  update(weight,target,eye){
   if(!head||!weight||!target)return;
   model.updateWorldMatrix(true,true);
   const forward=new Vector3(0,0,1).transformDirection(normalized.matrixWorld);
   const from=Math.atan2(forward.x,forward.z),to=Math.atan2(target.x-eye.x,target.z-eye.z);
   const delta=Math.max(-.36,Math.min(.36,Math.atan2(Math.sin(to-from),Math.cos(to-from))))*weight;
   const rotated=forward.clone().applyAxisAngle(new Vector3(0,1,0),delta),inverse=head.parent.matrixWorld.clone().invert();
   const localFrom=forward.clone().transformDirection(inverse),localTo=rotated.transformDirection(inverse);
   saved=head.quaternion.clone();head.quaternion.premultiply(new Quaternion().setFromUnitVectors(localFrom,localTo));yaw=from+delta;
  }};
}
