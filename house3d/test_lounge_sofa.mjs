import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BufferGeometry,Float32BufferAttribute} from 'three';
import {widenLoungeGeometry} from './web/lounge-sofa.js';

test('wide seat uses the original source and texture coordinates; the outer arm only translates',()=>{
 const assets=JSON.parse(readFileSync(new URL('./furniture-assets.json',import.meta.url))),wide=assets['family-wide-lounge-v1'],old=assets['family-sofa-stylized-v2'];
 const raw=readFileSync(new URL('./assets'+old.model.replace('/models',''),import.meta.url)),len=raw.readUInt32LE(12),json=JSON.parse(raw.toString('utf8',20,20+len)),attrs=json.meshes[0].primitives[0].attributes;
 function attribute(id,n){const a=json.accessors[id],view=json.bufferViews[a.bufferView];return new Float32BufferAttribute(new Float32Array(raw.buffer,raw.byteOffset+28+len+(view.byteOffset||0)+(a.byteOffset||0),a.count*n),n)}
 const mesh=new BufferGeometry();mesh.setAttribute('position',attribute(attrs.POSITION,3));mesh.setAttribute('normal',attribute(attrs.NORMAL,3));mesh.setAttribute('uv',attribute(attrs.TEXCOORD_0,2));
 assert.equal(wide.model,old.model);
 const changed=widenLoungeGeometry(mesh,wide.lounge_extension),p=mesh.attributes.position,q=changed.attributes.position;
 assert.deepEqual(changed.attributes.uv.array,mesh.attributes.uv.array);assert.notEqual(p.array,q.array);
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),dx=q.getX(i)-x;
  if(Math.abs(x)>=.66){assert.ok(Math.abs(dx-Math.sign(x)*wide.lounge_extension/2)<1e-6)}
  assert.equal(q.getY(i),p.getY(i));assert.equal(q.getZ(i),p.getZ(i));
 }
 const bounds=changed.boundingBox;assert.ok(Math.abs(bounds.max.x-bounds.min.x-wide.size[0])<1e-6);
 assert.ok([...changed.attributes.normal.array].every(Number.isFinite));
 changed.dispose();mesh.dispose();
});

test('folded throw follows the actual wide arm without penetrating its crest or enlarging the registered bounds',async()=>{
 const {createArmThrow}=await import('./web/arm-throw.js'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
 const {Box3,Vector3,Raycaster,DoubleSide}=await import('three');
 const assets=JSON.parse(readFileSync(new URL('./furniture-assets.json',import.meta.url))),family=JSON.parse(readFileSync(new URL('./room-presets.json',import.meta.url)))['family-home'];
 const item=family.objects.find(o=>o.id==='sofa-throw'),a=assets[item.asset_id],wide=assets['family-wide-lounge-v1'];
 const cloth=createArmThrow(),local=new Box3().setFromObject(cloth,true);assert.equal(a.arm_throw,true);assert.equal(assets['family-fringed-throw-v1'].arm_throw,undefined);
 assert.ok(Math.max(-local.min.x,local.max.x)<=a.size[0]/2&&Math.max(-local.min.z,local.max.z)<=a.size[1]/2&&local.max.y<=a.height&&Math.abs(local.min.y)<.0001);
 cloth.position.set(item.on.x,wide.surfaces.seat.height+a.support_offset,item.on.z);cloth.updateMatrixWorld(true);
 const raw=readFileSync(new URL('./assets'+wide.model.replace('/models',''),import.meta.url));
 const gltf=await new GLTFLoader().register(()=>({name:'geometry-test',loadTexture:async()=>null})).parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');
 const arm=gltf.scene.getObjectByName('family-sofa-stylized-v2');arm.geometry=widenLoungeGeometry(arm.geometry,wide.lounge_extension);arm.material.side=DoubleSide;gltf.scene.updateMatrixWorld(true);
 const sheet=cloth.getObjectByName('Wool_drape'),p=sheet.geometry.attributes.position,uv=sheet.geometry.attributes.uv,ray=new Raycaster();let closest=1;
 for(let i=0;i<p.count;i+=11){
  const u=uv.getX(i),v=uv.getY(i),angle=Math.min(Math.max((u-.5)*4,0),1)*Math.PI/2,phi=.8*v**3;
  const outward=new Vector3(Math.sin(angle)*Math.cos(phi),Math.cos(angle),Math.sin(angle)*Math.sin(phi));
  const pt=sheet.localToWorld(new Vector3().fromBufferAttribute(p,i));ray.set(pt.clone().addScaledVector(outward,2),outward.clone().negate());
  const hit=ray.intersectObject(arm)[0];assert.ok(hit);const clearance=pt.sub(hit.point).dot(outward);
  assert.ok(clearance>=-.001,'fabric clips the upholstery');closest=Math.min(closest,clearance);
 }
 assert.ok(closest<.012,'blanket should rest on the sofa, not float clear of it');
 assert.equal(cloth.children.length,3);assert.ok(cloth.getObjectByName('Knotted cotton tassels'));
});
