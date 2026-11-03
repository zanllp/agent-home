// Run from the repo root. Capture the approved wide arm contour without shipping another copy of the sofa.
import {readFileSync,writeFileSync} from 'node:fs';
import {Vector3,Raycaster,DoubleSide} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {widenLoungeGeometry} from '../house3d/web/lounge-sofa.js';
const assets=JSON.parse(readFileSync('house3d/furniture-assets.json')),sofa=assets['family-wide-lounge-v1'];
const raw=readFileSync('house3d/assets'+sofa.model.replace('/models',''));
const loader=new GLTFLoader().register(()=>({name:'geometry-only',loadTexture:async()=>null}));
const {scene}=await loader.parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');
const mesh=scene.getObjectByName('family-sofa-stylized-v2');mesh.geometry=widenLoungeGeometry(mesh.geometry,sofa.lounge_extension);mesh.material.side=DoubleSide;scene.updateMatrixWorld(true);
const ray=new Raycaster(),mm=n=>Math.round(n*1000),points=[];
function hit(x,y,z,dx,dy,dz=0){
 const dir=new Vector3(dx,dy,dz);ray.set(new Vector3(x,y,z).addScaledVector(dir,2),dir.negate());
 const surface=ray.intersectObject(mesh)[0];if(!surface)throw Error('No arm at '+[x,y,z]);return surface.point;
}
for(let j=0;j<=8;j++){const v=j/8,row=[];
 for(let i=0;i<=24;i++){
  const u=i/24,z=.004+.289*v+.009*Math.sin(Math.PI*u),phi=.80*v**3;
  const pivot=1.197-.03*v*v,cy=.427;
  const along=(y,a)=>{
   const dx=Math.sin(a)*Math.cos(phi),dy=Math.cos(a),dz=Math.sin(a)*Math.sin(phi),d=new Vector3(dx,dy,dz);
   // Span little hollows in the foam. Sample neighbouring strips but keep the guide on this ray.
   const reach=Math.max(...[-.025,0,.025].map(o=>hit(pivot,y,z+o,dx,dy,dz).sub(new Vector3(pivot,y,z+o)).dot(d)));
   return new Vector3(pivot,y,z).addScaledVector(d,reach);
  };
  let p;
  if(i<=12){
   const start=.637+.068*v+.019*Math.sin(v*5),x=start+(pivot-start)*i/12;
   const t=Math.max(0,Math.min(1,(x-.91)/.262)),bridge=.447+.130*t*t*(3-2*t);
   const h=Math.max(bridge,...[-.018,0,.018].flatMap(ox=>[-.02,0,.02].map(oz=>hit(x+ox,cy,z+oz,0,1).y)));
   p=new Vector3(x,h,z);
  }else if(i<=18){const a=(i-12)/6*Math.PI/2;p=along(cy,a)}
  else {
   const y=cy+((.160+.020*Math.sin(4*v+.4))-cy)*(i-18)/6,side=along(y,Math.PI/2),crest=along(cy,Math.PI/2);
   // Once the casing curves underneath, gravity leaves the hem hanging outside it.
   p=side.x>crest.x?side:crest;p.y=y;
  }
  row.push([mm(p.x),mm(p.y),mm(p.z)]);
 }
 points.push(row);
}
writeFileSync('house3d/web/throw-arm-profile.json',JSON.stringify(points)+'\n');
