import {MeshStandardMaterial,MeshBasicMaterial,DataTexture,RepeatWrapping} from 'three';

const SURFACES={
 fabric:{roughness:.91,metalness:0,envMapIntensity:.42},
 timber:{roughness:.49,metalness:0,envMapIntensity:.72},
 coated:{roughness:.40,metalness:.06,envMapIntensity:.8},
 metal:{roughness:.32,metalness:.38,envMapIntensity:.85},
 paper:{roughness:.93,metalness:0,envMapIntensity:.3},
 foliage:{roughness:.67,metalness:0,envMapIntensity:.45},
 neutral:{roughness:.68,metalness:0,envMapIntensity:.6},
};
export function furnitureSurface({kind}={},name=''){
 const n=name.toLowerCase();
 if(/paper|pages|notebook|cork/.test(n))return 'paper';
 if(/steel|metal|chrome|aluminium|bracket/.test(n))return 'metal';
 if(/linen|fabric|cushion|upholster/.test(n))return 'fabric';
 if(/oak|wood|walnut|timber/.test(n))return 'timber';
 if(['sofa','bed','rug','armchair','office_chair'].includes(kind))return 'fabric';
 if(['desk','coffee_table','dining_table','dining_chair','media_console','sideboard','shelf','wall_shelf','nightstand'].includes(kind))return 'timber';
 if(['washer','appliance','computer','desktop','tv','fridge','air_conditioner'].includes(kind))return 'coated';
 if(kind==='drying_rack')return 'metal';
 if(kind==='books')return 'paper';if(kind==='plant')return 'foliage';return 'neutral';
}
function fabricGrain(){
 const n=128,data=new Uint8Array(n*n*4);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const thread=((x%4<2)===(y%4<2)?7:-7),v=128+thread+Math.sin(x*7.13+y*3.17)*3;data.set([v,v,v,255],(y*n+x)*4)}
 const t=new DataTexture(data,n,n);t.wrapS=t.wrapT=RepeatWrapping;t.repeat.set(18,18);t.anisotropy=4;t.needsUpdate=true;return t;
}
// Preserve painted albedo, but do not copy generated normal/AO artifacts or add fake emission.
export function useFurnitureLighting(root,asset={}){
 const {unlit_nodes=[],no_shadow_nodes=[]}=asset,replacements=new Map();let cloth;
 root.traverse(object=>{
  if(!object.isMesh)return;
  const unlit=unlit_nodes.some(name=>object.name.startsWith(name));
  object.material=[].concat(object.material).map(source=>{
   const surface=furnitureSurface(asset,source.name||object.name),key=source.uuid+'|'+unlit+'|'+surface;
   if(!replacements.has(key)){
    const common={name:source.name+'-home-'+surface,map:source.map,color:source.color,side:source.side,transparent:source.transparent,opacity:source.opacity,alphaTest:source.alphaTest,alphaMap:source.alphaMap,vertexColors:source.vertexColors,depthWrite:source.depthWrite};
    const m=unlit?new MeshBasicMaterial({...common,toneMapped:false}):new MeshStandardMaterial({...common,...SURFACES[surface]});
    if(!unlit&&surface==='fabric'){cloth??=fabricGrain();m.bumpMap=cloth;m.bumpScale=.00065}m.userData.homeSurface=surface;replacements.set(key,m);
   }
   return replacements.get(key);
  });
  if(object.material.length===1)object.material=object.material[0];
  object.castShadow=!no_shadow_nodes.some(name=>object.name.startsWith(name));object.receiveShadow=!unlit;
 });
 return root;
}
