import {MeshStandardMaterial,MeshBasicMaterial} from 'three';

// Keep the character's accepted unlit face separate from lit room surfaces.
export function useFurnitureLighting(root,{unlit_nodes=[],no_shadow_nodes=[]}={}){
 const replacements=new Map();
 root.traverse(object=>{
  if(!object.isMesh)return;
  const unlit=unlit_nodes.some(name=>object.name.startsWith(name));
  object.material=[].concat(object.material).map(source=>{
   const key=source.uuid+'|'+unlit;
   if(!replacements.has(key)){
    const common={name:source.name+'-home',map:source.map,color:source.color,side:source.side,transparent:source.transparent,opacity:source.opacity,alphaTest:source.alphaTest,alphaMap:source.alphaMap,vertexColors:source.vertexColors,depthWrite:source.depthWrite};
    replacements.set(key,unlit?new MeshBasicMaterial({...common,toneMapped:false}):new MeshStandardMaterial({...common,roughness:.88,metalness:0,emissive:source.color,emissiveMap:source.map,emissiveIntensity:.12}));
   }
   return replacements.get(key);
  });
  if(object.material.length===1)object.material=object.material[0];
  object.castShadow=!no_shadow_nodes.some(name=>object.name.startsWith(name));object.receiveShadow=!unlit;
 });
 return root;
}
