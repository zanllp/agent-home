import * as T from 'three';
import {LIGHTING} from './wander-state.js';

export function hudLayout(width,height){
 const w=Math.min(width-24,470),h=54,x=(width-w)/2,y=height-h-18;
 return Array.from({length:5},(_,i)=>({id:['auto','pause','speed','camera','sound'][i],x:x+i*w/5,y,w:w/5,h}));
}
export function createCanvasHud(){
 const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,.1,10);camera.position.z=2;
 function panel(w,h){const canvas=document.createElement('canvas');canvas.width=w*2;canvas.height=h*2;
  const context=canvas.getContext('2d');context.scale(2,2);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  const mesh=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));scene.add(mesh);return {context,texture,mesh,w,h};
 }
 const veil=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({transparent:true,opacity:0,depthTest:false,depthWrite:false,toneMapped:false}));veil.renderOrder=-1;scene.add(veil);
 const bar=panel(470,54),title=panel(370,64);let width=1,height=1,rects=[],previous='';
 function size(w,h){width=w;height=h;veil.scale.set(w,h,1);rects=hudLayout(w,h);camera.left=-w/2;camera.right=w/2;camera.top=h/2;camera.bottom=-h/2;camera.updateProjectionMatrix();
  const first=rects[0],last=rects[4],bw=last.x+last.w-first.x;bar.mesh.scale.set(bw,54,1);bar.mesh.position.set(0,h/2-first.y-27,0);
  const tw=Math.min(370,w-32);title.mesh.scale.set(tw,64,1);title.mesh.position.set(-w/2+16+tw/2,h/2-48,0);previous='';
 }
 function lineText(c,text){text=String(text);if(c.measureText(text).width<=350)return text;while(text.length&&c.measureText(text+'…').width>350)text=text.slice(0,-1);return text+'…'}
 function rounded(c,x,y,w,h,r,fill){c.fillStyle=fill;c.beginPath();c.roundRect(x,y,w,h,r);c.fill()}
 function update(s){if(!rects.length)return;const key=JSON.stringify(s);if(key===previous)return;previous=key;const light=LIGHTING[s.light||'day'];veil.material.color.set(light.tint);veil.material.opacity=light.opacity;
  const c=bar.context;c.clearRect(0,0,470,54);rounded(c,0,0,470,54,22,'rgba(255,253,247,.95)');
  const objectLabel=['approaching','entering'].includes(s.objectPhase)?'取消':s.objectPhase==='leaving'?'起身中':s.objectPose==='sleep'?'起床':['sit','read'].includes(s.objectPose)?'起身':null;
  const labels=[objectLabel||(s.auto?'逛逛':'休息'),s.paused?'继续':'暂停',s.brisk?'走跑走':'慢慢走',{home:'全景',follow:'跟随',front:'正面',face:'看脸',portrait:'斜侧',side:'侧面',back:'背面',top:'俯视'}[s.cameraMode],s.sound?'有声':'静音'];
  for(let i=0;i<5;i++){const active=[s.auto,s.paused,s.brisk,s.cameraMode!=='home',s.sound][i];if(active)rounded(c,i*94+5,6,84,42,16,'#e4ede1');
   c.font=`bold ${13*470/(rects[0].w*5)}px -apple-system,"PingFang SC",sans-serif`;c.fillStyle=s.ready?'#4b6252':'#9ba396';c.textAlign='center';c.textBaseline='middle';c.fillText(labels[i],i*94+47,28);
  }bar.texture.needsUpdate=true;
  const night=s.light==='night',t=title.context;t.clearRect(0,0,370,64);t.textAlign='left';t.textBaseline='top';t.shadowColor=night?'#172a47':'rgba(255,253,245,.85)';t.shadowBlur=8;t.font='bold 17px -apple-system,"PingFang SC",sans-serif';t.fillStyle=night?'#f4f0e6':'#455e4c';t.fillText('大肥鱼的小家',8,8);t.font='12px -apple-system,"PingFang SC",sans-serif';t.fillStyle=night?'#dde4df':'#687a68';t.fillText(lineText(t,s.error||(!s.ready?'正在穿好小鞋子…':s.notice|| (s.paused?'停一会儿':s.status))),8,35);title.texture.needsUpdate=true;
 }
 return {size,update,hit(x,y){return rects.find(r=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h)?.id},render(renderer){const clear=renderer.autoClear;renderer.autoClear=false;renderer.clearDepth();renderer.render(scene,camera);renderer.autoClear=clear},dispose(){veil.geometry.dispose();veil.material.dispose();for(const p of [bar,title]){p.mesh.geometry.dispose();p.mesh.material.dispose();p.texture.dispose()}}};
}
