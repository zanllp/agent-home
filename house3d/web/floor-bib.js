import {BufferGeometry,Float32BufferAttribute,Uint16BufferAttribute,SkinnedMesh,MeshBasicMaterial,CanvasTexture,SRGBColorSpace,DoubleSide} from 'three';

// A continuous cloth front under the original neck jewel. Follows the same
// torso weights as the adjacent dress panels, never the moving sleeves.
export function createFloorBib(dress){
 const cvs=document.createElement('canvas');cvs.width=512;cvs.height=384;const c=cvs.getContext('2d');
 const cloth=c.createLinearGradient(0,0,512,0);cloth.addColorStop(0,'#c4bfcb');cloth.addColorStop(.22,'#efebeb');cloth.addColorStop(.52,'#fff8ea');cloth.addColorStop(.84,'#e7e1e4');cloth.addColorStop(1,'#c4bfcc');c.fillStyle=cloth;c.fillRect(0,0,512,384);
 // Navy dress at the sides, a narrower ivory insert down the centre.
 for(const flip of [false,true]){
  c.save();if(flip){c.translate(512,0);c.scale(-1,1)}
  const edge=new Path2D('M0 0 L79 0 C85 68 103 108 137 136 C120 200 114 286 126 384 L0 384 Z');
  const navy=c.createLinearGradient(0,0,140,30);navy.addColorStop(0,'#222e52');navy.addColorStop(.55,'#364772');navy.addColorStop(1,'#27365c');c.fillStyle=navy;c.fill(edge);
  c.strokeStyle='#c4aa85';c.lineWidth=3;c.beginPath();c.moveTo(79,0);c.bezierCurveTo(85,68,103,108,137,136);c.bezierCurveTo(120,200,114,286,126,384);c.stroke();c.restore();
 }
 const ribbon=(path,base,light)=>{const grad=c.createLinearGradient(0,0,0,275);grad.addColorStop(0,light);grad.addColorStop(.68,base);grad.addColorStop(1,light);c.fillStyle=grad;c.fill(new Path2D(path))};
 for(const flip of [false,true]){
  c.save();if(flip){c.translate(512,0);c.scale(-1,1)}
  ribbon('M245 14 Q201 60 141 134 Q124 154 106 194 L158 189 L184 218 Q204 144 246 73 Z','#263357','#52658c');
  ribbon('M248 27 Q218 17 173 5 Q150 0 131 10 Q138 46 132 96 Q168 114 202 83 Q224 68 251 52 Z','#202d53','#475e8d');
  c.strokeStyle='#65779a';c.lineWidth=3;c.beginPath();c.moveTo(239,42);c.quadraticCurveTo(211,42,160,25);c.stroke();
  c.restore();
 }
 c.strokeStyle='#c8c1c4';c.lineWidth=3;for(const x of [230,283]){c.beginPath();c.moveTo(x,103);c.lineTo(x,352);c.stroke()}
 for(const y of [155,233,311]){c.fillStyle='#ad8756';c.beginPath();c.arc(256,y,8,0,2*Math.PI);c.fill();c.fillStyle='#edcf8c';c.beginPath();c.arc(254,y-2,5,0,2*Math.PI);c.fill()}
 c.fillStyle='#283658';c.beginPath();c.ellipse(256,41,31,43,0,0,Math.PI*2);c.fill();
 c.fillStyle='#d6ae65';c.beginPath();c.ellipse(256,39,26,36,0,0,Math.PI*2);c.fill();
 const jewel=c.createLinearGradient(245,18,267,58);jewel.addColorStop(0,'#96d9eb');jewel.addColorStop(.5,'#3688ae');jewel.addColorStop(1,'#255075');
 c.fillStyle=jewel;c.beginPath();c.ellipse(256,39,20,29,0,0,Math.PI*2);c.fill();
 c.fillStyle='#d8f2ed';c.beginPath();c.ellipse(251,26,5,3,-.7,0,Math.PI*2);c.fill();
 const texture=new CanvasTexture(cvs);texture.colorSpace=SRGBColorSpace;texture.anisotropy=4;
 const mat=new MeshBasicMaterial({map:texture,toneMapped:false,side:DoubleSide}),g=new BufferGeometry(),pos=[],uv=[],skin=[],weights=[],idx=[];
 const hip=dress.skeleton.bones.findIndex(b=>b.name.endsWith('Hips')),spine=dress.skeleton.bones.findIndex(b=>b.name.endsWith('Spine2'));
 const rows=[[.434,.075,.162],[.447,.077,.151],[.46,.075,.136],[.473,.074,.130],[.49,.075,.131],[.505,.076,.141],[.523,.081,.145],[.541,.087,.142],[.556,.089,.135],[.573,.077,.128],[.583,.068,.121]];
 const cols=21;for(let j=0;j<rows.length;j++){const [y,width,front]=rows[j];
  for(let i=0;i<cols;i++){const u=i/(cols-1),x=u*2-1;pos.push(-.008+x*width,y,front-.028*x*x);uv.push(u,(y-rows[0][0])/(rows.at(-1)[0]-rows[0][0]));
   let t=Math.max(0,Math.min(1,(y-.37)/.13));t=t*t*(3-2*t);skin.push(hip,spine,0,0);weights.push(1-t,t,0,0);
   if(j&&i){const a=j*cols+i;idx.push(a-cols-1,a-cols,a,a-cols-1,a,a-1)}
  }
 }
 g.setAttribute('position',new Float32BufferAttribute(pos,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setAttribute('skinIndex',new Uint16BufferAttribute(skin,4));g.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));g.setIndex(idx);g.computeVertexNormals();
 const mesh=new SkinnedMesh(g,mat);mesh.name='Floor-play-bodice';mesh.frustumCulled=false;dress.parent.add(mesh);mesh.position.copy(dress.position);mesh.quaternion.copy(dress.quaternion);mesh.scale.copy(dress.scale);mesh.bind(dress.skeleton,dress.bindMatrix);mesh.visible=false;
 return {mesh,dispose(){mesh.removeFromParent();mat.dispose();texture.dispose();g.dispose()}};
}
