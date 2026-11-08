import {sunlight,transmission} from './outdoor-scene.js';
import * as T from 'three';
import {windowSunPose} from './room-lighting.js';
import {spaceBounds} from '../shared/space.mjs';
import {LIGHTING} from './wander-state.js';

// Low-resolution local radiance, not a downloaded HDR or a baked scene screenshot.
export function interiorRadiance(width=256,height=128){
 const data=new Float32Array(width*height*4),wall=new T.Color('#b6b8b1'),floor=new T.Color('#a68b6b'),sky=new T.Color('#c6d9ee'),warm=new T.Color('#fff1d9');
 const window=new T.Vector3(-.95,.25,.15).normalize();
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const theta=(y+.5)/height*Math.PI,phi=(x+.5)/width*2*Math.PI-Math.PI,d=new T.Vector3(Math.sin(theta)*Math.cos(phi),-Math.cos(theta),Math.sin(theta)*Math.sin(phi));
  const c=wall.clone().lerp(d.y>0?sky:floor,Math.abs(d.y)*.65).multiplyScalar(.48),opening=Math.pow(Math.max(0,d.dot(window)),32)*3.0;
  c.r+=warm.r*opening;c.g+=warm.g*opening;c.b+=warm.b*opening;const i=(y*width+x)*4;data.set([c.r,c.g,c.b,1],i);
 }
 const texture=new T.DataTexture(data,width,height,T.RGBAFormat,T.FloatType);texture.mapping=T.EquirectangularReflectionMapping;texture.needsUpdate=true;return texture;
}
export function fitSunShadow(sun,room={}){
 const b=spaceBounds(room),h=room.height||2.4;sun.updateMatrixWorld(true);sun.target.updateMatrixWorld(true);sun.shadow.updateMatrices(sun);
 const p=[];for(const x of [b.minX,b.maxX])for(const y of [0,h])for(const z of [b.minZ,b.maxZ])p.push(new T.Vector3(x,y,z).applyMatrix4(sun.shadow.camera.matrixWorldInverse));
 const camera=sun.shadow.camera,pad=.28;
 camera.left=Math.min(...p.map(v=>v.x))-pad;camera.right=Math.max(...p.map(v=>v.x))+pad;camera.bottom=Math.min(...p.map(v=>v.y))-pad;camera.top=Math.max(...p.map(v=>v.y))+pad;
 camera.near=Math.max(.1,Math.min(...p.map(v=>-v.z))-.8);camera.far=Math.max(camera.near+1,Math.max(...p.map(v=>-v.z))+.8);camera.updateProjectionMatrix();sun.shadow.needsUpdate=true;
}
export function createInteriorLighting(renderer,scene){
 renderer.shadowMap.type=T.PCFShadowMap;
 const ambient=new T.HemisphereLight('#e3edfa','#b79c7d',.68),sun=new T.DirectionalLight('#fff0d8',2.15);sun.name='Window-daylight';sun.castShadow=true;
 sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.00008;sun.shadow.normalBias=.008;sun.shadow.radius=2.4;sun.shadow.intensity=.85;
 scene.add(ambient,sun,sun.target);
 const generator=new T.PMREMGenerator(renderer),radiance=interiorRadiance(),environment=generator.fromEquirectangular(radiance);radiance.dispose();generator.dispose();scene.environment=environment.texture;
 let preset='day',wideOpening=false,outdoors={daylight:'day',weather:'unknown'};
 function setPreset(value){preset=value;const p=LIGHTING[value]||LIGHTING.day;scene.background.set(p.sky);const afternoon=wideOpening&&p===LIGHTING.day;ambient.intensity=afternoon ? .63 : p.ambient;sun.intensity=afternoon?4.05:p.sun;sun.shadow.intensity=afternoon?.95:.85;sun.shadow.radius=afternoon?6:2.4;sun.color.set(afternoon?'#ffdbaf':p.sunColor);scene.environmentIntensity=p.environment;renderer.toneMappingExposure=p.exposure;
 const factor=sunlight[outdoors.daylight]*transmission[outdoors.weather];sun.intensity*=factor;
 if(outdoors.daylight==='night')sun.color.set('#98b8de');else if(outdoors.daylight==='dusk')sun.color.set('#ffb078');else if(outdoors.daylight==='morning')sun.color.set('#e0ecfa');}
 setPreset('day');
 return {sun,ambient,setPreset,setOutdoors(next){outdoors=next;setPreset(preset)},update(objects,assets,room){const windows=room?.floorplan&&room.balcony?objects.filter(o=>o.id===room.balcony.door_id):objects;const pose=windowSunPose(windows,assets);sun.position.set(...pose.position);sun.target.position.set(...pose.target);const window=windows.find(o=>assets[o.asset_id]?.wall_opening);wideOpening=(assets[window?.asset_id]?.wall_opening?.width||0)>3;scene.environmentRotation.y=window?window.yaw-Math.PI/2:0;fitSunShadow(sun,room);setPreset(preset)},dispose(){scene.environment=null;environment.dispose();sun.shadow.dispose();scene.remove(ambient,sun,sun.target)}};
}
