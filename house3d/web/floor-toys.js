import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// A portable workshop: all coordinates are local to the set. Only the robot is picked up.
export function createFloorToys(){
 const g=new T.Group();g.name='Floor-workshop';
 const paint=(color,roughness=.65)=>new T.MeshStandardMaterial({color,roughness,side:T.DoubleSide});
 const blue=paint('#597ba1'),navy=paint('#344c65'),cream=paint('#f8e9c9'),ochre=paint('#e4ac61'),mint=paint('#88b1a4'),cloth=paint('#88a1ad',.95),trim=paint('#bacad1',.95);
 function part(parent,name,d,x,y,z,mat,r=.004){const o=new T.Mesh(new RoundedBoxGeometry(...d,1,Math.min(r,...d.map(v=>v*.45))),mat);o.name=name;o.position.set(x,y,z);parent.add(o);return o}
 // Low quilted seat. Nested layers retain the edge seam in a front close-up.
 part(g,'Seat-piping',[.55,.054,.47],.03,.046,-.18,trim,.023);
 part(g,'Seat-cushion',[.545,.060,.46],.03,.059,-.18,cloth,.028);
 const tray=new T.Group();tray.position.set(-.37,0,.13);tray.rotation.y=-.11;g.add(tray);
 part(tray,'Tray-bottom',[.25,.016,.24],0,.008,0,cream);
 for(const s of [-1,1]){
  part(tray,'Tray-side',[.012,.095,.24],s*.12,.052,0,cream);
  part(tray,'Tray-end',[.23,.09,.012],0,.050,s*.115,cream);
 }
 for(let i=0;i<8;i++){const o=part(tray,'Spare-block',[.045,.03,.035],(i%3-1)*.060,.041+Math.floor(i/6)*.032,(Math.floor(i/3)%2-.5)*.096,[blue,mint,ochre,cream][i%4]);o.rotation.y=i*.38}
 const sheet=new T.Group();sheet.position.set(.374,.009,.22);sheet.rotation.y=.16;g.add(sheet);
 part(sheet,'Foldout-cover',[.247,.008,.174],0,-.005,0,blue);
 part(sheet,'Build-card',[.235,.004,.16],0,0,0,cream);
 for(let i=0;i<3;i++){const x=-.076+i*.075;part(sheet,'Printed-body',[.032,.001,.045],x,.0027,.008,blue);part(sheet,'Printed-head',[.023,.001,.017],x,.0028,-.031,navy);if(i>0)for(const s of [-1,1])part(sheet,'Printed-arm',[.012,.001,.027],x+s*.023,.0027,.003,mint)}
 part(sheet,'Foldout-crease',[.002,.001,.153],.038,.0027,0,ochre);
 for(let i=0;i<3;i++){part(sheet,'Step-marker',[.011,.001,.009],-.085+i*.075,.003,.057,ochre);part(sheet,'Caption',[.034,.001,.002],-.06+i*.075,.003,.057,navy)}
 const robot=new T.Group();robot.name='Pick-up-robot';robot.position.set(-.04,.026,.26);g.add(robot);
 part(robot,'Body',[.096,.084,.065],0,.088,0,blue,.012);part(robot,'Chest-panel',[.062,.044,.007],0,.092,.035,cream);
 part(robot,'Head',[.114,.064,.068],0,.164,0,cream,.014);part(robot,'Visor',[.089,.030,.008],0,.165,.034,navy);
 for(const s of [-1,1]){
  part(robot,'Eye',[.014,.010,.005],s*.024,.167,.040,mint);
  part(robot,'Shoulder',[.034,.039,.052],s*.062,.112,0,ochre);
  part(robot,'Glove',[.062,.037,.045],s*.087,.076,.012,blue);
  part(robot,'Boot',[.047,.045,.062],s*.030,.025,.009,navy);
 }
 part(robot,'Dial',[.018,.019,.004],.015,.098,.041,ochre);part(robot,'Grille',[.024,.006,.004],-.016,.09,.041,navy);
 part(robot,'Smile',[.022,.004,.004],0,.156,.040,mint);
 part(robot,'Antenna',[.012,.031,.015],.030,.205,0,ochre);
 for(let i=0;i<3;i++)part(g,'Loose-piece',[.035,.024,.032],-.34+i*.055,.013,.34+(i%2)*.03,[mint,cream,ochre][i]).rotation.y=i*.7;
 return g;
}

// Work on the placed clone only. The tray transform also accounts for its slight rotation.
export function packFloorToys(instance){
 const tray=instance.getObjectByName('Tray-bottom')?.parent;
 if(!tray)return;
 const robot=instance.getObjectByName('Pick-up-robot');
 if(robot){tray.add(robot);robot.position.set(0,.079,-.019);robot.rotation.set(0,0,0);robot.userData.packed=true}
 const pieces=[];instance.traverse(o=>{if(o.name.startsWith('Loose-piece'))pieces.push(o)});
 pieces.forEach((piece,i)=>{tray.add(piece);piece.position.set((i-1)*.060,.068,.078);piece.rotation.set(0,.12*i,0)});
}
