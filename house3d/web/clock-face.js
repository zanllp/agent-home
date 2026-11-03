import * as T from 'three';

// A printed dial on the stationary face, under the original moving hands and brass pin.
export function finishClockFace(root,canvasFactory=()=>document.createElement('canvas')){
 const dial=root.getObjectByName('Ivory_dial');if(!dial)return;
 const canvas=canvasFactory(),size=384,mid=size/2;canvas.width=canvas.height=size;
 const c=canvas.getContext('2d');c.fillStyle='#fcf4e2';c.fillRect(0,0,size,size);
 c.strokeStyle='#9e9584';c.lineWidth=1.4;c.beginPath();
 for(let i=0;i<60;i++){
  if(i%5===0)continue;
  const theta=i*Math.PI/30,s=Math.sin(theta),v=Math.cos(theta);
  c.moveTo(mid+mid*.86*s,mid-mid*.86*v);c.lineTo(mid+mid*.89*s,mid-mid*.89*v);
 }
 c.stroke();c.fillStyle='#625d54';c.font='32px sans-serif';c.textAlign='center';c.textBaseline='middle';
 for(const [n,x,y] of [['12',0,-1],['3',1,0],['6',0,1],['9',-1,0]])c.fillText(n,mid+x*mid*.66,mid+y*mid*.66);
 const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
 const face=new T.Mesh(new T.CircleGeometry(.181,64),new T.MeshStandardMaterial({map,roughness:.91}));
 face.name='Printed minute dial';face.position.copy(dial.position);face.position.z+=.0027;face.receiveShadow=true;dial.parent.add(face);
}
