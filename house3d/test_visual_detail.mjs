import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createWindowDetail,disposeWindowDetail} from './web/window-detail.js';
import {screenSurfacePlan,enhanceScreens} from './web/screen-detail.js';
import {createRoomWalls} from './web/room-walls.js';

function source(){const root=new T.Group(),view=new T.Mesh(new T.PlaneGeometry(2.42,2.17),new T.MeshBasicMaterial({map:new T.Texture()}));view.name='WindowView-city';root.add(view);return root}
function meshes(root,name){const found=[];root.traverse(o=>{if(o.name===name)found.push(o)});return found}
test('walkable window stacks three real panels without embedding balcony furniture',()=>{
 const original=source(),detail=createWindowDetail(original,{walkable:true,open:true});
 assert.equal(original.children[0].visible,false);assert.equal(meshes(detail,'Real-window-glass').length,3);
 assert.equal(meshes(detail,'Handle-grip').length,3);assert.equal(meshes(detail,'Linen-curtain').length,2);
 assert.ok(meshes(detail,'Real-window-glass').every(o=>Math.abs(o.position.x+.8)<1e-8));
 assert.equal(detail.getObjectByName('Balcony-washer'),undefined);assert.equal(detail.getObjectByName('Draped-towel'),undefined);
 disposeWindowDetail(detail);
});
test('closing the sliding door restores separate leaf positions and instances own their materials',()=>{
 const a=createWindowDetail(source(),{walkable:true,open:false}),b=createWindowDetail(source(),{walkable:true});
 assert.deepEqual(meshes(a,'Real-window-glass').map(o=>o.position.x),[-.8,0,.8]);
 assert.notEqual(a.getObjectByName('Real-window-glass').material,b.getObjectByName('Real-window-glass').material);
 disposeWindowDetail(a);disposeWindowDetail(b);
});
test('window cleanup does not dispose the original GLB texture',()=>{
 const original=source();let disposed=0;original.children[0].material.map.addEventListener('dispose',()=>disposed++);
 disposeWindowDetail(createWindowDetail(original,{walkable:true}));assert.equal(disposed,0);
});
test('screen overlays use the original local bounds and inherit parent scale',()=>{
 const root=new T.Group();for(const [name,size] of [['Display',[1.05,.586,.004]],['Blue screen',[.536,.306,.006]],['Blue screen.001',[.206,.386,.006]]]){const mesh=new T.Mesh(new T.BoxGeometry(...size));mesh.name=T.PropertyBinding.sanitizeNodeName(name);mesh.scale.setScalar(1.3);root.add(mesh)}
 const plans=screenSurfacePlan(root);assert.deepEqual(plans.map(p=>p.kind),['television','editor','notes']);assert.ok(Math.abs(plans[0].width-1.05)<1e-6);assert.ok(plans.every(p=>p.z>0));
 const ctx=new Proxy({measureText:value=>({width:value.length*10}),createLinearGradient:()=>({addColorStop(){}})},{get:(target,key)=>target[key]??(()=>{})});
 const old=new T.Mesh(new T.BoxGeometry());old.name=T.PropertyBinding.sanitizeNodeName('Editor lines.001');root.add(old);
 enhanceScreens(root,{canvasFactory:()=>({getContext:()=>ctx})});assert.equal(old.visible,false);
 for(const p of plans){const overlay=p.mesh.children[0];assert.equal(overlay.name,'Detailed-screen-'+p.kind);assert.equal(overlay.material.toneMapped,false);assert.equal(overlay.material.map.colorSpace,T.SRGBColorSpace);assert.equal(overlay.parent,p.mesh)}
});
test('wall accent never fills a moved window opening',async()=>{
 const parent=new T.Group(),walls=createRoomWalls(parent);await walls.setFinish({style:'urban'});
 const back=parent.getObjectByName('wall-back'),accent=back.children.find(o=>o.userData.side==='back');assert.equal(accent.visible,true);
 walls.setOpenings([{asset_id:'window',x:0,z:-2.5,yaw:0}],{window:{elevation:.07,wall_opening:{width:2.42,height:2.17,bottom:.025}}});assert.equal(accent.visible,false);
 await walls.setFinish({style:'urban'});assert.equal(accent.visible,false);
 walls.setOpenings([],{});assert.equal(accent.visible,true);walls.dispose();
});

