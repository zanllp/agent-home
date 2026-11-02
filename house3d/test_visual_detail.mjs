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
