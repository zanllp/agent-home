import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Preserve the installed unit and its registered bounds; only remodel its front-service hardware.
export function finishWallAC(root){
 const shell=root.getObjectByName('Air_conditioner_shell');if(!shell)return;
 shell.scale.z*=.84;shell.position.y-=.0012;shell.scale.y*=.993;
 const satin=new T.MeshStandardMaterial({color:'#f1eee4',roughness:.42});
 const shadow=new T.MeshStandardMaterial({color:'#626a69',roughness:.85}),edge=new T.MeshStandardMaterial({color:'#bdbfb5',roughness:.52});
 const part=(name,size,pos,mat,radius)=>{
  const o=new T.Mesh(new RoundedBoxGeometry(...size,3,radius),mat);o.name=name;o.position.set(...pos);o.castShadow=o.receiveShadow=true;root.add(o);return o;
 };
 const fascia=part('Lift-up enamel cover',[.774,.168,.059],[0,.144,.064],satin,.019);
 fascia.rotation.x=-.034;
 const outlet=root.getObjectByName('Outlet_slot');if(outlet){outlet.scale.y=1.32;outlet.material=shadow}
 root.traverse(o=>{if(o.name.startsWith('Vent_blade'))o.visible=false});
 const vanes=[];
 for(let i=0;i<13;i++){const g=new T.BoxGeometry(.003,.027,.012);g.rotateY(-.32);g.translate((i-6)*.046,.036,.094);vanes.push(g)}
 const fins=new T.Mesh(mergeGeometries(vanes),edge);vanes.forEach(g=>g.dispose());fins.name='Outlet guide vanes';root.add(fins);
 const vane=part('Tilted air deflector',[.651,.009,.033],[0,.029,.087],satin,.004);vane.rotation.x=.20;
 part('IR receiver lens',[.024,.011,.004],[.296,.112,.093],new T.MeshStandardMaterial({color:'#767e79',roughness:.24}),.002);
 const led=root.getObjectByName('Indicator');if(led){led.position.set(.317,.112,.094);led.scale.x=.20}
 // Narrow recessed return slots on top read from the normal overhead camera.
 const slots=[];for(let i=0;i<5;i++){const geo=new T.BoxGeometry(.54,.0015,.006);geo.translate(-.022,.244,(i-2)*.015-.023);slots.push(geo)}
 const grille=new T.Mesh(mergeGeometries(slots),edge);slots.forEach(g=>g.dispose());grille.name='Top return grille';root.add(grille);
}
