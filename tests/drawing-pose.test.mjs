import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createDrawingPose} from '../house3d/web/drawing-pose.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {readFileSync} from 'node:fs';
import {HouseApp,loadContext} from '../runtime/test-app.mjs';
import {resolve} from 'node:path';

test('only a seat with an open book on its desk can request draw; producing art does not change its job',()=>{
 const root=resolve('house3d'),app=new HouseApp(loadContext(root),':memory:',root,resolve('runtime/web'));
 const cmd=(tool,args)=>app.handle({method:'POST',url:'/api/commands',headers:{},body:{id:crypto.randomUUID(),expected_revision:app.store.state().revision,tool,arguments:args}});
 try{
  cmd('apply_preset',{preset_id:'family-home',dry_run:false});
  assert.deepEqual(app.handle({method:'GET',url:'/api/objects?capability=draw',headers:{}}).body.objects.map(o=>o.id),['child-chair']);
  assert.equal(cmd('interact',{target_id:'workbook',action:'draw'}).status,400);
  const job=cmd('interact',{target_id:'child-chair',action:'draw'}).body.state.interaction;
  assert.equal(job.related_id,'workbook');assert.equal(job.phase,'requested');
  const art=cmd('draw_crayon',{title:'太阳',marks:[['sun','ochre',20,20,10,10]]});
  assert.equal(art.body.artwork.target_id,'workbook');assert.deepEqual(art.body.state.interaction,job);
 }finally{app.close()}
});

test('on the shipped rig the moving crayon reaches the page; the book and joints return untouched',async()=>{
const raw=readFileSync(new URL('../house3d/assets/dafeiyu-contact.glb',import.meta.url)),len=raw.readUInt32LE(12);
const doc=JSON.parse(raw.subarray(20,20+len));for(const m of doc.materials)delete m.pbrMetallicRoughness.baseColorTexture;
const json=Buffer.from(JSON.stringify(doc)),pad=(4-json.length%4)%4,header=Buffer.alloc(20),tail=raw.subarray(20+len);
header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(20+json.length+pad+tail.length,8);header.writeUInt32LE(json.length+pad,12);header.writeUInt32LE(0x4e4f534a,16);
const bytes=Buffer.concat([header,json,Buffer.alloc(pad,32),tail]);
const {scene,animations}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const world=new T.Scene(),avatar=new T.Group(),norm=new T.Group(),box=new T.Box3().setFromObject(scene),center=box.getCenter(new T.Vector3());
 avatar.position.set(1,0,-2);avatar.rotation.y=Math.PI-.2;world.add(avatar);avatar.add(norm);norm.add(scene);norm.scale.setScalar(1.3/box.getSize(new T.Vector3()).y);scene.position.set(-center.x,-box.min.y,-center.z);
 const mixer=new T.AnimationMixer(scene),action=mixer.clipAction(animations.find(c=>c.name==='read-pose')).play();action.time=.5;mixer.update(0);
 const placed=new T.Group(),page=new T.Mesh(new T.PlaneGeometry(.202,.232));page.name='Picturebook-page-right';page.position.set(.104,.012,0);page.rotation.x=-Math.PI/2;placed.add(page);world.add(placed);placed.position.set(1,.64,-2.8);
 const origin=placed.position.clone(),pose=createDrawingPose(world,scene,avatar),marker=world.getObjectByName('Drawing-crayon'),joint=scene.getObjectByName('mixamorigRightForeArm'),rest=joint.quaternion.clone(),points=[];
 for(let i=0;i<75;i++){pose.restore();pose.update(1,1/30,placed);assert.ok(marker.position.distanceTo(pose.focus)<.016,'tip should reach the paper');points.push(marker.position.clone());}
 assert.ok(points.some(p=>p.distanceTo(points[0])>.04));assert.ok(marker.visible);
 pose.restore();pose.update(0,0,null);assert.deepEqual(joint.quaternion.toArray(),rest.toArray());assert.deepEqual(placed.position,origin);assert.equal(marker.visible,false);pose.dispose();
});
