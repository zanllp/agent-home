import {Color} from 'three';
// Replace eye paint on the SAME skinned surface. No skin caps / depth fighting.
export function createSleepFace(root){
 const amount={value:0},left={value:new Color('#f8e0d5')},right={value:new Color('#f7dfd3')},materials=[];
 root.traverse(o=>{if(!o.isMesh||!o.name.startsWith('HeadHair'))return;
  function decorate(source){const material=source.clone();materials.push(material);material.customProgramCacheKey=()=> 'sleep-face-v1';
   material.onBeforeCompile=shader=>{
    shader.uniforms.uNapAmount=amount;shader.uniforms.uNapSkinL=left;shader.uniforms.uNapSkinR=right;
    shader.vertexShader='varying vec3 vNapLocal;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvNapLocal = vec3(position.x, -position.z, position.y);');
    shader.fragmentShader='varying vec3 vNapLocal;\nuniform float uNapAmount;\nuniform vec3 uNapSkinL;\nuniform vec3 uNapSkinR;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
     vec2 qL=(vNapLocal.xz-vec2(0.042,0.674))/vec2(0.044,0.046);
     vec2 qR=(vNapLocal.xz-vec2(-0.066,0.666))/vec2(0.044,0.046);
     float faceDepth=smoothstep(-0.183,-0.166,vNapLocal.y);
     float l=(1.0-smoothstep(0.78,1.0,length(qL)))*faceDepth;
     float r=(1.0-smoothstep(0.78,1.0,length(qR)))*faceDepth;
     diffuseColor.rgb=mix(diffuseColor.rgb,uNapSkinL,l*uNapAmount);
     diffuseColor.rgb=mix(diffuseColor.rgb,uNapSkinR,r*uNapAmount);
    `);
   };return material}
  o.material=Array.isArray(o.material)?o.material.map(decorate):decorate(o.material);
 });
 return {update(value){amount.value=Math.max(0,Math.min(1,(value-.45)/.55))},dispose(){materials.forEach(m=>m.dispose())}};
}
