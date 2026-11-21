// A cylindrical unwrap has its seam at the back; u=.5 is the centre front.
import {CanvasTexture, SRGBColorSpace, RepeatWrapping} from 'three';
const swatches={};
export async function loadSwatches(){
 for(const [key,file] of Object.entries({winter:'snow-letter',night:'moon-tide',boot:'boot',stocking:'stocking'})){
  const img=new Image();img.src=new URL('./swatches/'+file+'.jpg',import.meta.url).href;await img.decode();
  const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);swatches[key]=ctx.getImageData(0,0,c.width,c.height);
 }
}
// Fit selected front panels to the existing cylindrical UVs. Side/back panels
// keep their own fabric, rather than wrapping a second clasp/pocket around back.
function frontPanel(ctx,kind){
 if(kind==='fur'){
  const d=ctx.getImageData(0,0,ctx.canvas.width,ctx.canvas.height),src=swatches.winter;
  for(let y=0;y<d.height;y++)for(let x=0;x<d.width;x++){
   const f=x/48,repeat=1-Math.abs(f%2-1),sx=Math.round(85+repeat*65),sy=Math.round(101+repeat*19+11*y/d.height),i=(y*d.width+x)*4,j=(sy*src.width+sx)*4;
   for(let c=0;c<3;c++)d.data[i+c]=src.data[j+c];
  }ctx.putImageData(d,0,0);return;
 }
 const spec={
  boot:['boot',55,[[0,13,12],[.25,35,13],[.58,64,17],[.77,81,18],[1,101,19]]],
  stocking:['stocking',43,[[0,21,17],[.48,57,19],[1,95,16]]],
  cape:['winter',203,[[.0,28,37],[.30,52,70],[.62,86,95],[1,110,116]]],
  skirt:['winter',202,[[0,159,60],[.26,196,83],[.52,243,110],[.76,288,139],[1,343,157]]],
  shirt:['night',187,[[0,49,40],[.11,67,54],[.3,105,59],[.59,177,64],[.79,225,77],[1,281,94]]],
  pants:['night',142,[[0,305,27],[.28,355,34],[.72,448,36],[1,505,35]]]
 }[kind], [key,cx,rows]=spec,src=swatches[key];if(!src)throw Error('Missing cloth swatch');
 const d=ctx.getImageData(0,0,ctx.canvas.width,ctx.canvas.height),w=d.width,h=d.height;
 for(let y=0;y<h;y++){const v=y/(h-1);let k=1;while(rows[k][0]<v)k++;const a=rows[k-1],b=rows[k],mix=(v-a[0])/(b[0]-a[0]),cy=a[1]+(b[1]-a[1])*mix,rx=a[2]+(b[2]-a[2])*mix;
  for(let x=0;x<w;x++){const ang=(x/w-.5)*2*Math.PI,amp=Math.min(1,Math.max(0,(1.52-Math.abs(ang))/.32));if(!amp)continue;
   const lateral=Math.sin(ang),sx=Math.round(cx+lateral*rx),sy=Math.round(cy-(kind==='skirt'?13:kind==='shirt'?6:0)*lateral*lateral*v),srcI=(sy*src.width+sx)*4,i=(y*w+x)*4;
   for(let c=0;c<3;c++)d.data[i+c]+=(src.data[srcI+c]-d.data[i+c])*amp;
  }
 }
 ctx.putImageData(d,0,0);
}
export function textile(kind) {
 const c=document.createElement('canvas');c.width=1024;c.height=512;
 const g=c.getContext('2d'),w=c.width,h=c.height;
 const base={boot:['#424e87','#232943'],stocking:['#f9eddd','#ddcdb9'],fur:['#fff3df','#e8d8c7'],skirt:['#495c9a','#212950'],cape:['#fffaeb','#d4c2b6'],shirt:['#b9c8ee','#919fc9'],pants:['#b3c3e8','#92a4c8']}[kind];
 const grad=g.createLinearGradient(0,0,0,h);grad.addColorStop(0,base[0]);grad.addColorStop(1,base[1]);g.fillStyle=grad;g.fillRect(0,0,w,h);
 const line=(x,y,X,Y,color,width)=>{g.beginPath();g.moveTo(x,y);g.lineTo(X,Y);g.strokeStyle=color;g.lineWidth=width;g.stroke()};
 const rect=(x,y,a,b,color)=>{g.fillStyle=color;g.fillRect(x,y,a,b)};
 const dot=(x,y,r,color)=>{g.beginPath();g.ellipse(x,y,r,r,0,0,Math.PI*2);g.fillStyle=color;g.fill()};
 const tri=(x,y,a,b,color)=>{g.fillStyle=color;g.beginPath();g.moveTo(x,y);g.lineTo(x-a,y+b);g.lineTo(x+a,y+b);g.fill()};
 let seed=223;const rand=()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
 for(let i=0;i<15000;i++){const x=rand()*w,y=rand()*h;line(x,y,x+1+rand()*2,y+1,i%2?'#ffffff23':'#29284012',1)}
 function snow(x,y,r){g.save();g.translate(x,y);for(let j=0;j<6;j++){line(0,0,0,-r,'#c4ddee',2);line(0,-r*.55,-r*.27,-r*.8,'#c4ddee',1.5);line(0,-r*.55,r*.27,-r*.8,'#c4ddee',1.5);g.rotate(Math.PI/3)}g.restore()}
 if(kind==='skirt'){
  for(let i=0;i<95;i++){const x=rand()*w,y=110+rand()*286;dot(x,y,1+rand()*2,'#f6efe0');if(i%10===0)snow(x,y,10)}
  for(let i=0;i<24;i++){const x=(i+.5)*w/24,y=424+9*Math.sin(x*Math.PI/128);
   if(i%4===0||i%4===1){const ht=i%4?24:37;rect(x-9,y-ht,18,ht,'#e7dbc2');tri(x,y-ht-16,13,17,'#fcf9e8');rect(x-5,y-ht+7,4,7,'#edb65f');rect(x+3,y-ht+7,4,7,'#edb65f')}
   else for(let j=0;j<3;j++)tri(x,y-33+j*8,5+j*2.7,15,'#e0e5dc');
  }
  for(let i=0;i<w;i++)rect(i,425+9*Math.sin(i*Math.PI/128),1,3,'#efe7cc');
  rect(0,459,w,3,'#dfc28f');rect(0,469,w,2,'#d5c3a6');
 } else if(kind==='cape'){for(let i=0;i<16;i++)snow((i+.5)*64,293+20*Math.cos(i*Math.PI),18)}
 else if(kind==='shirt'){
  rect(507,0,9,h,'#9baacd');rect(512,0,2,h,'#f7f1df');
  for(let y=112;y<480;y+=91){dot(512,y+2,6,'#8291ad');dot(512,y,5.2,'#fff4d9');dot(511,y-1,1,'#aa9b88');dot(514,y+1,1,'#aa9b88')}
  const x=594,y=222;g.fillStyle='#d1dcf1';g.beginPath();g.roundRect(x-35,y-30,70,78,[2,2,15,15]);g.fill();rect(x-35,y-30,70,5,'#fff3e0');
  g.fillStyle='#6089cd';g.beginPath();g.ellipse(x,y+10,17,10,-.05,0,Math.PI*2);g.fill();tri(x+17,y,7,9,'#6089cd');dot(x-8,y+8,1.4,'#354974');
 }
 frontPanel(g,kind);
 const texture=new CanvasTexture(c);texture.colorSpace=SRGBColorSpace;texture.wrapS=RepeatWrapping;return texture;
}
