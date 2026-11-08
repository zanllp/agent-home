import * as T from 'three';
import {capturePng} from './capture.js';
// Offscreen body-level vision; never switch the owner's visible camera.
export async function captureCharacterView({renderer,scene,avatar,pose,book,toy,room,spectatorCamera,spectatorOptions}){
 const width=960,height=720,canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');
 if(pose==='sleep'){context.fillStyle='#12131b';context.fillRect(0,0,width,height);return capturePng(canvas)}
 const camera=new T.PerspectiveCamera(pose==='read'?65:75,width/height,['draw','read'].includes(pose)?.12:.025,15),eye=new T.Vector3(0,pose==='play'?.57:pose==='draw'?.90:['sit','read'].includes(pose)?.78:.9,pose==='draw'?.21:.16);avatar.updateMatrixWorld(true);avatar.localToWorld(eye);camera.position.copy(eye);
 const target=['draw','play'].includes(pose)&&toy?toy:pose==='read'&&book?book.clone():new T.Vector3(Math.sin(avatar.rotation.y),pose==='play'?-.57:-.03,Math.cos(avatar.rotation.y)).add(eye);camera.lookAt(target);camera.updateMatrixWorld();
 const hidden=[];avatar.traverse(o=>{if(o.isMesh&&(o.name.startsWith('HeadHair')||o.name==='Hair'||o.userData.sleep_eye||(pose==='draw'&&(!/Arm[. _]?[LR]|Legs|Tail/i.test(o.name+' '+o.parent?.name)||/TorsoSeam/i.test(o.name+' '+o.parent?.name))))){hidden.push([o,o.visible]);o.visible=false}});
 const renderTarget=new T.WebGLRenderTarget(width,height,{stencilBuffer:true}),previous=renderer.getRenderTarget();renderTarget.texture.colorSpace=T.SRGBColorSpace;
 try{room.updateView(camera.position,{cutaway:false});room.tickScreens?.(0,camera);renderer.setRenderTarget(renderTarget);renderer.shadowMap.needsUpdate=true;renderer.clear();renderer.render(scene,camera);const pixels=new Uint8Array(width*height*4);renderer.readRenderTargetPixels(renderTarget,0,0,width,height,pixels);const data=context.createImageData(width,height);for(let row=0;row<height;row++)data.data.set(pixels.subarray((height-1-row)*width*4,(height-row)*width*4),row*width*4);context.putImageData(data,0,0)}finally{renderer.setRenderTarget(previous);renderTarget.dispose();hidden.forEach(([o,v])=>o.visible=v);room.updateView(spectatorCamera.position,spectatorOptions);renderer.shadowMap.needsUpdate=true}
 return capturePng(canvas);
}
