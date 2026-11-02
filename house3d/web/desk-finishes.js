import * as T from 'three';
import {keyboardLayout} from './desk-models.js';
const fill=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h)};
const text=(c,t,x,y,size,color='#5e6e64',bold=false)=>{c.font=`${bold?'bold ':''}${size}px sans-serif`;c.fillStyle=color;c.fillText(t,x,y)};
function woodTexture(){const w=512,h=128,data=new Uint8Array(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const v=3.8*Math.sin(y*.42+Math.sin(x*.011)*1.8)+2*Math.sin(y*1.8+x*.003)+Math.sin(x*.31+y*2.14),i=(y*w+x)*4;data.set([208+v,173+v,127+v,255],i)}const t=new T.DataTexture(data,w,h);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;t.needsUpdate=true;return t}
function imageTexture(canvasFactory,w,h,paint){const canvas=canvasFactory();canvas.width=w;canvas.height=h;paint(canvas.getContext('2d'),w,h);const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;return t}
function flower(c,x,y,r,color){for(let i=0;i<7;i++){c.fillStyle=color;c.beginPath();c.ellipse(x+Math.cos(i*Math.PI/3)*r,y+Math.sin(i*Math.PI/3)*r,r*.75,r*.45,i*Math.PI/3,0,Math.PI*2);c.fill()}c.fillStyle='#d9b76f';c.beginPath();c.arc(x,y,r*.4,0,Math.PI*2);c.fill()}
function garden(c,x,y,w,h){fill(c,x,y,w,h,'#e5eee1');fill(c,x,y+h*.68,w,h*.32,'#c5d6ad');c.fillStyle='#ead5a1';c.beginPath();c.arc(x+w*.80,y+h*.18,w*.065,0,Math.PI*2);c.fill();fill(c,x+w*.18,y+h*.36,w*.29,h*.36,'#ead8b7');c.fillStyle='#b99582';c.beginPath();c.moveTo(x+w*.12,y+h*.38);c.lineTo(x+w*.33,y+h*.12);c.lineTo(x+w*.53,y+h*.38);c.closePath();c.fill();fill(c,x+w*.25,y+h*.49,w*.07,h*.22,'#adbaa4');fill(c,x+w*.37,y+h*.43,w*.06,h*.10,'#a7c6ce');
 for(let i=0;i<5;i++){const px=x+w*(.57+i*.075),py=y+h*(.60+(i%2)*.09);c.strokeStyle='#91aa7a';c.lineWidth=3;c.beginPath();c.moveTo(px,y+h*.91);c.lineTo(px,py);c.stroke();flower(c,px,py,w*.022,['#ce9f8d','#d5be86','#afbeca'][i%3])}}
