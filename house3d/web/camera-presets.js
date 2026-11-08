import {apartment} from '../shared/apartment.mjs';
import {balconyGeometry} from '../shared/space.mjs';
export const CAMERA_PRESETS = [
  ['home', '房间全景'], ['album','全屋留影'], ['broadcast','家庭直播'], ['front', '人物正面'], ['face', '脸部特写'],
  ['companion','家长跟拍'], ['portrait', '斜侧近景'], ['side', '人物侧面'], ['back', '人物背面'], ['top', '房间俯视'],
];
const CHARACTER_VIEWS = {
  front: { offset: [0, .85, 3.1], targetY: .72 },
  face: { offset: [0, 1.1, 1.4], targetY: 1.04 },
  portrait: { offset: [1.7, 1.5, 2.8], targetY: .76 },
  side: { offset: [2.8, .85, 0], targetY: .72 },
  back: { offset: [0, .85, -2.8], targetY: .72 },
};
export function cameraPose(preset, character) {
  if (preset === 'companion') return companionPose(character,[]);
  if (preset === 'broadcast') return broadcastPose();
  if (preset === 'home') return homePose();
  if (preset === 'album') return albumPose();
  if (preset === 'top') return { position: [0, 9.5, .01], target: [0, 0, 0] };
  const view = CHARACTER_VIEWS[preset];
  if (!view) throw new Error(`Unknown camera preset: ${preset}`);
  const [x, y, z] = view.offset;
  const c = Math.cos(character.yaw), s = Math.sin(character.yaw);
  return {
    position: [character.x + c * x + s * z, y, character.z - s * x + c * z],
    target: [character.x, view.targetY, character.z],
  };
}
export function cameraZoom(preset, aspect) {
  if(preset==='broadcast'||preset==='home'||preset==='album')return 1;
  // Portrait views need less empty room around the character on narrow screens.
  return Math.min(1, aspect / (preset==='top' ? 1.2 : .75));
}

// Frame only the silhouette visible from the open corner, not an imaginary closed box.
export const homeFov=23;
export function homePose(room={},aspect=1.6,viewportHeight=800){
 const w=(room.width||6)/2,d=(room.depth||5)/2,h=room.height||2.4;
 const points=[[-w,-.14,-d],[-w,-.14,d],[w,-.14,-d],[w,-.14,d],[-w,h,-d],[-w,h,d],[w,h,-d]];
 const balcony=balconyGeometry(room);
 if(balcony)for(const u of [-balcony.width/2,balcony.width/2]){
  const {x,z}=balcony.point(u,balcony.depth);points.push([x,-.1,z],[x,1.1,z]);
 }
 addAnnexCorners(points,room,h);
 return fitRoom(points,aspect,homeFov,45,24,.96,.94,1-Math.min(.34,156/viewportHeight));
}
// Long lens with no HUD reservation: keep the two inhabited walls and the front
// edge of the floor in frame, rather than fitting invisible exterior balcony rails.
export const albumFov=8;
export function albumPose(room={},aspect=1.6){
 const w=(room.width||6)/2,d=(room.depth||5)/2,h=room.height||2.4;
 const points=[[-w,-.14,-d],[-w,-.14,d],[w,-.14,-d],[w,-.14,d],[-w,h,-d],[-w,h,d],[w,h,-d]];
 addAnnexCorners(points,room,h);
 return fitRoom(points,aspect,albumFov,47,20,.974,.984,.98);
}
function addAnnexCorners(points,room,h){
 for(const z of apartment(room)?.zones.slice(1)||[])for(const x of [z.minX,z.maxX])for(const depth of [z.minZ,z.maxZ])points.push([x,-.14,depth],[x,h,depth]);
}
function fitRoom(points,aspect,fov,azimuth,elevation,side,top,bottom){
 const az=azimuth*Math.PI/180,pitch=elevation*Math.PI/180,sa=Math.sin(az),ca=Math.cos(az),sp=Math.sin(pitch),cp=Math.cos(pitch);
 const right=[ca,0,-sa],up=[-sa*sp,cp,-ca*sp],eye=[sa*cp,sp,ca*cp];
 const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],slope=Math.tan(fov*Math.PI/360);
 // Each corner constrains both the camera distance and the optical centre.
 function interval(axis,lo,hi){
  const high=Math.max(...points.map(p=>dot(p,axis)+hi*dot(p,eye)));
  const low=Math.min(...points.map(p=>dot(p,axis)-lo*dot(p,eye)));
  return {minDistance:(high-low)/(hi+lo),center:dist=>(high-hi*dist+low+lo*dist)/2};
 }
 const kx=slope*aspect*side;
 const x=interval(right,kx,kx),y=interval(up,slope*bottom,slope*top);
 const distance=Math.max(x.minDistance,y.minDistance),target=right.map((r,i)=>r*x.center(distance)+up[i]*y.center(distance));
 return {target,position:target.map((v,i)=>v+eye[i]*distance)};
}

