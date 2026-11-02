import * as T from 'three';
import {spaceBounds} from '../shared/space.mjs';

export function contactBounds(room={}){const b=spaceBounds(room),pad=.12;return {x:(b.minX+b.maxX)/2,z:(b.minZ+b.maxZ)/2,width:b.maxX-b.minX+pad*2,depth:b.maxZ-b.minZ+pad*2}}
// Captured only when the layout changes. This is local floor occlusion, not GI.
export function createContactShadows(renderer,scene){
 const size=1024,target=new T.WebGLRenderTarget(size,size),scratch=new T.WebGLRenderTarget(size,size,{depthBuffer:false});
 const depth=new T.ShaderMaterial({side:T.DoubleSide,blending:T.NoBlending,uniforms:{height:{value:.32}},vertexShader:'varying float worldHeight;void main(){vec4 p=modelMatrix*vec4(position,1.);worldHeight=p.y;gl_Position=projectionMatrix*viewMatrix*p;}',fragmentShader:'varying float worldHeight;uniform float height;void main(){if(worldHeight<0.0||worldHeight>height)discard;float a=.48*exp(-worldHeight*9.);gl_FragColor=vec4(0.,0.,0.,a);}'});
 const blur=new T.ShaderMaterial({depthTest:false,depthWrite:false,blending:T.NoBlending,uniforms:{inputMap:{value:null},step:{value:new T.Vector2()}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'varying vec2 vUv;uniform sampler2D inputMap;uniform vec2 step;void main(){vec4 c=texture2D(inputMap,vUv)*.227027;c+=(texture2D(inputMap,vUv+step*1.384615)+texture2D(inputMap,vUv-step*1.384615))*.316216;c+=(texture2D(inputMap,vUv+step*3.230769)+texture2D(inputMap,vUv-step*3.230769))*.070270;gl_FragColor=c;}'});
 const quad=new T.Mesh(new T.PlaneGeometry(2,2),blur),blurScene=new T.Scene(),blurCamera=new T.Camera();blurScene.add(quad);
 const material=new T.MeshBasicMaterial({map:target.texture,transparent:true,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const plane=new T.Mesh(new T.PlaneGeometry(1,1),material);plane.name='Furniture-floor-contact';plane.rotation.x=-Math.PI/2;plane.renderOrder=1;plane.visible=false;scene.add(plane);
 const camera=new T.OrthographicCamera();
 return {plane,update(furniture,room){
  const b=contactBounds(room);plane.position.set(b.x,.008,b.z);plane.scale.set(b.width,b.depth,1);
  camera.left=-b.width/2;camera.right=b.width/2;camera.top=b.depth/2;camera.bottom=-b.depth/2;camera.near=.001;camera.far=.34;camera.position.set(b.x,.34,b.z);camera.up.set(0,0,-1);camera.lookAt(b.x,0,b.z);camera.updateProjectionMatrix();
  const capture=new T.Scene(),copy=new T.Group();for(const item of furniture.children)if(item.position.y<.32&&!item.userData.isRug)copy.add(item.clone(true));copy.traverse(o=>{if(o.isMesh){o.material=depth;o.castShadow=false;o.receiveShadow=false}else if(o.isLight||o.isSprite||o.name==='Pick-up-robot')o.visible=false});capture.add(copy);
  const previous={target:renderer.getRenderTarget(),color:renderer.getClearColor(new T.Color()),alpha:renderer.getClearAlpha(),autoClear:renderer.autoClear,shadow:renderer.shadowMap.enabled,viewport:renderer.getViewport(new T.Vector4()),scissor:renderer.getScissor(new T.Vector4()),scissorTest:renderer.getScissorTest()};
  try{
   renderer.shadowMap.enabled=false;renderer.autoClear=true;renderer.setScissorTest(false);renderer.setClearColor(0x000000,0);renderer.setRenderTarget(target);renderer.clear();renderer.render(capture,camera);
   for(const radius of [1.3,.65])for(const horizontal of [true,false]){blur.uniforms.inputMap.value=horizontal?target.texture:scratch.texture;blur.uniforms.step.value.set(horizontal?radius/size:0,horizontal?0:radius/size);renderer.setRenderTarget(horizontal?scratch:target);renderer.clear();renderer.render(blurScene,blurCamera)}
   plane.visible=true;
  }finally{renderer.setRenderTarget(previous.target);renderer.setClearColor(previous.color,previous.alpha);renderer.autoClear=previous.autoClear;renderer.shadowMap.enabled=previous.shadow;renderer.setViewport(previous.viewport);renderer.setScissor(previous.scissor);renderer.setScissorTest(previous.scissorTest);capture.clear()}
 },setLighting(preset){material.opacity={day:.72,evening:.68,night:.40}[preset]??.72},dispose(){scene.remove(plane);plane.geometry.dispose();material.dispose();quad.geometry.dispose();blur.dispose();depth.dispose();target.dispose();scratch.dispose()}};
}
