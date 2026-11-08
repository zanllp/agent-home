import * as T from 'three';
import {spaceBounds} from '../shared/space.mjs';

export function contactBounds(room={}){const b=spaceBounds(room),pad=.12;return {x:(b.minX+b.maxX)/2,z:(b.minZ+b.maxZ)/2,width:b.maxX-b.minX+pad*2,depth:b.maxZ-b.minZ+pad*2}}
// Resolve direct children on a dining surface (including a placemat on the table).
export function diningReceivers(objects,assets){
 const foodSurfaces=new Set(objects.filter(o=>o.kind==='dining_table'||o.kind==='coffee_table').map(o=>o.id));
 for(const o of objects)if(o.on&&foodSurfaces.has(o.on.id)&&assets[o.asset_id]?.surfaces?.top)foodSurfaces.add(o.id);
 return objects.filter(o=>foodSurfaces.has(o.id)).flatMap(item=>{
  const surface=assets[item.asset_id]?.surfaces?.top,children=objects.filter(c=>c.on?.id===item.id&&c.on.surface==='top');
  return surface&&children.length?[{item,surface,children}]:[];
 });
}
export function mediaReceivers(objects,assets){
 return objects.filter(o=>o.kind==='media_console').flatMap(item=>Object.entries(assets[item.asset_id]?.surfaces||{}).flatMap(([name,surface])=>{
  const children=objects.filter(o=>o.on?.id===item.id&&o.on.surface===name);
  return children.length?[{item,surface,children,level:name}]:[];
 }));
}
// Only flat tabletops; a desk may also expose hooks that are not horizontal receivers.
export function worktopReceivers(objects,assets){
 return objects.filter(o=>o.kind==='desk'||o.kind==='sideboard').flatMap(item=>{
  const surface=assets[item.asset_id]?.surfaces?.top;
  const children=objects.filter(o=>o.on?.id===item.id&&o.on.surface==='top');
  return surface&&children.length?[{item,surface,children}]:[];
 });
}
function sofaReceivers(objects,assets){
 return objects.filter(o=>o.kind==='sofa'&&assets[o.asset_id]?.surfaces?.seat).map(item=>({
  item,surface:assets[item.asset_id].surfaces.seat,children:objects.filter(o=>o.on?.id===item.id&&o.on.surface==='seat'),upholstery:true
 })).filter(r=>r.children.length);
}
// Use the upholstery itself as the receiver: a plane at nominal seat height would slice curved cushions.
function seatOverlay(parent,item,surface,target){
 parent.updateWorldMatrix(true,true);const origin=new T.Matrix4().copy(parent.matrixWorld).invert(),[w,d]=surface.size;
 const mat=new T.ShaderMaterial({uniforms:{map:{value:target.texture},inv:{value:origin},span:{value:new T.Vector2(w,d)},y:{value:surface.height},intensity:{value:.85}},
  vertexShader:`varying vec3 p;uniform mat4 inv;
   void main(){vec4 world=modelMatrix*vec4(position,1.);p=(inv*world).xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
  fragmentShader:`varying vec3 p;uniform sampler2D map;uniform vec2 span;uniform float y,intensity;
   void main(){vec2 uv=vec2(.5+p.x/span.x,.5-p.z/span.y);if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))discard;
    float band=1.-smoothstep(.03,.13,abs(p.y-y));float a=texture2D(map,uv).a*band*intensity;if(a<.002)discard;gl_FragColor=vec4(.09,.065,.045,a);}`,
  transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,toneMapped:false});
 const group=new T.Group();group.name='Upholstery-contact-'+item.id;
 // The shader always discards outside its seat band. Index only triangles that
 // intersect it; do not submit the whole sofa a second time for a cushion shadow.
 const overlayGeometries=[];
 parent.traverse(o=>{
  if(!o.isMesh)return;
  const src=o.geometry,pos=src.attributes.position,idx=src.index,local=new T.Matrix4().multiplyMatrices(origin,o.matrixWorld).elements;
  const heights=new Float32Array(pos.count);
  for(let i=0;i<pos.count;i++)heights[i]=local[1]*pos.getX(i)+local[5]*pos.getY(i)+local[9]*pos.getZ(i)+local[13];
  const indices=[],n=idx?.count??pos.count;
  for(let i=0;i<n;i+=3){const a=idx?idx.getX(i):i,b=idx?idx.getX(i+1):i+1,c=idx?idx.getX(i+2):i+2;
   if(Math.max(heights[a],heights[b],heights[c])>=surface.height-.131&&Math.min(heights[a],heights[b],heights[c])<=surface.height+.131)indices.push(a,b,c)}
  if(!indices.length)return;
  const geo=new T.BufferGeometry();geo.setAttribute('position',pos.clone());geo.setIndex(indices);overlayGeometries.push(geo);
  const m=new T.Mesh(geo,mat);m.matrixAutoUpdate=false;m.matrix.copy(o.matrixWorld);m.renderOrder=1;group.add(m)
 });
 return {mesh:group,target,uniform:mat.uniforms.intensity,dispose(){overlayGeometries.forEach(g=>g.dispose());mat.dispose()}};
}
// Captured only when the layout changes. Floor and tabletop contact are independent of direct sun.
export function createContactShadows(renderer,scene){
 const size=1024,target=new T.WebGLRenderTarget(size,size,{depthBuffer:false}),scratch=new T.WebGLRenderTarget(size,size,{depthBuffer:false});
 const depth=new T.ShaderMaterial({
  side:T.DoubleSide,depthTest:false,depthWrite:false,blending:T.CustomBlending,blendEquation:T.MaxEquation,blendSrc:T.OneFactor,blendDst:T.OneFactor,
  uniforms:{height:{value:.32},falloff:{value:9},strength:{value:.48},drift:{value:new T.Vector2()}},
  vertexShader:`varying float worldHeight;uniform vec2 drift;
   void main(){vec4 p=modelMatrix*vec4(position,1.);worldHeight=p.y;p.xz+=drift*p.y;gl_Position=projectionMatrix*viewMatrix*p;}`,
  fragmentShader:`varying float worldHeight;uniform float height,falloff,strength;
   void main(){if(worldHeight<0.0||worldHeight>height)discard;gl_FragColor=vec4(0.,0.,0.,strength*exp(-worldHeight*falloff));}`
 });
 const blur=new T.ShaderMaterial({depthTest:false,depthWrite:false,blending:T.NoBlending,uniforms:{inputMap:{value:null},step:{value:new T.Vector2()}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'varying vec2 vUv;uniform sampler2D inputMap;uniform vec2 step;void main(){vec4 c=texture2D(inputMap,vUv)*.227027;c+=(texture2D(inputMap,vUv+step*1.384615)+texture2D(inputMap,vUv-step*1.384615))*.316216;c+=(texture2D(inputMap,vUv+step*3.230769)+texture2D(inputMap,vUv-step*3.230769))*.070270;gl_FragColor=c;}'});
 const quad=new T.Mesh(new T.PlaneGeometry(2,2),blur),blurScene=new T.Scene(),blurCamera=new T.Camera();blurScene.add(quad);
 // Tight feet and broad occlusion under seat/table tops use the same world projection.
 const broad=new T.WebGLRenderTarget(512,512,{depthBuffer:false}),broadScratch=broad.clone();
 const rugLayers=new Map(),ground=new T.ShaderMaterial({
  uniforms:{nearMap:{value:target.texture},farMap:{value:broad.texture},bounds:{value:new T.Vector4()},opacity:{value:.72}},
  vertexShader:`varying vec2 xz;void main(){vec4 p=modelMatrix*vec4(position,1.);xz=p.xz;gl_Position=projectionMatrix*viewMatrix*p;}`,
  fragmentShader:`uniform sampler2D nearMap,farMap;uniform vec4 bounds;uniform float opacity;varying vec2 xz;
   void main(){vec2 uv=(xz-bounds.xy)/bounds.zw*vec2(1.,-1.)+.5;
    float a=(1.-(1.-texture2D(nearMap,uv).a)*(1.-texture2D(farMap,uv).a))*opacity;
    if(a<.002)discard;gl_FragColor=vec4(.045,.033,.023,a);}`,
  transparent:true,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const plane=new T.Mesh(new T.PlaneGeometry(1,1),ground);plane.name='Furniture-floor-contact';plane.rotation.x=-Math.PI/2;plane.renderOrder=1;plane.visible=false;scene.add(plane);
 const rugPlane=new T.PlaneGeometry(1,1);
 function updateRugs(objects,assets,b){
  ground.uniforms.bounds.value.set(b.x,b.z,b.width,b.depth);const keep=new Set();
  for(const o of objects){const def=assets[o.asset_id];if(o.kind!=='rug'||!def?.rug_fabric)continue;keep.add(o.id);
   let m=rugLayers.get(o.id);if(!m){m=new T.Mesh(rugPlane,ground);m.name='Rug-floor-contact-'+o.id;m.renderOrder=1;m.rotation.order='YXZ';m.rotation.x=-Math.PI/2;scene.add(m);rugLayers.set(o.id,m)}
   m.position.set(o.x,def.height+.0005,o.z);m.rotation.y=o.yaw;m.scale.set(def.size[0]-.016,def.size[1]-.016,1);
  }
  for(const [id,m] of rugLayers)if(!keep.has(id)){scene.remove(m);rugLayers.delete(id)}
 }
 const camera=new T.OrthographicCamera();
 const surfaceSize=512,surfaceScratch=new T.WebGLRenderTarget(surfaceSize,surfaceSize,{depthBuffer:false}),layers=new Map();
 const surfaceDepth=depth.clone();surfaceDepth.depthTest=false;surfaceDepth.depthWrite=false;
 surfaceDepth.blending=T.CustomBlending;surfaceDepth.blendEquation=T.MaxEquation;surfaceDepth.blendSrc=T.OneFactor;surfaceDepth.blendDst=T.OneFactor;
 surfaceDepth.uniforms.strength.value=.56;surfaceDepth.uniforms.falloff.value=13;
 function renderPass(capture,output,work,radii,aspect=1,release=true){
  const previous={target:renderer.getRenderTarget(),color:renderer.getClearColor(new T.Color()),alpha:renderer.getClearAlpha(),autoClear:renderer.autoClear,shadow:renderer.shadowMap.enabled,viewport:renderer.getViewport(new T.Vector4()),scissor:renderer.getScissor(new T.Vector4()),scissorTest:renderer.getScissorTest()};
  try{
   renderer.shadowMap.enabled=false;renderer.autoClear=true;renderer.setScissorTest(false);renderer.setClearColor(0x000000,0);renderer.setRenderTarget(output);renderer.clear();renderer.render(capture,camera);
   for(const radius of radii)for(const horizontal of [true,false]){blur.uniforms.inputMap.value=horizontal?output.texture:work.texture;blur.uniforms.step.value.set(horizontal?radius/output.width:0,horizontal?0:radius*aspect/output.height);renderer.setRenderTarget(horizontal?work:output);renderer.clear();renderer.render(blurScene,blurCamera)}

  }finally{renderer.setRenderTarget(previous.target);renderer.setClearColor(previous.color,previous.alpha);renderer.autoClear=previous.autoClear;renderer.shadowMap.enabled=previous.shadow;renderer.setViewport(previous.viewport);renderer.setScissor(previous.scissor);renderer.setScissorTest(previous.scissorTest);if(release)capture.clear()}
 }
 function drop(layer){scene.remove(layer.mesh);if(layer.dispose)layer.dispose();else{layer.mesh.geometry.dispose();layer.mesh.material.dispose()}layer.target.dispose()}
 function tabletop(furniture,objects,assets){
  const byId=new Map(furniture.children.map(o=>[o.userData.id,o])),keep=new Set(),window=objects.find(o=>assets[o.asset_id]?.wall_opening);
  for(const {item,surface,children,upholstery,level} of [...diningReceivers(objects,assets),...sofaReceivers(objects,assets),...mediaReceivers(objects,assets),...worktopReceivers(objects,assets)]){
   const parent=byId.get(item.id);if(!parent)continue;
   const key=JSON.stringify([item.id,level||'top']);let layer=layers.get(key);
   if(upholstery&&layer){drop(layer);layer=undefined}
   if(!layer){
    const target=new T.WebGLRenderTarget(surfaceSize,surfaceSize,{depthBuffer:false});
    if(upholstery)layer=seatOverlay(parent,item,surface,target);
    else{const mesh=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({map:target.texture,transparent:true,depthWrite:false,toneMapped:false}));
    mesh.name='Tabletop-contact-'+item.id;mesh.rotation.order='YXZ';mesh.rotation.x=-Math.PI/2;mesh.renderOrder=1;
    layer={mesh,target}}layers.set(key,layer);scene.add(layer.mesh);
   }
   keep.add(key);
   const [w,d]=surface.size,y=parent.position.y+surface.height,copy=new T.Group(),capture=new T.Scene();
   const [dx,dz]=surface.center||[0,0],c=Math.cos(item.yaw),s=Math.sin(item.yaw),cx=item.x+dx*c+dz*s,cz=item.z-dx*s+dz*c;
   // Work in receiver-local coordinates so a moved or rotated table keeps its shadows.
   copy.rotation.y=-item.yaw;
   for(const c of children){const o=byId.get(c.id);if(!o)continue;const clone=o.clone(true);clone.position.sub(new T.Vector3(cx,y,cz));copy.add(clone)}
   copy.traverse(o=>{if(o.isMesh)o.material=surfaceDepth;else if(o.isLight||o.isSprite)o.visible=false});capture.add(copy);
   const away=new T.Vector3(window?item.x-window.x:1,0,window?item.z-window.z:1).normalize().applyAxisAngle(new T.Vector3(0,1,0),-item.yaw);
   const drift=upholstery ? .16 : .55;surfaceDepth.uniforms.drift.value.set(away.x*drift,away.z*drift);
   camera.left=-w/2;camera.right=w/2;camera.top=d/2;camera.bottom=-d/2;camera.near=.001;camera.far=.335;
   camera.position.set(0,.33,0);camera.lookAt(0,0,0);camera.updateProjectionMatrix();
   renderPass(capture,layer.target,surfaceScratch,[.009*surfaceSize/w,.005*surfaceSize/w],w/d);
   if(!upholstery){layer.mesh.position.set(cx,y+.0009,cz);layer.mesh.rotation.y=item.yaw;layer.mesh.scale.set(w,d,1)}
  }
  for(const [id,layer] of layers)if(!keep.has(id)){drop(layer);layers.delete(id)}
 }
 return {plane,update(furniture,room,objects=[],assets={}){
  const b=contactBounds(room);plane.position.set(b.x,.008,b.z);plane.scale.set(b.width,b.depth,1);
  camera.left=-b.width/2;camera.right=b.width/2;camera.top=b.depth/2;camera.bottom=-b.depth/2;camera.near=.001;camera.far=1.22;camera.position.set(b.x,1.22,b.z);camera.up.set(0,0,-1);camera.lookAt(b.x,0,b.z);camera.updateProjectionMatrix();
  const capture=new T.Scene(),copy=new T.Group();for(const item of furniture.children)if(item.position.y<.76&&!item.userData.isRug)copy.add(item.clone(true));copy.traverse(o=>{if(o.isMesh){o.material=depth;o.castShadow=false;o.receiveShadow=false}else if(o.isLight||o.isSprite||o.name==='Pick-up-robot')o.visible=false});capture.add(copy);
  const u=depth.uniforms;u.height.value=.32;u.falloff.value=9;u.strength.value=.48;u.drift.value.set(0,0);
  renderPass(capture,target,scratch,[1.3,.65],b.width/b.depth,false);
  // A tabletop blocks a broad patch of sky light. Keep this penumbra separate from the short foot contact.
  u.height.value=1.05;u.falloff.value=1.16;u.strength.value=.48;
  const window=objects.find(o=>assets[o.asset_id]?.wall_opening);
  if(window)u.drift.value.set(Math.sin(window.yaw)*.50,Math.cos(window.yaw)*.50);
  renderPass(capture,broad,broadScratch,[.095*512/b.width,.060*512/b.width],b.width/b.depth);plane.visible=true;updateRugs(objects,assets,b);tabletop(furniture,objects,assets);
 },setLighting(preset){ground.uniforms.opacity.value={day:.72,evening:.68,night:.40}[preset]??.72;for(const layer of layers.values()){const k={day:.83,evening:.77,night:.56}[preset]??.83;if(layer.uniform)layer.uniform.value=k;else layer.mesh.material.opacity=k}},dispose(){for(const m of rugLayers.values())scene.remove(m);rugLayers.clear();rugPlane.dispose();broad.dispose();broadScratch.dispose();for(const layer of layers.values())drop(layer);layers.clear();surfaceDepth.dispose();surfaceScratch.dispose();scene.remove(plane);plane.geometry.dispose();ground.dispose();quad.geometry.dispose();blur.dispose();depth.dispose();target.dispose();scratch.dispose()}};
}