// Intersect the sight line with a placed item's oriented box, not the room's navigation footprint.
function crossesFurniture(start,end,box){
 const c=Math.cos(box.yaw),s=Math.sin(box.yaw);
 const local=([x,y,z])=>[(x-box.x)*c-(z-box.z)*s,y-box.base,(x-box.x)*s+(z-box.z)*c];
 const a=local(start),b=local(end),low=[-box.size[0]/2,0,-box.size[1]/2],high=[-low[0],box.height,-low[2]];
 let lo=0,hi=1;
 for(let i=0;i<3;i++){
  const delta=b[i]-a[i];if(Math.abs(delta)<1e-8){if(a[i]<low[i]||a[i]>high[i])return false;continue}
  const t=(low[i]-a[i])/delta,u=(high[i]-a[i])/delta;
  lo=Math.max(lo,Math.min(t,u));hi=Math.min(hi,Math.max(t,u));if(lo>hi)return false;
 }
 return true;
}
export function drawingViewPose(p,yaw,boxes,side=false){
 const forward=[Math.sin(yaw),Math.cos(yaw)],face=[p.x,.98,p.z],page=[p.x+forward[0]*.27,.62,p.z+forward[1]*.27];
 const target=[p.x+forward[0]*.07,.69,p.z+forward[1]*.07];let best,score=Infinity;
 const angles=side?[Math.PI/2,-Math.PI/2,1.74,-1.74,1.36,-1.36]:[-.76,.76,-1.13,1.13,-1.4,1.4];
 const radius=side?1.7:1.78;
 for(const angle of angles){
  const a=yaw+angle,position=[p.x+Math.sin(a)*radius,side?1.28:1.65,p.z+Math.cos(a)*radius];
  let blocked=0;for(const box of boxes){if(crossesFurniture(position,face,box))blocked+=2;if(crossesFurniture(position,page,box))blocked++}
  if(blocked<score){best={position,target};score=blocked;if(!score)break}
 }
 return best;
}

// Frame a seated child together with the things she is using, in the toy set's own orientation.
export function rugPlayViewPose(p,yaw,boxes,portrait=false){
 const c=Math.cos(yaw),s=Math.sin(yaw),base=p.y||0;
 const at=(x,h,z)=>[p.x+x*c+z*s,base+h,p.z-x*s+z*c];
 const targets=[at(0,.73,0),at(0,.36,.16),at(-.24,.15,.48),at(.30,.025,.48)];
 const angles=portrait?[.78,-.78,1.02,-1.02,.53,-.53]:[.25,-.25,.48,-.48,.76,-.76,0];
 let best,score=Infinity;
 for(const a of angles){
  const r=portrait?2.18:2.36,position=at(Math.sin(a)*r,portrait?1.23:1.35,Math.cos(a)*r);
  const blocked=targets.reduce((n,t,i)=>n+boxes.filter(b=>crossesFurniture(position,t,b)).length*(i<2?3:1),0);
  if(blocked<score){score=blocked;best={position,target:at(-.035,.43,.16)};if(!score)break}
 }
 return best;
}

// A fixed indoor camera, with a natural horizon and some ceiling in view.
export const broadcastFov=56;
export function broadcastPose(room={},aspect=1.6){
 const w=room.width||6,d=room.depth||5,h=room.height||2.4;
 const position=[w/2-.22,h-.36,d/2-.22];
 const dx=-w*(aspect<1?.63:.55),dz=-d*.66,length=Math.hypot(dx,dz);
 const pitch=19*Math.PI/180;
 return {position,target:[position[0]+dx/length*3,position[1]-Math.tan(pitch)*3,position[2]+dz/length*3]};
}

// Keep a world-space shoulder rather than orbiting every time the child turns.
// Try the last shoulder first. A doorway or a tall chair can force a new one.
export function companionPose(p,boxes,previous,zone){
 const floor=p.y||0,target=[p.x,floor+.65,p.z];
 const angle=previous?.angle??.92;
 let best,score=Infinity;
 for(const radius of [2.15,1.7,1.38])for(const step of [0,1,-1,2,-2,3,-3,4,-4,5,-5,6]){
  const a=angle+step*Math.PI/6,position=[p.x+radius*Math.sin(a),1.6,p.z+radius*Math.cos(a)];
  const outside=zone&&(position[0]<zone.minX+.16||position[0]>zone.maxX-.16||position[2]<zone.minZ+.16||position[2]>zone.maxZ-.16);
  const loss=companionObstruction(p,position,boxes)+(outside ? .5 : 0);
  if(loss<score){best={position,target,angle:a,loss};score=loss;if(!loss)return best}
 }
 return best;
}
export function companionObstruction(p,eye,boxes){
 let loss=0;
 for(const [height,weight] of [[1.12,4],[.7,2],[.10,1]]){
  const end=[p.x,(p.y||0)+height,p.z];
  if(boxes.some(b=>crossesFurniture(eye,end,b)))loss+=weight;
 }
 return loss;
}
