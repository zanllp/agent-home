import * as T from 'three';
// A reusable storybook prop, not a claimed inventory / shelf-pickup system.
export function createReadingBook(parent){
 const group=new T.Group();parent.add(group);group.visible=false;const handPoint=new T.Vector3(-.007,.535,.39),handRotation=new T.Quaternion().setFromEuler(new T.Euler(.24,0,0)),deskPoint=new T.Vector3(),handWorld=new T.Vector3(),deskRotation=new T.Quaternion(),handWorldRotation=new T.Quaternion();
 const cover=new T.MeshStandardMaterial({color:'#497da0',roughness:.82}),paper=new T.MeshStandardMaterial({color:'#fff2d8',roughness:.95});
 const geometries=[],materials=[cover,paper];
 function box(w,h,d,x,y,z,mat){const geometry=new T.BoxGeometry(w,h,d);geometries.push(geometry);const m=new T.Mesh(geometry,mat);m.position.set(x,y,z);group.add(m);return m}
 box(.32,.009,.23,0,-.010,0,cover);
 for(const s of [-1,1]){
  const block=box(.149,.012,.215,s*.075,0,0,paper);block.rotation.z=-s*.025;
  for(let i=0;i<3;i++)box(.144,.00065,.0006,s*.075,-.004+i*.003,.108,cover);
 }
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=768;const c=canvas.getContext('2d');c.fillStyle='#fff2d8';c.fillRect(0,0,1024,768);c.fillStyle='#667b8d';c.font='bold 39px "PingFang SC",sans-serif';c.fillText('鲸鱼的小旅行',62,90);
 c.font='27px "PingFang SC",sans-serif';c.fillStyle='#776c60';
 ['今天，小鲸离开了海湾。','它跟着一串泡泡游，','遇见一群银色的小鱼。'].forEach((line,i)=>c.fillText(line,60,178+i*56));
 c.fillStyle='#b7d4ce';c.beginPath();c.moveTo(55,540);c.quadraticCurveTo(180,430,310,535);c.quadraticCurveTo(385,575,455,505);c.lineTo(455,650);c.lineTo(55,650);c.fill();
 c.fillStyle='#ca9b60';for(let i=0;i<4;i++){c.beginPath();c.ellipse(110+i*74,502-i%2*22,15,7,-.2,0,Math.PI*2);c.fill()}
 c.font='21px sans-serif';c.fillStyle='#8e8678';c.fillText('06',62,712);c.fillText('07',940,712);
 c.fillStyle='#6caeda';c.beginPath();c.ellipse(750,355,135,82,0,0,Math.PI*2);c.fill();c.beginPath();c.moveTo(854,350);c.quadraticCurveTo(930,250,936,322);c.quadraticCurveTo(960,365,870,378);c.fill();c.fillStyle='#294f70';c.beginPath();c.arc(690,340,9,0,Math.PI*2);c.fill();c.strokeStyle='#6caeda';c.lineWidth=12;for(let i=0;i<3;i++){c.beginPath();c.arc(735+i*34,530,38,.1,Math.PI-.1);c.stroke()}
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;const pageMat=new T.MeshStandardMaterial({map:texture,roughness:.94,side:T.DoubleSide});materials.push(pageMat);
 for(const sign of [-1,1]){
  const geo=new T.PlaneGeometry(.15,.215,12,1),p=geo.attributes.position,uv=geo.attributes.uv;
  for(let i=0;i<p.count;i++){const u=uv.getX(i),out=sign<0?1-u:u;p.setXYZ(i,sign*.075+p.getX(i),.008+.009*Math.sin(out*Math.PI)-.003*(1-out)**3,-p.getY(i));uv.setX(i,(sign<0?0:.5)+.5*u)}
  geo.computeVertexNormals();geometries.push(geo);const page=new T.Mesh(geo,pageMat);page.rotation.y=Math.PI;page.receiveShadow=true;group.add(page);
 }

 return {get position(){return group.position},update(weight,avatar,desk,asset){group.visible=!!desk&&weight>.001;if(!group.visible)return;avatar.updateMatrixWorld(true);handWorld.copy(handPoint);avatar.localToWorld(handWorld);deskPoint.set(0,(asset?.height||.70)+.025,.12).applyAxisAngle(new T.Vector3(0,1,0),desk.yaw);deskPoint.x+=desk.x;deskPoint.z+=desk.z;group.position.copy(deskPoint).lerp(handWorld,weight);deskRotation.setFromAxisAngle(new T.Vector3(0,1,0),desk.yaw);avatar.getWorldQuaternion(handWorldRotation);handWorldRotation.multiply(handRotation);group.quaternion.copy(deskRotation).slerp(handWorldRotation,weight)},dispose(){texture.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());parent.remove(group)}};
}
