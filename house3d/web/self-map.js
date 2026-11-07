import {fitOverlayQuad} from './overlay-quad.js';
import {spaceBounds,balconyGeometry,regionAt} from '../shared/space.mjs';
import {roomDimensions} from './room-size.js';
import * as T from 'three';
export function heading(yaw){const degrees=((yaw*180/Math.PI)%360+360)%360,labels=['前墙','右前方','右墙','右后方','后墙','左后方','左墙','左前方'];return {degrees:Math.round(degrees)%360,label:labels[Math.floor((degrees+22.5)/45)%8],forward:{x:Math.sin(yaw),z:Math.cos(yaw)}}}
export function selfMapLayout(width,height,room={}){const bounds=spaceBounds(room),ratio=(bounds.maxZ-bounds.minZ)/(bounds.maxX-bounds.minX),narrow=width<520,toggle={x:width-(narrow?94:178),y:narrow?62:18,w:76,h:36},w=Math.min(246,width-24),y=narrow?108:78,h=Math.min(286,height-y-86),panel={x:width-w-12,y,w,h},mapH=Math.max(36,Math.min((w-48)*ratio,h-120)),mapW=mapH/ratio;return {toggle,panel,map:{x:panel.x+(w-mapW)/2,y:y+37,w:mapW,h:mapH}}}
export function mapPoint(point,rect,room={}){const b=spaceBounds(room);return {x:rect.x+(point.x-b.minX)/(b.maxX-b.minX)*rect.w,y:rect.y+(point.z-b.minZ)/(b.maxZ-b.minZ)*rect.h}}
const n=v=>(Math.abs(v)<.005?0:v).toFixed(2);
const names={bed:'床',desk:'书桌',chair:'椅子',sofa:'沙发',armchair:'单人椅',nightstand:'床头柜',sideboard:'收纳柜',fridge:'冰箱',office_chair:'办公椅',dining_chair:'餐椅',coffee_table:'茶几',dining_table:'餐桌',media_console:'电视柜',tv:'电视',washer:'洗衣机',drying_rack:'晾衣架',computer:'主机',plant:'绿植',lamp:'灯',shelf:'书架',window:'窗',rug:'地毯'};
export function createSelfMap(){
 const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,.1,10);camera.position.z=2;
 const canvas=document.createElement('canvas'),c=canvas.getContext('2d'),texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
 const material=new T.MeshBasicMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}),mesh=new T.Mesh(new T.PlaneGeometry(1,1),material);scene.add(mesh);
 let width=1,height=1,open=false,hidden=false,layout=selfMapLayout(320,568),previous='',drawnAt=0;
 function size(w,h){texture.dispose();width=w;height=h;canvas.width=w*2;canvas.height=h*2;c.setTransform(2,0,0,2,0,0);camera.left=-w/2;camera.right=w/2;camera.top=h/2;camera.bottom=-h/2;camera.updateProjectionMatrix();mesh.scale.set(w,h,1);layout=selfMapLayout(w,h);previous=''}
 function round(r,fill){c.fillStyle=fill;c.beginPath();c.roundRect(r.x,r.y,r.w,r.h,14);c.fill()}
 function text(value,x,y,bold=false,color='#536758',align='left'){c.font=`${bold?'bold ':''}12px -apple-system,"PingFang SC",sans-serif`;c.fillStyle=color;c.textAlign=align;c.textBaseline='middle';c.fillText(value,x,y)}
 function update({ready,body,objects=[],assets={},catalog={},route=[],paused=false,hidden:hide=false,room={}}){
  hidden=hide;mesh.visible=!hide;const key=JSON.stringify(open?[width,height,open,hidden,ready,body,objects,route,paused,room]:[width,height,open,hidden]);if(key===previous)return;const now=performance.now();if(previous&&now-drawnAt<100)return;previous=key;drawnAt=now;c.clearRect(0,0,width,height);if(hidden){texture.needsUpdate=true;return}
  layout=selfMapLayout(width,height,room);fitOverlayQuad(mesh,width,height,open?null:layout.toggle);const dimensions=roomDimensions(room);const {toggle,panel,map}=layout;round(toggle,open?'#dce9dc':'rgba(255,253,247,.95)');text(open?'收起位置':'位置',toggle.x+toggle.w/2,toggle.y+18,true,'#405747','center');
  if(open){round(panel,'rgba(255,253,247,.97)');text('位置与朝向',panel.x+16,panel.y+19,true);if(room.balcony){const b=balconyGeometry(room),d=roomDimensions(room),a=mapPoint({x:-d.width/2,z:-d.depth/2},map,room),z=mapPoint({x:d.width/2,z:d.depth/2},map,room),p=mapPoint({x:b.minX,z:b.minZ},map,room),q=mapPoint({x:b.maxX,z:b.maxZ},map,room);c.fillStyle='#eee9dc';c.fillRect(a.x,a.y,z.x-a.x,z.y-a.y);c.fillStyle='#dce8df';c.fillRect(p.x,p.y,q.x-p.x,q.y-p.y);text('阳台',(p.x+q.x)/2,p.y+9,false,'#6f8a7b','center')}else round(map,'#eee9dc');
   text('后墙',map.x+map.w/2,map.y-10,false,'#8a9588','center');text('前墙',map.x+map.w/2,map.y+map.h+11,false,'#8a9588','center');text('左',map.x-12,map.y+map.h/2,false,'#8a9588','center');text('右',map.x+map.w+12,map.y+map.h/2,false,'#8a9588','center');
   c.save();c.beginPath();c.rect(map.x,map.y,map.w,map.h);c.clip();
   for(const obj of objects){if(obj.on)continue;const def=assets[obj.asset_id]||catalog[obj.kind];if(!def)continue;const p=mapPoint(obj,map,room),scale=map.w/(spaceBounds(room).maxX-spaceBounds(room).minX);c.save();c.translate(p.x,p.y);c.rotate(-obj.yaw);c.fillStyle=obj.kind==='rug'?'#e4e7d9':obj.kind==='bed'||obj.kind==='sofa'?'#c5d7df':'#d4c3a8';c.fillRect(-def.size[0]*scale/2,-def.size[1]*scale/2,def.size[0]*scale,def.size[1]*scale);c.restore();if(obj.kind!=='rug')text(names[obj.kind]||'物品',p.x,p.y,false,'#7a8071','center')}
   if(ready&&body){const p=mapPoint(body,map,room);if(route.length){c.strokeStyle='#88a697';c.setLineDash([3,3]);c.beginPath();c.moveTo(p.x,p.y);for(const point of route){const q=mapPoint(point,map,room);c.lineTo(q.x,q.y)}c.stroke();c.setLineDash([])}
    const f=heading(body.yaw).forward;c.strokeStyle='#fffdf7';c.lineWidth=2;c.fillStyle='#407c70';c.beginPath();c.arc(p.x,p.y,5,0,Math.PI*2);c.fill();c.stroke();c.beginPath();c.moveTo(p.x+f.x*17,p.y+f.z*17);c.lineTo(p.x+f.x*6-f.z*5,p.y+f.z*6+f.x*5);c.lineTo(p.x+f.x*6+f.z*5,p.y+f.z*6-f.x*5);c.closePath();c.fill();c.stroke();
   }c.restore();
   const bottom=map.y+map.h+32;
   if(ready&&body){const direction=heading(body.yaw);text(`X ${n(body.x)}  Y ${n(body.y)}  Z ${n(body.z)} 米`,panel.x+16,bottom);text(`面向${direction.label} · ${direction.degrees}°`,panel.x+16,bottom+22,true);const pose=body.moving?'走动':{stand:'站着',sit:'坐着',sleep:'躺着',read:'看书',draw:'画画',play:'玩机器人',transition:'调整姿势'}[body.pose];text(`${paused?'已暂停 · ':''}${pose} · ${regionAt(room,body)==='balcony'?'阳台':'室内'}`,panel.x+16,bottom+44,false,'#8a9588')}
   else text('等待角色的实时位置…',panel.x+16,bottom)
  }texture.needsUpdate=true;
 }
 function hit(x,y){if(hidden)return null;const inside=r=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h;if(inside(layout.toggle))return 'self-map-toggle';if(open&&inside(layout.panel))return 'self-map-panel';return null}
 return {size,update,hit,toggle(){open=!open;previous=''},close(){open=false;previous=''},get open(){return open},render(renderer){if(hidden)return;const clear=renderer.autoClear;renderer.autoClear=false;renderer.render(scene,camera);renderer.autoClear=clear},dispose(){texture.dispose();mesh.geometry.dispose();material.dispose()}};
}