function workbookPage(c,w,h,right){fill(c,0,0,w,h,'#f6f0e0');text(c,right?'给小花安个家':'今天的小发现',32,60,27,'#647e72',true);fill(c,30,80,w-60,2,'#cad5ba');if(right){garden(c,35,115,w-70,h*.55);text(c,'阳光 · 小屋 · 花园',42,h-75,20,'#8b9786');for(let i=0;i<3;i++){fill(c,40+i*110,h-46,75,2,['#c4b287','#aac0bd','#c6a694'][i])}}else{for(const [i,t] of ['观察一片叶子的形状','给植物画一个新花盆','留一点时间发呆'].entries()){text(c,String(i+1)+'.',36,140+i*90,20,'#a5b29b');text(c,t,70,140+i*90,21);fill(c,70,158+i*90,w-110,1,'#e2dcc8')}garden(c,45,h*.69,w-90,h*.23)}for(let i=0;i<12;i++)fill(c,w-5,i*h/12,2,h/20,'#ded4bd')}
function faceOverlay(parent,name,w,h,pos,texture,rotation){const face=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:texture,transparent:true,toneMapped:false,depthWrite:false}));face.name=name;face.position.set(...pos);if(rotation)face.rotation.set(...rotation);face.castShadow=false;parent.add(face);return face}
export function applyDeskFinishes(root,{canvasFactory=()=>document.createElement('canvas'),pictureBookImage}={}){
 let wood;const replacements=new Map();root.traverse(o=>{if(!o.isMesh||!o.name.startsWith('Wood-'))return;if(!wood)wood=woodTexture();const source=o.material;if(!replacements.has(source)){const mat=source.clone();mat.map=wood;mat.color.set('#ffffff');mat.roughness=.48;mat.envMapIntensity=.72;replacements.set(source,mat)}o.material=replacements.get(source)});
 const left=root.getObjectByName('Workbook-page-left'),right=root.getObjectByName('Workbook-page-right');for(const [i,page] of [left,right].entries()){if(!page)continue;const t=imageTexture(canvasFactory,480,640,(c,w,h)=>workbookPage(c,w,h,!!i));const mat=page.material.clone();mat.map=t;mat.color.set('#ffffff');mat.roughness=.97;page.material=mat}
 if(pictureBookImage)for(const [i,name] of ['Picturebook-page-left','Picturebook-page-right'].entries()){
  const page=root.getObjectByName(name);if(!page)continue;const t=new T.Texture(pictureBookImage);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;t.repeat.set(.5,1);t.offset.set(i*.5,0);t.needsUpdate=true;
  page.material=new T.MeshBasicMaterial({map:t,side:T.DoubleSide,toneMapped:false});
 }
 if(pictureBookImage){const covers=[];root.traverse(o=>{if(o.name.startsWith('Standing-book-cover'))covers.push(o)});for(const [i,cover] of covers.entries()){
  const t=new T.Texture(pictureBookImage);t.colorSpace=T.SRGBColorSpace;t.repeat.set(.5,1);t.offset.set((i%2)*.5,0);t.anisotropy=8;t.needsUpdate=true;
  faceOverlay(cover,'Storybook-cover-illustration',.073,.133,[(i%2?1:-1)*.0016,0,0],t,[0,(i%2?1:-1)*Math.PI/2,0]);
 }}
 if(root.getObjectByName('Keyboard-body')){const t=imageTexture(canvasFactory,1440,512,(c,w,h)=>{c.clearRect(0,0,w,h);c.textAlign='center';c.textBaseline='middle';for(const k of keyboardLayout()){if(k.text==='space')continue;const x=(k.x/.36+.5)*w,y=(k.z/.128+.5)*h;const label=k.text==='⌫'?'back':k.text==='↵'?'enter':k.text==='⌘'?'cmd':k.text;text(c,label,x,y,k.text.length>1?20:30,'#40534b')}});faceOverlay(root.getObjectByName('Keyboard-body').parent,'Keyboard-legends',.36,.128,[-.13,.0245,.12],t,[-Math.PI/2,0,0])}
 if(root.getObjectByName('Notebook-cloth-cover')){const t=imageTexture(canvasFactory,960,480,(c,w,h)=>{c.clearRect(0,0,w,h);text(c,'notes',90,160,65,'#dbe2cf');text(c,'a little space for ideas',90,230,25,'#c7d2c4');fill(c,90,275,180,2,'#c7d2c4')});faceOverlay(root.getObjectByName('Notebook-cloth-cover').parent,'Notebook-title',.22,.115,[0,.0173,0],t,[-Math.PI/2,0,0])}
 const deskCalendar=root.getObjectByName('Desk-calendar-paper');if(deskCalendar){const t=imageTexture(canvasFactory,300,360,(c,w,h)=>{fill(c,0,0,w,h,'#fff3dc');text(c,'NOV',32,65,39,'#a48c62',true);for(let i=0;i<28;i++){text(c,String(i+1),30+(i%7)*38,120+Math.floor(i/7)*48,21,'#7f948c')}flower(c,230,310,16,'#ce9a7e')});faceOverlay(deskCalendar,'Desk-calendar-print',.045,.051,[0,0,.0012],t)}
 const spines=[];root.traverse(o=>{if(o.name.startsWith('Standing-book-spine'))spines.push(o)});for(const [i,spine] of spines.entries()){const t=imageTexture(canvasFactory,180,680,(c,w,h)=>{fill(c,0,0,w,h,['#97b3a5','#86aabd','#d3b46f'][i%3]);text(c,['小','自','画'][i%3],40,160,66,'#fff0d9',true);text(c,['花','然','里'][i%3],40,250,66,'#fff0d9',true);text(c,['园','课','话'][i%3],40,340,66,'#fff0d9',true);flower(c,90,505,26,'#edd7ad')});faceOverlay(spine,'Storybook-spine-print',.027,.148,[0,0,.003],t)}
 const calendar=root.getObjectByName('Calendar-paper');if(calendar){const t=imageTexture(canvasFactory,340,460,(c,w,h)=>{fill(c,0,0,w,h,'#f5eedf');text(c,'日子慢慢过',25,52,24,'#7b8b75',true);text(c,'NOVEMBER',25,88,15,'#a6ad98');for(let i=0;i<35;i++){const x=34+(i%7)*44,y=142+Math.floor(i/7)*52;text(c,String(i%30+1),x,y,16,'#81917f');if(i===11){c.strokeStyle='#cb9c84';c.lineWidth=3;c.beginPath();c.arc(x+7,y-5,16,0,Math.PI*2);c.stroke()}}text(c,'记得一起散步',28,430,19,'#a7ad95')});faceOverlay(calendar,'Calendar-print',.165,.225,[0,0,.001],t)}
 const postcard=root.getObjectByName('Drawing-postcard');if(postcard){const t=imageTexture(canvasFactory,570,390,(c,w,h)=>{fill(c,0,0,w,h,'#f7f0df');garden(c,20,20,w-40,h-55);text(c,'小花园',30,h-12,18,'#83947a')});faceOverlay(postcard,'Garden-postcard',.18,.12,[0,0,.001],t)}
 return root;
}

// This material belongs to one placed book, not to the cached furniture model.
export function showCrayonDrawing(instance, image, title, canvasFactory=()=>document.createElement('canvas')){
 const page=instance.getObjectByName('Picturebook-page-right')||instance.getObjectByName('Workbook-page-right');
 if(!page)return;
 const texture=imageTexture(canvasFactory,512,640,(c,w,h)=>{
  fill(c,0,0,w,h,'#f7f2e5');text(c,title,24,65,27,'#647e72',true);
  const width=w-32,height=width*image.height/image.width;
  c.drawImage(image,16,(h-height)/2,width,height);
 });
 const mat=new T.MeshBasicMaterial({map:texture,side:T.DoubleSide,toneMapped:false});page.material=mat;
 return ()=>{texture.dispose();mat.dispose()};
}
