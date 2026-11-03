import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {HouseApp,loadContext} from '../runtime/test-app.mjs';

test('rice belongs to the nearest nonempty cooker on the same support, and cannot refill a full bowl',()=>{
 const root=resolve('house3d'),app=new HouseApp(loadContext(root),':memory:',root,resolve('runtime/web'));
 const cmd=(tool,args)=>app.handle({method:'POST',url:'/api/commands',headers:{},body:{id:crypto.randomUUID(),expected_revision:app.store.state().revision,tool,arguments:args}});
 const serve=()=>cmd('interact',{target_id:'rice-bowl',action:'serve_rice'});
 try{
  assert.equal(cmd('apply_preset',{preset_id:'family-home',dry_run:false}).status,200);
  assert.equal(app.handle({method:'GET',url:'/api/objects?capability=serve_rice',headers:{}}).body.objects[0].id,'rice-bowl');
  let s=app.store.state();const bowl=s.objects.find(o=>o.id==='rice-bowl'),on=bowl.on;
  bowl.on={...on,id:'child-desk'};app.store.save(s);assert.equal(serve().status,400);bowl.on=on;
  const pot=s.objects.find(o=>o.id==='rice-cooker');pot.properties={servings:0};app.store.save(s);assert.equal(serve().status,400);
  pot.properties={servings:4};app.store.save(s);let result=serve();assert.equal(result.status,200);
  s=result.body.state;assert.equal(s.objects.find(o=>o.id==='rice-cooker').properties.servings,3);
  assert.equal(s.objects.find(o=>o.id==='rice-bowl').properties.filled,true);
  assert.equal(serve().status,400);assert.deepEqual(app.store.state(),s);
 }finally{app.close()}
});

test('generated vessels retain the independently movable serving and embedded painted surface',async()=>{
 const {readFile}=await import('node:fs/promises');
 for(const id of ['home-rice-cooker-v1','home-rice-bowl-v1']){
  const raw=await readFile(resolve('house3d/assets/furniture',id+'.glb'));
  const doc=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12))),food=doc.nodes.find(n=>n.name==='Steamed-rice');
  assert.deepEqual(food.children.map(i=>doc.nodes[i].name).sort(),['Rice-grains-0','Rice-grains-1','Rice-grains-2','Rice-grains-3','Rice-mound']);
  const body=doc.nodes.find(n=>n.name.startsWith('Whale '));
  const surface=doc.meshes[body.mesh].primitives[0];assert.ok(doc.materials[surface.material].pbrMetallicRoughness.baseColorTexture);
  assert.ok(!food.children.includes(doc.nodes.indexOf(body)));
 }
});
