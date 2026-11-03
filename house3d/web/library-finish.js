import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

function timberTexture(){
 const w=640,h=256,pixels=new Uint8Array(w*h*4);
 for(let j=0;j<h;j++)for(let i=0;i<w;i++){
  const x=i/w,y=j/h,grain=y+.048*Math.sin(x*4.9+y*5.7)+.013*Math.sin(14*x+y*8);
  const ring=.5+.5*Math.cos(grain*87+1.8*Math.sin(y*11)),fibres=Math.cos(grain*815+x*6);
  const v=4.4*ring-8*ring**9+1.7*fibres+1.4*Math.sin(i*19+j*7);
  pixels.set([218+v,183+v,144+v,255],(j*w+i)*4);
 }
 const t=new T.DataTexture(pixels,w,h);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.MirroredRepeatWrapping;
 t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=4;t.needsUpdate=true;return t;
}
export function finishMapleSeating(root){
 const cushion=root.getObjectByName('Oatmeal_linen_cushion');if(!cushion)return;
 const wood=timberTexture(),seed={Steam_bent_stile:.09,Tapered_foreleg:.21,Bent_maple_crest:.37,Maple_saddle_rim:.64};
 root.traverse(o=>{
  if(!o.isMesh)return;
  const key=Object.keys(seed).find(k=>o.name.startsWith(k));if(!key)return;
  const uv=o.geometry.attributes.uv,shift=seed[key]+.39*o.geometry.attributes.position.getX(0);
  for(let i=0;i<uv.count;i++){const u=uv.getX(i),v=uv.getY(i);uv.setXY(i,.70*v+shift,.44*u+shift)}
  uv.needsUpdate=true;o.material.map=wood;o.material.color.set('#f0dcc4');o.material.roughness=.54;o.material.needsUpdate=true;
 });
 const n=64,data=new Uint8Array(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const yarn=((x+2*(y>>2))%4===0?-9:2)+(y%4===0?-5:1)+Math.sin(x*19+y*3)*1.6;
  data.set([235+yarn,224+yarn,201+yarn,255],4*(y*n+x));
 }
 const cloth=new T.DataTexture(data,n,n);cloth.colorSpace=T.SRGBColorSpace;cloth.wrapS=cloth.wrapT=T.RepeatWrapping;
 cloth.magFilter=T.LinearFilter;cloth.minFilter=T.LinearMipmapLinearFilter;cloth.generateMipmaps=true;cloth.anisotropy=4;cloth.needsUpdate=true;
 const {position,uv}=cushion.geometry.attributes;
 for(let i=0;i<uv.count;i++)uv.setXY(i,position.getX(i)*13,position.getZ(i)*13);uv.needsUpdate=true;
 cushion.material.map=cloth;cushion.material.color.set(0xffffff);cushion.material.needsUpdate=true;
}
export function finishCabinetWood(root){
 let map;const materials=new Map();
 root.traverse(o=>{
  if(!o.isMesh||!/^(Maple_|Solid_edge|Oak_top|Inset_front|Slat|Door_slab|Oak_veneer_joint)/.test(o.name))return;
  map??=timberTexture();const dark=/Door_slab|Solid_edge|Oak_veneer_joint/.test(o.name),key=o.material.uuid+dark;
  if(!materials.has(key)){const m=o.material.clone();m.map=map;m.color.set(/Door_slab|Oak_veneer_joint/.test(o.name)?'#c0a388':dark?'#e4d6bd':0xffffff);m.roughness=.58;materials.set(key,m)}
  o.material=materials.get(key);
  const geo=o.geometry,{position,normal,uv}=geo.attributes;geo.computeBoundingBox();const dimensions=geo.boundingBox.getSize(new T.Vector3()).toArray();
  const shift=.19*o.position.x+.27*o.position.y;
  for(let i=0;i<position.count;i++){const p=[position.getX(i),position.getY(i),position.getZ(i)],n=[normal.getX(i),normal.getY(i),normal.getZ(i)].map(Math.abs),facing=n.indexOf(Math.max(...n));
   const axes=[0,1,2].filter(a=>a!==facing).sort((a,b)=>dimensions[b]-dimensions[a]);uv.setXY(i,p[axes[0]]/.94+shift,p[axes[1]]/.43+shift+.5)}
  uv.needsUpdate=true;
 });
}
export function finishMediaGrille(root){
 const panel=root.getObjectByName('Woven_cable_grille');if(!panel)return;
 const n=64,px=new Uint8Array(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const dx=(x+(Math.floor(y/4)%2)*2)%4-1.5,dy=y%4-1.5,v=13*Math.exp(-(dx*dx+dy*dy))-.9*(x%2);
  px.set([180-v,166-v,145-v,255],(y*n+x)*4)}
 const t=new T.DataTexture(px,n,n);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(5,1.6);
 t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=8;t.needsUpdate=true;
 panel.material.map=t;panel.material.color.set(0xffffff);panel.material.roughness=.96;panel.material.needsUpdate=true;
}
const rows={
 nature:[['窗边的植物','野花','鸟类手记','山海','天气','昆虫记','贝壳'],['#81948b','#b9a779','#7394a0','#a68d75','#b8b5a6','#809c92','#94aabb']],
 study:[['系统设计','计算机','图与树','算法','网络','编译','笔记'],['#627d86','#bbaf90','#8da59f','#8c939d','#b29381','#7d969d','#acb2aa']],
 stories:[['海边来信','纸飞机','晚安','小小船长','月光','花园','远行'],['#8da4ba','#c9ac86','#b8a6b0','#879b9b','#b68e76','#b5bfa2','#8fabb3']]
};
export function finishBookSpines(root,series='nature',canvasFactory=()=>document.createElement('canvas')){
 const covers=[],labels=[];root.traverse(o=>{if(o.isMesh&&o.name.startsWith('Standing_cover'))covers.push(o);else if(o.isMesh&&o.name.startsWith('Spine_label'))labels.push(o)});
 if(!covers.length)return;
 covers.sort((a,b)=>a.position.x-b.position.x);const [titles,colors]=rows[series]||rows.nature;
 const canvas=canvasFactory(),width=96,height=448;canvas.width=covers.length*width;canvas.height=height;
 const ctx=canvas.getContext('2d'),parts=[];
 for(const [i,o] of covers.entries()){
  const col=colors[i%colors.length],title=titles[i%titles.length],x=i*width;
  ctx.save();ctx.translate(x,0);ctx.fillStyle=col;ctx.fillRect(0,0,width,height);
  ctx.fillStyle='rgba(248,242,214,.73)';ctx.fillRect(9,27,width-18,3);ctx.fillRect(9,height-43,width-18,2);
  ctx.textAlign='center';ctx.font='bold 29px serif';[...title].forEach((c,j)=>ctx.fillText(c,width/2,96+j*40));
  ctx.font='18px serif';ctx.fillText(String(i+1).padStart(2,'0'),width/2,height-62);ctx.restore();
  o.geometry.computeBoundingBox();const box=o.geometry.boundingBox,dim=box.getSize(new T.Vector3()),part=new T.PlaneGeometry(dim.x*.984,dim.y*.986);
  part.translate(o.position.x,o.position.y,o.position.z+box.max.z+.0006);
  const uv=part.attributes.uv;for(let j=0;j<uv.count;j++)uv.setX(j,(i+.01+.98*uv.getX(j))/covers.length);parts.push(part);
  // The imported cover is a solid box: split it into two boards and a spine to reveal the cream page block.
  const mat=o.material.clone();mat.color.set(col);const cx=o.position.x,left=o.clone(false),binding=o.clone(false);
  left.material=binding.material=o.material=mat;o.scale.x=left.scale.x=.075;
  o.position.x=cx-dim.x*.4625;left.position.x=cx+dim.x*.4625;
  binding.scale.z=.029;binding.position.z+=dim.z*(1-.029)/2;o.parent.add(left,binding);
 }
 for(const o of labels)o.visible=false;
 const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;
 const plate=new T.Mesh(mergeGeometries(parts),new T.MeshStandardMaterial({map:t,roughness:.87}));parts.forEach(p=>p.dispose());
 plate.name='Printed-book-spines';plate.receiveShadow=true;root.add(plate);
}

