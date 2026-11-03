import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,BufferGeometry,Float32BufferAttribute} from 'three';
import {indexExactVertices} from '../tools/index-geometry.mjs';
test('indexing keeps normals, UV seams, winding and signed zero byte-for-byte',()=>{
 const g=new BoxGeometry().toNonIndexed(),p=g.attributes.position;
 // Repeated faces give a useful reduction; distinct bit patterns at a seam must survive.
 const positions=[],normals=[],uv=[];
 for(let i=0;i<6;i++){positions.push(...p.array);normals.push(...g.attributes.normal.array);uv.push(...g.attributes.uv.array)}
 uv[0]=-0;const source=new BufferGeometry();for(const [name,data,size] of [['position',positions,3],['normal',normals,3],['uv',uv,2]])source.setAttribute(name,new Float32BufferAttribute(data,size));
 const expected=Object.fromEntries(Object.entries(source.attributes).map(([k,a])=>[k,new Uint32Array(a.array.buffer.slice(0))]));
 assert.ok(indexExactVertices(source));assert.equal(source.index.count,p.count*6);
 for(const [name,a] of Object.entries(source.attributes)){
  const values=new Uint32Array(a.array.buffer);
  for(let i=0;i<source.index.count;i++)for(let j=0;j<a.itemSize;j++)assert.equal(values[source.index.getX(i)*a.itemSize+j],expected[name][i*a.itemSize+j]);
 }
 assert.equal(indexExactVertices(source),false);
});