test('TV plays moving frames, visits every cartoon and avoids back-to-back repeats',async()=>{
 const {screenPlayback}=await import('./web/screen-detail.js');const frames=[];
 const tick=screenPlayback('television',(p,t)=>frames.push([p,t]),()=>.4);
 assert.deepEqual(frames,[['guide',0]]);tick(5.9);assert.equal(frames.length,1);
 tick(.11);const first=frames.at(-1)[0];assert.notEqual(first,'guide');
 tick(.1);assert.equal(frames.at(-1)[0],first);assert.ok(frames.at(-1)[1]>0);
 const switches=[first];for(let i=0;i<7;i++){tick(25);switches.push(frames.at(-1)[0])}
 assert.deepEqual([switches[3],switches[7]],['guide','guide']);
 assert.deepEqual(new Set(switches.slice(0,3)),new Set(['bike','sea','night']));
 assert.deepEqual(new Set(switches.slice(4,7)),new Set(['bike','sea','night']));
 assert.notEqual(switches[2],switches[4]);
});
test('landscape and portrait monitors rotate independently and register no timers after disposal',async()=>{
 const root=new T.Group();for(const name of ['Blue_screen','Blue_screen001']){const m=new T.Mesh(new T.BoxGeometry(.5,.3,.006));m.name=name;root.add(m)}
 const ctx=new Proxy({measureText:()=>({width:7}),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]??(()=>{})});
 const players=new Set();enhanceScreens(root,{canvasFactory:()=>({getContext:()=>ctx}),players,random:()=>.5});
 assert.equal(players.size,2);for(const m of root.children){const map=m.children[0].material.map;const v=map.version;
  for(const tick of players)tick(.51);assert.ok(map.version>v);map.dispose()}
 assert.equal(players.size,0);
});

test('linen spreads below its heading and releases its shared weave exactly once',()=>{
 const detail=createWindowDetail(source(),{openingWidth:3.04,walkable:true}),cloth=meshes(detail,'Linen-curtain'),map=cloth[0].material.map;
 assert.equal(cloth[1].material.map,map);assert.ok(detail.getObjectByName('Sheer-curtain').castShadow===false);
 const pos=cloth[0].geometry.attributes.position,span=(first,last)=>Math.abs(pos.getX(last)-pos.getX(first));
 assert.ok(span(pos.count-73,pos.count-1)>span(0,72)*1.1);let count=0;map.addEventListener('dispose',()=>count++);
 disposeWindowDetail(detail);assert.equal(count,1);
});

test('different book series use one print atlas each and expose page edges between covers',async()=>{
 const {finishBookSpines}=await import('./web/library-finish.js');
 const make=theme=>{const g=new T.Group();for(const [i,h] of [.18,.22].entries()){
  const o=new T.Mesh(new T.BoxGeometry(.04,h,.17),new T.MeshStandardMaterial());o.name='Standing_cover'+i;o.position.x=i*.047;g.add(o)}
  const draw=new Proxy({},{get:(o,key)=>o[key]||(()=>{})});finishBookSpines(g,theme,()=>({getContext:()=>draw}));return g};
 const nature=make('nature'),code=make('study'),print=nature.getObjectByName('Printed-book-spines');
 assert.equal(print.geometry.attributes.position.count,8);assert.notEqual(nature.children[0].material.color.getHex(),code.children[0].material.color.getHex());
 assert.ok(nature.children[0].scale.x<.1);assert.equal(print.material.map.image.width,192);
});

test('double curtain tracks separate warm voile from linen and leave the sliding passage clear',()=>{
 const detail=createWindowDetail(source(),{openingWidth:3.04,walkable:true});
 try{
  const cloth=meshes(detail,'Linen-curtain'),voile=meshes(detail,'Sheer-curtain');
  assert.ok(detail.getObjectByName('Sheer-inner-track').position.z<detail.getObjectByName('Curtain-ceiling-track').position.z);
  assert.equal(detail.getObjectByName('Curtain-gliders').count,18);
  for(let side=0;side<2;side++){
   const pos=voile[side].geometry.attributes.position,colors=voile[side].geometry.attributes.color;
   assert.equal(colors.itemSize,4);const alpha=Array.from({length:colors.count},(_,i)=>colors.getW(i));
   assert.ok(Math.min(...alpha)<.4&&Math.max(...alpha)>.7);
   for(const m of [voile[side],cloth[side]]){m.geometry.computeBoundingBox();const b=m.geometry.boundingBox;assert.ok(side?b.min.x>1.0:b.max.x<-.99)}
   assert.ok(pos.count>0);assert.equal(voile[side].castShadow,false);
  }
 }finally{disposeWindowDetail(detail)}
});
