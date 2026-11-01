import {MeshBasicMaterial} from 'three';

// Keep the painted colors without adding PBR lighting or filmic tone mapping.
export function usePaintedCharacter(root) {
 const replacements=new Map();
 function convert(source) {
  if(!replacements.has(source)) {
   const material=new MeshBasicMaterial({
    name:`${source.name}-painted`,
    map:source.map,
    color:source.color,
    transparent:source.transparent,
    opacity:source.opacity,
    alphaMap:source.alphaMap,
    alphaTest:source.alphaTest,
    side:source.side,
    depthWrite:source.depthWrite,
    vertexColors:source.vertexColors,
    toneMapped:false,
   });
   replacements.set(source,material);
  }
  return replacements.get(source);
 }
 root.traverse(object=>{
  if(!object.isMesh)return;
  object.material=Array.isArray(object.material)?object.material.map(convert):convert(object.material);
  object.castShadow=true;
  object.receiveShadow=false;
 });
 // Textures remain owned by the model; material disposal does not dispose maps.
 for(const source of replacements.keys())source.dispose();
}
