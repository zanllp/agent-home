import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// A finished winged model beside the loose parts, distinct from the round robot in her hands.
// One colored mesh keeps small hinges, markings and boots inexpensive in a whole-room shot.
export function createScoutModel(){
 const pieces=[],ivory='#f4e9cf',blue='#537cad',deep='#3c4f69',gold='#dfa24e',mint='#94cdbc';
 function piece(geo,color,x,y,z,rz=0,rx=0){
  geo.rotateX(rx);geo.rotateZ(rz);geo.translate(x,y,z);
  const c=new T.Color(color),pos=geo.attributes.position,colors=new Float32Array(pos.count*3);
  for(let i=0;i<pos.count;i++)c.toArray(colors,i*3);
  geo.setAttribute('color',new T.BufferAttribute(colors,3));pieces.push(geo);
 }
 const plate=(w,h,d,x,y,z,col,rz=0,rx=0)=>piece(new RoundedBoxGeometry(w,h,d,1,Math.min(.005,w*.22,h*.22,d*.22)),col,x,y,z,rz,rx);
 const pin=(r,d,x,y,z,col)=>piece(new T.CylinderGeometry(r,r,d,12),col,x,y,z,Math.PI/2);
 function foil(points,depth,x,y,z,col){
  const shape=new T.Shape(points.map(([px,py])=>new T.Vector2(px,py)));
  const extrude=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false});piece(extrude,col,x,y,z);
 }
 for(const s of [-1,1]){
  const stride=s>0?.012:-.010;
  plate(.054,.027,.082,s*.043,.014,stride+.012,deep);plate(.05,.019,.064,s*.043,.033,stride+.018,blue);
  plate(.034,.059,.033,s*.039,.068,stride,ivory,-s*.10);plate(.026,.041,.014,s*.039,.072,stride+.022,blue,-s*.10);
  pin(.015,.038,s*.038,.103,stride,deep);plate(.032,.052,.036,s*.031,.124,stride,ivory,-s*.16);
  // Swept paper-plane wings, behind the shoulders rather than covering the face.
  foil([[0,0],[s*.060,.060],[s*.052,.015],[s*.014,-.019]],.011,s*.038,.194,-.030,blue);
  plate(.04,.039,.051,s*.058,.190,.003,ivory,-s*.18);pin(.010,.031,s*.07,.168,.003,deep);
  plate(.031,.039,.037,s*.072,.144,.008,blue,s*.09);plate(.023,.019,.030,s*.072,.119,.013,deep);
 }
 plate(.089,.028,.053,0,.150,0,deep);
 foil([[-.051,.032],[.051,.032],[.040,-.020],[.025,-.038],[-.032,-.033]],.048,0,.185,-.020,ivory);
 foil([[-.046,.013],[0,-.008],[.046,.013],[.040,.025],[0,.008],[-.040,.025]],.005,0,.185,.029,blue);
 plate(.018,.012,.006,0,.198,.035,gold);plate(.036,.014,.033,0,.228,0,deep);
 plate(.080,.047,.052,0,.258,0,ivory);plate(.065,.016,.006,0,.258,.027,deep);
 for(const s of [-1,1]){
  plate(.018,.006,.004,s*.017,.258,.032,mint,s*.09);
  foil([[0,0],[s*.034,.039],[s*.012,.004]],.007,s*.017,.277,.016,gold);
 }
 // Extruded fins are non-indexed. Merge all pieces in the same format.
 const parts=pieces.map(g=>g.index?g.toNonIndexed():g),geo=mergeGeometries(parts);
 new Set([...parts,...pieces]).forEach(g=>g.dispose());
 const model=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:.47}));
 model.name='Standing-scout';model.castShadow=model.receiveShadow=true;
 model.position.set(-.210,0,.300);model.rotation.y=.40;return model;
}

export function finishRugKit(root){
 const tray=root.getObjectByName('Tray-bottom')?.parent;
 if(!tray||root.getObjectByName('Standing-scout'))return;
 // Widen the actual box, not its coordinate system: packed toys retain their physical size.
 tray.position.set(-.342,0,.075);
 let block=0;for(const o of tray.children){
  if(o.name.startsWith('Tray-bottom')){o.scale.x=1.17;o.scale.z=1.40}
  else if(o.name.startsWith('Tray-side')||o.name.startsWith('Folded_box_rim')||o.name.startsWith('Folded box rim')){o.position.x*=1.17;o.scale.z=1.40}
  else if(o.name.startsWith('Tray-end')){o.position.z*=1.40;o.scale.x=1.17}
  else if(o.name==='Tray-label'){o.position.z*=1.40}
  else if(o.name.startsWith('Spare-block')){
   o.position.set((block%5-2)*.048,.028+Math.floor(block/5)*.027,-.114);
   o.rotation.y=(block%3-1)*.12;block++;
  }
 }
 const divider=new T.Mesh(new T.BoxGeometry(.289,.069,.004),tray.getObjectByName('Tray-bottom').material);
 divider.name='Parts-bin divider';divider.position.set(0,.047,-.075);divider.castShadow=divider.receiveShadow=true;tray.add(divider);
 const scout=createScoutModel();scout.position.z=.322;root.add(scout);
 // Leave the standing model its own spot on the rug.
 for(const [name,x,z] of [['Loose-piece-0',-.397,.342],['Loose-piece-1',-.339,.396],['Pick-up-robot',.008,.23]]){
  const piece=root.getObjectByName(name);if(piece){piece.position.x=x;piece.position.z=z}
 }
}
