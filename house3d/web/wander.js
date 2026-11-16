import {createWaterPose} from './water-pose.js';
import {sofaGlance} from './sofa-rest.js';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {usePaintedCharacter} from './character-material.js';
import {createPreviewRoom,baseHeight} from './wander-room.js';
import {createNavigation,createWalker,groundHeightAt} from './wander-navigation.js';
import {createSecondaryMotion} from './wander-motion.js';
import {createSelfMap} from './self-map.js';
import {createCanvasHud,toolbarChoices,selectable,selectedChoice} from './wander-hud.js';
import {roomDimensions} from './room-size.js';
import {createInteriorLighting} from './interior-lighting.js';
import {cameraPose,cameraZoom,broadcastPose,broadcastFov,homePose,homeFov,albumPose,albumFov,roomViewOptions,roomCameraDistance,companionPose,companionObstruction,drawingViewPose,rugPlayViewPose} from './camera-presets.js';
import {apartment,zoneAt} from '../shared/apartment.mjs';
import {spaceSegments,balconyGeometry} from '../shared/space.mjs';
import {changedControls,navigationKey} from './wander-state.js';
import {createObjectInteraction} from './object-interaction.js';
import {createObjectPanel} from './object-panel.js';
import {sleepTurnClock,applySleepTurn} from './sleep-turn.js';
import {createSleepFace} from './sleep-face.js';
import {createFloorPlay} from './floor-play.js';
import {createDrawingPose} from './drawing-pose.js';
import {createReadingBook} from './reading-book.js';
import {bodySnapshot,feedbackEnvelope} from './home-feedback.js';
import {captureCharacterView} from './character-view.js';
import {capturePng} from './capture.js';
import {cameraHold} from './camera-hold.js';
import {createRenderDemand} from './render-demand.js';
import {playbackBuffer} from './live-playback.js';
import {perfSampler} from './perf-sample.js';
import './wander.css';

let waterPose;
let glance;
const renderDemand=createRenderDemand();
const statsMode=new URLSearchParams(location.search).get('renderStats');
const continuousBaseline=statsMode==='continuous';
const renderStats=statsMode!==null?{frames:0,shadowFrames:0,bodyFrames:0,calls:0,triangles:0,submitMs:0,mode:continuousBaseline?'continuous':'demand',startedAt:performance.now()}:null;
function finishRenderStats(start){if(!renderStats)return;renderStats.submitMs+=performance.now()-start;renderStats.calls+=renderer.info.render.calls;renderStats.triangles+=renderer.info.render.triangles}
const manualCamera=cameraHold();
let statsAt=0,trackingUntil=0,returnUntil=0;
let bodyDirty=true,outdoorState=null,outdoorTimer;
function invalidateBody(){if(renderer)renderer.shadowMap.needsUpdate=true;bodyDirty=true;renderDemand.invalidate()}

