import * as T from 'three';
import {createReadingBook} from '../../house3d/web/reading-book.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createSleepFace} from '../../house3d/web/sleep-face.js';
import manifest from './manifest.json';
import {makeGarment} from './garments.js';
import {tryOn,rebindPack} from '../../house3d/web/outfit-fit.js';
import {usePaintedCharacter} from '../../house3d/web/character-material.js';
import {loadSwatches} from './paint.js';
const author=new URLSearchParams(location.search).has("author");if(author)await loadSwatches();
const file='/house3d/assets/dafeiyu-contact.glb',loader=new GLTFLoader(),gltf=await loader.loadAsync(file),base=gltf.scene;
usePaintedCharacter(base,{cleanHands:true});const sleepFace=createSleepFace(base);base.traverse(o=>{if(o.userData.sleep_eye)o.visible=false});
const canvas=document.querySelector('canvas'),renderer=new T.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(2);
const scene=new T.Scene();scene.background=new T.Color('#eeeae3');scene.add(base);
const camera=new T.OrthographicCamera(-.55,.55,1.03,-.04,.01,20);camera.position.set(0,0,3);camera.lookAt(0,0,0);
const controls=new OrbitControls(camera,canvas);camera.top=.54;camera.bottom=-.54;controls.target.set(0,.49,0);camera.position.set(0,.49,3);controls.update();
const mixer=new T.AnimationMixer(base);let current,action;const rack=new Map();
for(const {id,file,task} of manifest.outfits)rack.set(id,author&&!task?makeGarment(base,id):rebindPack(base,(await loader.loadAsync(new URL(file,location.href).href)).scene));

// Reuse actual home props, shown only for the relevant fitting pose.
const chair=(await loader.loadAsync('/house3d/assets/furniture/whale-chair-v1.glb')).scene;
usePaintedCharacter(chair);chair.scale.setScalar(.978/1.3);chair.position.z=-.09*.978/1.3;scene.add(chair);chair.visible=false;
const bookHolder=new T.Group();scene.add(bookHolder);createReadingBook(bookHolder);
const book=bookHolder.children[0],hands=['Left','Right'].map(s=>base.getObjectByName('mixamorig'+s+'Hand')),v=new T.Vector3(),u=new T.Vector3();
scene.add(new T.HemisphereLight(0xfffcf5,0xd0c7bd,2.2));
function props(name){
 chair.visible=name==='sit-pose';
 book.visible=name==='hold-book';
 if(book.visible){book.scale.setScalar(.57);hands[0].getWorldPosition(u);hands[1].getWorldPosition(v);
 book.position.copy(u).lerp(v,.5);book.position.y+=.033;book.position.z+=.027;book.rotation.x=-1.04}
}
function draw(){const w=canvas.clientWidth,h=canvas.clientHeight;if(canvas.width!==w*renderer.getPixelRatio()||canvas.height!==h*renderer.getPixelRatio())renderer.setSize(w,h,false);camera.left=-.54*w/h;camera.right=.54*w/h;camera.updateProjectionMatrix();renderer.render(scene,camera)}
let orbiting=false;
controls.addEventListener('change',()=>{if(!orbiting)draw()});new ResizeObserver(draw).observe(canvas);
const outfit=document.querySelector('#outfit'),pose=document.querySelector('#pose');
for(const {id,label} of manifest.outfits)outfit.add(new Option(label+' · Tripo',id));
outfit.value='moon-tide';
for(const clip of gltf.animations)pose.add(new Option(({'rest':'垂手','hold-book':'抱书','sit-pose':'坐下','little-run':'小跑'})[clip.name]||clip.name,clip.name));pose.value='rest';
function dress(id){current?.remove();current=id==='reference'?null:tryOn(base,rack.get(id),Boolean(manifest.outfits.find(o=>o.id===id)?.task));outfit.value=id;if(action)showPose(pose.value,action.time);else draw()}
function showPose(name,time=.5){action?.stop();action=mixer.clipAction(gltf.animations.find(c=>c.name===name));action.play();action.time=time;mixer.update(0);
 current?.group.traverse(cloth=>{const targets=cloth.morphTargetDictionary;if(!targets)return;
  if(targets.SeatedFit!==undefined)cloth.morphTargetInfluences[targets.SeatedFit]=['sit-pose','read-pose'].includes(name)?1:0;
  if(targets.LyingFit!==undefined)cloth.morphTargetInfluences[targets.LyingFit]=name==='sleep-pose'?1:0});
 base.rotation.x=name==='sleep-pose'?-Math.PI/2+.125:0;base.position.set(0,name==='sleep-pose'?.39:0,name==='sleep-pose'?.46:0);
 sleepFace.update(name==='sleep-pose'?1:0);base.traverse(o=>{if(o.userData.sleep_eye)o.visible=name==='sleep-pose'});pose.value=name;props(name);draw()}
