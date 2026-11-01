import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {usePaintedCharacter} from './web/character-material.js';

test('painted character retains base color and alpha without PBR or tone mapping',()=>{
 const map=new T.Texture();map.colorSpace=T.SRGBColorSpace;
 const source=new T.MeshStandardMaterial({map,color:'#ffe0cc',normalMap:new T.Texture(),roughnessMap:new T.Texture(),side:T.DoubleSide,transparent:true,opacity:.8,alphaTest:.1});
 const mesh=new T.SkinnedMesh(new T.BufferGeometry(),source);
 const skeleton=new T.Skeleton([new T.Bone()]);mesh.bind(skeleton);
 const geometry=mesh.geometry;
 usePaintedCharacter(mesh);
 assert.ok(mesh.material.isMeshBasicMaterial);
 assert.equal(mesh.material.map,map);assert.equal(map.colorSpace,T.SRGBColorSpace);
 assert.ok(mesh.material.color.equals(source.color));
 assert.equal(mesh.material.normalMap,undefined);
 assert.equal(mesh.material.roughnessMap,undefined);
 assert.equal(mesh.material.toneMapped,false);
 assert.equal(mesh.material.side,T.DoubleSide);
 assert.equal(mesh.material.opacity,.8);assert.equal(mesh.material.alphaTest,.1);
 assert.equal(mesh.material.transparent,true);
 assert.equal(mesh.castShadow,true);assert.equal(mesh.receiveShadow,false);
 assert.equal(mesh.skeleton,skeleton);assert.equal(mesh.geometry,geometry);
});

test('shared and array materials are converted once; surrounding scene is untouched',()=>{
 const scene=new T.Group(),character=new T.Group(),source=new T.MeshStandardMaterial();
 const a=new T.Mesh(new T.BufferGeometry(),source),b=new T.Mesh(new T.BufferGeometry(),[source]);
 const room=new T.Mesh(new T.BufferGeometry(),new T.MeshStandardMaterial());
 const roomMaterial=room.material;let disposed=0;
 source.addEventListener('dispose',()=>disposed++);
 character.add(a,b);scene.add(character,room);usePaintedCharacter(character);
 assert.equal(a.material,b.material[0]);assert.equal(disposed,1);
 assert.equal(room.material,roomMaterial);assert.ok(room.material.isMeshStandardMaterial);
});

test('local seam vertex colors survive painted-material conversion',()=>{
 const source=new T.MeshBasicMaterial({vertexColors:true,color:0xffffff});
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('color',new T.Float32BufferAttribute([.1,.2,.3],3));
 const mesh=new T.Mesh(geometry,source);usePaintedCharacter(mesh);
 assert.equal(mesh.material.vertexColors,true);
 assert.equal(mesh.geometry.getAttribute('color'),geometry.getAttribute('color'));
 assert.equal(mesh.material.toneMapped,false);
});
