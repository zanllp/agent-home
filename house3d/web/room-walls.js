import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {roomDimensions,wallSides} from './room-size.js';
import {wallCells} from './room-lighting.js';
import WALLPAPERS from '../wallpapers.json' with {type:'json'};
export const WALL_SIDES=wallSides();
export function exteriorWall(side,position){return (position[side.axis]-(side.axis==='x'?side.x:side.z))*side.sign>.03}
function createRoomWallShell(parent,{loadTexture=url=>new T.TextureLoader().loadAsync(url),room={}}={}){
 const sides=wallSides(room),ceiling=roomDimensions(room).height;
 const classicDetails=[],accents=[],groups=new Map(),wallMeshes=new Map(),shadowMeshes=new Map(),paperLayers=new Map(),applied=new Map(),baseTextures=new Map(),tiles=new Map(),geometries=[];
 const paint=new T.MeshStandardMaterial({color:'#f3eee5',roughness:1}),trim=new T.MeshStandardMaterial({color:'#d9c4a3',roughness:.8}),panel=new T.MeshStandardMaterial({color:'#fff6e8',roughness:1}),accent=new T.MeshStandardMaterial({color:'#b3c0c6',roughness:1});
 const noiseData=new Uint8Array(64*64*4);let seed=31;for(let i=0;i<noiseData.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=120+(seed>>>28);noiseData.set([v,v,v,255],i)}const plaster=new T.DataTexture(noiseData,64,64);plaster.wrapS=plaster.wrapT=T.RepeatWrapping;plaster.repeat.set(5,3);plaster.needsUpdate=true;paint.bumpMap=panel.bumpMap=plaster;paint.bumpScale=panel.bumpScale=.003;
 const shadowMaterial=new T.MeshBasicMaterial({colorWrite:false,depthWrite:false,side:T.DoubleSide});let disposed=false,openings=[],style='classic',geometryKey='';
 function box(group,size,pos,material){const geometry=new RoundedBoxGeometry(...size,2,Math.min(.01,Math.min(...size)/4));geometries.push(geometry);const mesh=new T.Mesh(geometry,material);mesh.position.set(...pos);mesh.receiveShadow=true;group.add(mesh);return mesh}
 for(const side of sides){
  const g=new T.Group();g.name='wall-'+side.id;g.position.set(side.x,0,side.z);g.rotation.y=side.yaw;parent.add(g);groups.set(side.id,g);
  wallMeshes.set(side.id,box(g,[side.width,ceiling,.08],[0,ceiling/2,-.015],paint));
  // Shadow casters remain when a cutaway wall is hidden for the owner's camera.
  const caster=new T.Mesh(wallMeshes.get(side.id).geometry,shadowMaterial);caster.position.set(side.x,ceiling/2,side.z);caster.rotation.y=side.yaw;caster.name='wall-shadow-'+side.id;caster.castShadow=true;parent.add(caster);shadowMeshes.set(side.id,caster);
  const paper=new T.Mesh(new T.PlaneGeometry(side.width,1.56),new T.MeshStandardMaterial({roughness:1}));paper.name='wallpaper';paper.position.set(0,1.52,.028);paper.visible=false;paper.receiveShadow=true;g.add(paper);paperLayers.set(side.id,paper);
  box(g,[side.width,.11,.08],[0,.055,.055],trim);classicDetails.push(box(g,[side.width,.045,.07],[0,.72,.052],trim));box(g,[side.width,.065,.12],[0,ceiling-.05,.035],trim);box(g,[side.width,.025,.08],[0,ceiling-.11,.05],panel);
  const n=Math.round(side.width/.75),step=side.width/n;
  for(let i=0;i<n;i++){const x=-side.width/2+(i+.5)*step;classicDetails.push(box(g,[step-.035,.54,.035],[x,.40,.04],panel));for(const dx of [-step/2+.025,step/2-.025])classicDetails.push(box(g,[.018,.54,.025],[x+dx,.40,.065],trim))}
  if(side.id==='back'||side.id==='left'){
   const a=new T.Group();a.userData.side=side.id;g.add(a);const x=side.id==='back'?-.23:-1.55,w=side.id==='back'?1.68:1.5;
   box(a,[w,ceiling-.23,.015],[x,(ceiling-.23)/2+.095,.035],accent);for(const dx of [-w/2,w/2])box(a,[.014,ceiling-.23,.012],[x+dx,(ceiling-.23)/2+.095,.05],panel);accents.push(a);
  }
 }
 function rebuild(){
  const key=JSON.stringify([style,openings,ceiling]);if(key===geometryKey)return;geometryKey=key;
  for(const side of sides){
   const holes=openings.filter(h=>h.side===side.id),mesh=wallMeshes.get(side.id),caster=shadowMeshes.get(side.id);
   const boxes=wallCells(side.width,ceiling,holes).map(c=>new T.BoxGeometry(c.width,c.height,.08).translate(c.x,c.y-ceiling/2,0));const geometry=mergeGeometries(boxes);boxes.forEach(g=>g.dispose());mesh.geometry.dispose();mesh.geometry=caster.geometry=geometry;
   const height=style==='urban'?ceiling-.16:ceiling-.84,bottom=style==='urban'?.09:.74,paper=paperLayers.get(side.id);
   const planes=wallCells(side.width,height,holes.map(h=>({...h,bottom:h.bottom-bottom}))).map(c=>new T.PlaneGeometry(c.width,c.height).translate(c.x,c.y-height/2,0));const pg=mergeGeometries(planes);planes.forEach(g=>g.dispose());
   const position=pg.getAttribute('position'),uv=pg.getAttribute('uv');for(let i=0;i<position.count;i++)uv.setXY(i,(position.getX(i)+side.width/2)/side.width,(position.getY(i)+height/2)/height);
   paper.geometry.dispose();paper.geometry=pg;paper.position.y=bottom+height/2;
  }
 }
 function setOpenings(objects,assets){
  openings=objects.flatMap(o=>{
   const asset=assets[o.asset_id],hole=asset?.wall_opening;if(!hole)return [];
   const side=Math.abs(o.yaw)<.001?'back':'left';return [{side,x:side==='back'?o.x:-o.z,width:hole.width,height:hole.height,bottom:(asset.elevation||0)+(hole.bottom||0)}];
  });rebuild();
 }
 async function setPaper(side,id){
  const height=style==='urban'?ceiling-.16:ceiling-.84,key=id+':'+style;if(applied.get(side.id)===key)return;
  const definition=WALLPAPERS[id];if(!definition)throw Error('墙纸不在目录中，请重新选择');const layer=paperLayers.get(side.id);
  if(!definition.texture){layer.visible=false;layer.material.map=null;layer.material.needsUpdate=true;applied.set(side.id,key);return}
  if(!baseTextures.has(id))baseTextures.set(id,loadTexture(definition.texture).then(texture=>{texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=4;if(disposed)texture.dispose();return texture}));
  const source=await baseTextures.get(id);if(disposed)return;const tileKey=key+':'+side.width;
  if(!tiles.has(tileKey)){const texture=source.clone();texture.repeat.set(side.width/definition.tile_m,height/definition.tile_m);texture.needsUpdate=true;tiles.set(tileKey,texture)}
  layer.material.map=tiles.get(tileKey);layer.material.needsUpdate=true;layer.visible=true;applied.set(side.id,key);
 }
 return {setOpenings,async setFinish(value={}){
  style=value.style==='urban'?'urban':'classic';for(const detail of classicDetails)detail.visible=style!=='urban';for(const a of accents)a.visible=style==='urban'&&(!value.wallpapers?.[a.userData.side]||value.wallpapers[a.userData.side]==='plain');
  paint.color.set(value.wall_color||'#f3eee5');trim.color.set(value.trim_color||'#d9c4a3');rebuild();await Promise.all(sides.map(side=>setPaper(side,value.wallpapers?.[side.id]||'plain')));
 },updateView(position){const hidden=new Set();for(const side of sides){const outside=exteriorWall(side,position);groups.get(side.id).visible=!outside;if(outside)hidden.add(side.id)}return hidden},dispose(){
  disposed=true;plaster.dispose();geometries.forEach(g=>g.dispose());wallMeshes.forEach(m=>m.geometry.dispose());paperLayers.forEach(m=>{m.geometry.dispose();m.material.dispose()});[paint,trim,panel,accent,shadowMaterial].forEach(m=>m.dispose());tiles.forEach(t=>t.dispose());baseTextures.forEach(p=>p.then(t=>t.dispose(),()=>{}));
 }};
}

export function createRoomWalls(parent,options={}){
 let container=new T.Group();parent.add(container);let size=roomDimensions(options.room),shell=createRoomWallShell(container,options),finish={};
 return {async setSize(room={}){const next=roomDimensions(room);if(JSON.stringify(size)===JSON.stringify(next))return;shell.dispose();parent.remove(container);container=new T.Group();parent.add(container);size=next;shell=createRoomWallShell(container,{...options,room});await shell.setFinish(finish)},setOpenings:(objects,assets)=>shell.setOpenings(objects,assets),async setFinish(value={}){finish=value;await shell.setFinish(value)},updateView:position=>shell.updateView(position),dispose(){shell.dispose();parent.remove(container)}};
}
