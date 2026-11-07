import {Frustum,Matrix4} from 'three';

// Be conservative: only skip screens outside the camera frustum or explicitly
// hidden. Furniture occlusion is deliberately not guessed from bounding boxes.
export function createScreenVisibility(){
 const frustum=new Frustum(),matrix=new Matrix4();
 return (meshes,camera)=>{
  camera.updateMatrixWorld();frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  const maps=new Set();
  for(const mesh of meshes){
   let visible=true;for(let o=mesh;o;o=o.parent)if(!o.visible){visible=false;break}
   if(!visible)continue;
   mesh.updateWorldMatrix(true,false);
   if(frustum.intersectsObject(mesh))for(const material of [].concat(mesh.material||[]))if(material.map)maps.add(material.map);
  }
  return maps;
 };
}
