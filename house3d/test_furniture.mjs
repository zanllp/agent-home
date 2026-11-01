import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createNavigation} from './web/wander-navigation.js';
const assets=JSON.parse(readFileSync(new URL('./furniture-assets.json',import.meta.url),'utf8'));
function document(path){const bytes=readFileSync(path);assert.equal(bytes.toString('utf8',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.length,bytes.readUInt32LE(8));return JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString())}

test('catalog GLBs contain geometry and original base-colour texture, no external resources',()=>{
 for(const [id,asset] of Object.entries(assets)){
  const doc=document(new URL('./assets/'+asset.model.replace('/models/',''),import.meta.url));
  assert.ok(asset.size.every(n=>Number.isFinite(n)&&n>0));assert.ok(asset.height>0);
  assert.ok(doc.meshes.length>0,id);assert.ok(doc.materials.some(m=>m.pbrMetallicRoughness?.baseColorTexture),id);
  assert.ok(doc.images.length>0,id);assert.ok(doc.images.every(i=>i.bufferView!==undefined));
  assert.ok(![...(doc.buffers||[]),...doc.images].some(x=>x.uri),id);
  let triangles=0;for(const mesh of doc.meshes)for(const p of mesh.primitives)triangles+=doc.accessors[p.indices].count/3;
  assert.ok(triangles<60000,id+' is too heavy for this pack');assert.ok(!doc.skins?.length);
  assert.ok(doc.materials.every(m=>m.doubleSided),id+' must preserve the inspected thin surfaces in WebGL');
 }
});
test('navigation uses real asset size rather than the old blockout dimensions',()=>{
 const catalog={bed:{size:[.2,.2]}},asset={wide:{size:[2,1]}};
 const nav=createNavigation([{id:'bed',kind:'bed',asset_id:'wide',x:0,z:0,yaw:0}],catalog,{assets:asset,radius:.1});
 assert.equal(nav.free({x:.85,z:0}),false);assert.equal(nav.free({x:1.2,z:0}),true);
});
test('rotated furniture and multiple instances use independent obstacle transforms',()=>{
 const catalog={bed:{size:[1.65,1.8]}};
 const nav=createNavigation([{id:'a',kind:'bed',asset_id:'whale-bed-v1',x:-1.8,z:-1.1,yaw:0},{id:'b',kind:'bed',asset_id:'whale-bed-v1',x:1.7,z:-1.1,yaw:Math.PI/2}],catalog,{assets,radius:.2});
 assert.equal(nav.free({x:-1.8,z:-1.1}),false);assert.equal(nav.free({x:1.7,z:-1.1}),false);assert.equal(nav.free({x:0,z:1.2}),true);
});
import {createWalker} from './web/wander-navigation.js';
for(const name of ['whale-study','whale-mirrored'])test(`${name}: real layout stays navigable for ten simulated minutes`,()=>{
 const {objects}=JSON.parse(readFileSync(new URL(`../modeling/furniture/layouts/${name}.json`,import.meta.url),'utf8'));
 const primitives={plant:{size:[.4,.4]},lamp:{size:[.3,.3]},rug:{size:[1.8,1.3]}};
 const nav=createNavigation(objects,primitives,{assets});assert.ok(nav.nodes.length>30);assert.ok(nav.free({x:0,z:.5}));
 let seed=13;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
 const walker=createWalker(nav,{x:0,z:.5,yaw:0},{random});walker.setBrisk(true);let moving=0;
 for(let i=0;i<12000;i++){const s=walker.update(.05,.65);assert.ok(nav.free(s));if(s.mode==='walk')moving++}
 assert.ok(moving>300);
});
import {groundHeightAt} from './web/wander-navigation.js';
test('oval carpet height does not float feet over the empty rectangle corners',()=>{
 const rugs=[{kind:'rug',asset_id:'whale-rug-v1',x:0,z:0,yaw:0}];
 assert.ok(groundHeightAt(0,0,rugs,assets)>.018);
 assert.equal(groundHeightAt(.95,.59,rugs,assets),.006);
 assert.equal(groundHeightAt(2,2,rugs,assets),.006);
});
