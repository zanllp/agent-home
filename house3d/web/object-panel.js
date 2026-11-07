import {fitOverlayQuad} from './overlay-quad.js';
import * as T from 'three';
const categories=[['all','全部'],['seating','坐具'],['sleeping','寝具'],['study','学习'],['play','玩具'],['lighting','灯光'],['storage','收纳'],['appliances','家电'],['decoration','装饰'],['environment','环境'],['tables','桌几']];
export function createObjectPanel(){
 const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,.1,10);camera.position.z=2;
 const canvas=document.createElement('canvas'),c=canvas.getContext('2d'),texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
 const mesh=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));scene.add(mesh);
 let width=1,height=1,rects=[],open=false,category='all',page=0,selected=null,data={objects:[]},pending=false,previous='';
 function size(w,h){texture.dispose();width=w;height=h;canvas.width=w*2;canvas.height=h*2;c.setTransform(2,0,0,2,0,0);camera.left=-w/2;camera.right=w/2;camera.top=h/2;camera.bottom=-h/2;camera.updateProjectionMatrix();mesh.scale.set(w,h,1);previous=''}
 function button(id,label,x,y,w,h,active=false,enabled=true){rects.push({id,x,y,w,h,enabled});c.fillStyle=active?'#dce9dc':'#f4f1e9';c.beginPath();c.roundRect(x,y,w,h,12);c.fill();c.fillStyle=enabled?'#405747':'#9a9c94';c.font='bold 13px -apple-system,"PingFang SC",sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(label,x+w/2,y+h/2)}
 function text(s,x,y,bold=false,color='#405747'){c.fillStyle=color;c.textAlign='left';c.textBaseline='top';c.font=`${bold?'bold ':''}13px -apple-system,"PingFang SC",sans-serif`;c.fillText(s,x,y)}
 function update(next){data=next||data;const key=JSON.stringify([width,height,open,category,page,selected,open?data:null,pending]);if(key===previous)return;previous=key;c.clearRect(0,0,width,height);rects=[];
  fitOverlayQuad(mesh,width,height,open?null:{x:width-94,y:18,w:76,h:36});
  button('toggle',open?'收起物品':'物品',width-94,18,76,36,open);
  if(open){const w=Math.min(380,width-24),x=width-w-12,y=78,h=Math.min(510,height-168);c.fillStyle='rgba(255,253,247,.98)';c.beginPath();c.roundRect(x,y,w,h,20);c.fill();rects.push({id:'panel',x,y,w,h,enabled:true});text('家里的东西',x+18,y+18,true);
   categories.forEach(([id,label],i)=>button('category:'+id,label,x+14+(i%6)*(w-28)/6,y+46+Math.floor(i/6)*36,(w-36)/6,30,category===id));
   const items=data.objects.filter(o=>category==='all'||o.category===category),perPage=Math.max(1,Math.min(4,Math.floor((h-255)/44)));page=Math.max(0,Math.min(page,Math.ceil(items.length/perPage)-1));
   items.slice(page*perPage,(page+1)*perPage).forEach((o,i)=>button('select:'+o.id,o.label,x+18,y+128+i*44,w-36,38,selected===o.id));
   const bottom=y+128+perPage*44;button('prev','‹',x+18,bottom+4,34,28);button('next','›',x+w-52,bottom+4,34,28);text(`${page+1} / ${Math.max(1,Math.ceil(items.length/perPage))}`,x+w/2-18,bottom+10);
   const obj=data.objects.find(o=>o.id===selected);if(obj){text(obj.label,x+18,bottom+46,true);const actions=(obj.actions||[]).filter(a=>a.available);if(!actions.length)text(obj.actions?.length?'先结束当前互动，再试试这里':'还没有生活动作，可由 Agent 调整摆放',x+18,bottom+72,false,'#858b7f');actions.slice(0,3).forEach((a,i)=>button('action:'+encodeURIComponent(obj.id)+':'+a.id,a.label,x+18+i*(w-36)/3,bottom+70,(w-48)/3,34,false,a.available&&!pending));if(obj.on&&!obj.interaction){const parent=data.objects.find(o=>o.id===obj.on.id);text('放在'+(parent?.label||'家具')+'上',x+18,bottom+103,false,'#858b7f')}if(obj.interaction)text(({requested:'准备中',approaching:'正在走过去',entering:'正在就位',active:'正在互动',leaving:'正在起身',completed:'已结束',failed:'暂时走不过去'})[obj.interaction.phase],x+18,bottom+112)}else text('选一件物品，看看可以做什么',x+18,bottom+56,false,'#858b7f');
  }texture.needsUpdate=true;
 }
 function hit(x,y){return [...rects].reverse().find(r=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h)}
 function activate(id){if(id==='toggle')open=!open;else if(id.startsWith('category:')){category=id.slice(9);page=0;selected=null}else if(id.startsWith('select:'))selected=id.slice(7);else if(id==='prev')page=Math.max(0,page-1);else if(id==='next')page++;previous=''}
 return {size,update,hit,activate,get open(){return open},get pending(){return pending},set pending(v){pending=v;previous=''},render(renderer){const clear=renderer.autoClear;renderer.autoClear=false;renderer.render(scene,camera);renderer.autoClear=clear},dispose(){texture.dispose();mesh.geometry.dispose();mesh.material.dispose()}};
}
