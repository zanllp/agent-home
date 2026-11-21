// Author in the original GLB bind space (metres, +Y up, +Z face forward).
// A garment uses the live skeleton, never a second mixer or character instance.
import * as T from 'three';
import {textile} from './paint.js';
import catalog from './manifest.json';
const tau=2*Math.PI, clamp=t=>Math.max(0,Math.min(1,t)), ease=t=>clamp(t)**2*(3-2*clamp(t));
export const outfits=Object.fromEntries(catalog.outfits.map(o=>[o.id,o.label]));
export function makeGarment(base,id){
 if(!Object.hasOwn(outfits,id))throw Error('Unknown outfit '+id);
 const anchor=base.getObjectByName('Legs'),sk=anchor.skeleton;
 const joints=new Map(sk.bones.map((b,i)=>[b.name.replace(/^mixamorig[:_]?/,''),i]));
 const joint=n=>{if(!joints.has(n))throw Error('Missing bind joint '+n);return joints.get(n)};
 const bp=n=>new T.Vector3().setFromMatrixPosition(sk.boneInverses[joint(n)].clone().invert());
 const blend=(a,b,t)=>[[a,1-t],[b,t]],spine=y=>y<.46?blend('Hips','Spine1',ease((y-.39)/.07)):blend('Spine1','Spine2',ease((y-.46)/.065));
 const group=new T.Group();group.name=id;
 const pos=[],seated=[],uv=[],clr=[],weights=[],indices=[],jidx=[],materials=[],surfaces=[],tex=new Map();
 const palette=new T.Color(),white=new T.Color('#ffffff');
 function surface(hex,map){
  const key=hex+'|'+(map||'');let i=materials.findIndex(m=>m.name===key);if(i>=0)return i;
  if(map&&!tex.has(map))tex.set(map,textile(map));
  const m=new T.MeshBasicMaterial({name:key,color:hex,vertexColors:true,map:tex.get(map)||null,side:T.DoubleSide,toneMapped:false});materials.push(m);return materials.length-1;
 }
 // Section: [height, half width, half depth, centre X, centre Z].
 function shell(rings,{color='#ffffff',map,fold=0,flutes=10,skin=spine,fur=false,hem=0,sections=64,axis,skirt=false,lapel=false,sole=false}={}){
  const start=indices.length,offset=pos.length/3,mat=surface(color,map);
  let lengths=[0];for(let j=1;j<rings.length;j++)lengths.push(lengths[j-1]+Math.hypot(...rings[j].map((v,k)=>v-rings[j-1][k])));const total=lengths.at(-1);
  for(let j=0;j<rings.length;j++)for(let i=0;i<=sections;i++){
   const [y,rx,rz,x,z]=rings[j],u=i/sections,a=(u-.5)*tau,cs=Math.cos(a),sn=Math.sin(a),v=lengths[j]/total;
   const wave=Math.cos(flutes*a+.25*Math.sin(v*3)),pile=fur?(.45*Math.cos(23*a+v*4)+.35*Math.sin(39*a-v*6)+.2*Math.sin(7*a+v*12)):0;
   const radius=1+fold*(.45+.55*(1-v))*wave+(fur?.04*pile:0),dy=hem*Math.cos(a*flutes)*(1-v)**3;
   let dx=rx*sn*radius;pos.push(x+dx*(axis?.x??1),y+dy+dx*(axis?.y??0),z+rz*cs*radius);
   if(skirt){
    const t=clamp((.43-y)/.19),front=ease((cs+.15)/1.05);
    seated.push(0,(.068*Math.sin(t*2.45)+.015*t)*front+.015*t*(1-front),.103*Math.sin(t*1.48)*front);
   }else if(lapel){
    const t=1-ease((y-.316)/.097),front=ease((cs+.05)/1.05);seated.push(0,.027*t*front,.047*t*front);
   }else seated.push(0,0,0);
   uv.push(u,v);let shade=.74+.15*cs-.10*sn+.055*v+fold*1.3*wave+(fur?.16*pile:0);
   // The boots/socks are unlit in game; bake curvature, welt and instep in bind space.
   if(axis)shade+=.055*Math.sin(v*2.7)-.035*Math.cos(a*3+v*1.6);
   if(y<.12){shade+=.085*Math.sin(v*Math.PI)-.13*(1-ease(v/.19))+.035*Math.sin(2*a);
    if(!winter&&v>.70)shade+=.018*Math.cos(a*24);
   }
   palette.copy(white).multiplyScalar(shade);clr.push(palette.r,palette.g,palette.b);
   const ws=skin(y,a,v);for(let k=0;k<4;k++){jidx.push(ws[k]?joint(ws[k][0]):0);weights.push(ws[k]?.[1]||0)}
   if(i&&j){const d=offset+j*(sections+1)+i;indices.push(d-sections-2,d-sections-1,d,d-sections-2,d,d-1)}
  }
  if(sole){for(let k=1;k<sections-1;k++)indices.push(offset,offset+k+1,offset+k)}
  surfaces.push([start,indices.length-start,mat]);
 }
 const C=-.006,ring=(y,rx,rz,x=C,z=.067)=>[y,rx,rz,x,z];
 const winter=id==='snow-letter';
 const skirtSkin=()=>[['Hips',1]];
 if(winter){
  shell([ring(.241,.193,.150),ring(.246,.196,.152),ring(.257,.192,.149),ring(.265,.179,.139)],{color:'#fff2da',fold:.030,flutes:20,hem:.003,skin:skirtSkin,skirt:true});
  shell([ring(.258,.200,.155),ring(.275,.196,.152),ring(.312,.178,.138),ring(.349,.15,.120),ring(.38,.124,.098),ring(.413,.088,.075),ring(.43,.079,.070)],{map:'skirt',fold:.053,flutes:12,hem:.003,skin:skirtSkin,skirt:true});
  shell([ring(.41,.087,.076),ring(.425,.084,.073),ring(.455,.083,.072),ring(.50,.09,.075),ring(.545,.085,.070),ring(.575,.054,.053),ring(.602,.035,.036)],{color:'#384776'});
  shell([ring(.411,.091,.079),ring(.42,.090,.078),ring(.43,.087,.077)],{color:'#bac9e6'});
 }else{
  shell([ring(.309,.122,.095),ring(.32,.124,.097),ring(.355,.114,.090),ring(.404,.101,.081),ring(.458,.095,.080),ring(.512,.097,.079),ring(.549,.089,.073),ring(.572,.066,.06),ring(.604,.036,.038)],{map:'shirt',lapel:true,fold:.017,flutes:9});
  shell([ring(.311,.123,.096),ring(.314,.124,.097)],{color:'#efe9df',lapel:true,fold:.017,flutes:9});
 }
 for(const [side,ss] of [['Left',1],['Right',-1]]){
  const arm=bp(side+'Arm'),elbow=bp(side+'ForeArm'),wrist=bp(side+'Hand');
  const point=t=>t<.5?arm.clone().lerp(elbow,2*t):elbow.clone().lerp(wrist,2*t-1);
  const axis=new T.Vector2(arm.y-wrist.y,wrist.x-arm.x).normalize();
  const armRing=(t,r)=>{const p=point(t);return ring(p.y,r,r*.95,p.x,p.z)};
  const skin=y=>blend(side+'Arm',side+'ForeArm',ease((elbow.y+.028-y)/.056));
  shell([[1.05,.031],[.99,.037],[.91,.042],[.77,.042],[.52,.044],[.28,.048],[.14,.052],[.04,.046],[-.035,.028]].map(([t,r])=>armRing(t,r)),{color:winter?'#a8bce2':'#b4c3e6',fold:.036,flutes:7,skin,axis});
  shell([[1.065,.031],[1.05,.034],[.98,.038],[.95,.037]].map(([t,r])=>armRing(t,r)),{color:winter?'#333f69':'#e6e7eb',axis,skin});
  const hip=bp(side+'UpLeg'),knee=bp(side+'Leg'),ankle=bp(side+'Foot');
  const legSkin=y=>y<.12?blend(side+'Foot',side+'Leg',ease((y-.063)/.057)):blend(side+'Leg',side+'UpLeg',ease((y-knee.y+.036)/.072));
  const legRing=(y,rx,rz)=>{const q=y<knee.y?ankle.clone().lerp(knee,clamp((y-ankle.y)/(knee.y-ankle.y))):knee.clone().lerp(hip,clamp((y-knee.y)/(hip.y-knee.y)));return ring(y,rx,rz,q.x+ss*(winter?.008:.017),q.z)};
  if(winter){
   shell([[.062,.027,.027],[.095,.031,.031],[.14,.034,.033],[.20,.036,.035],[.25,.040,.040],[.35,.044,.045],[.38,.040,.041]].map(r=>legRing(...r)),{map:'stocking',skin:legSkin,fold:.015,flutes:16});
  }else{
   shell([[.071,.032,.031],[.084,.04,.039],[.102,.048,.043],[.139,.051,.046],[.184,.050,.048],[.22,.050,.049],[.26,.052,.052],[.309,.056,.055],[.354,.053,.057],[.383,.050,.054]].map(r=>legRing(...r)),{map:'pants',skin:legSkin,fold:.041,flutes:7});
   shell([[.070,.033,.032],[.075,.038,.035],[.086,.041,.039],[.089,.040,.038]].map(r=>legRing(...r)),{color:'#d6dced',skin:legSkin});
  }
  const fx=ankle.x+ss*(winter?.008:.017),fz=ankle.z+.026;
  const f=(y,rx,rz,off=0)=>ring(y,rx,rz,fx,fz+off);
  shell([f(.005,.030,.044),f(.009,.034,.052),f(.021,.036,.054),f(.034,.035,.050),f(.045,.031,.040,-.005),f(.062,.028,.030,-.017),f(.085,.031,.030,-.024),f(winter?.115:.093,.033,.031,-.024)],{color:winter?'#ffffff':'#fff2df',map:winter?'boot':null,skin:legSkin,sole:true});
  if(winter){
   shell([f(.106,.034,.033,-.024),f(.112,.036,.034,-.024),f(.117,.034,.032,-.024)],{color:'#f7ead9',skin:legSkin});

  }
 }
 if(winter){
  const cape=[ring(.480,.157,.114),ring(.493,.156,.113),ring(.511,.147,.108),ring(.539,.134,.098),ring(.562,.101,.076),ring(.580,.075,.063),ring(.604,.039,.040)];
  shell(cape,{map:'cape',fold:.03,hem:.003,flutes:9});
  shell([ring(.47,.153,.110),ring(.475,.161,.118),ring(.484,.165,.119),ring(.494,.162,.118),ring(.498,.154,.111)],{map:'fur',fur:true,hem:.003,sections:152});
  shell([ring(.572,.067,.058),ring(.579,.068,.061),ring(.588,.057,.054),ring(.594,.044,.041),ring(.595,.036,.038)],{map:'fur',fur:true,sections:120});

 }else{
  shell([ring(.579,.060,.054),ring(.588,.053,.048),ring(.604,.038,.039)],{color:'#c3cfe7'});
 }
 // Close the small neckline visible below the scanned head, without editing the head.
 shell([ring(.570,.035,.031,C,.068),ring(.585,.040,.041,C,.076),ring(.604,.045,.047,C,.085)],{color:'#f9d9c9',skin:y=>blend('Neck','Head',ease((y-.576)/.03))});
 shell([ring(.584,.022,.020,C,.092),ring(.588,.042,.031,C,.093),ring(.594,.061,.039,C,.095),ring(.605,.072,.045,C,.095),ring(.616,.075,.048,C,.095)],{color:'#ffe4d6',skin:()=>[['Head',1]],sole:true});
 const g=new T.BufferGeometry();for(const [name,vals,size] of [['position',pos,3],['uv',uv,2],['color',clr,3],['skinWeight',weights,4]])g.setAttribute(name,new T.Float32BufferAttribute(vals,size));
 g.setAttribute('skinIndex',new T.Uint16BufferAttribute(jidx,4));
 const sorted=[];for(let m=0;m<materials.length;m++){const start=sorted.length;for(const [offset,count,material] of surfaces)if(material===m)for(let k=0;k<count;k++)sorted.push(indices[offset+k]);g.addGroup(start,sorted.length-start,m)}
 g.setIndex(sorted);g.computeVertexNormals();const seat=new T.Float32BufferAttribute(seated,3);seat.name='SeatedFit';g.morphAttributes.position=[seat];g.morphTargetsRelative=true;

 const mesh=new T.SkinnedMesh(g,materials);mesh.name=id+'-clothing';mesh.bind(sk,anchor.bindMatrix);mesh.frustumCulled=false;group.add(mesh);return group;
}
