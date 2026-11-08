import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {apartment,doorsOnWall,zoneAt} from '../shared/apartment.mjs';
import {wallSides} from './room-size.js';
import {wallCells} from './room-lighting.js';
import WALLPAPERS from '../wallpapers.json' with {type:'json'};

// Walls and floors follow the same door spans as the path planner. Merge the
// architectural pieces per wall/finish, keeping furniture independently movable.
export function createAnnexRooms(parent,room,objects,assets,oakMap,onChange){
 const plan=apartment(room);if(!plan)return null;
 const group=new T.Group(),surfaces=[],ownedTextures=[],materials=new Map();
 const height=room.height??2.4;
 const mat=(color,map=null)=>{const key=color+(map?.uuid||'');if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,map,roughness:.85}));return materials.get(key)};
 const mesh=(g,geo,m)=>{const o=new T.Mesh(geo,m);o.receiveShadow=true;g.add(o);return o};
 const solid=(g,x,y,z,w,h,d,m)=>mesh(g,new T.BoxGeometry(w,h,d).translate(x,y,z),m);
 for(const zone of plan.zones.slice(1)){
  const root=new T.Group();root.name=zone.label;root.position.set(zone.x,0,zone.z);group.add(root);
  const bath=zone.id==='bath',child=zone.id==='child';
  const floorMap=bath?null:oakMap.clone();if(floorMap){floorMap.repeat.set(zone.width/3,zone.depth/2);floorMap.needsUpdate=true;ownedTextures.push(floorMap)}
  solid(root,0,-.065,0,zone.width,.12,zone.depth,mat(bath?'#d6e1dc':'#f5ead8',floorMap));
  for(const side of wallSides(zone)){
   const g=new T.Group();g.name=zone.id+'-'+side.id;
   // Keep both finishes inside their respective rooms, not coplanar.
   g.position.set(side.x+Math.sin(side.yaw)*.045,0,side.z+Math.cos(side.yaw)*.045);
   g.rotation.y=side.yaw;root.add(g);
   const toLocal=(x,z)=>(x-zone.x)*Math.cos(side.yaw)-(z-zone.z)*Math.sin(side.yaw);
   const holes=doorsOnWall(plan,zone,side.id).map(d=>({x:toLocal(d.axis==='z'?d.center:d.at,d.axis==='x'?d.center:d.at),width:d.width,bottom:0,height:2.10}));
   for(const o of objects){const def=assets[o.asset_id],win=def?.wall_opening;if(win&&zoneAt(plan,o)?.id===zone.id&&side.id===(Math.abs(o.yaw)<.001?'back':'left'))holes.push({x:toLocal(o.x,o.z),width:win.width,bottom:(def.elevation||0)+(win.bottom||0),height:win.height})}
   const batches=new Map();
   function part(m,w,h,d,x,y,z){if(w<=0||h<=0)return;const geom=new T.BoxGeometry(w,h,d).translate(x,y,z);if(!batches.has(m))batches.set(m,[]);batches.get(m).push(geom)}
   const paper=child&&WALLPAPERS[room.child_finish?.wallpapers?.[side.id]],wood=mat(bath?'#aab8ad':'#cfb591');
   let texture=null;if(paper?.texture){texture=new T.TextureLoader().load(paper.texture,onChange);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;ownedTextures.push(texture)}
   const paint=mat(texture?'#ffffff':paper?.color||(bath?'#dee8e2':child?(room.child_finish?.wall_color||'#e3ebf3'):zone.id==='parent'?'#eadbce':'#f2e5d5'),texture);
   const outsideFaces=[];
   for(const c of wallCells(side.width,height,holes)){
    outsideFaces.push(new T.PlaneGeometry(c.width,c.height).rotateY(Math.PI).translate(c.x,c.y,-.048));
    part(paint,c.width,c.height,.054,c.x,c.y,0);
    if(texture){const geom=batches.get(paint).at(-1),p=geom.attributes.position,uv=geom.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i)/paper.tile_m,p.getY(i)/paper.tile_m)}
    if(c.y-c.height/2<.001)part(wood,c.width,.08,.075,c.x,.04,0);
    if(bath)for(let y=.38;y<height;y+=.38)if(Math.abs(y-c.y)<c.height/2)part(wood,c.width,.007,.058,c.x,y,0);
   }
   const facade=mesh(g,mergeGeometries(outsideFaces),mat('#ddd9ce'));facade.name='Exterior-plaster';facade.visible=false;
   outsideFaces.forEach(f=>f.dispose());surfaces.push({g,zone,side,facade});
   for(const h of holes.filter(h=>h.bottom===0)){
    for(const sign of [-1,1])part(wood,.045,h.height,.09,h.x+sign*(h.width/2+.023),h.height/2,0);
    part(wood,h.width+.09,.055,.09,h.x,h.height+.027,0);
   }
   part(wood,side.width,.065,.081,0,height-.0325,0);
   for(const [m,geos] of batches){mesh(g,mergeGeometries(geos),m);geos.forEach(t=>t.dispose())}
  }
 }
 parent.add(group);
 const hidden=(position,zone,side)=>side.sign*(position[side.axis]-zone[side.axis]-(side.axis==='x'?side.x:side.z))>.03;
 return {zone:p=>zoneAt(plan,p),updateView(p,{cutaway=true}={}){for(const {g,zone,side,facade} of surfaces){const outside=hidden(p,zone,side);g.visible=!cutaway||!outside;facade.visible=!cutaway&&outside;g.scale.y=cutaway&&p.y>height+.5&&(zone.id==='hall'||doorsOnWall(plan,zone,side.id).length>0)? .08:1}},fixtureVisible(position,zone,side,options){return options?.cutaway===false||!hidden(position,zone,wallSides(zone).find(s=>s.id===side))},dispose(){group.removeFromParent();group.traverse(o=>o.geometry?.dispose());for(const m of materials.values())m.dispose();ownedTextures.forEach(t=>t.dispose())}};
}