const ui={ready:false,error:'',auto:true,paused:false,brisk:true,sound:false,status:'正在穿好小鞋子…',cameraMode:'home',menuId:null,menuHover:null,light:'day',notice:''};
const mount=document.getElementById('app');
 let companion,companionLayout,companionBoxes,companionPlan,companionBalcony;
 let activityCamera,drawingPose,floorPlay,playTime=0;
 let scene,renderer,camera,controls,resize,raf,walker,mixer,walk,run,rest,avatar,scale=1,weight=0,last=0,disposed=false,marker,nav,pointer,audio,lastSteps=0,tapTimer=0,room,motion,rugs=[],hud,motionTime=0,turnVelocity=0,syncTimer,layoutKey='',navKey='',roomRevision=-1,furnitureAssets={},lighting,noticeUntil=0,captureNotBefore=0,objectPanel,interaction,sitAction,sleepAction,characterModel,roomObjects=[],objectData={objects:[]},sleepFace,readAction,readingBook,controller=false,selfMap,roomCatalog={},roomSpec=roomDimensions();
 const cleanView=mode=>mode==='broadcast'||mode==='album';
 const viewerSession=crypto.randomUUID();
 const runnerKey=new URLSearchParams(location.hash.slice(1)).get('runner');
 const isRunner=!!runnerKey,playback=playbackBuffer();
 let pausedRev=0,briskRev=0,watchers=0;
 const turns=sleepTurnClock();let lastDrawnSide=0;
 const gait={time:0,weight:0,turn:0,poseTime:0,sleepSide:0};
 let spectator=false,feed,perf,framePending=false,lastPublish=-Infinity,lastPacket='',remoteDirty=false,controlRevision=0,lastShadow=-Infinity,lastCameraMode='';
 const ownerFetch=(url,opts={})=>fetch(url,{...opts,headers:{...opts.headers,...(runnerKey?{'X-House-Runner':runnerKey}:{})}});
 const post=(url,body)=>ownerFetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 async function command(tool,args){const state=await (await fetch('/api/state')).json(),r=await post('/api/commands',{id:crypto.randomUUID(),expected_revision:state.revision,tool,arguments:args});if(!r.ok)throw Error((await r.json()).error)}
 let lastFaultKey='',lastFaultAt=0;
 function runtimeFault(where,e){const detail=String(e?.stack||e?.message||e).replaceAll(runnerKey||'','[runner]').slice(0,1200),key=where+':'+detail;if(key===lastFaultKey&&performance.now()-lastFaultAt<10000)return;lastFaultKey=key;lastFaultAt=performance.now();post('/api/runtime/fault',{message:where+': '+detail}).catch(()=>{})}
 function failNotice(e){ui.notice=e.message;noticeUntil=performance.now()+3500}
 function publish(now,contact){if(framePending||now-lastPublish<(watchers?80:500))return;
  const w=walker.state, packet={jobId:interaction.jobId,phase:interaction.phase,pose:interaction.pose,gait,targetId:interaction.targetId,relatedId:interaction.relatedId,busy:interaction.busy,contact,body:bodySnapshot(avatar,walker,interaction,ui.paused),walk:{x:w.x,z:w.z,yaw:w.yaw,speed:w.speed,phase:w.phase,mode:w.mode,steps:w.steps,runBlend:w.runBlend},auto:ui.auto,brisk:ui.brisk,paused:ui.paused,status:ui.status};
  const serial=JSON.stringify(packet);if(serial===lastPacket&&now-lastPublish<1000)return;
  lastPublish=now;framePending=true;
  post('/api/runtime/frame',packet).then(async r=>{if(!r.ok)throw Error('Runner 状态同步失败');lastPacket=serial;const c=await r.json();watchers=c.watchers;if(c.revision!==controlRevision){controlRevision=c.revision;if(c.pausedRev>pausedRev){ui.paused=c.paused;pausedRev=c.pausedRev}if(c.briskRev>briskRev){setBrisk(c.brisk);briskRev=c.briskRev}}}).catch(e=>{runtimeFault('frame',e);failNotice(e)}).finally(()=>framePending=false);
 }
 const ray=new T.Raycaster(),plane=new T.Plane(new T.Vector3(0,1,0),0),hit=new T.Vector3();
 async function objectCommand(target_id,action){
  objectPanel.pending=true;
  try{const current=await (await fetch('/api/state')).json();const r=await fetch('/api/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),expected_revision:current.revision,tool:target_id?'interact':'cancel_action',arguments:target_id?{target_id,action}:{job_id:interaction.jobId}})});const body=await r.json();if(!r.ok)throw Error(body.error);ui.notice=action==='water'?'去拿小水壶啦。':action==='cook_rice'?'开始煮饭，半小时后就好。':action==='serve_rice'?'白饭盛好啦。':action==='tidy'?'都收回盒子啦。':action==='unpack'?'拿出来啦！':'好，准备一下。';noticeUntil=performance.now()+2500}catch(e){ui.notice=e.message;noticeUntil=performance.now()+8000}finally{objectPanel.pending=false}
 }
 function setAuto(v){invalidateBody();ui.auto=v;walker?.setAutonomous(v);if(!v)walker?.stop()}
 function setBrisk(v){ui.brisk=v;walker?.setBrisk(v)}
 async function toggleSound(){ui.sound=!ui.sound;if(ui.sound){audio??=new AudioContext();await audio.resume()}}
 function tap(){if(!ui.sound||!audio||audio.state!=='running')return;const o=audio.createOscillator(),g=audio.createGain();o.type='triangle';o.frequency.setValueAtTime(150,audio.currentTime);o.frequency.exponentialRampToValueAtTime(65,audio.currentTime+.055);g.gain.setValueAtTime(.025,audio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+.075);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+.08)}
 let wallLayout,wallSegments,wallZoom=1;
 const lastEye=new T.Vector3(Infinity,0,0),lastTarget=new T.Vector3();let lastClampLayout;
 const desiredEye=new T.Vector3(),desiredTarget=new T.Vector3();
 function cameraWalls(){
  if(wallLayout!==layoutKey){wallSegments=spaceSegments(roomSpec,roomObjects);wallLayout=layoutKey}
  return wallSegments;
 }
 function constrainCamera(mode){
  if(!avatar||mode==='broadcast'||roomViewOptions(mode).cutaway)return;
  if(lastClampLayout===layoutKey&&lastEye.distanceToSquared(camera.position)<1e-14&&lastTarget.distanceToSquared(controls.target)<1e-14)return;
  const t=roomCameraDistance(controls.target,camera.position,cameraWalls());
  if(t<1){camera.position.lerp(controls.target,1-t);camera.lookAt(controls.target);camera.updateMatrixWorld()}
  lastEye.copy(camera.position);lastTarget.copy(controls.target);lastClampLayout=layoutKey;
 }
 function trackingPose(mode){
  const pose=authoredPose(mode);wallZoom=1;
  if(!avatar||mode==='broadcast'||roomViewOptions(mode).cutaway)return pose;
  desiredTarget.fromArray(pose.target);desiredEye.fromArray(pose.position);
  const t=roomCameraDistance(desiredTarget,desiredEye,cameraWalls());
  if(t===1)return pose;
  // Shorten the boom, then widen the lens so a full-body preset stays full body.
  desiredEye.lerp(desiredTarget,1-t);wallZoom=t;
  return {position:desiredEye.toArray(),target:pose.target};
 }
 function applyLens(mode,blend=1){
  const zoom=cameraZoom(mode,camera.aspect)*wallZoom;
  if(Math.abs(camera.zoom-zoom)>1e-5){camera.zoom+=(zoom-camera.zoom)*blend;camera.updateProjectionMatrix()}
 }
 function authoredPose(mode){
  if(mode==='album')return albumPose(roomSpec,camera.aspect);
  if(mode==='broadcast')return broadcastPose(roomSpec,camera.aspect);
  let p=avatar?.position||{x:0,z:.5};const yaw=avatar?.rotation.y||0;
  if(mode==='companion'){
   if(companionLayout!==layoutKey){
    companionBoxes=cameraWalls().map(([a,b])=>({x:(a.x+b.x)/2,z:(a.z+b.z)/2,yaw:0,base:0,height:roomSpec.height||2.6,size:[Math.abs(a.x-b.x)+.09,Math.abs(a.z-b.z)+.09]}));
    for(const o of roomObjects){
     const asset=furnitureAssets[o.asset_id]||roomCatalog[o.kind];
     if(!asset?.size||o.kind==='rug'||asset.wall_opening)continue;
     companionBoxes.push({x:o.x,z:o.z,yaw:o.yaw||0,base:baseHeight(o,roomObjects,furnitureAssets),size:asset.size,height:asset.height});
    }
    companion=null;companionLayout=layoutKey;companionPlan=apartment(roomSpec);companionBalcony=balconyGeometry(roomSpec);
   }
   if(!companion||Math.hypot(companion.x-p.x,companion.z-p.z,companion.y-p.y)>.055){
    const living={minX:-roomSpec.width/2,maxX:roomSpec.width/2,minZ:-roomSpec.depth/2,maxZ:roomSpec.depth/2};
    const zone=zoneAt(companionPlan,p)||(p.x>=living.minX&&p.x<=living.maxX&&p.z>=living.minZ&&p.z<=living.maxZ?living:companionBalcony);
    const pose=companionPose(p,companionBoxes,companion,zone);
    companion={...pose,x:p.x,y:p.y||0,z:p.z};
   }
   return companion;
  }
  if((interaction?.frame?.sleep||0)>.5&&!['home','top','broadcast','album'].includes(mode)){const distance=mode==='face'?1.0:.65,x=p.x-distance*Math.sin(yaw),z=p.z-distance*Math.cos(yaw);return {position:mode==='side'?[x+2.8,1.5,z]:mode==='face'?[x+.12,1.7,z+.34]:[x+1.8,2.5,z+2.1],target:[x,mode==='face'?.82:.67,z]}}
  const drawing=(mode==='front'||mode==='side')&&interaction?.frame?.draw>.01;
  const playing=(mode==='front'||mode==='portrait')&&interaction?.frame?.play>.01;
  if(drawing||playing){
   const kind=drawing?'draw':'play';
   if(!activityCamera||activityCamera.kind!==kind||activityCamera.mode!==mode||activityCamera.layout!==layoutKey||Math.hypot(p.x-activityCamera.x,p.z-activityCamera.z)>.01||Math.abs(yaw-activityCamera.yaw)>.01){
    const boxes=roomObjects.flatMap(o=>{const asset=furnitureAssets[o.asset_id]||roomCatalog[o.kind];if(!asset||o.id===interaction.targetId||asset.placement==='wall'||o.kind==='rug')return [];const base=baseHeight(o,roomObjects,furnitureAssets);return base+asset.height<(drawing ? .61 : .08)?[]:[{x:o.x,z:o.z,yaw:o.yaw,base,size:asset.size,height:asset.height}]});
    const pose=drawing?drawingViewPose(p,yaw,boxes,mode==='side'):rugPlayViewPose(p,yaw,boxes,mode==='portrait');
    activityCamera={layout:layoutKey,mode,kind,x:p.x,z:p.z,yaw,pose};
   }
   return activityCamera.pose;
  }
  if(mode==='home')return homePose(roomSpec,camera.aspect,mount.clientHeight||800);
  if(mode==='follow')return {position:[p.x+2.5,2.2,p.z+3.2],target:[p.x,.72,p.z]};
  if(mode==='front')return {position:[p.x+Math.sin(yaw)*2.8,1.25,p.z+Math.cos(yaw)*2.8],target:[p.x,.72,p.z]};
  return cameraPose(mode,{x:p.x,z:p.z,yaw});
 }
 function view(mode,instant=false){
  manualCamera.reset();returnUntil=0;ui.menuId=null;ui.menuHover=null;renderDemand.invalidate();trackingUntil=performance.now()+3000;ui.cameraMode=mode;wallZoom=1;if(!camera)return;camera.near=.05;camera.fov=mode==='broadcast'?broadcastFov:mode==='home'?homeFov:mode==='album'?albumFov:mode==='companion'?52:36;if(controls)controls.enabled=!cleanView(mode);
  if(instant||['home','top','broadcast','album'].includes(mode)){const pose=trackingPose(mode);camera.position.set(...pose.position);controls.target.set(...pose.target);const dist=camera.position.distanceTo(controls.target);if(mode==='album')camera.near=Math.max(.05,dist*.08);controls.maxDistance=Math.max(15,dist*1.3);camera.far=Math.max(40,controls.maxDistance+20)}
  camera.zoom=cameraZoom(mode,camera.aspect)*wallZoom;camera.updateProjectionMatrix();controls.update();constrainCamera(mode);
 }
 function consumeControls(previous,next){
  const changes=changedControls(previous,next);if(changes.length){invalidateBody();captureNotBefore=performance.now()+450}
  for(const key of changes){
   if(key==='camera')continue;
   if(key==='light'){ui.light=next.light;lighting.setPreset(next.light);room?.setLighting(next.light)}
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
  if(changes.includes('camera'))view(next.camera,true);else if(changes.includes('position')&&!manualCamera.blocked(performance.now())&&!['home','top','broadcast','album'].includes(ui.cameraMode))view(ui.cameraMode,true);
 }
 function pick(event){if(!ui.ready||!pointer||Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)>5)return;if(interaction?.busy){ui.notice='先起身，再去那边玩。';noticeUntil=performance.now()+3000;return}if(!ui.ready||!pointer||Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)>5)return;
  const rect=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new T.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);
  if(!ray.ray.intersectPlane(plane,hit))return;
  if(spectator||ui.lifePlan&&['running','paused'].includes(ui.lifePlan.status)){command('walk_to',{x:hit.x,z:hit.z}).catch(failNotice);return}
  if(walker.go({x:hit.x,z:hit.z})){invalidateBody();ui.auto=false;walker.setAutonomous(false);ui.status='去那边看看';marker.position.set(hit.x,.025,hit.z);marker.visible=true}else ui.status='这里走不过去，点一块空地吧';
 }
 function groundHeight(x,z){return groundHeightAt(x,z,rugs,furnitureAssets)}
 function applyBody(dt,remote){bodyDirty=false;remoteDirty=false;
   waterPose?.restore();glance?.restore();drawingPose.restore();floorPlay.restore();const contact=remote?remote.contact:interaction.tick(dt);
   const side=remote?.gait?.sleepSide??gait.sleepSide;
   lastDrawnSide=side;
   const roll=contact?.sofa ? .90*contact.sofa*(contact.sleep||0) : side*(contact?.sleep||0);
   applySleepTurn(characterModel.parent,roll);
   sleepFace.update((contact?.sleep||0)-(contact?.awake||0));room.setSleep(interaction?.targetId,contact?.sleep||0,roll);
   characterModel.parent.position.y=0;
   if(contact&&!contact.walking){
    motion?.restore();walk.setEffectiveWeight(0);run.setEffectiveWeight(0);rest.setEffectiveWeight(1-contact.sit-contact.sleep);sitAction.setEffectiveWeight(contact.sit*(1-(contact.read||contact.play||contact.draw||0)));readAction.setEffectiveWeight(contact.sit*(contact.read||contact.play||contact.draw||0));readAction.time=.5;sleepAction.setEffectiveWeight(contact.sleep);sitAction.time=sleepAction.time=.5;mixer.update(0);
    avatar.position.set(contact.x,contact.y,contact.z);avatar.rotation.set(contact.pitch,contact.yaw,0,'YXZ');
    characterModel.traverse(o=>{const i=o.morphTargetDictionary?.SeatedFit;if(i!==undefined)o.morphTargetInfluences[i]=contact.sit;const j=o.morphTargetDictionary?.LyingFit;if(j!==undefined)o.morphTargetInfluences[j]=contact.sleep;if(o.userData.sleep_eye)o.visible=contact.sleep-(contact.awake||0)>.65});
   }else{
   avatar.rotation.x=0;readAction.setEffectiveWeight(0);sitAction.setEffectiveWeight(0);sleepAction.setEffectiveWeight(0);characterModel.traverse(o=>{const i=o.morphTargetDictionary?.SeatedFit;if(i!==undefined)o.morphTargetInfluences[i]=0;const j=o.morphTargetDictionary?.LyingFit;if(j!==undefined)o.morphTargetInfluences[j]=0;if(o.userData.sleep_eye)o.visible=false});
   const oldYaw=walker.state.yaw;const s=remote?Object.assign(walker.state,remote.walk):walker.update(dt,scale);turnVelocity=remote?.gait?.turn??(s.yaw-oldYaw)/dt;motionTime=remote?.gait?.time??(motionTime+dt);avatar.position.set(s.x,groundHeight(s.x,s.z),s.z);avatar.rotation.y=s.yaw;
   const target=s.mode==='walk'?1:0;weight=remote?.gait?.weight??(weight+(target-weight)*Math.min(1,dt*8));walk.setEffectiveWeight(weight*(1-s.runBlend));run.setEffectiveWeight(weight*s.runBlend);rest.setEffectiveWeight(1-weight);
   // Distance, not elapsed wall time, drives the gait and footfall cadence.
   motion?.restore();
   walk.time=1/24+(s.phase%1);run.time=1/24+(s.phase%1)*.75;rest.time=1/24;mixer.update(0);
   characterModel.parent.position.y=.025*weight*s.runBlend*Math.sin(s.phase*Math.PI*2)**2;
   motion?.apply({phase:s.phase,time:motionTime,weight,runBlend:s.runBlend,turn:turnVelocity});
   if(s.steps>lastSteps){tap();lastSteps=s.steps}tapTimer+=dt;
   if(tapTimer>.4&&!interaction?.busy){ui.status=s.mode==='walk'?(s.runBlend>.4?'哒哒哒，小跑过去':ui.brisk?'啪嗒啪嗒，去看看':'慢慢走，看看家里'):s.mode==='turn'?'转个身，换个方向':'停一停，看看周围';tapTimer=0}
   if(!s.route.length)marker.visible=false;
   }
  waterPose.update(contact,dt);room.setCarried(interaction.relatedId,!!contact?.carry);
  if(contact?.awake){
   const plan=apartment(roomSpec),zone=zoneAt(plan,avatar.position)?.id;
   const tv=roomObjects.filter(o=>o.kind==='tv'&&o.properties?.on!==false&&zoneAt(plan,o)?.id===zone)
    .sort((a,b)=>Math.hypot(a.x-avatar.position.x,a.z-avatar.position.z)-Math.hypot(b.x-avatar.position.x,b.z-avatar.position.z))[0];
   if(tv&&Math.hypot(tv.x-avatar.position.x,tv.z-avatar.position.z)<5)glance.update(contact.awake,tv,avatar.position);
  }
  {const playing=interaction.frame?.play;floorPlay.update(interaction.frame,remote?.gait?.poseTime??(playTime+=dt),playing?room.furniture.children.find(o=>o.userData.id===interaction.targetId):null)}
  {const w=interaction.frame?.draw||0;drawingPose.update(w,dt,w?room.furniture.children.find(o=>o.userData.id===interaction.relatedId):null,remote?.gait?.poseTime)}
  {const desk=roomObjects.find(o=>o.id===interaction.relatedId)||roomObjects.find(o=>o.kind==='desk');readingBook.update(interaction.frame?.read||0,avatar,desk,furnitureAssets[desk?.asset_id])}
 }
 let lastShotAt=performance.now();
 function applyRunnerCapture(){
  applyBody(1/30,{contact:interaction.frame,walk:walker.state,gait});
  view(ui.cameraMode,true);ui.objectPhase=interaction.phase;ui.objectPose=interaction.busy?interaction.pose:null;
  selfMap.update({ready:true,body:bodySnapshot(avatar,walker,interaction,ui.paused),objects:roomObjects,assets:furnitureAssets,catalog:roomCatalog,room:roomSpec,route:walker.state.route,paused:ui.paused,hidden:objectPanel.open});
 }
 function frame(now){
  if(disposed)return;raf=isRunner?setTimeout(()=>frame(performance.now()),ui.ready&&(!ui.auto&&!interaction?.busy&&!walker?.state.route.length||ui.paused)?120:33):requestAnimationFrame(frame);if(document.hidden&&!isRunner){last=now;return}if(!isRunner&&now-last<1000/30)return;
  const elapsed=(now-last)/1000,dt=Math.min(.05,elapsed);last=now;if(ui.notice&&now>noticeUntil)ui.notice='';
  const remote=spectator?playback.sample(now):null;
  if(spectator&&ui.ready){if(remote){
    Object.assign(interaction,{phase:remote.phase,pose:remote.pose,busy:remote.busy,targetId:remote.targetId,relatedId:remote.relatedId,frame:remote.contact,jobId:remote.jobId});
    ui.auto=remote.auto;ui.brisk=remote.brisk;ui.paused=remote.paused;ui.status=remote.status;
  }else ui.status='等待家里的 Runner 连接…'}
  if(ui.ready&&controller&&!spectator)gait.sleepSide=turns.sample(now,interaction,ui.paused);
  const turnChanged=(spectator?(remote?.gait?.sleepSide??0):gait.sleepSide)!==lastDrawnSide;
  const animateBody=ui.ready&&(spectator?!!remote&&(remoteDirty||bodyDirty||turnChanged||(!ui.paused&&(remote.body.moving||remote.walk.mode==='turn'||remote.phase==='approaching'||remote.phase==='entering'||remote.phase==='leaving'||remote.phase==='active'&&['draw','play','water'].includes(remote.pose)))):controller&&!ui.paused&&(continuousBaseline||bodyDirty||(!isRunner&&turnChanged)||renderDemand.animate(now,{ready:ui.ready,controller,paused:ui.paused,auto:ui.auto,routeLength:walker?.state.route.length||0,phase:interaction?.phase,pose:interaction?.pose,weight:isRunner?0:weight})));
  perf?.tick(elapsed*1000,animateBody);
  if(isRunner&&ui.ready){
   if(controller&&animateBody){bodyDirty=false;gait.poseTime+=dt;const c=interaction.tick(dt);if(c&&!c.walking){avatar.position.set(c.x,c.y,c.z);avatar.rotation.set(c.pitch,c.yaw,0,'YXZ')}else{
    const oldYaw=walker.state.yaw,w=walker.update(dt,scale);gait.turn=(w.yaw-oldYaw)/dt;gait.time+=dt;gait.weight+=((w.mode==='walk'?1:0)-gait.weight)*Math.min(1,dt*8);avatar.position.set(w.x,groundHeight(w.x,w.z),w.z);avatar.rotation.set(0,w.yaw,0,'YXZ');if(!interaction.busy)ui.status=w.route.length?'去那边看看':'停一停，看看周围';
   }}
   publish(now,interaction.frame);return;
  }
  if(isRunner)return;
  if(animateBody)applyBody(dt,remote);
  if(animateBody)trackingUntil=now+3000;
  if(manualCamera.resume(now))trackingUntil=returnUntil=now+3000;
  const cameraTracking=ui.ready&&!manualCamera.blocked(now)&&now<trackingUntil&&!['home','top','broadcast','album'].includes(ui.cameraMode);
  if(cameraTracking){
   const mode=ui.cameraMode,pose=trackingPose(mode),returning=now<returnUntil;
   const blend=1-Math.exp(-dt*(returning?3:mode==='companion'?8:3));applyLens(mode,returning?blend:1);
   camera.position.lerp(new T.Vector3(...pose.position),blend);
   if(!returning&&mode==='companion'&&companionObstruction(avatar.position,camera.position.toArray(),companionBoxes)>pose.loss){
    camera.position.set(...pose.position);controls.target.set(...pose.target);
   }
   controls.target.lerp(new T.Vector3(...pose.target),returning?blend:1-Math.exp(-dt*(mode==='companion'?10:5)));
  }
  ui.objectPhase=interaction?.phase;ui.objectPose=interaction?.busy?interaction.pose:null;if(cameraTracking)controls.update();constrainCamera(ui.cameraMode);room?.updateView(camera.position,roomViewOptions(ui.cameraMode));const screenChanged=ui.ready&&!ui.paused?room.tickScreens(elapsed,camera):false;if(cleanView(ui.cameraMode)&&marker)marker.visible=false;
  if(ui.menuId&&!selectable(ui.menuId,ui)){ui.menuId=null;ui.menuHover=null}
  const decision=renderDemand.frame({camera:[...camera.matrixWorld.elements,...camera.projectionMatrix.elements],key:JSON.stringify([ui,objectPanel?.open,objectPanel?.pending,selfMap?.open]),bodyChanged:animateBody,screenChanged});
  if(continuousBaseline){decision.render=true;decision.shadows=true}
  if(renderStats){renderStats.frames+=Number(decision.render);renderStats.bodyFrames+=Number(animateBody);if(now-statsAt>=1000){renderer.domElement.dataset.renderStats=JSON.stringify({...renderStats,elapsedMs:now-renderStats.startedAt});statsAt=now}}
  if(!decision.render)return;
  const renderStart=performance.now();renderer.info.reset();
  // The full-apartment camera sees a very small moving silhouette. Refresh its
  // shadow at 10 Hz; keep the character and the closer cameras at full detail.
  const shadowInterval=roomSpec.floorplan&&['album','home','top'].includes(ui.cameraMode)?100:65;
  const shadowDue=continuousBaseline||!animateBody||bodyDirty||ui.cameraMode!==lastCameraMode||now-lastShadow>=shadowInterval;
  decision.shadows&&=shadowDue;lastCameraMode=ui.cameraMode;
  const refreshShadow=decision.shadows||renderer.shadowMap.needsUpdate;if(refreshShadow){lastShadow=now;if(renderStats)renderStats.shadowFrames++}perf?.begin(now);
  renderer.shadowMap.needsUpdate ||= decision.shadows;renderer.render(scene,camera);
  if(cleanView(ui.cameraMode)){renderer.domElement.setAttribute('aria-label',(ui.cameraMode==='album'?'全屋留影。':'小家直播。')+'轻点画面或按 Esc 返回。');finishRenderStats(renderStart);perf?.end(renderStart,refreshShadow);return}
  hud.update(ui);hud.render(renderer);selfMap.update({ready:ui.ready&&(controller||!!remote),body:ui.ready?bodySnapshot(avatar,walker,interaction,ui.paused):null,objects:roomObjects,assets:furnitureAssets,catalog:roomCatalog,room:roomSpec,route:walker?.state.route||[],paused:ui.paused,hidden:objectPanel?.open});selfMap.render(renderer);objectPanel?.update(objectData);objectPanel?.render(renderer);renderer.domElement.setAttribute('aria-label',`大肥鱼的小家。${ui.notice||(ui.paused?'已暂停':ui.status)}。${ui.auto?'自主逛逛':'手动休息'}，${ui.brisk?'走跑走':'慢慢走'}，${{home:'全景',broadcast:'直播',companion:'家长跟拍',follow:'跟随',front:'正面',face:'看脸',portrait:'斜侧',side:'侧面',back:'背面',top:'俯视'}[ui.cameraMode]}，${ui.sound?'有声':'静音'}。空格暂停，A切换逛逛，F切换快慢，V打开镜头列表，M切换声音，I查看物品，P查看位置。`);finishRenderStats(renderStart);perf?.end(renderStart,refreshShadow);
 }
