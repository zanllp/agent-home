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
 const washer=root.getObjectByName('Wash_fascia_lettering');
 if(washer){
  root.getObjectByName('Convex_inspection_glass').castShadow=false;
  const labels=imageTexture(canvasFactory,1024,236,(c,w,h)=>{
   c.clearRect(0,0,w,h);text(c,'清 洗',35,52,16,'#697470',true);
   text(c,'棉织物',355,33,12,'#687571');text(c,'快洗',520,60,12,'#687571');
   text(c,'水温',723,173,14,'#687571');text(c,'漂洗',802,173,14,'#687571');text(c,'启动',886,173,14,'#687571');
   fill(c,735,111,12,3,'#96b3a8');fill(c,753,111,12,3,'#96b3a8');
  });
  washer.material=washer.material.clone();washer.material.map=labels;washer.material.opacity=1;
  washer.material.needsUpdate=true;washer.castShadow=false;washer.receiveShadow=false;
 }
 const sketch=root.getObjectByName('Weekend_sketch');
 if(sketch&&pictureBookImage){
  const print=(name,w,h,draw)=>{
   const card=root.getObjectByName(name);card.material=card.material.clone();card.material.map=imageTexture(canvasFactory,w,h,draw);card.material.needsUpdate=true;
  };
  print('Weekend_sketch',720,426,(c,w,h)=>{
   fill(c,0,0,w,h,'#f9f3de');text(c,'我的机器人',32,52,30,'#5b7792',true);
   c.drawImage(pictureBookImage,pictureBookImage.width/2,0,pictureBookImage.width/2,pictureBookImage.height,164,64,388,330);
  });
  print('Garden_diary',424,365,(c,w,h)=>{fill(c,0,0,w,h,'#fbf6e7');garden(c,14,20,w-28,h-91);text(c,'今天窗边开花啦',25,h-20,21,'#738e72')});
  print('Workshop_ticket',430,276,(c,w,h)=>{fill(c,0,0,w,h,'#f3dfaa');fill(c,18,18,w-36,5,'#ba8859');text(c,'周六手作',30,95,43,'#8d6243',true);text(c,'家庭工坊   10:00',30,159,26,'#8d7557');flower(c,360,210,17,'#cd987e')});
 }
 const magazine=root.getObjectByName('Weekend_print');
 if(magazine&&pictureBookImage){
  const t=imageTexture(canvasFactory,640,468,(c,w,h)=>{
   fill(c,0,0,w,h,'#dce9e6');fill(c,0,0,21,h,'#779aaf');fill(c,35,110,w-70,2,'#a3b9b6');
   text(c,'周末手作',48,78,52,'#486277',true);text(c,'NO. 03',455,73,23,'#758986');
   c.drawImage(pictureBookImage,pictureBookImage.width/2,0,pictureBookImage.width/2,pictureBookImage.height,103,126,242,307);
   text(c,'会眨眼的',380,238,30,'#637f85');text(c,'小机器人',380,287,35,'#526b80',true);
  });magazine.material=new T.MeshStandardMaterial({map:t,roughness:.91});
 }
 const picnic=root.getObjectByName('Picnic_print');
 if(picnic&&pictureBookImage){const print=new T.Texture(pictureBookImage);print.colorSpace=T.SRGBColorSpace;print.anisotropy=8;print.needsUpdate=true;picnic.material.map=print;picnic.material.needsUpdate=true}
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

// The board displays a copy; removing a book also removes its work from the exhibition.
export function exhibitedBook(objects){
 let newest=0,book;
 for(const o of objects){
  if(o.kind!=='books'||o.artwork?.target_id!==o.id)continue;
  const match=/^\/api\/drawings\/(\d+)\.png$/.exec(o.artwork.url);
  if(match&&Number(match[1])>newest){newest=Number(match[1]);book=o}
 }
 return book;
}
export function showPinnedDrawing(instance,image,title,canvasFactory=()=>document.createElement('canvas')){
 const card=instance.getObjectByName('Weekend_sketch');if(!card)return;
 const original=card.material,mat=original.clone();
 const map=imageTexture(canvasFactory,720,426,(c,w,h)=>{
  fill(c,0,0,w,h,'#fbf5e8');
  const scale=Math.min((w-32)/image.width,(h-70)/image.height);
  const dw=image.width*scale,dh=image.height*scale;
  c.drawImage(image,(w-dw)/2,12+(h-70-dh)/2,dw,dh);
  c.fillStyle='#626e70';c.font='24px sans-serif';c.fillText(title,24,h-16,w-48);
 });
 mat.map=map;mat.needsUpdate=true;card.material=mat;
 return ()=>{card.material=original;mat.dispose();map.dispose()};
}

// Subtle woven stripes, not painted-on shadows; the mat remains a separate support.
export function finishDiningLinen(root,canvasFactory=()=>document.createElement('canvas')){
 const cloth=root.getObjectByName('Linen_placemat');
 if(!cloth)return;
 const map=imageTexture(canvasFactory,640,544,(c,w,h)=>{
  fill(c,0,0,w,h,'#e2d9c6');
  for(const y of [36,40,47,h-36,h-40,h-47])fill(c,0,y,w,2,'#a5b5b0');
  for(let y=0;y<h;y+=3){c.fillStyle='rgba(131,109,86,.14)';c.fillRect(0,y,w,1)}
  for(let x=0;x<w;x+=3){c.fillStyle='rgba(255,251,235,.29)';c.fillRect(x,0,1,h)}
 });
 map.minFilter=T.LinearMipmapLinearFilter;map.generateMipmaps=true;
 cloth.material=cloth.material.clone();cloth.material.map=map;cloth.material.color.set(0xffffff);cloth.material.roughness=.96;
}

