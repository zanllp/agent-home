import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

function part(root,name,geometry,material,x,y,z){
 const m=new T.Mesh(geometry,material);m.name=name;m.position.set(x,y,z);m.receiveShadow=m.castShadow=true;root.add(m);return m;
}
const rounded=(w,h,d,r)=>new RoundedBoxGeometry(w,h,d,2,r);
const satin=(color,metalness=0)=>new T.MeshStandardMaterial({color,metalness,roughness:.43});

// Pencil marks on the inside casing travel with this particular family door.
function growthMarks(root,canvas){
 canvas.width=160;canvas.height=768;const ctx=canvas.getContext('2d');
 ctx.fillStyle='#514434';ctx.strokeStyle='#514434';ctx.lineWidth=3;
 for(const [height,label,offset] of [[1.18,'8 岁',3],[1.26,'9 岁',-2],[1.34,'10 岁',1]]){
  const y=(1.42-height)/.36*canvas.height;
  ctx.beginPath();ctx.moveTo(12,y);ctx.lineTo(114,y+offset);ctx.stroke();
  ctx.font='35px sans-serif';ctx.fillText(label,14,y-9);
 }
 const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
 const ink=new T.MeshBasicMaterial({map,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
 const p=part(root,'Family pencil height marks',new T.PlaneGeometry(.029,.36),ink,.483,1.24,.0275);
 p.castShadow=false;
}

export function finishEntryDoor(root,makeCanvas=()=>document.createElement('canvas')){
 const oak=root.getObjectByName('Door_slab').material,metal=satin('#595651',.4),black=satin('#342f2a',.25);
 const box=(n,w,h,d,x,y,z,m,r=.002)=>part(root,n,rounded(w,h,d,r),m,x,y,z);
 const disc=(n,r,d,x,y,z,m)=>{
  const p=part(root,n,new T.CylinderGeometry(r,r,d,24),m,x,y,z);p.rotation.x=Math.PI/2;return p;
 };
 for(const sign of [-1,1])box('Stepped oak casing',.031,2.144,.022,sign*.483,1.073,.016,oak);
 box('Casing lintel',.996,.029,.022,0,2.142,.016,oak);
 const lock=root.getObjectByName('Lock');lock.material=black;
 growthMarks(root,makeCanvas());
 root.getObjectByName('Lever').visible=false;
 disc('Lever pivot',.021,.014,-.351,1.027,.061,metal);
 box('Inside lever',.114,.016,.021,-.305,1.027,.068,black,.006);
 box('Thumbturn grip',.027,.009,.012,-.351,.953,.059,metal,.003).rotation.z=.65;
 disc('Peephole bezel',.015,.006,0,1.52,.046,metal);
 disc('Peephole glass',.009,.003,0,1.52,.050,black);
 for(const z of [-.035,-.012,.009])box('Sill traction rib',.92,.003,.002,0,.019,z,metal,.0006);
}

export function finishEntryLanding(root){
 // A bound runner inset into the threshold tiles. Its fibres live in one mipmapped draw call.
 const w=512,h=160,data=new Uint8Array(w*h*4);let seed=73;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  const edge=Math.min(x,w-1-x,y,h-1-y),warp=(x+(y>>2)%2)%4,weft=y%4;
  const light=(seed>>>28)-7+(warp===0?-7:2)+(weft===0?-6:2)
   +(edge<4?-24:edge<7?5:0)+(edge>10&&edge<14?-11:0);
  data.set([117+light,111+light,101+light,255],4*(w*y+x));
 }
 const t=new T.DataTexture(data,w,h);t.colorSpace=T.SRGBColorSpace;t.generateMipmaps=true;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.anisotropy=4;t.needsUpdate=true;
 const mat=new T.MeshStandardMaterial({map:t,roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const m=part(root,'Bound inset doormat',new T.PlaneGeometry(.86,.295),mat,.054,.0148,-.306);
 m.rotation.x=-Math.PI/2;m.castShadow=false;
}

export function latchPlates(objects,assets,sides){
 const side=o=>Math.abs(o.yaw)<.001?'back':'left',u=o=>side(o)==='back'?o.x:-o.z;
 const wallItems=objects.filter(o=>assets[o.asset_id]?.placement==='wall');
 return wallItems.filter(o=>o.asset_id==='family-entry-door-v1').flatMap(o=>{
  const wall=side(o),x=u(o)-assets[o.asset_id].size[0]/2-.096,y=1.14;
  if(Math.abs(x)+.046>sides.find(s=>s.id===wall).width/2)return [];
  const blocked=wallItems.some(p=>{
   if(p===o||side(p)!==wall)return false;
   const a=assets[p.asset_id],b=a.elevation||0;
   return Math.abs(x-u(p))<a.size[0]/2+.046&&y+.046>b&&y-.046<b+a.height;
  });
  return blocked?[]:[{wall,x,y}];
 });
}

// One reusable architectural fitting, like the low outlets; no implied lighting command.
export function entryPlateTemplate(){
 const g=new T.Group();g.name='Entry rocker plate';
 const ivory=satin('#ece6da'),rocker=satin('#f7f0e5'),shadow=satin('#a39988');
 part(g,'Recessed gasket',rounded(.087,.087,.004,.004),shadow,0,0,0);
 part(g,'Ivory bezel',rounded(.086,.086,.008,.004),ivory,0,0,.004);
 part(g,'Rocker',rounded(.069,.062,.007,.003),rocker,0,0,.01).rotation.x=-.05;
 return g;
}
