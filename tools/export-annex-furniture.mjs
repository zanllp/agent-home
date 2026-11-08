import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(v=>{this.result=v;this.onloadend?.()})}};
const assets=JSON.parse(readFileSync('house3d/furniture-assets.json')),manifest=JSON.parse(readFileSync('runtime-assets.json'));
const cube=new RoundedBoxGeometry(1,1,1,1,.065),round=new T.CylinderGeometry(.5,.5,1,20),egg=new T.SphereGeometry(.5,20,12),mats=new Map();
const maple='#bf895f',cream='#f6edda',teal='#709e9d',metal='#9eaaa8',linen='#b4becd';
async function asset(slug,label,kind,build,extra={}){
 const group=new T.Group();
 const piece=(name,geo,color,x,y,z,w,h,d)=>{if(!mats.has(color))mats.set(color,new T.MeshStandardMaterial({color,side:T.DoubleSide,roughness:color===metal?.35:.72}));const m=new T.Mesh(geo,mats.get(color));m.name=name;m.position.set(x,y,z);m.scale.set(w,h,d);group.add(m);return m};
 const box=(...a)=>piece(a.shift(),cube,...a),cyl=(...a)=>piece(a.shift(),round,...a),oval=(...a)=>piece(a.shift(),egg,...a);
 build(box,cyl,oval);const bounds=new T.Box3().setFromObject(group,true),offset=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
 for(const o of group.children){o.position.x-=offset.x;o.position.z-=offset.z;o.position.y-=bounds.min.y}
 const id='apartment-'+slug+'-v1',path='house3d/assets/furniture/'+id+'.glb',bytes=new Uint8Array(await new GLTFExporter().parseAsync(group,{binary:true}));
 writeFileSync(path,bytes);manifest.assets[path]={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),source:'Original local geometry: tools/export-annex-furniture.mjs'};
 assets[id]={label,kind,style:'maple-family',model:'/models/furniture/'+id+'.glb',size:[size.x,size.z].map(n=>+n.toFixed(4)),height:+size.y.toFixed(4),painted:false,source_type:'native_geometry',native_materials:true,recolorable:false,source:'Original procedural household asset',...extra};console.log(id,bytes.length)
}
await asset('bed','雾蓝棉被双人床','bed',(b,c)=>{
 for(const x of [-.74,.74])for(const z of [-.9,.9])c('Foot',maple,x,.105,z,.1,.21,.1);
 b('Oak-frame',maple,0,.24,0,1.7,.15,2.1);b('Upholstered-head',teal,0,.49,-1.02,1.74,.94,.11);
 b('Mattress',cream,0,.38,.02,1.66,.2,2.02);b('Washed-linen',linen,0,.50,.32,1.66,.14,1.4);b('Fold',teal,0,.58,-.27,1.66,.06,.23);
 for(const x of [-.42,.42])b('Pillow',cream,x,.52,-.69,.70,.18,.4);
},{interactions:{sleep:{root:[0,.6,.65],yaw:0,approaches:[[0,0,1.8],[-1.52,0,.1],[1.52,0,.1]],surface_height:.53}}});
await asset('basin','白瓷台盆和橡木浴室柜','sideboard',(b,c,o)=>{
 b('Plinth','#776f66',0,.08,0,.76,.16,.39);b('Cabinet',maple,0,.46,0,.86,.72,.48);
 for(const x of [-.206,.206]){b('Shaker-door',cream,x,.47,.246,.397,.63,.028);b('Brass-handle','#ad8b58',x,.65,.269,.08,.021,.022)}
 b('Counter',cream,0,.84,0,.94,.08,.52);o('Porcelain', '#faf5e9',0,.903,.02,.63,.17,.39);o('Basin-well','#bad1d0',0,.976,.024,.45,.03,.267);
 c('Tap',metal,0,1.01,-.18,.033,.26,.033);b('Spout',metal,0,1.13,-.12,.035,.032,.15);b('Mirror-frame',maple,0,1.49,-.23,.67,.55,.047);b('Mirror','#c2d9dd',0,1.49,-.2,.61,.49,.02);
});
await asset('shower','青瓷淋浴角和挂巾','appliance',(b,c)=>{
 b('Pan',cream,0,.048,0,1.05,.094,1.04);b('Inset','#a6c4be',0,.095,0,.91,.014,.91);
 b('Tile-back','#c6d9cf',0,1.04,-.49,1.04,2,.055);
 for(let i=1;i<8;i++)b('Grout','#e1e9df',0,.09+i*.24,-.455,1.02,.006,.004);
 c('Riser',metal,.05,1.35,-.40,.026,1.18,.026);b('Shower-arm',metal,.05,1.94,-.27,.03,.027,.28);c('Shower-head','#aab9b5',.05,1.918,-.13,.21,.035,.21);
 b('Mixer',metal,.05,.87,-.38,.24,.043,.055);b('Towel-bar',maple,-.29,1.13,-.39,.31,.035,.06);b('Cotton-towel',teal,-.29,.94,-.35,.23,.36,.035);
});
await asset('toilet','奶油白坐便器','appliance',(b,c,o)=>{
 o('Foot',cream,0,.15,0,.32,.30,.4);o('Bowl','#faf6e9',0,.32,.035,.44,.31,.62);
 o('Lid',cream,0,.471,.058,.44,.065,.54);b('Cistern',cream,0,.54,-.235,.45,.49,.19);
 b('Flush',metal,0,.79,-.235,.092,.012,.046)
});
await asset('step','枫木两级踏凳','chair',(b)=>{
 for(const x of [-.18,.18]){b('Side',maple,x,.145,-.09,.046,.29,.22);b('Side',maple,x,.069,.09,.046,.138,.18)}
 b('Upper',cream,0,.302,-.09,.44,.038,.24);b('Lower',teal,0,.147,.12,.44,.035,.18);
});
writeFileSync('runtime-assets.json',JSON.stringify(manifest,null,2)+'\n');writeFileSync('house3d/furniture-assets.json',JSON.stringify(assets,null,2)+'\n');
