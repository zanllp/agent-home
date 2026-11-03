import * as T from 'three';
import {drawHarborPaper} from './desktop-wallpaper.js';
import {cartoons} from './screen-cartoons.js';

function rounded(ctx,x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
function text(ctx,value,x,y,size,color='#d9e2df',bold=false){ctx.font=`${bold?'bold ':''}${size}px sans-serif`;ctx.fillStyle=color;ctx.fillText(value,x,y)}
function editor(ctx,w,h){
 ctx.fillStyle='#1e292f';ctx.fillRect(0,0,w,h);rounded(ctx,0,0,w,72,0,'#29383f');
 for(const [i,c] of ['#c9887d','#d8b874','#82ad9b'].entries()){ctx.fillStyle=c;ctx.beginPath();ctx.arc(34+i*31,36,8,0,Math.PI*2);ctx.fill()}
 text(ctx,'home-scene.ts',190,46,27);text(ctx,'Agent Home',w-200,46,24,'#91aaa8');
 ctx.fillStyle='#243239';ctx.fillRect(0,72,290,h-114);text(ctx,'小家',36,123,28,'#e2e5da',true);
 ['场景','  living-room.ts','  furniture.ts','  activities.ts','素材','  plants','  textiles','说明'].forEach((v,i)=>{if(i===1)rounded(ctx,16,147+i*45,258,43,5,'#34484f');text(ctx,v,34,178+i*45,22,i===1?'#eef5e8':'#aebfc0')});
 rounded(ctx,308,87,261,45,6,'#33454b');text(ctx,'home-scene.ts',332,118,24,'#e7e5ce');
 const code=[['import ',"{ Room, Furniture }",' from ',"'agent-home'"],[''],['const ','home',' = new ','Room','({'],['  name: ',"'我们的家'",','],['  daylight: ',"'soft-morning'",','],['  windows: ',"'courtyard'"],['});'],[''],['home','.place(',"'reading-chair'",', {'],['  near: ',"'bookshelf'",','],['  facing: ',"'window'"],['});'],[''],['await ','home','.relax();']];
 for(let i=0;i<code.length;i++){text(ctx,String(i+1),317,179+i*44,21,'#68818a');let x=373;for(const part of code[i]){const c=part.startsWith("'")?'#c9c895':/const|import|await/.test(part)?'#a2bbd5':/Room|Furniture|place|relax/.test(part)?'#a0d4bd':'#d3dcda';text(ctx,part,x,179+i*44,27,c);x+=ctx.measureText(part).width}}
 rounded(ctx,320,h-160,w-340,100,8,'#24373d');text(ctx,'TERMINAL',344,h-121,19,'#8ca4a8');text(ctx,'✓  小家已准备好',344,h-82,25,'#a4c6af');
 ctx.fillStyle='#405e60';ctx.fillRect(0,h-42,w,42);text(ctx,'main   ✓',25,h-14,19,'#e0e8df');text(ctx,'TypeScript    UTF-8',w-260,h-14,18,'#e0e8df');
}
function notes(ctx,w,h){
 ctx.fillStyle='#f3f0e7';ctx.fillRect(0,0,w,h);rounded(ctx,0,0,w,85,0,'#e5e9df');text(ctx,'随手记',45,57,32,'#435953',true);
 text(ctx,'给平常的日子',48,172,35,'#4e655c',true);text(ctx,'留一点小小的期待',48,221,24,'#819084');
 rounded(ctx,37,275,w-74,380,20,'#dfe8dc');
 ctx.strokeStyle='#7c9b85';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(w*.51,601);ctx.bezierCurveTo(w*.39,490,w*.62,424,w*.51,335);ctx.stroke();
 for(let i=0;i<7;i++){const y=363+i*31,side=i%2?-1:1;ctx.save();ctx.translate(w*.51,y);ctx.rotate(side*.55);ctx.fillStyle=i%2?'#8da98f':'#afbea0';ctx.beginPath();ctx.ellipse(side*35,0,48,17,0,0,Math.PI*2);ctx.fill();ctx.restore()}
 text(ctx,'今天的小计划',48,750,30,'#435953',true);
 for(const [i,t] of ['看一会儿书','画一棵树','一起散步'].entries()){rounded(ctx,48,800+i*92,28,28,7,i===0?'#9fb7a4':'#e0e3d8');if(i===0)text(ctx,'✓',51,824+i*92,26,'#ffffff',true);text(ctx,t,96,825+i*92,26,'#627267')}
 ctx.strokeStyle='#d5d9ce';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(48,1120);ctx.lineTo(w-48,1120);ctx.stroke();text(ctx,'慢慢来，也很好。',48,1191,27,'#8b998b');
}
function terminal(c,w,h,t){
 c.fillStyle='#243840';c.fillRect(0,0,w,h);rounded(c,32,38,w-64,h-76,18,'#1c2c33');text(c,'终端   /   家庭工作台',70,107,34,'#b8d5bf',true);
 text(c,'›  home / studio',72,167,25,'#87aab0');
 const rows=['$ node start.mjs','  正在整理书架…','  房间已准备好','> garden.sketch','  种下薄荷和小番茄','  今天也会有好天气。'];
 rows.forEach((s,i)=>{const n=Math.max(0,Math.floor(t*9)+18-i*13);text(c,s.slice(0,n),72,213+i*65,32,i===0||i===3?'#e7cb8e':'#a6c9c0')});
}
function planner(c,w,h,t){
 c.fillStyle='#f5efdf';c.fillRect(0,0,w,h);rounded(c,28,35,w-56,158,24,'#c6d9c9');text(c,'这一周',62,140,53,'#415f58',true);
 const day=Math.floor(t/2)%7;
 for(let i=0;i<7;i++){const y=254+i*116;rounded(c,35,y,w-70,91,14,i===day?'#efd3a3':'#e4e8dc');text(c,'日一二三四五六'[i],63,y+59,34,'#6c8276',true);text(c,['逛花市','读书','买水果','整理画笔','浇花','看动画','晒太阳'][i],145,y+59,31,'#486157')}
}
function channelGuide(ctx,w,h,image){
 if(image){const scale=Math.max(w/image.width,h/image.height);ctx.drawImage(image,(w-image.width*scale)/2,(h-image.height*scale)/2,image.width*scale,image.height*scale)}else{ctx.fillStyle='#577d83';ctx.fillRect(0,0,w,h)}
 const fade=ctx.createLinearGradient(0,0,w,0);fade.addColorStop(0,'rgba(17,35,40,.88)');fade.addColorStop(.55,'rgba(17,35,40,.25)');fade.addColorStop(1,'rgba(17,35,40,.08)');ctx.fillStyle=fade;ctx.fillRect(0,0,w,h);
 const lower=ctx.createLinearGradient(0,h*.35,0,h);lower.addColorStop(0,'rgba(16,31,36,0)');lower.addColorStop(1,'rgba(16,31,36,.93)');ctx.fillStyle=lower;ctx.fillRect(0,0,w,h);
 text(ctx,'首页     电影     纪录片     音乐',90,87,27,'#e2e8df');text(ctx,'周末片单',91,270,74,'#fff9eb',true);text(ctx,'城市慢游',94,340,37,'#eee9da');text(ctx,'熟悉的街角，也有新的风景。',96,393,25,'#ccd8ce');rounded(ctx,94,440,183,57,28,'#edead9');text(ctx,'看看这座城',119,478,23,'#3a5758',true);
 const titles=['留一点阳光','家里的时光','安静听一会儿'];for(let i=0;i<3;i++){const x=94+i*350,y=h-250;rounded(ctx,x,y,316,160,15,['#567c76','#9f977e','#4f647b'][i]);if(image&&i<2){ctx.save();ctx.beginPath();ctx.roundRect(x,y,316,160,15);ctx.clip();ctx.drawImage(image,i*image.width*.2,0,image.width*.6,image.height,x,y,316,160);ctx.fillStyle='rgba(23,45,49,.35)';ctx.fillRect(x,y,316,160);ctx.restore()}else{ctx.strokeStyle='#a4b9bd';ctx.lineWidth=3;for(const r of [24,40,56]){ctx.beginPath();ctx.arc(x+158,y+75,r,0,Math.PI*2);ctx.stroke()}}text(ctx,titles[i],x+16,y+135,22,'#fff8e7',true)}
}
function deskWindow(c,x,y,w,h,painter){
 c.save();rounded(c,x-2,y+4,w+4,h+4,13,'rgba(24,49,61,.23)');
 c.beginPath();c.roundRect(x,y,w,h,12);c.clip();c.translate(x,y);painter(w,h);c.restore();
}
function previewCard(c,w,h,t){
 c.fillStyle='#fbf5e6';c.fillRect(0,0,w,h);rounded(c,0,0,w,41,0,'#dce8df');
 text(c,'周末手作   /   色彩练习',19,28,17,'#476365',true);
 const x=w*.18,y=h*.26;rounded(c,x,y,w*.65,h*.40,8,'#b5d1ce');rounded(c,x+w*.18,y+h*.14,w*.26,h*.22,4,'#e9d1a5');
 c.fillStyle='#a98068';c.beginPath();c.moveTo(x+w*.15,y+h*.15);c.lineTo(x+w*.31,y+h*.04);c.lineTo(x+w*.48,y+h*.15);c.fill();
 rounded(c,x+w*.28,y+h*.23,w*.07,h*.13,2,'#a8b3a4');
 for(const [i,color] of ['#86a8aa','#d5b889','#b87f6c','#819e86'].entries()){
  rounded(c,w*.18+i*w*.17,h*.76,w*.14,h*.084,4,color);
  if(i===Math.floor(t/3)%4)rounded(c,w*.18+i*w*.17,h*.88,w*.14,3,1,'#819894');
 }
}
function workstationDesktop(c,kind,program,t,w,h,paper){
 c.drawImage(paper,0,0,w,h);
 if(kind==='editor'){
  rounded(c,0,0,w,33,0,'rgba(234,241,232,.87)');text(c,'工作间    文件    视图',18,23,17,'#405b65',true);
  deskWindow(c,w*.042,h*.11,w*.64,h*.72,(cw,ch)=>{
   c.scale(cw/1600,ch/900);
   if(program==='editor'){editor(c,1600,900);if(Math.floor(t)%2===0)rounded(c,560,728,4,28,1,'#d2dcba')}
   else terminal(c,1600,900,t);
  });
  deskWindow(c,w*.55,h*.35,w*.35,h*.48,(cw,ch)=>previewCard(c,cw,ch,t));
  rounded(c,w*.405,h*.925,w*.19,h*.054,15,'rgba(235,240,229,.78)');
  for(const [i,color] of ['#6c93aa','#dca577','#7b9895','#a8b887'].entries())rounded(c,w*.42+w*.044*i,h*.935,h*.035,h*.035,6,color);
 }else{
  const cw=w*.88,ch=h*.75;
  deskWindow(c,w*.06,h*.19,cw,ch,()=>{
   c.scale(cw/768,ch/1290);
   if(program==='notes')notes(c,768,1290);else planner(c,768,1290,t);
  });
 }
}
function drawProgram(c,kind,program,t,w,h,televisionImage,paper){
 c.save();
 if(program==='guide'){
  c.scale(w/1920,h/1080);channelGuide(c,1920,1080,televisionImage);
 }else if(kind==='television'){
  c.scale(w/640,h/360);cartoons[program](c,t);
  rounded(c,18,16,105,24,10,'rgba(47,61,71,.52)');text(c,({bike:'猫咪单车日记',sea:'海风小帆船',night:'星夜气球'})[program],28,33,14,'#fff6e4',true);
 }else{
  const width=kind==='editor'?1600:768,height=width*h/w;c.scale(w/width,h/height);
  workstationDesktop(c,kind,program,t,width,height,paper);
 }
 c.restore();
}
// A shuffled deck gives every program airtime and never repeats across a deck boundary.
export function screenPlayback(kind,paint,random=Math.random){
 const options=kind==='television'?Object.keys(cartoons):kind==='notes'?['notes','planner']:['editor','terminal'];
 let bag=[],previousProgram,current,time=0,remaining=0,last=-Infinity;
 function next(){
  time=0;last=-Infinity;
  if(kind==='television'&&!bag.length&&current!=='guide'){
   current='guide';remaining=6;return;
  }
  if(!bag.length){bag=[...options];for(let i=bag.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]]}
   if(bag.at(-1)===previousProgram)[bag[0],bag[bag.length-1]]=[bag.at(-1),bag[0]]}
  current=previousProgram=bag.pop();remaining=(kind==='television'?12:18)+random()*9;
 }
 function tick(dt){remaining-=dt;time+=dt;if(remaining<=0)next();
  if((current!=='guide'||last===-Infinity)&&time-last>=1/(kind==='television'?12:2)){paint(current,time);last=time}}
 tick(0);return tick;
}
export function screenSurfacePlan(root){const list=[];root.traverse(mesh=>{if(!mesh.isMesh||!/^(?:Display|Blue[ _]screen(?:\.?\d+)?)$/.test(mesh.name))return;mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox;list.push({mesh,width:box.max.x-box.min.x,height:box.max.y-box.min.y,z:box.max.z+.0015,kind:mesh.name==='Display'?'television':/^Blue[ _]screen$/.test(mesh.name)?'editor':'notes'})});return list}
export function enhanceScreens(root,{canvasFactory=()=>document.createElement('canvas'),players,random,televisionImage}={}){
 root.traverse(mesh=>{if(mesh.isMesh&&/^(Editor[ _]lines|Quiet[ _]horizon)/.test(mesh.name))mesh.visible=false});
 for(const plan of screenSurfacePlan(root)){
  const canvas=canvasFactory();canvas.width=plan.kind==='television'?640:plan.kind==='notes'?600:1024;canvas.height=Math.round(canvas.width*plan.height/plan.width);const ctx=canvas.getContext('2d');
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;
  let paper;if(plan.kind!=='television'){paper=canvasFactory();paper.width=canvas.width;paper.height=canvas.height;drawHarborPaper(paper.getContext('2d'),paper.width,paper.height)}
  const tick=screenPlayback(plan.kind,(program,t)=>{drawProgram(ctx,plan.kind,program,t,canvas.width,canvas.height,televisionImage,paper);texture.needsUpdate=true},random);
  if(players){players.add(tick);texture.addEventListener('dispose',()=>players.delete(tick))}
  const face=new T.Mesh(new T.PlaneGeometry(plan.width*.995,plan.height*.995),new T.MeshBasicMaterial({map:texture,toneMapped:false}));face.position.z=plan.z;face.name='Detailed-screen-'+plan.kind;plan.mesh.add(face);
 }
 return root;
}
