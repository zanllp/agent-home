import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {createDeskAsset,createStudyProp,keyboardLayout} from './web/desk-models.js';
import {applyDeskFinishes} from './web/desk-finishes.js';
import {screenSurfacePlan} from './web/screen-detail.js';
const assets=JSON.parse(readFileSync(new URL('./furniture-assets.json',import.meta.url)));
const ids=Object.keys(assets).filter(id=>id.startsWith('urban-')&&createDeskAsset(id));
for(const id of ids)test(`${id}: finite, rounded native geometry stays within declared bounds`,()=>{
 const root=createDeskAsset(id),a=assets[id];root.updateMatrixWorld(true);root.traverse(o=>{if(o.isMesh){for(const [key,attribute] of Object.entries(o.geometry.attributes))assert.ok([...attribute.array].every(Number.isFinite),id+' '+key);assert.equal(o.material.side,T.DoubleSide)}});
 const box=new T.Box3().setFromObject(root),s=box.getSize(new T.Vector3());assert.ok(s.x<=a.size[0]+1e-5,id+' width');assert.ok(s.z<=a.size[1]+1e-5,id+' depth');assert.ok(box.min.y>=-1e-5);assert.ok(box.max.y<=a.height+1e-5,id+' height');
});
test('new desks retain the original usable surfaces and a real central knee opening',()=>{
 for(const [id,old] of [['urban-workdesk-detailed-v1','oak-workdesk-v1'],['urban-child-desk-detailed-v1','urban-child-desk-tripo-v1']]){const root=createDeskAsset(id),a=assets[id];assert.deepEqual(a.surfaces.top,assets[old].surfaces.top);assert.deepEqual(a.size,assets[old].size);const top=root.getObjectByName('Wood-tabletop');assert.ok(Math.abs(new T.Box3().setFromObject(top).max.y-a.surfaces.top.height)<1e-6);const cabinet=root.getObjectByName('Drawer-cabinet'),b=new T.Box3().setFromObject(cabinet);assert.ok(b.max.x<-.30||b.min.x>.39);assert.equal(root.getObjectByName('Work-mug'),undefined)}
});
test('refined existing props stay inside their old placement footprints',()=>{
 for(const id of ['urban-dual-monitor-kit-v1','urban-study-lamp-v1','urban-pencil-cup-v1','urban-workbook-v1']){const a=assets[id],root=createStudyProp(a.model),box=new T.Box3().setFromObject(root),s=box.getSize(new T.Vector3());assert.ok(s.x<=a.size[0]+1e-5,id);assert.ok(s.z<=a.size[1]+1e-5,id);assert.ok(box.max.y<=a.height+1e-5,id)}
 const plans=screenSurfacePlan(createStudyProp(assets['urban-dual-monitor-kit-v1'].model));assert.deepEqual(plans.map(p=>p.kind),['editor','notes']);assert.ok(keyboardLayout().length>=60);assert.ok(keyboardLayout().some(k=>k.text==='space'));
});
test('wood, page, keyboard and pinboard print resources are locally generated and owned by cached models',()=>{
 const ctx=new Proxy({measureText:v=>({width:v.length*10})},{get:(o,k)=>o[k]??(()=>{})}),canvasFactory=()=>({getContext:()=>ctx});
 const desk=createDeskAsset('urban-workdesk-detailed-v1');applyDeskFinishes(desk,{canvasFactory});const map=desk.getObjectByName('Wood-tabletop').material.map;assert.equal(map.colorSpace,T.SRGBColorSpace);assert.equal(map.image.data.length,512*128*4);
 const book=createStudyProp('/models/furniture/urban-workbook-v1.glb');applyDeskFinishes(book,{canvasFactory});assert.ok(book.getObjectByName('Workbook-page-left').material.map);assert.ok(book.getObjectByName('Workbook-page-right').material.map);
 const keyboard=createStudyProp('/models/furniture/urban-dual-monitor-kit-v1.glb');applyDeskFinishes(keyboard,{canvasFactory});assert.ok(keyboard.getObjectByName('Keyboard-legends'));
 const board=createDeskAsset('urban-study-pinboard-v1');applyDeskFinishes(board,{canvasFactory});assert.ok(board.getObjectByName('Calendar-print'));assert.ok(board.getObjectByName('Garden-postcard'));
});
test('inactive reading prop cannot cover the adult keyboard; it appears only during reading',async()=>{
 const {createReadingBook}=await import('./web/reading-book.js'),previous=globalThis.document;
 const ctx=new Proxy({},{get:(o,k)=>o[k]??(()=>{})});globalThis.document={createElement:()=>({getContext:()=>ctx})};
 try{const parent=new T.Group(),prop=createReadingBook(parent),avatar=new T.Group(),desk={x:0,z:0,yaw:0};prop.update(0,avatar,desk,{height:.613});assert.equal(parent.children[0].visible,false);prop.update(1,avatar,desk,{height:.613});assert.equal(parent.children[0].visible,true);prop.update(0,avatar,desk,{height:.613});assert.equal(parent.children[0].visible,false);prop.dispose();assert.equal(parent.children.length,0)}finally{globalThis.document=previous}
});
test('picture-book spread uses separate half-image UVs without flattening the physical book',()=>{
 const root=createDeskAsset('urban-picture-book-v1'),image={width:1619,height:971};applyDeskFinishes(root,{pictureBookImage:image});
 for(const [i,name] of ['Picturebook-page-left','Picturebook-page-right'].entries()){
  const page=root.getObjectByName(name);assert.equal(page.material.map.image,image);assert.deepEqual(page.material.map.repeat.toArray(),[.5,1]);assert.deepEqual(page.material.map.offset.toArray(),[i*.5,0]);assert.equal(page.material.map.colorSpace,T.SRGBColorSpace);assert.equal(page.material.toneMapped,false);assert.ok(new Set(page.geometry.attributes.position.array.filter((_,j)=>j%3===2)).size>5);
 }
 assert.ok(root.getObjectByName('Picturebook-page-block'));assert.ok(root.getObjectByName('Picturebook-cloth-spine'));
});
test('schoolbag hangs on the declared desk hook, away from the central knee opening',()=>{
 const desk=assets['urban-child-desk-detailed-v1'],bag=assets['urban-schoolbag-v1'],hook=desk.surfaces['bag-hook'];
 assert.ok(hook.center[0]-bag.size[0]/2>=.32);assert.ok(hook.height+bag.support_offset>0);assert.ok(hook.height+bag.support_offset+bag.height<desk.surfaces.top.height);
 assert.ok(createDeskAsset('urban-child-desk-detailed-v1').getObjectByName('Schoolbag-hook'));assert.ok(createDeskAsset('urban-child-desk-detailed-v1').getObjectByName('Cabinet-caster'));
 const root=createDeskAsset('urban-schoolbag-v1');for(const name of ['Backpack-carry-handle','Backpack-front-pocket','Puppy-charm-head'])assert.ok(root.getObjectByName(name));
});
