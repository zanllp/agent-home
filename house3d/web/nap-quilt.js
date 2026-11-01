import * as T from 'three';
// A reversible sleep-only cover, separate from the original bed / character.
export function createNapQuilt(scene){
 const group=new T.Group();scene.add(group);group.visible=false;const nx=56,nz=64,w=1.06,z0=-.06,length=.92,vertices=[],colors=[],indices=[];
 const base=new T.Color('#adc0e1'),cream=new T.Color('#f5ead6');
 function height(x,z){const fall=Math.exp(-Math.pow(x/.36,4)),along=.33+.06*Math.exp(-Math.pow((z-.12)/.4,4));const seam=Math.pow(Math.abs(Math.sin(x*22+z*16)*Math.sin(x*22-z*16)),.35);return .555+fall*(along+.012*seam)+.004*Math.sin(z*36+x*6)}
 for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){const x=(i/nx-.5)*w,z=z0+j/nz*length,seam=Math.pow(Math.abs(Math.sin(x*22+z*16)*Math.sin(x*22-z*16)),.35),shade=.92+.08*seam;vertices.push(x,height(x,z),z);const c=base.clone().multiplyScalar(shade);colors.push(c.r,c.g,c.b)}
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,d=a+nx+1,c=d+1;indices.push(a,c,b,a,d,c)}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();const material=new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide,toneMapped:false});group.add(new T.Mesh(geometry,material));
 const edge=[];for(let i=0;i<=40;i++)edge.push(new T.Vector3(-w/2+i/40*w,height(-w/2+i/40*w,z0)+.002,z0));for(let i=1;i<=40;i++)edge.push(new T.Vector3(w/2,height(w/2,z0+i/40*length)+.002,z0+i/40*length));for(let i=1;i<=40;i++)edge.push(new T.Vector3(w/2-i/40*w,height(w/2-i/40*w,z0+length)+.002,z0+length));for(let i=1;i<=40;i++)edge.push(new T.Vector3(-w/2,height(-w/2,z0+length-i/40*length)+.002,z0+length-i/40*length));const piping=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(edge,true),240,.008,6,true),new T.MeshBasicMaterial({color:cream,toneMapped:false}));group.add(piping);
 // Soft stitched dots mark the quilt intersections without a texture dependency.
 const dotGeometry=new T.SphereGeometry(.005,8,6),dotMaterial=new T.MeshBasicMaterial({color:'#ecdfbd',toneMapped:false});for(let z=-.12;z<.8;z+=.18)for(let x=-.36;x<=.36;x+=.18){const dot=new T.Mesh(dotGeometry,dotMaterial);dot.scale.y=.35;dot.position.set(x,height(x,z)+.006,z);group.add(dot)}
 return {update(weight,obj){group.visible=!!obj&&weight>.72;if(obj){group.position.set(obj.x,0,obj.z);group.rotation.y=obj.yaw}},dispose(){const geometries=new Set(),materials=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material)});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());scene.remove(group)}};
}
