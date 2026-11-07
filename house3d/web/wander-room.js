import {createOakFloor} from './oak-floor.js';
import {createArmThrow} from './arm-throw.js';
import {playRugTexture} from './rug-finish.js';
import {finishRugKit} from './scout-model.js';
import {printAssemblyGuide} from './workshop-kit.js';
import {widenLoungeGeometry,finishLoungeCloth} from './lounge-sofa.js';
import {fitLaundryShelf} from './laundry-shelf.js';
import {finishClockFace} from './clock-face.js';
import {finishEntryDoor,finishEntryLanding} from './entry-finish.js';
import {finishWallAC} from './wall-ac.js';
import {finishWorkstation} from './workstation-finish.js';
import {finishLinenRail} from './drying-rack.js';
import {finishMapleSeating,finishCabinetWood,finishBookSpines,finishStorageBin,finishMediaGrille} from './library-finish.js';
import {packFloorToys} from './floor-toys.js';
import {finishMapleTable} from './maple-finish.js';
import {createContactShadows} from './contact-shadows.js';
import {LIGHTING} from './wander-state.js';
import {lightStudyDesk} from './task-light.js';
import {createStudyLamp,createStudyProp} from './desk-models.js';
import {applyDeskFinishes,showCrayonDrawing,exhibitedBook,showPinnedDrawing,finishDiningLinen,finishBookStack,finishSofaThrow,finishLinenPillow} from './desk-finishes.js';
import {createBalcony,disposeBalcony} from './balcony.js';
import * as T from 'three';
import {groundHeightAt} from './wander-navigation.js';
import {floorBouncePose} from './room-lighting.js';
import {roomDimensions} from './room-size.js';
import {createRoomWalls} from './room-walls.js';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {useFurnitureLighting} from './furniture-material.js';
import {batchStaticProp} from './static-prop-batch.js';
import {enhanceScreens} from './screen-detail.js';
import {createScreenVisibility} from './screen-visibility.js';
import {createWindowDetail,disposeWindowDetail} from './window-detail.js';
export function baseHeight(item,objects,assets,seen=new Set()){if(seen.has(item.id))return 0;seen.add(item.id);if(!item.on)return assets[item.asset_id]?.elevation||0;const parent=objects.find(o=>o.id===item.on.id),surface=assets[parent?.asset_id]?.surfaces?.[item.on.surface];return parent&&surface?baseHeight(parent,objects,assets,seen)+surface.height+(assets[item.asset_id]?.support_offset||0):0}
export function createPreviewRoom(scene,{renderer,batchStatic=true,onChange=()=>{}}={}){
 const contacts=renderer?createContactShadows(renderer,scene):null;let lightPreset='day';
 RectAreaLightUniformsLib.init();const windowFill=new T.RectAreaLight('#edf4ff',1.2,2.4,2.1);windowFill.visible=false;const bounce=new T.RectAreaLight('#ffdbac',.65,2,2);bounce.visible=false;scene.add(windowFill,bounce);
 const cache=new Map(),loader=new GLTFLoader();const screenPlayers=new Set(),visibleScreens=createScreenVisibility();let screenMeshes=[];let balconyRoot=null,roomSpec={};
 const printImages=new Map();let clocks=[],clockMinute=-1;
 const loadPrint=url=>{if(!printImages.has(url))printImages.set(url,new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>{printImages.delete(url);reject(Error('无法读取绘本印刷图'))};image.src=url}));return printImages.get(url)};

 const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=64;const gc=glowCanvas.getContext('2d'),gradient=gc.createRadialGradient(32,32,1,32,32,32);gradient.addColorStop(0,'rgba(255,226,155,.6)');gradient.addColorStop(1,'rgba(255,226,155,0)');gc.fillStyle=gradient;gc.fillRect(0,0,64,64);const glowTexture=new T.CanvasTexture(glowCanvas);glowTexture.colorSpace=T.SRGBColorSpace;
 function disposeModel(root){
  const textures=new Set(),materials=new Set(),geometry=new Set();
  root.traverse(o=>{if(o.geometry)geometry.add(o.geometry);for(const m of [].concat(o.material||[])){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value)}});
  textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometry.forEach(g=>g.dispose());
 }

 const modelKey=a=>a.model+'|'+(a.painted!==false)+'|'+(a.spine_series||a.bin_label||'')+'|'+(a.lounge_extension||0)+'|'+(a.task_light?'task':'')+'|'+(a.laundry_shelf?'shelf':'')+'|'+(a.arm_throw?'drape':'');
 async function assetModel(asset){
  const key=modelKey(asset);
  if(!cache.has(key))cache.set(key,(async()=>{const native=asset.arm_throw?createArmThrow():asset.task_light?createStudyLamp(true):createStudyProp(asset.model),root=native||(await loader.loadAsync(asset.model)).scene;if(asset.lounge_extension){
   // The catalog variant has its own parsed model and retains the original albedo/UVs.
   const part=root.getObjectByName('family-sofa-stylized-v2'),original=part.geometry;
   part.geometry=widenLoungeGeometry(original,asset.lounge_extension);original.dispose();
  }if(!native&&!asset.native_materials)useFurnitureLighting(root,asset);else if(asset.native_materials)root.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true});if(asset.laundry_shelf)fitLaundryShelf(root,asset.surfaces.top);if(asset.model.endsWith('/family-beech-clock-v1.glb'))finishClockFace(root);if(asset.model.endsWith('/urban-wall-ac-v1.glb'))finishWallAC(root);if(asset.model.endsWith('/urban-dual-monitor-detailed-v1.glb'))finishWorkstation(root);if(asset.lounge_extension)finishLoungeCloth(root);else if(asset.model.endsWith('/family-whale-plush-v1.glb'))finishLoungeCloth(root,true);if(/family-(maple-library|maple-media-unit|entry-door|shoe-cabinet)-v1\.glb$/.test(asset.model))finishCabinetWood(root);if(asset.model.endsWith('/family-entry-door-v1.glb'))finishEntryDoor(root);if(asset.model.endsWith('/family-entry-landing-v1.glb'))finishEntryLanding(root);if(asset.model.endsWith('/family-maple-dining-chair-v1.glb'))finishMapleSeating(root);if(asset.model.endsWith('/family-linen-rail-v1.glb'))finishLinenRail(root);if(asset.model.endsWith('/family-maple-media-unit-v1.glb'))finishMediaGrille(root);if(asset.spine_series)finishBookSpines(root,asset.spine_series);if(asset.bin_label)finishStorageBin(root,asset.bin_label);if(asset.kind==='dining_table'||asset.model.endsWith('/family-low-table-v1.glb'))finishMapleTable(root,asset.kind==='coffee_table'?'#f5e7d6':0xffffff);if(asset.rug_fabric){const face=root.getObjectByName('Rug_weave_face'),t=playRugTexture(await loadPrint(asset.rug_fabric),asset.size);face.material.map=t;face.material.needsUpdate=true}if(asset.model.endsWith('/family-flax-mat-v1.glb'))finishDiningLinen(root);if(asset.model.endsWith('/family-denim-pillow-v1.glb'))finishLinenPillow(root);if(asset.model.endsWith('/family-fringed-throw-v1.glb'))finishSofaThrow(root);if(asset.model.endsWith('/urban-books-v1.glb'))finishBookStack(root);if(asset.assembly_guide){finishRugKit(root);printAssemblyGuide(root,await loadPrint(asset.assembly_guide))}applyDeskFinishes(root,{pictureBookImage:asset.print_texture?await loadPrint(asset.print_texture):undefined});if(['tv','desktop'].includes(asset.kind))enhanceScreens(root,{players:screenPlayers,televisionImage:asset.kind==='tv'?await loadPrint('/models/materials/courtyard-film-still-v1.png').catch(()=>null):null});if(batchStatic&&/\/(?:family-(?:flax-mat|maple-library|linen-rail|study-chair|enamel-washer|fringed-throw|shoe-cabinet|game-corner|weekend-tea)|urban-(?:study-organizer|desk-plant|storybooks))-v1\.glb$/.test(asset.model))batchStaticProp(root);return root})());
  try{return await cache.get(key)}catch(e){cache.delete(key);throw e}
 }

 const furniture=new T.Group(),walls=new T.Group(),fixtures=new T.Group(),legacyWindow=new T.Group();scene.add(furniture,walls);walls.add(fixtures,legacyWindow);const enclosure=createRoomWalls(walls);
 function material(color){return new T.MeshStandardMaterial({color,roughness:.85})}
 function box(parent,size,pos,color,round=.025){const obj=new T.Mesh(new RoundedBoxGeometry(...size,2,round),material(color));obj.position.set(...pos);obj.castShadow=true;obj.receiveShadow=true;parent.add(obj);return obj}
 function cylinder(parent,r,h,pos,color){const o=new T.Mesh(new T.CylinderGeometry(r,r,h,24),material(color));o.position.set(...pos);o.castShadow=true;parent.add(o);return o}
 function buildItem(item,parent,model,asset,baseY=asset?.elevation||0,stencilRef=1,drawingImage,exhibit){const g=new T.Group(),c=item.color;g.userData.id=item.id;g.userData.rugPlay=!!asset?.assembly_guide;g.userData.isRug=item.kind==='rug';if(asset?.placement==='wall')g.userData.wall=Math.abs(item.yaw)<.001?'back':'left';g.position.set(item.x,baseY,item.z);g.rotation.y=item.yaw;
 if(item.id===roomSpec.balcony?.door_id)g.position.y=0;
 if(model){const instance=model.clone(true);
 if(item.asset_id==='home-rice-cooker-v1'||item.asset_id==='home-rice-bowl-v1'){
  const grains=instance.getObjectByName('Steamed-rice');
  if(grains){if(item.asset_id==='home-rice-bowl-v1')grains.visible=item.properties?.filled===true;
   else{const servings=item.properties?.servings??4;grains.visible=servings>0;grains.position.y-=(4-servings)*.012;grains.scale.x=grains.scale.z=.84+.04*servings}}
 }
 if(item.kind==='toy_set'&&item.properties?.packed)packFloorToys(instance);if(drawingImage)g.userData.disposeArtwork=showCrayonDrawing(instance,drawingImage,item.artwork.title);if(item.asset_id==='family-studio-board-v1'&&exhibit)g.userData.disposeArtwork=showPinnedDrawing(instance,exhibit.image,exhibit.title);if(item.kind==='toy_set')instance.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true});g.add(instance);if(asset.wall_opening){const detail=createWindowDetail(instance,{openingWidth:asset.wall_opening.width,walkable:item.id===roomSpec.balcony?.door_id,open:item.properties?.open!==false});g.add(detail)}if(asset.task_light){g.userData.disposeShade=lightStudyDesk(instance,item.properties)}else if(item.kind==='lamp'){
  const properties={on:true,brightness:.7,...item.properties};const glow=new T.Sprite(new T.SpriteMaterial({map:glowTexture,color:'#fff1cf',transparent:true,depthWrite:false,toneMapped:false,opacity:properties.on?properties.brightness*.45:0}));const shade=instance.getObjectByName('Linen_shade');if(shade){glow.material.opacity*=.35;shade.material=shade.material.clone();shade.material.emissive.set('#ffc17b');shade.material.emissiveIntensity=properties.on?properties.brightness*.6:0;g.userData.disposeShade=()=>shade.material.dispose()}glow.position.y=asset.height*(shade ? .68 : .87);const halo=shade?asset.height*1.35:.72;glow.scale.set(halo,halo,1);g.add(glow);const light=new T.PointLight('#ffdb95',properties.on?properties.brightness*(shade ? .75 : 1.2):0,2);light.position.y=asset.height*.83;g.add(light);
 }parent.add(g);return g}g.userData.procedural=true;
 const legs=(w,d,h)=>{for(const x of [-w/2+.06,w/2-.06])for(const z of [-d/2+.06,d/2-.06])box(g,[.055,h,.055],[x,h/2,z],'#986e4c')};
 if(item.kind==='desk'){legs(1.25,.65,.67);box(g,[1.25,.07,.65],[0,.70,0],c);box(g,[.35,.12,.45],[.38,.6,0],'#ddba91');box(g,[.25,.035,.18],[-.2,.755,0],'#f7edcf');box(g,[.1,.11,.1],[.38,.79,-.16],'#ebdcd1')}
 if(item.kind==='chair'){legs(.55,.55,.35);box(g,[.55,.07,.55],[0,.38,0],c);box(g,[.55,.36,.06],[0,.64,-.24],c)}
 if(item.kind==='shelf'){box(g,[.9,1.65,.06],[0,.825,-.14],c);for(const x of [-.43,.43])box(g,[.05,1.65,.35],[x,.825,0],c);for(const h of [.06,.55,1.08,1.62])box(g,[.9,.05,.35],[0,h,0],c);for(let n=0;n<12;n++){const x=-.33+(n%4)*.19,y=.07+Math.floor(n/4)*.52;box(g,[.10,.28+(n%3)*.04,.19],[x,y+.17,0],['#a5babb','#d2ad97','#e7d7b5'][n%3])}}
 if(item.kind==='bed'){legs(1.2,1.9,.28);box(g,[1.23,.60,.08],[0,.43,-.9],'#c59e79');box(g,[1.18,.18,1.85],[0,.36,0],'#fff3df');box(g,[1.18,.11,1.25],[0,.49,.27],c);box(g,[.8,.12,.37],[0,.52,-.58],'#f5ead5')}
 if(item.kind==='sofa'){box(g,[1.6,.3,.7],[0,.25,0],c);box(g,[1.6,.5,.15],[0,.64,-.28],c);for(const x of [-.73,.73])box(g,[.15,.35,.7],[x,.5,0],c);box(g,[.55,.11,.5],[-.32,.46,.03],'#e1be9f')}
 if(item.kind==='rug')box(g,[1.8,.018,1.3],[0,.012,0],c,.01);
 if(item.kind==='lamp'){cylinder(g,.15,.06,[0,.03,0],'#b59467');cylinder(g,.018,1.35,[0,.7,0],'#b59467');cylinder(g,.22,.28,[0,1.47,0],'#fff0c9')}
 if(item.kind==='plant'){cylinder(g,.16,.3,[0,.15,0],'#c99a7c');for(let n=0;n<7;n++){const o=new T.Mesh(new T.SphereGeometry(.16,12,8),material(c));o.scale.set(.48,1.7,.7);o.position.set(Math.sin(n*2)*.13,.4+(n%3)*.13,Math.cos(n*2)*.12);o.rotation.z=Math.sin(n)*.5;g.add(o)}}
 parent.add(g);return g}

 const plinth=box(scene,[6,.12,5],[0,-.08,0],'#b99573');let sizeKey='';
 const floorMap=new T.TextureLoader().load('/models/materials/honey-oak-floor-v1.png',onChange);floorMap.colorSpace=T.SRGBColorSpace;floorMap.wrapS=floorMap.wrapT=T.RepeatWrapping;floorMap.repeat.set(2,2.5);floorMap.anisotropy=8;
 const floor=createOakFloor(floorMap);scene.add(floor.mesh);

 box(legacyWindow,[1.1,1.05,.04],[.05,1.55,-2.43],'#bdd8d5');for(const x of [-.52,.62,.05])box(legacyWindow,[.04,1.12,.05],[x,1.55,-2.39],'#fff6e6');box(legacyWindow,[1.18,.04,.05],[.05,1.55,-2.39],'#fff6e6');
 async function update(objects,assets={},room={}){
  roomSpec=room;
  const dimensions=roomDimensions(room),key=JSON.stringify(dimensions);
  if(key!==sizeKey){sizeKey=key;await enclosure.setSize(room);plinth.scale.set(dimensions.width/6,1,dimensions.depth/5);legacyWindow.position.z=-(dimensions.depth-5)/2;}
  floor.update(room);
  const loaded=new Map(),art=new Map();
  const visiblePrints=new Set(objects.map(o=>o.artwork?.url).filter(Boolean));
  for(const url of printImages.keys())if(url.startsWith('/api/drawings/')&&!visiblePrints.has(url))printImages.delete(url);
  await Promise.all(objects.filter(o=>o.asset_id).map(async o=>{
   const asset=assets[o.asset_id];if(!asset||asset.kind!==o.kind)throw Error('家具目录不完整，请刷新重试');
   loaded.set(o.id,await assetModel(asset));
   if(/^\/api\/drawings\/\d+\.png$/.test(o.artwork?.url))art.set(o.id,await loadPrint(o.artwork.url));
  }));
  enclosure.setOpenings(objects,assets);
  const window=objects.find(o=>assets[o.asset_id]?.wall_opening);
  windowFill.visible=bounce.visible=!!window;
  if(window){
   const a=assets[window.asset_id],hole=a.wall_opening,s=Math.sin(window.yaw),c=Math.cos(window.yaw);
   windowFill.position.set(window.x+s*.12,(a.elevation||0)+(hole.bottom||0)+hole.height/2,window.z+c*.12);
   windowFill.width=hole.width;windowFill.height=hole.height;
   windowFill.lookAt(windowFill.position.x+s,windowFill.position.y,windowFill.position.z+c);
   const patch=floorBouncePose(window,hole,dimensions,windowFill.position.y);
   bounce.position.set(patch.x,.036,patch.z);bounce.width=patch.width;bounce.height=patch.depth;
   bounce.rotation.set(Math.PI/2,window.yaw,0,'YXZ');
  }
  if(balconyRoot){disposeBalcony(balconyRoot);scene.remove(balconyRoot);balconyRoot=null}
  const door=objects.find(o=>o.id===room.balcony?.door_id),view=door&&loaded.get(door.id)?.getObjectByName('WindowView-city');
  balconyRoot=createBalcony(room,view,door,assets[door?.asset_id]?.wall_opening?.width);if(balconyRoot)scene.add(balconyRoot);
  const book=exhibitedBook(objects),exhibit=book&&art.has(book.id)?{image:art.get(book.id),title:book.artwork.title}:null;
  const next=new T.Group(),nextFixtures=new T.Group();let stencilRef=1;objects.forEach(o=>{const asset=assets[o.asset_id];buildItem(o,asset?.placement==='wall'?nextFixtures:next,loaded.get(o.id),asset,o.kind==='toy_set'?groundHeightAt(o.x,o.z,objects.filter(p=>p.kind==='rug'),assets):baseHeight(o,objects,assets),asset?.wall_opening?stencilRef++:0,art.get(o.id),exhibit)});
  for(const old of fixtures.children){old.userData.disposeArtwork?.();old.traverse(o=>{if(o.userData.runtimeDetail)disposeWindowDetail(o)})}fixtures.clear();while(nextFixtures.children.length)fixtures.add(nextFixtures.children[0]);
  legacyWindow.userData.enabled=!objects.some(o=>o.kind==='window'&&assets[o.asset_id]?.placement==='wall');
  for(const old of [...furniture.children]){
   old.userData.disposeArtwork?.();old.userData.disposeShade?.();
   old.traverse(o=>{if(old.userData.procedural)o.geometry?.dispose();if(old.userData.procedural||o.isSprite)for(const m of [].concat(o.material||[]))m.dispose()});
   furniture.remove(old);
  }
  while(next.children.length)furniture.add(next.children[0]);
  screenMeshes=[];for(const root of [furniture,fixtures])root.traverse(o=>{if(o.isMesh&&o.name.startsWith('Detailed-screen-'))screenMeshes.push(o)});
  clocks=fixtures.children.filter(g=>g.getObjectByName('Hour_hand')).map(g=>[g.getObjectByName('Hour_hand'),g.getObjectByName('Minute_hand')]);clockMinute=-1;
  contacts?.update(furniture,room,objects,assets);contacts?.setLighting(lightPreset);
  const keep=new Set(objects.filter(o=>o.asset_id).map(o=>{const a=assets[o.asset_id];return modelKey(a)}));
  for(const [key,promise] of cache)if(!keep.has(key)){cache.delete(key);promise.then(disposeModel,()=>{})}

 }
 return {furniture,walls,update,tickScreens(dt,camera){const visible=camera?visibleScreens(screenMeshes,camera):null;let changed=false;for(const tick of screenPlayers)changed=tick(dt,!visible||visible.has(tick.texture))||changed;if(clocks.length){const minute=Math.floor(Date.now()/60000);if(clockMinute!==minute){changed=true;if(renderer)renderer.shadowMap.needsUpdate=true;clockMinute=minute;const now=new Date(minute*60000),m=now.getMinutes();for(const [hour,hand] of clocks){hour.rotation.z=-(now.getHours()%12+m/60)*Math.PI/6;hand.rotation.z=-m*Math.PI/30}}}return changed},setLighting(preset){lightPreset=preset;const p=LIGHTING[preset]||LIGHTING.day;windowFill.intensity=p.window;bounce.intensity=p.bounce;bounce.color.set(preset==='night'?'#ccd5dd':'#ffdbac');windowFill.color.set(preset==='evening'?'#ffe1bd':'#e1edff');contacts?.setLighting(preset)},setFinish(value){floor.update({...roomSpec,...value});return enclosure.setFinish(value)},updateView(position,options){balconyRoot?.userData.updateView?.(position);const hidden=enclosure.updateView(position,options);for(const fixture of fixtures.children)fixture.visible=!hidden.has(fixture.userData.wall);legacyWindow.visible=legacyWindow.userData.enabled&&!hidden.has('back')},dispose(){for(const old of furniture.children){old.userData.disposeArtwork?.();old.userData.disposeShade?.()}contacts?.dispose();disposeBalcony(balconyRoot);if(balconyRoot)scene.remove(balconyRoot);for(const old of fixtures.children)old.userData.disposeArtwork?.();fixtures.traverse(o=>{if(o.userData.runtimeDetail)disposeWindowDetail(o)});scene.remove(windowFill,bounce);enclosure.dispose();for(const promise of cache.values())promise.then(disposeModel,()=>{});cache.clear();floor.dispose();glowTexture.dispose()}};
}
