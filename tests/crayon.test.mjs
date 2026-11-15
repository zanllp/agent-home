import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {HouseApp,loadContext} from '../runtime/test-app.mjs';
import {Group,Mesh,MeshBasicMaterial,PlaneGeometry} from 'three';
import {showCrayonDrawing} from '../house3d/web/desk-finishes.js';

test('one tool call produces a persistent static PNG with no viewer',()=>{
 const root=resolve('house3d'),app=new HouseApp(loadContext(root),':memory:',root,resolve('runtime/web'));
 const get=url=>app.handle({method:'GET',url,headers:{}});
 const call=(tool,args,id,rev)=>app.handle({method:'POST',url:'/api/commands',headers:{},body:{id,tool,arguments:args,expected_revision:rev}});
 const args={title:'窗边',marks:[['oval','ochre',50,30,10,10],['line','mint',10,70,50,60,90,70]]};
 try{
  assert.ok(get('/api/tool-schemas').body.some(v=>v.function.name==='draw_crayon'));
  const first=call('draw_crayon',args,'first',0);assert.equal(first.status,200);assert.equal(first.body.artwork.target_id,'workbook');
  assert.deepEqual(call('draw_crayon',args,'first',0),first);
  const png=get(first.body.artwork.url);assert.equal(png.type,'image/png');assert.equal(png.bytes.readUInt32BE(16),480);assert.equal(png.bytes.readUInt32BE(20),360);
  assert.equal(call('apply_preset',{preset_id:'family-home',dry_run:false},'preset',1).status,200);
  const before=get('/api/state').body,output=call('draw_crayon',{...args,target_id:'workbook'},'in-book',2);
  assert.equal(output.status,200);const state=get('/api/state').body;
  assert.deepEqual(state.character,before.character);assert.deepEqual(state.objects.find(o=>o.id==='workbook').artwork,output.body.artwork);
  assert.deepEqual(get(output.body.artwork.url).bytes,png.bytes);assert.deepEqual(get(first.body.artwork.url).bytes,png.bytes);
  for(const invalid of [{target_id:'child-desk'},{marks:[['line','pink',0,0,10,20]]},{marks:[['oval','ink',0,0,5,5]]},{marks:[]}]){
   assert.equal(call('draw_crayon',{...args,...invalid},'invalid',3).status,400);
   assert.deepEqual(get('/api/state').body,state);
  }
 }finally{app.close()}
});

test('drawing still produces a PNG when a custom home has no drawing book',()=>{
 const app=new HouseApp(loadContext('house3d'),':memory:','house3d','runtime/web');
 try{
  const state=app.store.state();state.objects=[];app.store.save(state);
  const r=app.handle({method:'POST',url:'/api/commands',headers:{},body:{id:'no-book',expected_revision:0,tool:'draw_crayon',arguments:{title:'太阳',marks:[['sun','ochre',50,30,10,10]]}}});
  assert.equal(r.status,200);assert.equal(r.body.artwork.target_id,null);
  const image=app.handle({method:'GET',url:r.body.artwork.url,headers:{}});
  assert.equal(image.type,'image/png');assert.equal(image.bytes.readUInt32BE(16),480);
 }finally{app.close()}
});

test('the right page of a single placed book receives the image, not the shared model',()=>{
 const original=new Group(),mat=new MeshBasicMaterial(),page=new Mesh(new PlaneGeometry(),mat);
 page.name='Picturebook-page-right';original.add(page);
 const copy=original.clone(true),image={width:480,height:360};let draw;
 const dispose=showCrayonDrawing(copy,image,'窗边',()=>({getContext:()=>({fillRect(){},fillText(){},drawImage(...args){draw=args}})}));
 assert.equal(draw[0],image);assert.equal(draw[3]/draw[4],4/3);assert.equal(original.children[0].material,mat);assert.notEqual(copy.children[0].material,mat);
 dispose();mat.dispose();page.geometry.dispose();
});

test('add a motif to a saved page without replacing old strokes or changing its PNG',async()=>{
 const {inflateSync}=await import('node:zlib');
 const pixels=p=>inflateSync(p.subarray(41,41+p.readUInt32BE(33)));
 const root=resolve('house3d'),app=new HouseApp(loadContext(root),':memory:',root,resolve('runtime/web'));
 const get=url=>app.handle({method:'GET',url,headers:{}});
 const draw=args=>app.handle({method:'POST',url:'/api/commands',headers:{},body:{tool:'draw_crayon',id:crypto.randomUUID(),expected_revision:app.store.state().revision,arguments:{title:'我们的家',...args}}});
 try{
  const first=draw({marks:[['house','blue',25,55,15,20]]}).body.artwork;
  const old=get(first.url).bytes,prev=pixels(old);
  const next=draw({base_url:first.url,marks:[['sun','ochre',75,20,10,12],['flower','coral',75,75,8,14]]});
  assert.equal(next.status,200);const after=pixels(get(next.body.artwork.url).bytes);
  let changes=0;for(let y=0;y<360;y++)for(let x=0;x<480;x++)for(let c=0;c<3;c++){const i=y*1441+1+x*3+c;if(prev[i]!==after[i]){assert.ok(x>240);changes++}}
  assert.ok(changes>500);assert.deepEqual(get(first.url).bytes,old);
  assert.equal(draw({base_url:first.url,marks:[['sun','ochre',75,20,10,12]]}).status,400);
 }finally{app.close()}
});
