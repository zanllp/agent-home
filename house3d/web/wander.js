import {spaceBounds} from '../shared/space.mjs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {usePaintedCharacter} from './character-material.js';
import {createPreviewRoom} from './wander-room.js';
import {createNavigation,createWalker,groundHeightAt} from './wander-navigation.js';
import {createSecondaryMotion} from './wander-motion.js';
import {createSelfMap} from './self-map.js';
import {createCanvasHud} from './wander-hud.js';
import {roomDimensions} from './room-size.js';
import {windowSunPose} from './room-lighting.js';
import {cameraPose,cameraZoom} from './camera-presets.js';
import {changedControls,LIGHTING,navigationKey} from './wander-state.js';
import {createObjectInteraction} from './object-interaction.js';
import {createObjectPanel} from './object-panel.js';
import {createNapQuilt} from './nap-quilt.js';
import {createSleepFace} from './sleep-face.js';
import {createReadingBook} from './reading-book.js';
import {bodySnapshot,feedbackEnvelope} from './home-feedback.js';
import {captureCharacterView} from './character-view.js';
import {capturePng} from './capture.js';
import './wander.css';

const ui={ready:false,error:'',auto:true,paused:false,brisk:true,sound:false,status:'正在穿好小鞋子…',cameraMode:'home',light:'day',notice:''};
const mount=document.getElementById('app');
 let scene,renderer,camera,controls,resize,raf,walker,mixer,walk,run,rest,avatar,scale=1,weight=0,last=0,disposed=false,marker,nav,pointer,audio,lastSteps=0,tapTimer=0,room,motion,rugs=[],hud,motionTime=0,turnVelocity=0,syncTimer,layoutKey='',navKey='',roomRevision=-1,furnitureAssets={},ambient,sun,noticeUntil=0,captureNotBefore=0,objectPanel,interaction,sitAction,sleepAction,characterModel,roomObjects=[],objectData={objects:[]},napQuilt,sleepFace,readAction,readingBook,controller=false,selfMap,roomCatalog={},roomSpec=roomDimensions();
 const viewerSession=crypto.randomUUID();
 const ray=new T.Raycaster(),plane=new T.Plane(new T.Vector3(0,1,0),0),hit=new T.Vector3();
 async function objectCommand(target_id,action){
  objectPanel.pending=true;
  try{const current=await (await fetch('/api/state')).json();const r=await fetch('/api/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),expected_revision:current.revision,tool:target_id?'interact':'cancel_action',arguments:target_id?{target_id,action}:{job_id:interaction.jobId}})});const body=await r.json();if(!r.ok)throw Error(body.error);ui.notice='好，准备一下。';noticeUntil=performance.now()+2500}catch(e){ui.notice=e.message;noticeUntil=performance.now()+8000}finally{objectPanel.pending=false}
 }
 function setAuto(v){ui.auto=v;walker?.setAutonomous(v);if(!v)walker?.stop()}
 function setBrisk(v){ui.brisk=v;walker?.setBrisk(v)}
 async function toggleSound(){ui.sound=!ui.sound;if(ui.sound){audio??=new AudioContext();await audio.resume()}}
 function tap(){if(!ui.sound||!audio||audio.state!=='running')return;const o=audio.createOscillator(),g=audio.createGain();o.type='triangle';o.frequency.setValueAtTime(150,audio.currentTime);o.frequency.exponentialRampToValueAtTime(65,audio.currentTime+.055);g.gain.setValueAtTime(.025,audio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+.075);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+.08)}
 function trackingPose(mode){
  let p=avatar?.position||{x:0,z:.5};const yaw=avatar?.rotation.y||0;
  if((interaction?.frame?.sleep||0)>.5&&!['home','top'].includes(mode)){const distance=mode==='face'?1.0:.65,x=p.x-distance*Math.sin(yaw),z=p.z-distance*Math.cos(yaw);return {position:mode==='side'?[x+2.8,1.5,z]:mode==='face'?[x+.12,1.7,z+.34]:[x+1.8,2.5,z+2.1],target:[x,mode==='face'?.82:.67,z]}}
  if(mode==='home'){const b=spaceBounds(roomSpec),x=(b.minX+b.maxX)/2,z=(b.minZ+b.maxZ)/2,f=Math.max((b.maxX-b.minX)/6,(b.maxZ-b.minZ)/5,roomSpec.height/2.4);return {position:[x+7.2*f,6.5*f,z+8.5*f],target:[x,.5,z]}};
  if(mode==='follow')return {position:[p.x+2.5,2.2,p.z+3.2],target:[p.x,.72,p.z]};
  if(mode==='front')return {position:[p.x+Math.sin(yaw)*2.8,1.25,p.z+Math.cos(yaw)*2.8],target:[p.x,.72,p.z]};
  return cameraPose(mode,{x:p.x,z:p.z,yaw});
 }
 function view(mode,instant=false){
  ui.cameraMode=mode;if(!camera)return;
  if(instant||['home','top'].includes(mode)){const pose=trackingPose(mode);camera.position.set(...pose.position);controls.target.set(...pose.target)}
  camera.zoom=cameraZoom(mode,camera.aspect);camera.updateProjectionMatrix();controls.update();
 }
 function consumeControls(previous,next){
  const changes=changedControls(previous,next);if(changes.length)captureNotBefore=performance.now()+450;
  for(const key of changes){
   if(key==='camera')continue;
   if(key==='light'){ui.light=next.light;const l=LIGHTING[next.light];scene.background.set(l.sky);sun.intensity=l.sun;ambient.intensity=l.ambient;room?.setLighting(next.light)}
   if(key==='note'){ui.notice=next.note;noticeUntil=performance.now()+10000}
   if(key==='position'&&!['requested','approaching','entering','active','leaving'].includes(next.interaction?.phase)){
    if(!nav.free(next.character)){ui.notice='那里站不开，先留在这里。';noticeUntil=performance.now()+10000;continue}
    walker=createWalker(nav,next.character);avatar.position.set(next.character.x,groundHeight(next.character.x,next.character.z),next.character.z);avatar.rotation.y=next.character.yaw;setAuto(false);walker.setBrisk(ui.brisk);lastSteps=0;marker.visible=false;ui.paused=false;
   }
   if(key==='activity'&&!['requested','approaching','entering','active','leaving'].includes(next.interaction?.phase)){
    ui.paused=false;setAuto(next.character.activity==='walk');
    if(next.character.activity==='sit'){ui.notice='坐姿还没准备好，先休息一会儿。';noticeUntil=performance.now()+10000}
   }
  }
  if(changes.includes('camera'))view(next.camera,true);else if(changes.includes('position')&&!['home','top'].includes(ui.cameraMode))view(ui.cameraMode,true);
 }
 function pick(event){if(!ui.ready||!pointer||Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)>5)return;if(interaction?.busy){ui.notice='先起身，再去那边玩。';noticeUntil=performance.now()+3000;return}if(!ui.ready||!pointer||Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)>5)return;
  const rect=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new T.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);
  if(!ray.ray.intersectPlane(plane,hit))return;
  if(walker.go({x:hit.x,z:hit.z})){ui.auto=false;walker.setAutonomous(false);ui.status='去那边看看';marker.position.set(hit.x,.025,hit.z);marker.visible=true}else ui.status='这里走不过去，点一块空地吧';
 }
 function groundHeight(x,z){return groundHeightAt(x,z,rugs,furnitureAssets)}
 function frame(now){
  if(disposed)return;raf=requestAnimationFrame(frame);if(document.hidden){last=now;return}if(now-last<1000/30)return;
  const dt=Math.min(.05,(now-last)/1000);last=now;if(ui.notice&&now>noticeUntil)ui.notice='';
  if(ui.ready&&controller&&!ui.paused){
   const contact=interaction?.tick(dt);
   sleepFace.update(contact?.sleep||0);const bedObject=roomObjects.find(o=>o.id===interaction?.targetId);napQuilt.update(bedObject?.properties?.covered===false?0:contact?.sleep||0,bedObject);
   if(contact){
    motion?.restore();walk.setEffectiveWeight(0);run.setEffectiveWeight(0);rest.setEffectiveWeight(1-contact.sit-contact.sleep);sitAction.setEffectiveWeight(contact.sit*(1-(contact.read||0)));readAction.setEffectiveWeight(contact.sit*(contact.read||0));readAction.time=.5;sleepAction.setEffectiveWeight(contact.sleep);sitAction.time=sleepAction.time=.5;mixer.update(0);
    avatar.position.set(contact.x,contact.y,contact.z);avatar.rotation.set(contact.pitch,contact.yaw,0,'YXZ');
    characterModel.traverse(o=>{const i=o.morphTargetDictionary?.SeatedFit;if(i!==undefined)o.morphTargetInfluences[i]=contact.sit;const j=o.morphTargetDictionary?.LyingFit;if(j!==undefined)o.morphTargetInfluences[j]=contact.sleep;if(o.userData.sleep_eye)o.visible=contact.sleep>.65});
   }else{
   avatar.rotation.x=0;readAction.setEffectiveWeight(0);sitAction.setEffectiveWeight(0);sleepAction.setEffectiveWeight(0);characterModel.traverse(o=>{const i=o.morphTargetDictionary?.SeatedFit;if(i!==undefined)o.morphTargetInfluences[i]=0;const j=o.morphTargetDictionary?.LyingFit;if(j!==undefined)o.morphTargetInfluences[j]=0;if(o.userData.sleep_eye)o.visible=false});
   const oldYaw=walker.state.yaw;const s=walker.update(dt,scale);turnVelocity=(s.yaw-oldYaw)/dt;motionTime+=dt;avatar.position.set(s.x,groundHeight(s.x,s.z),s.z);avatar.rotation.y=s.yaw;
   const target=s.mode==='walk'?1:0;weight+=(target-weight)*Math.min(1,dt*8);walk.setEffectiveWeight(weight*(1-s.runBlend));run.setEffectiveWeight(weight*s.runBlend);rest.setEffectiveWeight(1-weight);
   // Distance, not elapsed wall time, drives the gait and footfall cadence.
   motion?.restore();
   walk.time=1/24+(s.phase%1);run.time=1/24+(s.phase%1)*.75;rest.time=1/24;mixer.update(0);
   motion?.apply({phase:s.phase,time:motionTime,weight,turn:turnVelocity});
   if(s.steps>lastSteps){tap();lastSteps=s.steps}tapTimer+=dt;
   if(tapTimer>.4&&!interaction?.busy){ui.status=s.mode==='walk'?(s.runBlend>.4?'哒哒哒，小跑过去':ui.brisk?'啪嗒啪嗒，去看看':'慢慢走，看看家里'):s.mode==='turn'?'转个身，换个方向':'停一停，看看周围';tapTimer=0}
   if(!s.route.length)marker.visible=false;
   }
  }
  if(ui.ready){const desk=roomObjects.find(o=>o.id===interaction.relatedId)||roomObjects.find(o=>o.kind==='desk');readingBook.update(interaction.frame?.read||0,avatar,desk,furnitureAssets[desk?.asset_id])}
  if(ui.ready&&!['home','top'].includes(ui.cameraMode)){
   const pose=trackingPose(ui.cameraMode);camera.position.lerp(new T.Vector3(...pose.position),1-Math.exp(-dt*3));controls.target.lerp(new T.Vector3(...pose.target),1-Math.exp(-dt*5));
  }
  ui.objectPhase=interaction?.phase;ui.objectPose=interaction?.busy?interaction.pose:null;controls.update();room?.updateView(camera.position);renderer.render(scene,camera);hud.update(ui);hud.render(renderer);selfMap.update({ready:ui.ready&&controller,body:ui.ready?bodySnapshot(avatar,walker,interaction,ui.paused):null,objects:roomObjects,assets:furnitureAssets,catalog:roomCatalog,room:roomSpec,route:walker?.state.route||[],paused:ui.paused,hidden:objectPanel?.open});selfMap.render(renderer);objectPanel?.update(objectData);objectPanel?.render(renderer);renderer.domElement.setAttribute('aria-label',`大肥鱼的小家。${ui.notice||(ui.paused?'已暂停':ui.status)}。${ui.auto?'自主逛逛':'手动休息'}，${ui.brisk?'走跑走':'慢慢走'}，${{home:'全景',follow:'跟随',front:'正面',face:'看脸',portrait:'斜侧',side:'侧面',back:'背面',top:'俯视'}[ui.cameraMode]}，${ui.sound?'有声':'静音'}。空格暂停，A切换逛逛，F切换快慢，V切换镜头，M切换声音，I查看物品，P查看位置。`);
 }
