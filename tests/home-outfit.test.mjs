import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {HouseApp,loadContext} from '../runtime/test-app.mjs';

test('only approved outfits are discoverable; changing clothes survives reopen and preserves an active job',()=>{
 const dir=mkdtempSync(join(tmpdir(),'outfit-')),ctx=loadContext('house3d');
 const open=()=>new HouseApp(ctx,join(dir,'house.sqlite'),'house3d','runtime/web');
 let app=open();
 const call=(url,body)=>app.handle({method:body?'POST':'GET',url,headers:{host:'localhost'},body});
 const set=(tool,args)=>call('/api/commands',{tool,arguments:args,id:crypto.randomUUID(),expected_revision:app.store.state().revision});
 try{
  const ids=['reference','moon-tide','snow-letter','sailor-day','school-track','lilac-reader'];
  assert.deepEqual(call('/api/catalog').body.outfits,ids);
  assert.deepEqual(ctx.definitions.set_outfit[1].outfit.enum,ids);
  assert.ok(call('/api/tools').body.tools.set_outfit);
  assert.equal(set('set_outfit',{outfit:'other'}).status,400);
  assert.equal(set('interact',{target_id:'childroom-bed',action:'sleep'}).status,200);
  const before=app.store.state();
  for(const outfit of ids.slice(1)){
   assert.equal(set('set_outfit',{outfit}).status,200);
   assert.equal(app.store.state().character.outfit,outfit);
  }
  assert.equal(set('set_outfit',{outfit:'snow-letter'}).status,200);
  app.close();app=open();const after=app.store.state();
  assert.deepEqual(after.character,{...before.character,outfit:'snow-letter'});
  assert.deepEqual(after.interaction,before.interaction);
  assert.equal(set('set_outfit',{outfit:'reference'}).status,200);
  assert.deepEqual(app.store.state().character,before.character);
 }finally{app.close();rmSync(dir,{recursive:true,force:true})}
});
