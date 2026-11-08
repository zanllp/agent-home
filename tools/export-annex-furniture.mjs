import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(v=>{this.result=v;this.onloadend?.()})}};
const assets=JSON.parse(readFileSync('house3d/furniture-assets.json')),manifest=JSON.parse(readFileSync('runtime-assets.json'));
const cube=new RoundedBoxGeometry(1,1,1,1,.065),round=new T.CylinderGeometry(.5,.5,1,20),egg=new T.SphereGeometry(.5,20,12),mats=new Map();
const maple='#bf895f',cream='#f6edda',teal='#709e9d',metal='#9eaaa8';
function cloth(nx,ny,sample){
 const positions=[],colors=[],indices=[];
 for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
  const [x,y,z,color]=sample(i/nx,j/ny);positions.push(x,y,z);colors.push(...new T.Color(color).toArray());
  const a=j*(nx+1)+i;if(i<nx&&j<ny)indices.push(a,a+nx+1,a+1,a+1,a+nx+1,a+nx+2);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function pipe(points,r){
 return new T.TubeGeometry(new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v))),24,r,8,false);
}
async function asset(slug,label,kind,build,extra={}){
 const group=new T.Group();
 const piece=(name,geo,color,x,y,z,w,h,d)=>{if(!mats.has(color))mats.set(color,new T.MeshStandardMaterial({color,side:T.DoubleSide,roughness:color===metal?.29:color==='#faf6ec'?.22:.76,metalness:color===metal?.52:0}));const m=new T.Mesh(geo,mats.get(color));m.name=name;m.position.set(x,y,z);m.scale.set(w,h,d);group.add(m);return m};
 const box=(...a)=>piece(a.shift(),cube,...a),cyl=(...a)=>piece(a.shift(),round,...a),oval=(...a)=>piece(a.shift(),egg,...a);
 const custom=(name,geo,color='#ffffff')=>{const m=piece(name,geo,color,0,0,0,1,1,1);if(geo.hasAttribute('color')){m.material=m.material.clone();m.material.vertexColors=true}return m};
 build(box,cyl,oval,custom);const bounds=new T.Box3().setFromObject(group,true),offset=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
 for(const o of group.children){o.position.x-=offset.x;o.position.z-=offset.z;o.position.y-=bounds.min.y}
 const id='apartment-'+slug+'-v1',path='house3d/assets/furniture/'+id+'.glb',bytes=new Uint8Array(await new GLTFExporter().parseAsync(group,{binary:true}));
 writeFileSync(path,bytes);manifest.assets[path]={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),source:'Original local geometry: tools/export-annex-furniture.mjs'};
 assets[id]={label,kind,style:'maple-family',model:'/models/furniture/'+id+'.glb',size:[size.x,size.z].map(n=>+n.toFixed(4)),height:+size.y.toFixed(4),painted:false,source_type:'native_geometry',native_materials:true,recolorable:false,source:'Original procedural household asset',...extra};console.log(id,bytes.length)
}
await asset('bed','雾蓝棉被双人床','bed',(b,c,o,g)=>{
 for(const x of [-.74,.74])for(const z of [-.9,.9])c('Foot',maple,x,.105,z,.1,.21,.1);
 b('Oak-frame',maple,0,.24,0,1.7,.15,2.1);b('Upholstered-head',teal,0,.49,-1.02,1.74,.94,.11);
 b('Mattress',cream,0,.38,.02,1.66,.2,2.02);
 g('Channel-quilt',cloth(44,32,(u,v)=>{
  const side=Math.max(0,(Math.abs(u-.5)-.44)/.06),foot=Math.max(0,(v-.94)/.06);
  const channel=Math.sin(Math.PI*(u*8+.085*Math.sin(v*5)))**2;
  const x=Math.sign(u-.5)*(side ? .824+.022*Math.sin(side*Math.PI/2) : Math.abs(u-.5)*.824/.44),y=.551+.025*channel+.008*Math.sin(v*13+u*24)-.16*Math.max(side**1.4,foot**1.5);
  const hem=v<.14,edge=v>.89&&v<.94;return [x,y,foot ? 1.032+.015*Math.sin(foot*Math.PI/2) : -.41+1.442*v/.94,hem?'#739699':edge?'#eee1c6':channel<.16?'#9baebb':'#b5c6d0'];
 }));
 const cushion=egg.clone(),vertices=cushion.attributes.position;
 for(let i=0;i<vertices.count;i++){
  const shape=n=>Math.sign(n)*Math.pow(Math.abs(2*n),.58)/2;
  vertices.setXYZ(i,shape(vertices.getX(i)),shape(vertices.getY(i)),shape(vertices.getZ(i)));
 }
 cushion.computeVertexNormals();
 for(const x of [-.42,.42]){
  const pillow=g('Down-pillow',cushion,cream);pillow.position.set(x,.547,-.70);pillow.scale.set(.75,.18,.44);pillow.rotation.y=x*.14;
  b('Headboard-panel','#86a8a6',x,.74,-.954,.80,.38,.041);
 }
 for(const x of [-.64,-.22,.22,.64])o('Tuft',teal,x,.75,-.929,.028,.028,.009);

},{interactions:{sleep:{root:[-.40,.452,.50],yaw:0,approaches:[[0,0,1.8],[-1.52,0,.1],[1.52,0,.1]],surface_height:.53}}});
await asset('basin','白瓷台盆和橡木浴室柜','sideboard',(b,c,o,g)=>{
 b('Plinth','#776f66',0,.08,0,.76,.16,.39);b('Cabinet',maple,0,.46,0,.86,.72,.48);
 for(const x of [-.206,.206]){b('Shaker-door',cream,x,.47,.246,.397,.63,.028);b('Brass-handle','#ad8b58',x,.65,.269,.08,.021,.022)}
 b('Counter',cream,0,.84,0,.94,.08,.52);
 const profile=[[.16,0],[.22,.014],[.29,.081],[.303,.107],[.30,.116],[.285,.116],[.272,.096],[.22,.055],[.13,.026],[.028,.02]];
 const bowl=g('Glazed-vessel',new T.LatheGeometry(profile.map(([r,h])=>new T.Vector2(r,h)),48),'#faf6ec');bowl.position.set(0,.88,.039);bowl.scale.z=.63;
 c('Waste',metal,0,.90,.039,.055,.006,.038);
 g('Gooseneck',pipe([[0,.882,-.177],[0,1.073,-.177],[0,1.117,-.15],[0,1.114,-.095],[0,1.082,-.082]],.014),metal);
 c('Tap-base',metal,0,.888,-.177,.068,.023,.068);
 for(const x of [-.206,.206])b('Recessed-oak-panel','#cda681',x,.45,.263,.329,.48,.009);
 c('Amber-soap','#b37442',.369,.951,-.10,.081,.142,.081);c('Pump-neck',metal,.369,1.04,-.10,.025,.038,.025);b('Pump',metal,.356,1.06,-.10,.056,.013,.016);
 c('Rinse-cup',teal,-.369,.93,-.09,.080,.10,.080);c('Cup-inner','#466965',-.369,.981,-.09,.062,.002,.062);
 b('Mirror-frame',maple,0,1.49,-.23,.67,.55,.047);b('Mirror','#c2d9dd',0,1.49,-.20,.632,.512,.015);b('Vanity-ledge',maple,0,1.206,-.182,.72,.024,.14);

},{surfaces:{ledge:{size:[.66,.102],center:[0,-.182],height:1.218}}});
await asset('shower','青瓷淋浴角和挂巾','appliance',(b,c,o,g)=>{
 b('Pan',cream,0,.048,0,1.05,.094,1.04);b('Inset','#a6c4be',0,.095,0,.91,.014,.91);
 b('Tile-back','#c6d9cf',0,1.04,-.49,1.04,2,.055);
 for(let i=1;i<8;i++)b('Grout','#e1e9df',0,.09+i*.24,-.455,1.02,.006,.004);
 c('Riser',metal,.05,1.35,-.40,.026,1.18,.026);b('Shower-arm',metal,.05,1.94,-.27,.03,.027,.28);c('Shower-head','#aab9b5',.05,1.918,-.13,.21,.035,.21);
 b('Mixer',metal,.05,.87,-.38,.24,.043,.055);b('Towel-bar',maple,-.29,1.13,-.39,.31,.035,.06);
 g('Draped-hand-towel',cloth(18,12,(u,v)=>[-.294+(u-.5)*.232,1.145-v*.40+.01*Math.cos(6*u)*v,-.344+.015*Math.cos(5*Math.PI*u)+.003*Math.sin(v*7),v>.75&&v<.94?'#e4d7b8':'#689492']));
 for(const x of [-.26,0,.26])b('Tile-joint','#e1e9df',x,1.047,-.457,.005,1.95,.005);
 g('Handshower-hose',pipe([[.105,.87,-.353],[.13,.57,-.31],[.22,.42,-.31],[.315,.55,-.32],[.33,1.25,-.37]],.009),metal);
 c('Handset-grip',metal,.33,1.31,-.372,.031,.16,.031);o('Handset',metal,.33,1.416,-.357,.07,.103,.047);
 b('Wall-shelf',cream,-.32,1.50,-.379,.32,.027,.16);
 for(const [x,h,color] of [[-.39,.135,'#bc8854'],[-.26,.18,teal]]){c('Bottle',color,x,1.514+h/2,-.37,.069,h,.069);c('Bottle-cap',cream,x,1.528+h,-.37,.039,.025,.039)}
 for(let i=0;i<7;i++)b('Teak-slat',i%2?maple:'#c29772',-.273+i*.091,.116,.16,.079,.029,.43);

});
await asset('toilet','奶油白坐便器','appliance',(b,c,o,g)=>{
 const profile=[[.142,0],[.152,.008],[.151,.04],[.131,.095],[.117,.16],[.128,.216],[.163,.25],[.201,.293],[.217,.35],[.219,.413],[.209,.432],[.18,.437]];
 const shell=g('Vitreous-pedestal',new T.LatheGeometry(profile.map(([r,h])=>new T.Vector2(r,h)),40),'#faf6ec');shell.scale.z=.31/.219;shell.position.z=.035;
 o('Lid',cream,0,.471,.058,.44,.065,.54);b('Cistern',cream,0,.54,-.235,.45,.49,.19);
 b('Tank-cap','#faf6ec',0,.775,-.235,.45,.02,.19);
 for(const x of [-.025,.025])o('Dual-flush',metal,x,.79,-.235,.044,.012,.040);
 o('Seat-rim','#e5ddc7',0,.452,.058,.435,.034,.545);
 for(const x of [-.107,.107]){c('Hinge-base',metal,x,.471,-.159,.045,.020,.045);b('Seat-hinge',metal,x,.481,-.14,.034,.021,.054)}
 for(const x of [-.12,.12])o('Anchor-cap','#faf6ec',x,.099,.077,.046,.024,.04);
});
await asset('step','枫木两级踏凳','chair',(b,c)=>{
 for(const x of [-.18,.18]){b('Side',maple,x,.145,-.09,.046,.29,.22);b('Side',maple,x,.069,.09,.046,.138,.18)}
 b('Cross-brace','#a87953',0,.20,-.14,.34,.046,.038);
 for(const x of [-.178,.178])for(const z of [-.15,.13])c('Rubber-foot','#817b6d',x,.01,z,.053,.02,.057);
 b('Upper',cream,0,.30175,-.09,.44,.0375,.24);b('Lower',teal,0,.147,.12,.44,.035,.18);
 for(let i=0;i<3;i++){b('Upper-inlay','#cbb693',0,.32065,-.145+i*.042,.326,.0007,.009);b('Lower-inlay','#acc5ba',0,.165,.067+i*.039,.326,.001,.007)}
});
writeFileSync('runtime-assets.json',JSON.stringify(manifest,null,2)+'\n');writeFileSync('house3d/furniture-assets.json',JSON.stringify(assets,null,2)+'\n');