const bins={paper:['画纸','#cdc4ab'],cables:['线材','#a5afb1'],toys:['拼搭','#adb9a3']};
export function finishStorageBin(root,theme,canvasFactory=()=>document.createElement('canvas')){
 const pocket=root.getObjectByName('Label_pocket');if(!pocket||!bins[theme])return;
 const [label,tint]=bins[theme],canvas=canvasFactory();canvas.width=canvas.height=128;const c=canvas.getContext('2d');
 c.fillStyle=tint;c.fillRect(0,0,128,128);
 for(let y=0;y<128;y+=4)for(let x=0;x<128;x+=8){const dx=x+y%8;c.fillStyle='rgba(255,250,225,.25)';c.fillRect(dx,y,5,1);c.fillStyle='rgba(76,70,64,.18)';c.fillRect(dx+2,y+2,4,1)}
 const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(4,3);map.anisotropy=4;
 for(const name of ['Rounded_linen_bin','Lid_piping']){const mesh=root.getObjectByName(name);if(mesh){mesh.material=mesh.material.clone();mesh.material.map=map;mesh.material.color.set(0xffffff);mesh.material.roughness=.96}}
 const paper=canvasFactory();paper.width=280;paper.height=96;const ctx=paper.getContext('2d');ctx.fillStyle='#eee4ca';ctx.fillRect(0,0,280,96);
 ctx.strokeStyle='#b6a788';ctx.lineWidth=2;ctx.setLineDash([7,5]);ctx.strokeRect(7,7,266,82);
 ctx.textAlign='center';ctx.font='bold 54px serif';ctx.fillStyle='#625e50';ctx.fillText(label,140,69);
 const t=new T.CanvasTexture(paper);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;
 const face=new T.Mesh(new T.PlaneGeometry(.067,.023),new T.MeshStandardMaterial({map:t,roughness:.9}));face.name='Storage-bin-label';face.position.z=.0019;face.receiveShadow=true;pocket.add(face);
}
