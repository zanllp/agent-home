import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {roomDimensions,wallSides} from './room-size.js';
import {wallCells} from './room-lighting.js';
import {createWallContact,wallContacts} from './wall-contact.js';
import {entryPlateTemplate,latchPlates} from './entry-finish.js';
import WALLPAPERS from '../wallpapers.json' with {type:'json'};
export const WALL_SIDES=wallSides();
export function exteriorWall(side,position){return (position[side.axis]-(side.axis==='x'?side.x:side.z))*side.sign>.03}
function createRoomWallShell(parent,{loadTexture=url=>new T.TextureLoader().loadAsync(url),room={}}={}){
 const sides=wallSides(room),ceiling=roomDimensions(room).height;
 const joinMeshes=new Map(),joinPaint=new T.MeshStandardMaterial({color:'#d1c6b6',roughness:.94});
 const classicDetails=[],accents=[],groups=new Map(),wallMeshes=new Map(),shadowMeshes=new Map(),paperLayers=new Map(),applied=new Map(),baseTextures=new Map(),tiles=new Map(),geometries=[];
 const paint=new T.MeshStandardMaterial({color:'#f3eee5',roughness:1}),trim=new T.MeshStandardMaterial({color:'#d9c4a3',roughness:.8}),panel=new T.MeshStandardMaterial({color:'#fff6e8',roughness:1}),accent=new T.MeshStandardMaterial({color:'#b3c0c6',roughness:1});
 const noiseData=new Uint8Array(64*64*4);let seed=31;for(let i=0;i<noiseData.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=120+(seed>>>28);noiseData.set([v,v,v,255],i)}const plaster=new T.DataTexture(noiseData,64,64);plaster.wrapS=plaster.wrapT=T.RepeatWrapping;plaster.repeat.set(5,3);plaster.needsUpdate=true;paint.bumpMap=panel.bumpMap=plaster;paint.bumpScale=panel.bumpScale=.003;
 const socket=new T.MeshStandardMaterial({color:'#e8e7de',roughness:.55}),socketInset=new T.MeshStandardMaterial({color:'#777f79',roughness:.8});
 const shadowMaterial=new T.MeshBasicMaterial({colorWrite:false,depthWrite:false,side:T.DoubleSide});let disposed=false,openings=[],style='classic',geometryKey='';
 function box(group,size,pos,material){const geometry=new RoundedBoxGeometry(...size,2,Math.min(.01,Math.min(...size)/4));geometries.push(geometry);const mesh=new T.Mesh(geometry,material);mesh.position.set(...pos);mesh.receiveShadow=true;group.add(mesh);return mesh}
 // The owner looks through the ceiling; sunlight must not.
 const lid=new T.Mesh(new T.PlaneGeometry(roomDimensions(room).width,roomDimensions(room).depth),shadowMaterial);
 lid.name='ceiling-shadow';lid.rotation.x=-Math.PI/2;lid.position.y=ceiling;lid.castShadow=true;lid.visible=false;parent.add(lid);
 const indoorCeiling=new T.Group();indoorCeiling.name='Indoor-ceiling';indoorCeiling.visible=false;parent.add(indoorCeiling);
 const plasterCeiling=new T.MeshStandardMaterial({color:'#f2eee4',roughness:1,emissive:'#29261f'});
 const ceilingFace=new T.Mesh(new T.PlaneGeometry(roomDimensions(room).width,roomDimensions(room).depth),plasterCeiling);
 ceilingFace.rotation.x=Math.PI/2;ceilingFace.position.y=ceiling-.002;ceilingFace.receiveShadow=true;indoorCeiling.add(ceilingFace);
 const fitting=new T.Mesh(new T.CylinderGeometry(.21,.20,.035,40),trim),diffuserMaterial=new T.MeshStandardMaterial({color:'#fff8e4',roughness:.8,emissive:'#645d49'});
 const diffuser=new T.Mesh(new T.CylinderGeometry(.19,.185,.016,40),diffuserMaterial);fitting.position.y=ceiling-.023;diffuser.position.y=ceiling-.047;indoorCeiling.add(fitting,diffuser);
 for(const side of sides){
  const g=new T.Group();g.name='wall-'+side.id;g.position.set(side.x,0,side.z);g.rotation.y=side.yaw;parent.add(g);groups.set(side.id,g);
  wallMeshes.set(side.id,box(g,[side.width,ceiling,.08],[0,ceiling/2,-.015],paint));
  const joins=new T.Mesh(new T.BufferGeometry(),joinPaint);joins.name='Plaster-panel-joints';joins.receiveShadow=true;g.add(joins);joinMeshes.set(side.id,joins);
  // Shadow casters remain when a cutaway wall is hidden for the owner's camera.
  const caster=new T.Mesh(wallMeshes.get(side.id).geometry,shadowMaterial);caster.position.set(side.x,ceiling/2,side.z);caster.rotation.y=side.yaw;caster.name='wall-shadow-'+side.id;caster.castShadow=true;parent.add(caster);shadowMeshes.set(side.id,caster);
  const paper=new T.Mesh(new T.PlaneGeometry(side.width,1.56),new T.MeshStandardMaterial({roughness:1}));paper.name='wallpaper';paper.position.set(0,1.52,.028);paper.visible=false;paper.receiveShadow=true;g.add(paper);paperLayers.set(side.id,paper);
  box(g,[side.width,.11,.08],[0,.055,.055],trim);classicDetails.push(box(g,[side.width,.045,.07],[0,.72,.052],trim));box(g,[side.width,.065,.12],[0,ceiling-.05,.035],trim);box(g,[side.width,.025,.08],[0,ceiling-.11,.05],panel);
  const n=Math.round(side.width/.75),step=side.width/n;
  for(let i=0;i<n;i++){const x=-side.width/2+(i+.5)*step;classicDetails.push(box(g,[step-.035,.54,.035],[x,.40,.04],panel));for(const dx of [-step/2+.025,step/2-.025])classicDetails.push(box(g,[.018,.54,.025],[x+dx,.40,.065],trim))}
  if(side.id==='back'||side.id==='left'){
   const a=new T.Group();a.userData.side=side.id;g.add(a);const x=side.id==='back'?-side.width*.157:-1.55,w=side.id==='back'?Math.min(2.16,side.width*.28):1.5;
   box(a,[w,ceiling-.23,.015],[x,(ceiling-.23)/2+.095,.035],accent);for(const dx of [-w/2,w/2])box(a,[.014,ceiling-.23,.012],[x+dx,(ceiling-.23)/2+.095,.05],panel);
   if(side.id==='left'){for(let i=0;i<16;i++){const u=x-w/2+.055+i*(w-.11)/15;box(a,[.016,ceiling-.28,.018],[u,(ceiling-.28)/2+.12,.056],trim)}}
   else{for(const y of [.12,ceiling-.15])box(a,[w-.08,.009,.012],[x,y,.052],panel)}
   a.userData.center=x;a.userData.width=w;accents.push(a);
  }
  if(side.id==='back'||side.id==='left'){for(const ratio of [-.22,.22]){const x=side.width*ratio;box(g,[.105,.077,.015],[x,.29,.062],socket);for(const dx of [-.023,.023]){box(g,[.009,.018,.002],[x+dx,.286,.071],socketInset);box(g,[.006,.008,.002],[x+dx,.312,.071],socketInset)}}}
 }
 function rebuild(){
  const key=JSON.stringify([style,openings,ceiling]);if(key===geometryKey)return;geometryKey=key;
  for(const side of sides){
   const holes=openings.filter(h=>h.side===side.id),mesh=wallMeshes.get(side.id),caster=shadowMeshes.get(side.id);
   const boxes=wallCells(side.width,ceiling,holes).map(c=>new T.BoxGeometry(c.width,c.height,.08).translate(c.x,c.y-ceiling/2,0));const geometry=mergeGeometries(boxes);boxes.forEach(g=>g.dispose());mesh.geometry.dispose();mesh.geometry=caster.geometry=geometry;
   const joins=joinMeshes.get(side.id);joins.geometry.dispose();const strips=[];
   if(style==='urban'){
    const bottom=.12,top=ceiling-.15,upper=ceiling-.78;
    // Split the finish at real apertures. No seams behind glass or across the balcony.
    for(const c of wallCells(side.width,ceiling,holes)){
     const l=c.x-c.width/2,r=c.x+c.width/2,b=Math.max(bottom,c.y-c.height/2),t=Math.min(top,c.y+c.height/2);
     if(t<=b)continue;
     for(let x=-side.width/2+1.08;x<side.width/2-.15;x+=1.08)if(x>=l&&x<r)strips.push(new T.BoxGeometry(.005,t-b,.002).translate(x,(b+t)/2,.029));
     if(upper>b&&upper<=t)strips.push(new T.BoxGeometry(r-l,.004,.002).translate((l+r)/2,upper,.029));
    }
   }
   joins.geometry=strips.length?mergeGeometries(strips):new T.BufferGeometry();strips.forEach(g=>g.dispose());
   const height=style==='urban'?ceiling-.16:ceiling-.84,bottom=style==='urban'?.09:.74,paper=paperLayers.get(side.id);
   const planes=wallCells(side.width,height,holes.map(h=>({...h,bottom:h.bottom-bottom}))).map(c=>new T.PlaneGeometry(c.width,c.height).translate(c.x,c.y-height/2,0));const pg=mergeGeometries(planes);planes.forEach(g=>g.dispose());
   const position=pg.getAttribute('position'),uv=pg.getAttribute('uv');for(let i=0;i<position.count;i++)uv.setXY(i,(position.getX(i)+side.width/2)/side.width,(position.getY(i)+height/2)/height);
   paper.geometry.dispose();paper.geometry=pg;paper.position.y=bottom+height/2;
  }
 }
 function updateAccents(){for(const a of accents){const blocked=openings.some(h=>h.side===a.userData.side&&Math.abs(h.x-a.userData.center)<(h.width+a.userData.width)/2);a.visible=style==='urban'&&!blocked&&(!finish.wallpapers?.[a.userData.side]||finish.wallpapers[a.userData.side]==='plain')}}
 let finish={};
 let contactKey='',contacts=[];
 function clearContacts(){for(const m of contacts){m.removeFromParent();m.geometry.dispose();m.material.map.dispose();m.material.dispose()}contacts=[]}
 function updateContacts(objects,assets){
  const imprints=wallContacts(objects,assets),key=JSON.stringify([openings,imprints]);if(key===contactKey)return;
  clearContacts();contactKey=key;
  for(const shadow of imprints){
   const side=sides.find(s=>s.id===shadow.side),m=createWallContact(side,ceiling,openings.filter(h=>h.side===side.id),shadow);
   if(m){groups.get(side.id).add(m);contacts.push(m)}
  }
 }
 const plateSource=entryPlateTemplate();
 let plates=[],plateKey='';
 function setPlates(objects,assets){
  const placements=latchPlates(objects,assets,sides).map(p=>{
   const raised=accents.some(a=>a.visible&&a.userData.side===p.wall&&Math.abs(p.x-a.userData.center)<a.userData.width/2+.043);
   return {...p,z:raised?.067:.031};
  }),key=JSON.stringify(placements);if(plateKey===key)return;
  plateKey=key;plates.forEach(p=>p.removeFromParent());plates=placements.map(({wall,x,y,z})=>{
   const p=plateSource.clone();
   p.position.set(x,y,z);groups.get(wall).add(p);return p;
  });
 }
 let mounted=[];
 function setOpenings(objects,assets){
  openings=objects.flatMap(o=>{
   const asset=assets[o.asset_id],hole=asset?.wall_opening;if(!hole)return [];
   const side=Math.abs(o.yaw)<.001?'back':'left';return [{side,x:side==='back'?o.x:-o.z,width:hole.width,height:o.id===room.balcony?.door_id?2.22:hole.height,bottom:o.id===room.balcony?.door_id?0:(asset.elevation||0)+(hole.bottom||0)}];
  });lid.visible=openings.length>0;rebuild();updateAccents();updateContacts(objects,assets);mounted=[objects,assets];setPlates(objects,assets);
 }
 async function setPaper(side,id){
  const height=style==='urban'?ceiling-.16:ceiling-.84,key=id+':'+style;if(applied.get(side.id)===key)return;
  const definition=WALLPAPERS[id];if(!definition)throw Error('墙纸不在目录中，请重新选择');const layer=paperLayers.get(side.id);
  layer.material.color.set(definition.color||0xffffff);layer.material.bumpMap=definition.color?plaster:null;layer.material.bumpScale=.002;
  if(!definition.texture){layer.visible=!!definition.color;layer.material.map=null;layer.material.needsUpdate=true;applied.set(side.id,key);return}
  if(!baseTextures.has(id))baseTextures.set(id,loadTexture(definition.texture).then(texture=>{texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=4;if(disposed)texture.dispose();return texture}));
  const source=await baseTextures.get(id);if(disposed)return;const tileKey=key+':'+side.width;
  if(!tiles.has(tileKey)){const texture=source.clone();texture.repeat.set(side.width/definition.tile_m,height/definition.tile_m);texture.needsUpdate=true;tiles.set(tileKey,texture)}
  layer.material.map=tiles.get(tileKey);layer.material.needsUpdate=true;layer.visible=true;applied.set(side.id,key);
 }
 return {setOpenings,async setFinish(value={}){
  finish=value;style=value.style==='urban'?'urban':'classic';for(const detail of classicDetails)detail.visible=style!=='urban';updateAccents();
  for(const [id,m] of joinMeshes)m.visible=style==='urban'&&(!value.wallpapers?.[id]||value.wallpapers[id]==='plain');
  paint.color.set(value.wall_color||'#f3eee5');trim.color.set(value.trim_color||'#d9c4a3');rebuild();await Promise.all(sides.map(side=>setPaper(side,value.wallpapers?.[side.id]||'plain')));
 },updateView(position,{cutaway=true}={}){const dim=roomDimensions(room);indoorCeiling.visible=position.y<ceiling && Math.abs(position.x)<dim.width/2 && Math.abs(position.z)<dim.depth/2;const hidden=new Set();for(const side of sides){const outside=cutaway&&exteriorWall(side,position);groups.get(side.id).visible=!outside;if(outside)hidden.add(side.id)}return hidden},dispose(){
  disposed=true;plateSource.traverse(m=>{if(m.isMesh){m.geometry.dispose();m.material.dispose()}});clearContacts();ceilingFace.geometry.dispose();fitting.geometry.dispose();diffuser.geometry.dispose();diffuserMaterial.dispose();plasterCeiling.dispose();lid.geometry.dispose();plaster.dispose();joinPaint.dispose();joinMeshes.forEach(m=>m.geometry.dispose());geometries.forEach(g=>g.dispose());wallMeshes.forEach(m=>m.geometry.dispose());paperLayers.forEach(m=>{m.geometry.dispose();m.material.dispose()});[paint,trim,panel,accent,socket,socketInset,shadowMaterial].forEach(m=>m.dispose());tiles.forEach(t=>t.dispose());baseTextures.forEach(p=>p.then(t=>t.dispose(),()=>{}));
 }};
}

export function createRoomWalls(parent,options={}){
 let container=new T.Group();parent.add(container);let size=roomDimensions(options.room),shell=createRoomWallShell(container,options),finish={};
 return {async setSize(room={}){const next=roomDimensions(room);if(JSON.stringify(size)===JSON.stringify(next))return;shell.dispose();parent.remove(container);container=new T.Group();parent.add(container);size=next;shell=createRoomWallShell(container,{...options,room});await shell.setFinish(finish)},setOpenings:(objects,assets)=>shell.setOpenings(objects,assets),async setFinish(value={}){finish=value;await shell.setFinish(value)},updateView:(position,options)=>shell.updateView(position,options),dispose(){shell.dispose();parent.remove(container)}};
}