async function init(){try{
  const runtime=await (await fetch('/api/runtime')).json();spectator=runtime.runner&&!isRunner;
  scene=new T.Scene();scene.background=new T.Color('#f3efe6');camera=new T.PerspectiveCamera(36,1,.05,40);
  renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,stencil:true});renderer.info.autoReset=false;perf=perfSampler(renderer,data=>post('/api/runtime/perf',{session:viewerSession,...data}));renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=T.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.toneMapping=T.ACESFilmicToneMapping;mount.appendChild(renderer.domElement);renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('role','application');hud=createCanvasHud();selfMap=createSelfMap();objectPanel=createObjectPanel();
  controls=new OrbitControls(camera,renderer.domElement);controls.minDistance=1;controls.maxDistance=15;controls.maxPolarAngle=Math.PI*.48;view('home');
  controls.addEventListener('start',()=>manualCamera.start());
  controls.addEventListener('change',()=>manualCamera.change());
  controls.addEventListener('end',()=>manualCamera.end(performance.now()));
  lighting=createInteriorLighting(renderer,scene);
  resize=new ResizeObserver(()=>{renderDemand.invalidate();const w=mount.clientWidth,h=mount.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;if(cleanView(ui.cameraMode)||ui.cameraMode==='home')view(ui.cameraMode,true);camera.zoom=cameraZoom(ui.cameraMode,w/h)*wallZoom;camera.updateProjectionMatrix();hud.size(w,h);selfMap.size(w,h);objectPanel.size(w,h)});resize.observe(mount);last=performance.now();raf=requestAnimationFrame(frame);
  const [a,b]=await Promise.all([fetch('/api/state'),fetch('/api/catalog')]);if(!a.ok||!b.ok)throw Error('暂时没能读到房间，请刷新重试。');const state=await a.json();let catalog=await b.json();furnitureAssets=catalog.assets||{};roomCatalog=catalog.furniture;roomObjects=state.objects;roomSpec=roomDimensions(state.room);
  rugs=state.objects.filter(o=>o.kind==='rug');nav=createNavigation(state.objects,catalog.furniture,{assets:catalog.assets,room:state.room});
  let start={x:state.character.x,z:state.character.z,yaw:state.character.yaw};if(!nav.free(start)){const nearest=nav.nodes.reduce((a,b)=>Math.hypot(a.x-start.x,a.z-start.z)<Math.hypot(b.x-start.x,b.z-start.z)?a:b);start={...nearest,yaw:0}}
  walker=createWalker(nav,start);walker.setBrisk(ui.brisk);
  room=createPreviewRoom(scene,{renderer,batchStatic:!continuousBaseline,onChange:()=>renderDemand.invalidate()});await room.update(state.objects,catalog.assets,state.room);lighting.update(state.objects,catalog.assets,state.room);await room.setFinish(state.room);layoutKey=JSON.stringify([state.objects,roomDimensions(state.room)]);navKey=navigationKey(state.objects,state.room);roomRevision=state.revision;
  marker=new T.Mesh(new T.RingGeometry(.09,.12,40),new T.MeshBasicMaterial({color:'#789d83',side:T.DoubleSide}));marker.rotation.x=-Math.PI/2;marker.visible=false;scene.add(marker);
  const gltf=await new GLTFLoader().loadAsync('/models/dafeiyu-contact.glb?v=brows-4a347b12');const model=gltf.scene;characterModel=model;usePaintedCharacter(model);sleepFace=createSleepFace(model);model.traverse(o=>{if(o.userData.sleep_eye)o.visible=false});model.updateMatrixWorld(true);
  const box=new T.Box3().setFromObject(model),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());scale=1.3/size.y;
  const normalized=new T.Group();normalized.scale.setScalar(scale);model.position.set(-center.x,-box.min.y,-center.z);normalized.add(model);avatar=new T.Group();avatar.rotation.order='YXZ';avatar.add(normalized);waterPose=createWaterPose(scene,model,avatar);glance=sofaGlance(model,normalized);avatar.position.set(start.x,groundHeight(start.x,start.z),start.z);avatar.rotation.y=start.yaw;scene.add(avatar);readingBook=createReadingBook(scene);
  mixer=new T.AnimationMixer(model);const clip=gltf.animations.find(a=>a.name==='little-walk'),idle=gltf.animations.find(a=>a.name==='rest'),running=gltf.animations.find(a=>a.name==='little-run');if(!clip||!idle||!running)throw Error('小碎步动作没有载入完整。');
  walk=mixer.clipAction(clip).play();run=mixer.clipAction(running).play();run.setEffectiveWeight(0);rest=mixer.clipAction(idle).play();walk.setEffectiveWeight(0);mixer.update(0);
  sitAction=mixer.clipAction(gltf.animations.find(c=>c.name==='sit-pose')).play();sleepAction=mixer.clipAction(gltf.animations.find(c=>c.name==='sleep-pose')).play();sitAction.setEffectiveWeight(0);sleepAction.setEffectiveWeight(0);
  readAction=mixer.clipAction(gltf.animations.find(c=>c.name==='read-pose')).play();readAction.setEffectiveWeight(0);
  motion=createSecondaryMotion(model);floorPlay=createFloorPlay(model,avatar);drawingPose=createDrawingPose(scene,model,avatar);
  interaction=createObjectInteraction({context:()=>({walker,nav,objects:roomObjects,assets:furnitureAssets,catalog:catalog.furniture,room:roomSpec,groundHeight}),onStart:()=>{setAuto(false);ui.paused=false;marker.visible=false},onExit:p=>{walker=createWalker(nav,p);walker.setBrisk(ui.brisk);setAuto(false);avatar.rotation.x=0;ui.status='站稳啦'},onStatus:s=>{ui.status=s},report:async(id,body)=>{const r=await ownerFetch(`/api/interactions/${id}/progress`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,viewer_session:viewerSession})});if(!r.ok){const b=await r.json();throw Error(b.error)}}});
  if(spectator){interaction={phase:'none',busy:false,frame:null};
    let serial='';
    const subscribe=()=>{
      feed?.close();if(disposed||document.hidden)return;
      feed=new EventSource('/api/runtime/stream');
      feed.onmessage=e=>{const packet=JSON.parse(e.data);playback.push(packet,performance.now(),e.data!==serial);if(e.data!==serial){remoteDirty=true;serial=e.data}};
      feed.onerror=()=>{perf.add('reconnects');ui.status='等待家里的 Runner 连接…'};
    };
    subscribe();document.addEventListener('visibilitychange',subscribe);window.addEventListener('pagehide',()=>document.removeEventListener('visibilitychange',subscribe),{once:true});

  }
  function menu(id=null,hover=null){ui.menuId=id;ui.menuHover=hover}
  function choose(id,value){
   menu();if(!selectable(id,ui))return;
   if(id==='camera'){view(value,true);return}
   if(value===selectedChoice(id,ui))return;
   if(id==='sound'){toggleSound().catch(()=>{ui.sound=false;ui.status='暂时无法播放声音'});return}
   if(spectator){
    if(id==='auto')command('set_activity',{activity:value==='wander'?'walk':'idle'}).catch(failNotice);
    else post('/api/runtime/control',id==='pause'?{paused:value==='paused'}:{brisk:value==='brisk'}).then(r=>{if(!r.ok)throw Error('Runner 尚未就绪')}).catch(failNotice);
   }else if(id==='auto'){if(ui.lifePlan&&['running','paused'].includes(ui.lifePlan.status))command('set_activity',{activity:value==='wander'?'walk':'idle'}).catch(failNotice);else setAuto(value==='wander')}
   else if(id==='pause')ui.paused=value==='paused';
   else if(id==='speed')setBrisk(value==='brisk');
  }
  function activate(id,shortcut=false){
   invalidateBody();
   if(!ui.ready)return;
   if(selectable(id,ui)){
    if(!shortcut||id==='camera')menu(id,selectedChoice(id,ui));
    else choose(id,toolbarChoices[id].find(([v])=>v!==selectedChoice(id,ui))[0]);
    return;
   }
   menu();
   if(id==='life-toggle'||id==='life-cancel'){
    command('control_life_plan',{action:id==='life-cancel'?'cancel':ui.lifePlan?.status==='paused'?'resume':'pause'}).catch(failNotice);return;
   }
   if(id==='album'){view('album',true);return}
   if(id==='items'){selfMap.close();objectPanel.activate('toggle');return}
   if(id==='self-map'){if(objectPanel.open)objectPanel.activate('toggle');selfMap.toggle();return}
   if(id==='auto'&&interaction.busy&&interaction.phase!=='leaving')objectCommand(interaction.targetId,'leave');
  }
  const canvas=renderer.domElement;
  canvas.addEventListener('pointerdown',e=>{invalidateBody();canvas.focus({preventScroll:true});if(cleanView(ui.cameraMode)){pointer={x:e.clientX,y:e.clientY};return}const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;pointer=null;
   if(ui.menuId){const id=hud.hit(x,y),hit=hud.menuHit(ui.menuId,x,y);
    e.stopImmediatePropagation();e.preventDefault();
    if(hit?.startsWith('choice:'))choose(ui.menuId,hit.slice(7));
    else if(id)activate(id);else if(!hit)menu();
    return;
   }
   const panelHit=objectPanel.hit(x,y);if(panelHit){e.stopImmediatePropagation();e.preventDefault();if(panelHit.enabled){if(panelHit.id.startsWith('action:')){const [,target,action]=panelHit.id.split(':');objectCommand(decodeURIComponent(target),action)}else objectPanel.activate(panelHit.id)}return}const mapHit=selfMap.hit(e.clientX-r.left,e.clientY-r.top);if(mapHit){e.stopImmediatePropagation();e.preventDefault();if(mapHit==='self-map-toggle')activate('self-map');return}const id=hud.hit(e.clientX-r.left,e.clientY-r.top);if(id){e.stopImmediatePropagation();e.preventDefault();activate(id);return}pointer={x:e.clientX,y:e.clientY}},true);
  canvas.addEventListener('pointerup',e=>{if(cleanView(ui.cameraMode)){if(pointer&&Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)<5)view('home',true);pointer=null;return}const r=canvas.getBoundingClientRect();if(objectPanel.hit(e.clientX-r.left,e.clientY-r.top)||selfMap.hit(e.clientX-r.left,e.clientY-r.top)||hud.hit(e.clientX-r.left,e.clientY-r.top)){pointer=null;return}pick(e);pointer=null},true);
  canvas.addEventListener('pointercancel',()=>{pointer=null});
  canvas.addEventListener('pointermove',e=>{if(cleanView(ui.cameraMode)){canvas.style.cursor='default';return}const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,id=hud.hit(x,y);
   if(e.pointerType!=='touch'&&!e.buttons&&ui.ready&&!objectPanel.open&&!selfMap.open){
    const entry=ui.menuId&&hud.menuHit(ui.menuId,x,y);
    menu(selectable(id,ui)?id:entry?ui.menuId:null,entry?.startsWith('choice:')?entry.slice(7):null);
   }
   canvas.style.cursor=(id||ui.menuId||selfMap.hit(x,y)||objectPanel.hit(x,y))?'pointer':'grab'});
  canvas.addEventListener('pointerleave',()=>menu());
  canvas.addEventListener('keydown',e=>{
   if(ui.menuId){
    const choices=toolbarChoices[ui.menuId],current=ui.menuHover||selectedChoice(ui.menuId,ui),i=choices.findIndex(([id])=>id===current),cols=ui.menuId==='camera'?2:1;
    const d={ArrowUp:-cols,ArrowDown:cols,ArrowLeft:-1,ArrowRight:1}[e.code];
    if(d){menu(ui.menuId,choices[Math.max(0,Math.min(choices.length-1,i+d))][0]);e.preventDefault();return}
    if(e.code==='Enter'){choose(ui.menuId,current);e.preventDefault();return}
    if(e.code==='Escape'||(e.code==='KeyV'&&ui.menuId==='camera')){menu();e.preventDefault();return}
   }
   if(cleanView(ui.cameraMode)){if(['Escape','KeyV','KeyG'].includes(e.code)){e.preventDefault();view('home',true)}return}const id={Space:'pause',KeyA:'auto',KeyF:'speed',KeyV:'camera',KeyM:'sound',KeyI:'items',KeyP:'self-map',KeyG:'album'}[e.code];if(id){e.preventDefault();activate(id,true)}});
  consumeControls(null,state);let received=state;
  // Poll state only while viewed; no rendering service or model call is needed.
  async function syncRoom(){
   try{
    if(isRunner||!document.hidden){
     const response=await fetch('/api/state');if(!response.ok)throw Error('暂时连不上小家');
     const next=await response.json(),dimensionsChanged=JSON.stringify(roomSpec)!==JSON.stringify(roomDimensions(next.room)),key=JSON.stringify([next.objects,roomDimensions(next.room)]);roomObjects=next.objects;roomSpec=roomDimensions(next.room);
     if(key!==layoutKey){
      if(next.objects.some(o=>o.asset_id&&!catalog.assets?.[o.asset_id])){const response=await fetch('/api/catalog');if(!response.ok)throw Error('家具目录暂时不可用');catalog=await response.json();furnitureAssets=catalog.assets||{};roomCatalog=catalog.furniture}
      const shapeChanged=navigationKey(next.objects,next.room)!==navKey;
      const nextNav=shapeChanged?createNavigation(next.objects,catalog.furniture,{assets:catalog.assets,room:next.room}):nav;
      if(!nextNav.nodes.length)throw Error('家具太满了，留一块走路的地方吧');
      await room.update(next.objects,catalog.assets,next.room);if(outdoorState)room.setOutdoors(outdoorState);invalidateBody();lighting.update(next.objects,catalog.assets,next.room);if(disposed)return;
      if(shapeChanged){const old=walker.state;let position={x:old.x,z:old.z,yaw:old.yaw};
      if(!nextNav.free(position))position={...nextNav.nodes.reduce((a,b)=>Math.hypot(a.x-old.x,a.z-old.z)<Math.hypot(b.x-old.x,b.z-old.z)?a:b),yaw:old.yaw};
      nav=nextNav;walker=createWalker(nav,position);walker.setBrisk(ui.brisk);walker.setAutonomous(ui.auto);lastSteps=0;marker.visible=false;}
      navKey=navigationKey(next.objects,next.room);rugs=next.objects.filter(o=>o.kind==='rug');layoutKey=key;captureNotBefore=performance.now()+450;
     }
     const p=next.life_plan;ui.lifePlan=p?{title:p.title,status:p.status,label:p.steps[p.index]?.label,wait_reason:p.wait_reason}:null;
     await room.setFinish(next.room);if(next.revision!==roomRevision)renderDemand.invalidate();if(dimensionsChanged&&['home','broadcast','album'].includes(ui.cameraMode))view(ui.cameraMode,true);
     if(!spectator){const heartbeat=await ownerFetch('/api/viewer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...feedbackEnvelope(viewerSession,bodySnapshot(avatar,walker,interaction,ui.paused),interaction,true,ui.paused),job_id:interaction.jobId===next.interaction?.id?interaction.jobId:null})});
     if(!heartbeat.ok){const detail=await heartbeat.text();throw Error(`身体反馈暂时没同步 (${heartbeat.status}): ${detail}`)}controller=(await heartbeat.json()).controller;if(!controller){ui.notice='小家正在另一个窗口里运行。';noticeUntil=performance.now()+2000}}
     consumeControls(received,next);if(controller){const previousJob=interaction.jobId;interaction.consume(next.interaction);if(previousJob!==interaction.jobId)invalidateBody()}const objectResponse=await fetch('/api/objects');if(objectResponse.ok){const data=await objectResponse.json();if(objectPanel.open&&JSON.stringify(data)!==JSON.stringify(objectData))renderDemand.invalidate();objectData=data}received=next;roomRevision=next.revision;ui.error='';
     if(!spectator){const shots=await ownerFetch('/api/screenshots/pending?viewer=life-v2');if(!shots.ok)throw Error('拍照请求暂时不可用');
     const shot=await shots.json();
     if(shot.id&&ui.ready&&controller&&performance.now()>=captureNotBefore){const shotStart=performance.now();if(isRunner){applyRunnerCapture();room.updateView(camera.position,roomViewOptions(ui.cameraMode));room.tickScreens(Math.max(0,(performance.now()-lastShotAt)/1000),camera);lastShotAt=performance.now();perf.add('screenshots')}renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);
      if(!cleanView(ui.cameraMode)){hud.update(ui);hud.render(renderer);selfMap.render(renderer);objectPanel.update(objectData);objectPanel.render(renderer)}
      const blob=shot.view==='character'?await captureCharacterView({renderer,scene,avatar,pose:bodySnapshot(avatar,walker,interaction,ui.paused).pose,book:readingBook.position,toy:drawingPose.focus||floorPlay.lookAt,room,gazeYaw:glance?.yaw,sofaSide:interaction.frame?.sofa,spectatorCamera:camera,spectatorOptions:roomViewOptions(ui.cameraMode)}):await capturePng(renderer.domElement);const uploaded=await ownerFetch(`/api/screenshots/${shot.id}`,{method:'POST',headers:{'Content-Type':'image/png','X-House-Viewer':'life-v2'},body:blob});renderDemand.invalidate();perf?.add('capture_ms',performance.now()-shotStart);if(!uploaded.ok)throw Error('照片暂时没存好')}}
    }
   }catch(e){perf?.add('sync_errors');runtimeFault('syncRoom',e);ui.error='布置暂时没能更新，请稍后重试';console.warn(e)}
   if(!disposed)syncTimer=setTimeout(syncRoom,1200);
  }
  async function syncOutdoors(){try{if(isRunner||!document.hidden){const res=await fetch('/api/outdoors');if(res.ok&&!disposed){const value=await res.json();if(!disposed&&(value.weather!==outdoorState?.weather||value.daylight!==outdoorState?.daylight)){outdoorState=value;room.setOutdoors(value);lighting.setOutdoors(value);renderDemand.invalidate();renderer.shadowMap.needsUpdate=true}}}}catch(e){console.warn('窗外天气暂时无法更新',e)}if(!disposed)outdoorTimer=setTimeout(syncOutdoors,60000)}
  void syncOutdoors();syncTimer=setTimeout(syncRoom,1200);
  invalidateBody();ui.ready=true;ui.status='点空地走过去，拖动转一转';
 }catch(e){ui.error=e.message;hud?.update(ui);if(isRunner)post('/api/runtime/fault',{message:e.message}).catch(()=>{})}}
window.addEventListener('pagehide',()=>{disposed=true;clearTimeout(outdoorTimer);clearTimeout(syncTimer);cancelAnimationFrame(raf);if(isRunner)clearTimeout(raf);feed?.close();perf?.dispose();resize?.disconnect();controls?.dispose();audio?.close();hud?.dispose();selfMap?.dispose();objectPanel?.dispose();sleepFace?.dispose();readingBook?.dispose();drawingPose?.dispose();floorPlay?.dispose();waterPose?.dispose();room?.dispose();lighting?.dispose();scene?.traverse(o=>{o.geometry?.dispose();for(const m of [].concat(o.material||[]))m.dispose()});renderer?.dispose()},{once:true});
init();
