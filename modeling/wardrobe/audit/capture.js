import {OrthographicCamera,Vector3,MathUtils} from 'three';

export function studioCapture({base,scene,renderer,showPose}){
 const mid=(suffix)=>bone('Left'+suffix).add(bone('Right'+suffix)).multiplyScalar(.5);
 const bone=s=>base.getObjectByName('mixamorig'+s).getWorldPosition(new Vector3());
 return shot=>{
  showPose(shot.pose,shot.time);scene.updateMatrixWorld(true);
  const target=Array.isArray(shot.at)?new Vector3(...shot.at):shot.at==='hands'?mid('Hand'):shot.at==='feet'?mid('Foot'):shot.at==='knees'?mid('Leg'):bone(shot.at);
  const h=shot.height/2,cam=new OrthographicCamera(-h,h,h,-h,.01,12);
  const yaw=MathUtils.degToRad(shot.yaw),pitch=MathUtils.degToRad(shot.pitch);
  cam.position.copy(target).addScaledVector(new Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)),3);cam.lookAt(target);
  renderer.setPixelRatio(1);renderer.setSize(640,640,false);renderer.render(scene,cam);
  const canvas=renderer.domElement,ctx=document.createElement('canvas');ctx.width=ctx.height=32;
  const c=ctx.getContext('2d');c.drawImage(canvas,0,0,32,32);
  const data=c.getImageData(0,0,32,32).data,colors=new Set();
  for(let i=0;i<data.length;i+=4)colors.add((data[i]<<16)|(data[i+1]<<8)|data[i+2]);
  if(colors.size<12)throw Error('取景为空：'+shot.label);
  return canvas.toDataURL('image/webp',.94).split(',')[1];
 };
}
