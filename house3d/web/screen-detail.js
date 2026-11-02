import * as T from 'three';

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
function television(ctx,w,h,image){
 if(image){const scale=Math.max(w/image.width,h/image.height);ctx.drawImage(image,(w-image.width*scale)/2,(h-image.height*scale)/2,image.width*scale,image.height*scale)}else{ctx.fillStyle='#577d83';ctx.fillRect(0,0,w,h)}
 const fade=ctx.createLinearGradient(0,0,w,0);fade.addColorStop(0,'rgba(17,35,40,.88)');fade.addColorStop(.55,'rgba(17,35,40,.25)');fade.addColorStop(1,'rgba(17,35,40,.08)');ctx.fillStyle=fade;ctx.fillRect(0,0,w,h);
 const lower=ctx.createLinearGradient(0,h*.35,0,h);lower.addColorStop(0,'rgba(16,31,36,0)');lower.addColorStop(1,'rgba(16,31,36,.93)');ctx.fillStyle=lower;ctx.fillRect(0,0,w,h);
 text(ctx,'首页     电影     纪录片     音乐',90,87,27,'#e2e8df');text(ctx,'周末片单',91,270,74,'#fff9eb',true);text(ctx,'城市慢游',94,340,37,'#eee9da');text(ctx,'熟悉的街角，也有新的风景。',96,393,25,'#ccd8ce');rounded(ctx,94,440,183,57,28,'#edead9');text(ctx,'看看这座城',119,478,23,'#3a5758',true);
 const titles=['留一点阳光','家里的时光','安静听一会儿'];for(let i=0;i<3;i++){const x=94+i*350,y=h-250;rounded(ctx,x,y,316,160,15,['#567c76','#9f977e','#4f647b'][i]);if(image&&i<2){ctx.save();ctx.beginPath();ctx.roundRect(x,y,316,160,15);ctx.clip();ctx.drawImage(image,i*image.width*.2,0,image.width*.6,image.height,x,y,316,160);ctx.fillStyle='rgba(23,45,49,.35)';ctx.fillRect(x,y,316,160);ctx.restore()}else{ctx.strokeStyle='#a4b9bd';ctx.lineWidth=3;for(const r of [24,40,56]){ctx.beginPath();ctx.arc(x+158,y+75,r,0,Math.PI*2);ctx.stroke()}}text(ctx,titles[i],x+16,y+135,22,'#fff8e7',true)}
}
export function drawScreen(ctx,kind,width,height,image){ctx.textBaseline='alphabetic';if(kind==='television')television(ctx,width,height,image);else if(kind==='notes')notes(ctx,width,height);else editor(ctx,width,height)}
export function screenSurfacePlan(root){const list=[];root.traverse(mesh=>{if(!mesh.isMesh||!/^(?:Display|Blue[ _]screen(?:\.?\d+)?)$/.test(mesh.name))return;mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox;list.push({mesh,width:box.max.x-box.min.x,height:box.max.y-box.min.y,z:box.max.z+.0015,kind:mesh.name==='Display'?'television':/^Blue[ _]screen$/.test(mesh.name)?'editor':'notes'})});return list}
export function enhanceScreens(root,{canvasFactory=()=>document.createElement('canvas'),televisionImage}={}){
 root.traverse(mesh=>{if(mesh.isMesh&&/^(Editor[ _]lines|Quiet[ _]horizon)/.test(mesh.name))mesh.visible=false});
 for(const plan of screenSurfacePlan(root)){
  const canvas=canvasFactory();canvas.width=plan.kind==='notes'?768:1920;canvas.height=Math.round(canvas.width*plan.height/plan.width);drawScreen(canvas.getContext('2d'),plan.kind,canvas.width,canvas.height,televisionImage);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;
  const face=new T.Mesh(new T.PlaneGeometry(plan.width*.995,plan.height*.995),new T.MeshBasicMaterial({map:texture,toneMapped:false}));face.position.z=plan.z;face.name='Detailed-screen-'+plan.kind;plan.mesh.add(face);
 }
 return root;
}