async function init(){try{
  scene=new T.Scene();scene.background=new T.Color('#f3efe6');camera=new T.PerspectiveCamera(36,1,.05,40);
  renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,stencil:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=T.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;mount.appendChild(renderer.domElement);renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('role','application');hud=createCanvasHud();selfMap=createSelfMap();objectPanel=createObjectPanel();napQuilt=createNapQuilt(scene);
  controls=new OrbitControls(camera,renderer.domElement);controls.minDistance=1;controls.maxDistance=15;controls.maxPolarAngle=Math.PI*.48;view('home');
  ambient=new T.HemisphereLight('#fff6ec','#ad9b83',1.05);scene.add(ambient);sun=new T.DirectionalLight('#fff2dd',2.4);sun.position.set(-2,6,4);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8});sun.shadow.bias=-.00015;sun.shadow.normalBias=.015;sun.shadow.radius=4;sun.shadow.intensity=.78;scene.add(sun,sun.target);
  resize=new ResizeObserver(()=>{const w=mount.clientWidth,h=mount.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.zoom=cameraZoom(ui.cameraMode,w/h);camera.updateProjectionMatrix();hud.size(w,h);selfMap.size(w,h);objectPanel.size(w,h)});resize.observe(mount);last=performance.now();raf=requestAnimationFrame(frame);
  const [a,b]=await Promise.all([fetch('/api/state'),fetch('/api/catalog')]);if(!a.ok||!b.ok)throw Error('暂时没能读到房间，请刷新重试。');const state=await a.json();let catalog=await b.json();furnitureAssets=catalog.assets||{};roomCatalog=catalog.furniture;roomObjects=state.objects;roomSpec=roomDimensions(state.room);
  rugs=state.objects.filter(o=>o.kind==='rug');nav=createNavigation(state.objects,catalog.furniture,{assets:catalog.assets,room:state.room});
  let start={x:state.character.x,z:state.character.z,yaw:state.character.yaw};if(!nav.free(start)){const nearest=nav.nodes.reduce((a,b)=>Math.hypot(a.x-start.x,a.z-start.z)<Math.hypot(b.x-start.x,b.z-start.z)?a:b);start={...nearest,yaw:0}}
  walker=createWalker(nav,start);walker.setBrisk(ui.brisk);
  room=createPreviewRoom(scene);await room.update(state.objects,catalog.assets,state.room);const daylight=windowSunPose(state.objects,catalog.assets);sun.position.set(...daylight.position);sun.target.position.set(...daylight.target);await room.setFinish(state.room);layoutKey=JSON.stringify([state.objects,roomDimensions(state.room)]);navKey=navigationKey(state.objects,state.room);roomRevision=state.revision;
  marker=new T.Mesh(new T.RingGeometry(.09,.12,40),new T.MeshBasicMaterial({color:'#789d83',side:T.DoubleSide}));marker.rotation.x=-Math.PI/2;marker.visible=false;scene.add(marker);
  const gltf=await new GLTFLoader().loadAsync('/models/dafeiyu-contact.glb?v=life-v2-5');const model=gltf.scene;characterModel=model;usePaintedCharacter(model);sleepFace=createSleepFace(model);model.traverse(o=>{if(o.userData.sleep_eye)o.visible=false});model.updateMatrixWorld(true);
  const box=new T.Box3().setFromObject(model),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());scale=1.3/size.y;
  const normalized=new T.Group();normalized.scale.setScalar(scale);model.position.set(-center.x,-box.min.y,-center.z);normalized.add(model);avatar=new T.Group();avatar.rotation.order='YXZ';avatar.add(normalized);avatar.position.set(start.x,groundHeight(start.x,start.z),start.z);avatar.rotation.y=start.yaw;scene.add(avatar);readingBook=createReadingBook(scene);
  mixer=new T.AnimationMixer(model);const clip=gltf.animations.find(a=>a.name==='little-walk'),idle=gltf.animations.find(a=>a.name==='rest'),running=gltf.animations.find(a=>a.name==='little-run');if(!clip||!idle||!running)throw Error('小碎步动作没有载入完整。');
  walk=mixer.clipAction(clip).play();run=mixer.clipAction(running).play();run.setEffectiveWeight(0);rest=mixer.clipAction(idle).play();walk.setEffectiveWeight(0);mixer.update(0);
  sitAction=mixer.clipAction(gltf.animations.find(c=>c.name==='sit-pose')).play();sleepAction=mixer.clipAction(gltf.animations.find(c=>c.name==='sleep-pose')).play();sitAction.setEffectiveWeight(0);sleepAction.setEffectiveWeight(0);
  readAction=mixer.clipAction(gltf.animations.find(c=>c.name==='read-pose')).play();readAction.setEffectiveWeight(0);
  motion=createSecondaryMotion(model);
  interaction=createObjectInteraction({context:()=>({walker,nav,objects:roomObjects,assets:furnitureAssets,catalog:catalog.furniture,room:roomSpec,groundHeight}),onStart:()=>{setAuto(false);ui.paused=false;marker.visible=false},onExit:p=>{walker=createWalker(nav,p);walker.setBrisk(ui.brisk);setAuto(false);avatar.rotation.x=0;ui.status='站稳啦'},onStatus:s=>{ui.status=s},report:async(id,body)=>{const r=await fetch(`/api/interactions/${id}/progress`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,viewer_session:viewerSession})});if(!r.ok){const b=await r.json();throw Error(b.error)}}});
  function activate(id){
   if(!ui.ready)return;
   if(id==='items'){selfMap.close();objectPanel.activate('toggle');return}
   if(id==='self-map'){if(objectPanel.open)objectPanel.activate('toggle');selfMap.toggle();return}
   if(id==='auto'&&interaction.phase==='leaving')return;
   if(id==='auto'&&interaction.busy){objectCommand(interaction.targetId,'leave');return}
   if(id==='auto')setAuto(!ui.auto);
   if(id==='pause')ui.paused=!ui.paused;
   if(id==='speed')setBrisk(!ui.brisk);
   if(id==='camera')view({home:'follow',follow:'front',front:'home'}[ui.cameraMode]||'home');
   if(id==='sound')toggleSound().catch(()=>{ui.sound=false;ui.status='暂时无法播放声音'});
  }
  const canvas=renderer.domElement;
  canvas.addEventListener('pointerdown',e=>{canvas.focus({preventScroll:true});const r=canvas.getBoundingClientRect(),panelHit=objectPanel.hit(e.clientX-r.left,e.clientY-r.top);pointer=null;if(panelHit){e.stopImmediatePropagation();e.preventDefault();if(panelHit.enabled){if(panelHit.id.startsWith('action:')){const [,target,action]=panelHit.id.split(':');objectCommand(decodeURIComponent(target),action)}else objectPanel.activate(panelHit.id)}return}const mapHit=selfMap.hit(e.clientX-r.left,e.clientY-r.top);if(mapHit){e.stopImmediatePropagation();e.preventDefault();if(mapHit==='self-map-toggle')activate('self-map');return}const id=hud.hit(e.clientX-r.left,e.clientY-r.top);if(id){e.stopImmediatePropagation();e.preventDefault();activate(id);return}pointer={x:e.clientX,y:e.clientY}},true);
  canvas.addEventListener('pointerup',e=>{const r=canvas.getBoundingClientRect();if(objectPanel.hit(e.clientX-r.left,e.clientY-r.top)||selfMap.hit(e.clientX-r.left,e.clientY-r.top)||hud.hit(e.clientX-r.left,e.clientY-r.top)){e.stopImmediatePropagation();pointer=null;return}pick(e);pointer=null},true);
  canvas.addEventListener('pointercancel',()=>{pointer=null});
  canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();canvas.style.cursor=(hud.hit(e.clientX-r.left,e.clientY-r.top)||selfMap.hit(e.clientX-r.left,e.clientY-r.top)||objectPanel.hit(e.clientX-r.left,e.clientY-r.top))?'pointer':'grab'});
  canvas.addEventListener('keydown',e=>{const id={Space:'pause',KeyA:'auto',KeyF:'speed',KeyV:'camera',KeyM:'sound',KeyI:'items',KeyP:'self-map'}[e.code];if(id){e.preventDefault();activate(id)}});
  consumeControls(null,state);let received=state;
  // Poll state only while viewed; no rendering service or model call is needed.
  async function syncRoom(){
   try{
    if(!document.hidden){
     const response=await fetch('/api/state');if(!response.ok)throw Error('暂时连不上小家');
     const next=await response.json(),dimensionsChanged=JSON.stringify(roomSpec)!==JSON.stringify(roomDimensions(next.room)),key=JSON.stringify([next.objects,roomDimensions(next.room)]);roomObjects=next.objects;roomSpec=roomDimensions(next.room);
     if(next.revision!==roomRevision&&key!==layoutKey){
      if(next.objects.some(o=>o.asset_id&&!catalog.assets?.[o.asset_id])){const response=await fetch('/api/catalog');if(!response.ok)throw Error('家具目录暂时不可用');catalog=await response.json();furnitureAssets=catalog.assets||{};roomCatalog=catalog.furniture}
      const shapeChanged=navigationKey(next.objects,next.room)!==navKey;
      const nextNav=shapeChanged?createNavigation(next.objects,catalog.furniture,{assets:catalog.assets,room:next.room}):nav;
      if(!nextNav.nodes.length)throw Error('家具太满了，留一块走路的地方吧');
      await room.update(next.objects,catalog.assets,next.room);const daylight=windowSunPose(next.objects,catalog.assets);sun.position.set(...daylight.position);sun.target.position.set(...daylight.target);if(disposed)return;
      if(shapeChanged){const old=walker.state;let position={x:old.x,z:old.z,yaw:old.yaw};
      if(!nextNav.free(position))position={...nextNav.nodes.reduce((a,b)=>Math.hypot(a.x-old.x,a.z-old.z)<Math.hypot(b.x-old.x,b.z-old.z)?a:b),yaw:old.yaw};
      nav=nextNav;walker=createWalker(nav,position);walker.setBrisk(ui.brisk);walker.setAutonomous(ui.auto);lastSteps=0;marker.visible=false;}
      navKey=navigationKey(next.objects,next.room);rugs=next.objects.filter(o=>o.kind==='rug');layoutKey=key;captureNotBefore=performance.now()+450;
     }
     await room.setFinish(next.room);if(dimensionsChanged&&ui.cameraMode==='home')view('home',true);
     const heartbeat=await fetch('/api/viewer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...feedbackEnvelope(viewerSession,bodySnapshot(avatar,walker,interaction,ui.paused),interaction,true,ui.paused),job_id:interaction.jobId===next.interaction?.id?interaction.jobId:null})});
     if(!heartbeat.ok)throw Error('身体反馈暂时没同步');controller=(await heartbeat.json()).controller;if(!controller){ui.notice='小家正在另一个窗口里运行。';noticeUntil=performance.now()+2000}
     consumeControls(received,next);if(controller)interaction.consume(next.interaction);const objectResponse=await fetch('/api/objects');if(objectResponse.ok)objectData=await objectResponse.json();received=next;roomRevision=next.revision;ui.error='';
     const shots=await fetch('/api/screenshots/pending?viewer=life-v2');if(!shots.ok)throw Error('拍照请求暂时不可用');
     const shot=await shots.json();
     if(shot.id&&ui.ready&&controller&&performance.now()>=captureNotBefore){renderer.render(scene,camera);hud.update(ui);hud.render(renderer);selfMap.render(renderer);objectPanel.update(objectData);objectPanel.render(renderer);const blob=shot.view==='character'?await captureCharacterView({renderer,scene,avatar,pose:bodySnapshot(avatar,walker,interaction,ui.paused).pose,book:readingBook.position,room,spectatorCamera:camera}):await capturePng(renderer.domElement);const uploaded=await fetch(`/api/screenshots/${shot.id}`,{method:'POST',headers:{'Content-Type':'image/png','X-House-Viewer':'life-v2'},body:blob});if(!uploaded.ok)throw Error('照片暂时没存好')}
    }
   }catch(e){ui.error='布置暂时没能更新，请稍后重试';console.warn(e)}
   if(!disposed)syncTimer=setTimeout(syncRoom,1200);
  }
  syncTimer=setTimeout(syncRoom,1200);
  ui.ready=true;ui.status='点空地走过去，拖动转一转';
 }catch(e){ui.error=e.message;hud?.update(ui)}}
window.addEventListener('pagehide',()=>{disposed=true;clearTimeout(syncTimer);cancelAnimationFrame(raf);resize?.disconnect();controls?.dispose();audio?.close();hud?.dispose();selfMap?.dispose();objectPanel?.dispose();napQuilt?.dispose();sleepFace?.dispose();readingBook?.dispose();room?.dispose();scene?.traverse(o=>{o.geometry?.dispose();for(const m of [].concat(o.material||[]))m.dispose()});renderer?.dispose()},{once:true});
init();
