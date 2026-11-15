import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {HouseApp,loadContext} from '../runtime/test-app.mjs';
import {createNavigation} from '../house3d/shared/navigation.mjs';
import {changedControls} from '../house3d/web/wander-state.js';

test('first launch starts in the furnished connected home without a live job',()=>{
 const ctx=loadContext('house3d'),app=new HouseApp(ctx,':memory:','house3d','runtime/web',()=>100);
 try{
  const s=app.store.state(),p=ctx.presets['connected-home'];
  assert.equal(s.preset_id,'connected-home');assert.equal(s.revision,0);
  assert.equal(s.objects.length,111);assert.deepEqual(s.room,p.room);
  assert.deepEqual(s.objects.map(o=>o.id),p.objects.map(o=>o.id));
  assert.deepEqual(s.character,{...p.spawn,activity:'idle',outfit:'reference',hair:'reference'});
  assert.equal(s.camera,p.camera);assert.equal(s.light,p.light);
  assert.deepEqual(changedControls(null,s).sort(),['activity','camera','light','position']);
  assert.equal(s.interaction,undefined);assert.equal(s.life_plan,undefined);
  assert.equal(app.store.snapshot(),null);
  assert.ok(createNavigation(s.objects,ctx.catalog,{assets:ctx.assets,room:s.room}).free(s.character));
  assert.equal(s.objects.find(o=>o.id==='rice-cooker').properties.servings,3);
  assert.equal(app.store.db.prepare('SELECT count(*) AS n FROM commands').get().n,0);
 }finally{app.close()}
});

test('expanding the initial home does not mutate the reusable preset',()=>{
 const ctx=loadContext('house3d'),p=structuredClone(ctx.presets['connected-home']);
 ctx.defaultState.objects[0].x+=1;ctx.defaultState.room.wall_color='#123456';
 assert.deepEqual(ctx.presets['connected-home'],p);
 assert.deepEqual(loadContext('house3d').defaultState.objects,p.objects);
});

test('opening and reopening an existing custom save does not apply the new default',()=>{
 const folder=mkdtempSync(join(tmpdir(),'agent-home-default-')),file=join(folder,'existing.sqlite');
 const saved={revision:27,note:'我的旧布置',camera:'face',light:'evening',
  character:{x:.4,z:.2,yaw:1,activity:'idle',outfit:'reference',hair:'reference'},
  room:{width:6,depth:5,height:2.5},
  objects:[{id:'my-chair',kind:'chair',x:1,z:1,yaw:0,label:'保留我的椅子'}]};
 try{
  const db=new DatabaseSync(file);db.exec('CREATE TABLE state(id INTEGER PRIMARY KEY,body TEXT)');
  db.prepare('INSERT INTO state VALUES(1,?)').run(JSON.stringify(saved));db.close();
  for(let i=0;i<2;i++){
   const app=new HouseApp(loadContext('house3d'),file,'house3d','runtime/web',()=>100+i);
   try{assert.deepEqual(app.store.state(),saved)}finally{app.close()}
  }
 }finally{rmSync(folder,{recursive:true,force:true})}
});
