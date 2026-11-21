import {Uint8BufferAttribute,MathUtils} from 'three';
import fingerColors from './finger-colors.json' with {type:'json'};
import handFaces from './pajama-mask.json' with {type:'json'};

// Only touch the painted hands, not the sleeves sharing their scan or other
// body parts using the same atlas. Bind-space selection follows all poses.
export function cleanFingerPaint(mesh){
 const match=/^Arm[_.]?([LR])$/.exec(mesh.name);
 if(!match||!mesh.isSkinnedMesh||!mesh.material.map)return;
 const side=match[1],sign=side==='L'?1:-1,x0=sign===1?.186:-.202;
 const g=mesh.geometry,pos=g.attributes.position,hand=new Set(),paint=new Uint8Array(pos.count*4);
 for(const [start,count] of handFaces['Arm.'+side])for(let i=start*3;i<(start+count)*3;i++){
  hand.add(g.index.getX(i));
 }
 const colors=fingerColors['Arm.'+side];let offset=0;
 for(const v of [...hand].sort((a,b)=>a-b)){
  const station=.76*sign*(pos.getX(v)-x0)-.62*(pos.getY(v)-.378)+.18*(pos.getZ(v)-.092);
  for(let k=0;k<3;k++,offset+=2)paint[v*4+k]=parseInt(colors.slice(offset,offset+2),16);
  paint[v*4+3]=Math.round(255*MathUtils.smoothstep(station,.008,.019));
 }
 g.setAttribute('fingerPaint',new Uint8BufferAttribute(paint,4,true));
 const material=mesh.material.clone();mesh.material=material;
 material.customProgramCacheKey=()=>'clean-fingertip-v1';
 material.onBeforeCompile=shader=>{
  shader.vertexShader='attribute vec4 fingerPaint; varying vec4 vFingerPaint;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFingerPaint = fingerPaint;');
  shader.fragmentShader='varying vec4 vFingerPaint;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   // Work in linear color. Healthy peach skin is red-dominant; the ink
   // baked on the finger edges is navy, near-black or desaturated grey.
   vec3 c = diffuseColor.rgb;
   vec3 skin = sRGBTransferEOTF(vec4(vFingerPaint.rgb,1.0)).rgb;
   float cool = 1.0-smoothstep(0.05,0.15,c.r-c.b);
   float lostRed = skin.r-c.r;
   float stain = max(smoothstep(0.055,0.19,lostRed),
                     cool*smoothstep(0.015,0.09,lostRed));
   diffuseColor.rgb = mix(c,skin,stain*vFingerPaint.a);
  `);
 };
}
