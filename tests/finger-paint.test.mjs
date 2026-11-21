import test from 'node:test';
import assert from 'node:assert/strict';
import {Texture} from 'three';
import {geometryOnly} from './helpers/geometry-only.mjs';
import {usePaintedCharacter} from '../house3d/web/character-material.js';
import faces from '../house3d/web/pajama-mask.json' with {type:'json'};

test('fingertip color correction stays on the two painted hands',async()=>{
 const {scene}=await geometryOnly('dafeiyu-contact');
 const texture=new Texture();
 scene.traverse(o=>{if(o.isMesh)o.material.map=texture});
 usePaintedCharacter(scene,{cleanHands:true});
 const arms=[];
 scene.traverse(o=>{
  if(!o.isMesh)return;
  const g=o.geometry,attr=g.getAttribute('fingerPaint');
  if(!/^Arm[LR]$/.test(o.name)){assert.equal(attr,undefined);return}
  arms.push(o);
  assert.equal(o.material.map,texture);
  const hand=new Set();
  for(const [first,n] of faces['Arm.'+o.name.at(-1)])for(let j=first*3;j<(first+n)*3;j++)hand.add(g.index.getX(j));
  const colors=new Set();
  for(let v=0;v<attr.count;v++){
   if(!hand.has(v))assert.equal(attr.getW(v),0);
   else if(attr.getW(v)===1)colors.add(attr.getX(v)+','+attr.getY(v)+','+attr.getZ(v));
  }
  assert.ok(colors.size>20);
 });
 assert.equal(arms.length,2);
 assert.notEqual(arms[0].material,scene.getObjectByName('Legs').material);
});