const tourPoses=['little-run','hold-book','sit-pose'];
let playing=false,frame,last,tour=null;
function startTour(){
 stop();tour={row:0,seconds:0};controls.target.set(0,.49,0);
 showPose(tourPoses[0],0);orbit(0);playing=true;
 playButton.textContent='暂停';last=performance.now();frame=requestAnimationFrame(tick);
}
controls.addEventListener('start',()=>{tour=null});
const playButton=document.querySelector('#play');
function stop(){tour=null;playing=false;cancelAnimationFrame(frame);playButton.textContent='播放动作'}
function tick(t){if(!playing)return;const dt=Math.min(.1,(t-last)/1000);last=t;
 if(tour){
  tour.seconds+=dt;
  if(tour.seconds>=5){
   tour.seconds-=5;
   if(++tour.row===tourPoses.length){orbit(0);stop();return}
   showPose(tourPoses[tour.row],0);
  }
  orbit(tour.seconds*72,false);
 }
 mixer.update(dt);props(pose.value);draw();frame=requestAnimationFrame(tick)}
playButton.onclick=()=>{if(playing)return stop();playing=true;playButton.textContent='暂停';last=performance.now();frame=requestAnimationFrame(tick)};
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
function orbit(deg,redraw=true){
 const a=deg*Math.PI/180;camera.position.set(3*Math.sin(a),pose.value==='sleep-pose'?2.9:.49,3*Math.cos(a));
 orbiting=true;try{controls.update()}finally{orbiting=false}
 if(redraw)draw();
}
async function exportPack(){
 if(!current)throw Error('Select a garment first');
 const entry=manifest.outfits.find(o=>o.id===outfit.value);
 if(!author||entry.task)return new Uint8Array(await (await fetch(new URL(entry.file,location.href))).arrayBuffer());
 // Export the joint hierarchy and garment only, without shipping the character twice.
 const clean=(await loader.loadAsync(file)).scene,anchor=clean.getObjectByName('Legs'),mesh=current.group.children[0].clone();mesh.bind(anchor.skeleton,anchor.bindMatrix);mesh.morphTargetInfluences=[0];
 const omit=[];clean.traverse(o=>{if(o.isMesh)omit.push(o)});omit.forEach(o=>o.removeFromParent());clean.add(mesh);clean.updateMatrixWorld(true);
 return new Uint8Array(await new GLTFExporter().parseAsync(clean,{binary:true}));
}
document.querySelector('#save').onclick=async()=>{const data=await exportPack(),url=URL.createObjectURL(new Blob([data]));const a=document.createElement('a');a.href=url;a.download=outfit.value+'.glb';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
outfit.onchange=()=>{stop();dress(outfit.value)};pose.onchange=()=>{stop();showPose(pose.value)};
document.querySelector('#tour').onclick=startTour;
const requested=new URLSearchParams(location.search).get('outfit');
dress(rack.has(requested)?requested:outfit.value);showPose('rest');window.review={dress,showPose,orbit,exportPack,wristFrame,clips:gltf.animations.map(c=>c.name)};

// Fixed wrist cameras for repeatable A/B renders. Use the unchanged hand bones
// as tracking points, never the clothing's bounds.
function wristFrame(index, degrees, pitch=9){
 const wrist=hands[index].getWorldPosition(new T.Vector3());
 const sign=index===0?1:-1;
 wrist.x+=.012*sign;wrist.z+=.012;wrist.y-=.005;
 const a=degrees*Math.PI/180,p=pitch*Math.PI/180,aspect=canvas.width/canvas.height;
 const cam=new T.OrthographicCamera(-.088*aspect,.088*aspect,.088,-.088,.01,10);
 cam.position.copy(wrist).add(new T.Vector3(Math.sin(a)*Math.cos(p),Math.sin(p),Math.cos(a)*Math.cos(p)));
 cam.lookAt(wrist);renderer.render(scene,cam);
}
async function proof(){
 stop();const id=outfit.value,old=pose.value,clock=action.time,eye=camera.position.clone(),look=controls.target.clone();
 const sheet=document.createElement('canvas');sheet.width=1680;sheet.height=1260;
 const ctx=sheet.getContext('2d');ctx.fillStyle='#eeeae3';ctx.fillRect(0,0,1680,1260);
 for(const [row,[clip,title]] of [['rest','垂手'],['hold-book','抱书'],['sit-pose','坐下']].entries()){
  showPose(clip,.5);
  for(const [col,deg] of [0,60,180,300].entries()){
   controls.target.set(0,.49,0);orbit(deg);draw();
   const span=canvas.height*.85;ctx.drawImage(canvas,(canvas.width-span)/2,0,span,canvas.height,col*420+40,row*420+8,340,400);
   ctx.fillStyle='#525661';ctx.font='16px system-ui';ctx.fillText(title+'  ·  '+deg+'°',col*420+16,(row+1)*420-10);
  }
 }
 dress(id);showPose(old,clock);controls.target.copy(look);camera.position.copy(eye);controls.update();draw();
 const w=window.open('','wardrobe-proof');if(w){w.document.title=outfit.selectedOptions[0].text+' · 实机环视';w.document.body.style='margin:0;background:#eeeae3';sheet.style='display:block;width:100%;height:auto';w.document.body.replaceChildren(sheet)}
 const a=document.createElement('a');a.download=id+'-tripo-poses.png';a.href=sheet.toDataURL();a.click();
}
document.querySelector('#proof').onclick=proof;

document.querySelector('#spin').onclick=async function(){
 stop();this.disabled=true;
 const old=pose.value,clock=action.time,eye=camera.position.clone(),look=controls.target.clone();
 const tileW=240,tileH=300,atlas=document.createElement('canvas');atlas.width=6*3*tileW;atlas.height=8*tileH;
 const ctx=atlas.getContext('2d');ctx.fillStyle='#eeeae3';ctx.fillRect(0,0,atlas.width,atlas.height);
 try{
  controls.target.set(0,.49,0);
  for(const [k,clip] of ['rest','hold-book','sit-pose'].entries()){
   showPose(clip,.5);
   for(let i=0;i<48;i++){
    orbit(i*360/48);const span=canvas.height*tileW/tileH;
    ctx.drawImage(canvas,(canvas.width-span)/2,0,span,canvas.height,((i%6)*3+k)*tileW,Math.floor(i/6)*tileH,tileW,tileH);
    if(i%6===5)await new Promise(requestAnimationFrame);
   }
  }
  const blob=await new Promise(r=>atlas.toBlob(r)),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=outfit.value+'-turntable.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),10000);
 }finally{showPose(old,clock);controls.target.copy(look);camera.position.copy(eye);controls.update();draw();this.disabled=false;}
};

if(new URLSearchParams(location.search).has('tour'))startTour();

if(new URLSearchParams(location.search).has('audit')){
 const {studioCapture}=await import('./audit/capture.js');
 window.review.capture=studioCapture({base,scene,renderer,showPose});
}
