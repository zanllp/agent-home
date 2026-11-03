import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const paint=(name,color,roughness=.64)=>new T.MeshStandardMaterial({name,color,roughness,side:T.DoubleSide});
export function createRugWorkshop(){
 const root=new T.Group();root.name='Rug-workshop';
 const ivory=paint('Warm enamel','#f0e6ce',.43),blue=paint('Cornflower enamel','#527da9',.44),navy=paint('Blue chassis','#354b66'),mint=paint('Mint lens','#a2c9bb',.36),gold=paint('Ochre clip','#d6a45f'),rubber=paint('Rubber tire','#53606c',.9),paper=paint('Warm paper','#f5ebd7',.94);
 function put(g,name,geo,m,x,y,z){const o=new T.Mesh(geo,m);o.name=name;o.position.set(x,y,z);g.add(o);return o}
 function box(g,name,w,h,d,x,y,z,m,r=.003){return put(g,name,new RoundedBoxGeometry(w,h,d,2,Math.min(r,w*.44,h*.44,d*.44)),m,x,y,z)}
 function oval(g,name,w,h,d,x,y,z,m){const o=put(g,name,new T.SphereGeometry(1,16,12),m,x,y,z);o.scale.set(w,h,d);return o}
 function disk(g,name,r,h,x,y,z,m,axis='y'){const o=put(g,name,new T.CylinderGeometry(r,r,h,20),m,x,y,z);if(axis==='x')o.rotation.z=Math.PI/2;if(axis==='z')o.rotation.x=Math.PI/2;return o}
 const tray=new T.Group();tray.name='Parts-tray';tray.position.set(-.365,0,.10);tray.rotation.y=-.095;root.add(tray);
 box(tray,'Tray-bottom',.265,.012,.228,0,.006,0,ivory,.005);
 for(const s of [-1,1]){
  box(tray,'Tray-side',.009,.10,.228,s*.128,.055,0,ivory);
  box(tray,'Tray-end',.254,.10,.009,0,.055,s*.109,ivory);
  box(tray,'Folded box rim',.016,.008,.231,s*.128,.104,0,paper);
 }
 box(tray,'Tray-label',.09,.034,.003,0,.066,.115,blue);
 for(let i=0;i<8;i++){const o=box(tray,'Spare-block',.045,.026,.028,(i%3-1)*.053,.025+Math.floor(i/6)*.027,(Math.floor(i/3)%2-.5)*.070,[ivory,blue,mint,gold][i%4]);o.rotation.y=i*.32}
 const bot=new T.Group();bot.name='Pick-up-robot';bot.position.set(-.03,.003,.23);root.add(bot);
 for(const s of [-1,1]){
  box(bot,'Blue boot',.047,.030,.072,s*.034,.016,.009,blue,.009);
  box(bot,'Ivory shin guard',.035,.049,.036,s*.034,.05,0,ivory,.005);disk(bot,'Knee pivot',.013,.038,s*.034,.071,0,navy,'x');
 }
 box(bot,'Link belt',.089,.027,.055,0,.08,0,navy,.006);
 box(bot,'Rounded cuirass',.112,.080,.066,0,.124,0,ivory,.016);
 box(bot,'Chest hatch',.057,.041,.007,0,.132,.034,blue,.006);box(bot,'Ochre chest badge',.020,.008,.003,0,.14,.039,gold,.001);
 for(let i=0;i<3;i++)box(bot,'Chest vents',.034,.002,.004,0,.114+i*.004,.039,navy,.0006);
 disk(bot,'Collar bearing',.028,.013,0,.167,0,navy);
 box(bot,'Rounded head',.123,.07,.075,0,.204,0,ivory,.018);
 box(bot,'Inset visor',.096,.038,.009,0,.204,.036,navy,.010);
 for(const s of [-1,1]){
  box(bot,'Smile eye',.016,.011,.004,s*.024,.207,.042,mint,.002);
  disk(bot,'Headphone rim',.019,.011,s*.062,.205,-.001,blue,'x');
  oval(bot,'Shoulder pivot',.023,.023,.021,s*.062,.15,0,navy);
  box(bot,'Shoulder cap',.037,.030,.052,s*.065,.153,0,blue,.008);disk(bot,'Elbow bearing',.013,.028,s*.075,.116,.008,gold,'x');
  box(bot,'Enamel gauntlet',.039,.043,.047,s*.082,.096,.012,blue,.009);
  box(bot,'Palm',.029,.019,.031,s*.085,.073,.018,ivory,.006);
 }
 disk(bot,'Antenna',.004,.019,.032,.247,-.006,gold);oval(bot,'Antenna cap',.008,.008,.008,.032,.258,-.006,mint);
 const booklet=new T.Group();booklet.name='Assembly-booklet';booklet.position.set(.308,.006,.257);booklet.rotation.y=-.18;root.add(booklet);
 box(booklet,'Book-lined cover',.337,.005,.220,0,-.001,0,blue,.002);
 for(const s of [-1,1]){
  const page=new T.PlaneGeometry(.164,.212,16,5),p=page.attributes.position;
  for(let i=0;i<p.count;i++){const u=(p.getX(i)+.082)/.164,z=-p.getY(i),across=s<0?1-u:u;
   p.setXYZ(i,s*.164*across,.004+.010*Math.sin(across*Math.PI)+.004*across+.002*(.5+z/.212)*across,z)}
  page.computeVertexNormals();put(booklet,s<0?'Diagram-left':'Diagram-right',page,paper,0,0,0);
 }
 // Each loose piece is a group: studs and hubs move with the piece when tidied.
 const slots=[[-.30,.32],[-.18,.36],[-.085,.27],[.020,.357],[.11,.26],[.183,.358],[-.47,.35]];
 for(let i=0;i<slots.length;i++){
  const [x,z]=slots[i],loose=new T.Group();loose.name='Loose-piece-'+i;loose.position.set(x,0,z);loose.rotation.y=i*.74;root.add(loose);
  if(i%3===0){disk(loose,'Loose wheel',.021,.009,0,.005,0,rubber);disk(loose,'Wheel hub',.011,.011,0,.008,0,ivory)}
  else{const m=[blue,mint,ivory,gold][i%4];box(loose,'Plate',.038,.010,.023,0,.005,0,m,.002);
   for(const s of [-1,1])disk(loose,'Stud',.0045,.004,s*.009,.012,0,m)}
 }
 return root;
}
export function printAssemblyGuide(root,image){
 if(!image)return;
 for(const [i,name] of ['Diagram-left','Diagram-right'].entries()){
  const page=root.getObjectByName(name);if(!page)continue;
  const t=new T.Texture(image);t.colorSpace=T.SRGBColorSpace;t.repeat.set(.5,1);t.offset.x=i*.5;t.anisotropy=8;t.needsUpdate=true;
  page.material=new T.MeshStandardMaterial({map:t,roughness:.94,side:T.DoubleSide});page.receiveShadow=true;
 }
}
