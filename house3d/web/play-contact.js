import {Mesh,PlaneGeometry,ShaderMaterial,Vector3} from 'three';

// Use the live seated skeleton so the soft contact follows the knees and ankles when the kit turns.
export function createPlayContact(avatar,bones){
 const anchors=['Hips','LeftLeg','RightLeg','LeftFoot','RightFoot'].map(k=>bones.get(k));
 const centres=anchors.map(()=>new Vector3()),point=new Vector3();
 const mat=new ShaderMaterial({uniforms:{centres:{value:centres},fade:{value:0}},
  vertexShader:`varying vec2 p;void main(){p=vec2(position.x,-position.y);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`varying vec2 p;uniform vec3 centres[5];uniform float fade;
  void main(){float shade=0.;for(int i=0;i<5;i++){vec3 c=centres[i];vec2 r=i==0?vec2(.17,.145):(i<3?vec2(.09,.076):vec2(.065,.048));vec2 d=(p-c.xz)/r;
   shade=max(shade,exp(-dot(d,d)*1.3)*exp(-max(c.y-.04,0.)*3.));}
   float a=fade*.38*shade;if(a<.002)discard;gl_FragColor=vec4(.10,.08,.075,a);}`,transparent:true,depthWrite:false,toneMapped:false});
 const plane=new Mesh(new PlaneGeometry(1.1,1.1),mat);plane.name='Seated-rug-contact';plane.rotation.x=-Math.PI/2;plane.visible=false;plane.renderOrder=2;avatar.add(plane);
 return {update(w,ground){
  plane.visible=w>0&&Number.isFinite(ground)&&anchors.every(Boolean);if(!plane.visible)return;
  plane.position.y=ground-avatar.position.y+.0006;mat.uniforms.fade.value=w;
  anchors.forEach((b,i)=>{b.getWorldPosition(point);avatar.worldToLocal(point);centres[i].copy(point);centres[i].y-=plane.position.y});
 },dispose(){avatar.remove(plane);plane.geometry.dispose();mat.dispose()}};
}