export function finishLinenPillow(root,canvasFactory=()=>document.createElement('canvas')){
 const panels=[];root.traverse(o=>{if(o.isMesh&&o.name.startsWith('Filled_linen_panel'))panels.push(o)});if(!panels.length)return;
 const map=imageTexture(canvasFactory,480,400,(c,w,h)=>{
  fill(c,0,0,w,h,'#8ca7be');
  for(let y=0;y<h;y+=3)for(let x=0;x<w;x+=6){const dx=x+(Math.floor(y/3)%3)*2;fill(c,dx,y,4,1,'rgba(248,245,225,.23)');fill(c,dx-2,y+1,3,1,'rgba(50,76,94,.14)')}
  // Two lines of running stitches follow the edge rather than lying flat in the room.
  c.lineWidth=1.7;c.strokeStyle='#cdd6d4';c.setLineDash([5,4]);c.strokeRect(18,18,w-36,h-36);
 });
 for(const panel of panels){
  const g=panel.geometry,p=g.attributes.position,uv=g.attributes.uv;
  if(!g.userData.shapedLinen)for(let i=0;i<p.count;i++){
   const u=uv.getX(i)*2-1,v=uv.getY(i)*2-1,z=p.getZ(i);
   // Compression radiates from the lower corners; both panels still meet the original piped seam.
   const inside=Math.max(0,(1-u*u)*(1-v*v));
   const pinch=.014*Math.exp(-((v+.60-.59*(1-Math.abs(u)))**2)/.012)*Math.abs(u)**1.4;
   p.setZ(i,z-Math.sign(z)*pinch*Math.sqrt(inside));
  }
  g.userData.shapedLinen=true;p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();
  panel.material.map=map;panel.material.color.set(0xffffff);panel.material.roughness=.98;
 }
}

export function finishSofaThrow(root,canvasFactory=()=>document.createElement('canvas')){
 const wool=root.getObjectByName('Wool_drape');if(!wool)return;
 const map=imageTexture(canvasFactory,512,384,(c,w,h)=>{
  fill(c,0,0,w,h,root.userData.armFit?'#8194a9':'#91a4b8');
  // The bands follow the draped UVs and turn down the arm with the fringe.
  for(const u of [.12,.86])for(const [offset,width,color] of [[-12,3,'#bcc7cc'],[-6,8,'#d5d6cd'],[6,3,'#c4cdcf']])fill(c,u*w+offset,0,width,h,color);
  if(root.userData.armFit){
   // A double row of oat-coloured herringbone runs across the finished hanging hem.
   c.strokeStyle='#d9d8cd';c.lineWidth=2.5;c.beginPath();
   for(let y=-10;y<h+10;y+=12){c.moveTo(w*.907,y);c.lineTo(w*.922,y+5);c.lineTo(w*.907,y+10)}
   c.stroke();fill(c,w*.945,0,2,h,'#e4dfd0');fill(c,w*.965,0,3,h,'#c8caca');
  }
  if(root.userData.armFit){
   let seed=51;for(let i=0;i<24000;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=(seed&511),y=(seed>>>9)%h;
    c.fillStyle=(seed&8192)?'rgba(244,242,228,.16)':'rgba(48,70,94,.13)';
    c.fillRect(x,y,2+(seed%4),1);
   }
   return;
  }
  for(let y=0;y<h;y+=4)for(let x=0;x<w;x+=8){
   const shift=(Math.floor(y/4)%4)*2;
   fill(c,x+shift,y,5,2,'rgba(245,241,222,.22)');
   fill(c,x+shift-2,y+2,3,2,'rgba(55,72,95,.14)');
  }
 });
 wool.material.map=map;wool.material.color.set(0xffffff);wool.material.roughness=.99;
}

export function finishBookStack(root,canvasFactory=()=>document.createElement('canvas')){
 const covers=[];root.traverse(o=>{if(o.isMesh&&o.name.startsWith('Book_back'))covers.push(o)});
 covers.sort((a,b)=>a.position.y-b.position.y);
 for(const cover of covers){
  const bottom=cover.clone(false),spine=cover.clone(false);
  bottom.scale.y=cover.scale.y=.09;bottom.position.y-=.0145;cover.position.y+=.0145;
  spine.scale.x=.026;spine.position.x-=.111;cover.parent.add(bottom,spine);
 }
 const top=covers.at(-1);if(!top)return;
 const print=imageTexture(canvasFactory,512,384,(c,w,h)=>{
  fill(c,0,0,w,h,'#e8ddbc');fill(c,0,0,23,h,'#658078');fill(c,34,27,w-60,2,'#a1ab90');
  text(c,'植物观察簿',50,87,45,'#485f57',true);text(c,'窗边的小花园',52,124,19,'#758b77');
  c.strokeStyle='#698770';c.lineWidth=4;c.beginPath();c.moveTo(160,322);c.bezierCurveTo(240,263,265,298,405,142);c.stroke();
  for(let i=0;i<7;i++){const x=175+i*32,y=309-i*22;c.fillStyle=i%2?'#719078':'#9bac8a';c.beginPath();c.ellipse(x,y+(i%2?10:-14),30,11,i%2?.22:-1,0,Math.PI*2);c.fill()}
  flower(c,365,176,11,'#f4ecca');flower(c,398,142,9,'#fff1ca');
 });
 const face=new T.Mesh(new T.PlaneGeometry(.218,.159),new T.MeshStandardMaterial({map:print,roughness:.89}));
 face.name='Botany-notebook-print';face.rotation.x=-Math.PI/2;face.position.copy(top.position);face.position.y+=.00165;face.receiveShadow=true;top.parent.add(face);
}
