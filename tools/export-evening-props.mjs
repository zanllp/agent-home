// Authoring only. Shared primitives keep these small tabletop objects inexpensive to ship.
import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(v=>{this.result=v;this.onloadend?.()})}};
const catalogPath='house3d/furniture-assets.json',manifestPath='runtime-assets.json';
const catalog=JSON.parse(readFileSync(catalogPath)),manifest=JSON.parse(readFileSync(manifestPath));
const cube=new T.BoxGeometry(),round=new T.CylinderGeometry(.5,.5,1,16),rim=new T.TorusGeometry(1,.060,6,32);
async function prop(id,label,kind,build){
 const root=new T.Group(),materials=new Map();
 const piece=(name,geo,c,x,y,z,w,h,d)=>{
  if(!materials.has(c))materials.set(c,new T.MeshStandardMaterial({color:c,roughness:.64,side:T.DoubleSide}));
  const m=new T.Mesh(geo,materials.get(c));m.name=name;m.position.set(x,y,z);m.scale.set(w,h,d);root.add(m);return m;
 };
 build(piece);
 const bounds=new T.Box3().setFromObject(root,true),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
 for(const o of root.children){o.position.x-=center.x;o.position.z-=center.z;o.position.y-=bounds.min.y}
 const bytes=new Uint8Array(await new GLTFExporter().parseAsync(root,{binary:true})),name='house3d/assets/furniture/'+id+'.glb';
 writeFileSync(name,bytes);
 const source='Original local geometry: tools/export-evening-props.mjs';
 manifest.assets[name]={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),source};
 catalog[id]={label,kind,model:'/models/furniture/'+id+'.glb',size:[size.x,size.z].map(n=>Math.ceil(n*10000)/10000),height:+size.y.toFixed(4),style:'maple-family',placement:'surface',source_type:'native_geometry',native_materials:true,painted:false,recolorable:false,source};
}
await prop('evening-paperback-v1','读到一半的书和细框眼镜','books',p=>{
 for(const sign of [-1,1]){
  p('Cloth-cover',cube,'#597b73',sign*.074,.007,0,.149,.009,.208).rotation.z=-sign*.054;
  p('Leaves',cube,'#e5ceaa',sign*.073,.014,0,.142,.013,.201).rotation.z=-sign*.054;
  p('Open-page',cube,'#fff1ce',sign*.073,.022,0,.141,.002,.198).rotation.z=-sign*.054;
  for(let i=0;i<11;i++){const width=i%5===4?.064:.101;p('Type-lines',cube,'#91897a',sign*.072-(.101-width)/2,.0237,-.062+i*.012,width,.0007,.0014).rotation.z=-sign*.054}
 }
 p('Ribbon',cube,'#bf7459',.009,.022,.076,.008,.001,.084);
 for(const x of [-.026,.030]){
  const lens=p('Bronze-rim',rim,'#695348',x,.034,.032,.024,.018,.018);lens.rotation.x=-Math.PI/2;
  p('Folded-temple',cube,'#715443',x,.033,.017,.047,.002,.002).rotation.y=x<0?-.72:.67;
 }
 p('Bridge',cube,'#876b4f',.002,.035,.030,.012,.002,.002);
});
await prop('evening-wash-kit-v1','并排的两把牙刷和卷尾牙膏','desktop',p=>{
 const clay='#c3d4cd';
 p('Speckled-cup',round,clay,-.049,.049,0,.077,.098,.077);
 p('Cup-opening',round,'#62857f',-.049,.099,0,.066,.001,.066);
 for(const [x,angle,c,h] of [[-.059,.11,'#5b8095',.184],[-.034,-.13,'#d49a79',.154]]){
  p('Brush-handle',cube,c,x,.117,0,.009,h-.065,.008).rotation.z=angle;
  const dx=x-(h-.117)*Math.tan(angle);
  p('Brush-head',cube,c,dx,h,0,.014,.025,.010).rotation.z=angle;
  p('Bristles',cube,'#fff3d9',dx,h,.007,.012,.020,.005).rotation.z=angle;
 }
 p('Folded-tube',cube,'#eee9d8',.037,.012,.009,.080,.019,.034);
 p('Mint-band',cube,'#6aa7a0',.041,.022,.009,.032,.001,.033);
 p('Rolled-end',round,clay,.077,.015,.009,.018,.039,.018).rotation.x=Math.PI/2;
 p('Tube-cap',round,'#537e81',-.008,.013,.009,.020,.014,.020).rotation.z=Math.PI/2;
});
writeFileSync(catalogPath,JSON.stringify(catalog,null,2)+'\n');writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
