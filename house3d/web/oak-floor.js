import * as T from 'three';

// Swatches within individual boards of the existing oak atlas, excluding the photographed joints.
// Source image bounds here use top-left coordinates on a 650 x 433 reference grid.
const swatches=[
 [12,5,285,31],[160,42,482,71],[269,83,631,110],[42,124,401,152],
 [194,165,535,192],[13,205,212,233],[320,247,637,273],[174,286,582,315],
 [244,328,584,355],[363,368,630,399],[6,409,307,428],
];
function random(seed){
 let x=seed|0;return ()=>{x=(Math.imul(1664525,x)+1013904223)>>>0;return x/4294967296};
}

export function oakBoards(width,depth){
 const positions=[],uv=[],colors=[],indices=[],finishes=[];
 const rows=Math.max(1,Math.round(depth/.184)),dw=depth/rows;
 for(let row=0;row<rows;row++){
  const rand=random(125891+row*7547);let x=-width/2,first=true;
  const y0=-depth/2+row*dw,y1=-depth/2+(row+1)*dw;
  while(x<width/2-1e-7){
   const full=1.08+.62*rand(),offset=first?(.14+((row*.618034)%1)*.71)*full:0;
   let length=Math.min(full-offset,width/2-x);if(width/2-x-length<.075)length=width/2-x;
   const [u0,v0,u1,v1]=swatches[Math.floor(rand()*swatches.length)],flip=rand()>.5;
   const tone=.92+.115*rand(),honey=rand(),rough=.40+.15*rand(),start=positions.length/3;
   // Continuous mesh: a shallow bevel catches light, but the walking plane stays level.
   for(const [inset,h,edgeTint] of [[0,-.00085,.86],[.0012,-.0005,.95],[.0028,0,.993],[.0050,0,1]]){
    const pad=Math.min(inset,length*.20),xa=x+pad,xb=x+length-pad,ya=y0+inset,yb=y1-inset;
    for(const [px,py] of [[xa,ya],[xb,ya],[xb,yb],[xa,yb]]){
     positions.push(px,py,h);
     const along=Math.min(1,(px-x+offset)/full),across=(py-y0)/dw;
     uv.push((u0+(u1-u0)*(flip?1-along:along))/650,1-(v1+(v0-v1)*across)/433);
     colors.push(tone*edgeTint,(tone-.012-.017*honey)*edgeTint,(tone-.035-.024*honey)*edgeTint);finishes.push(rough);
    }
   }
   for(let r=0;r<3;r++)for(let j=0;j<4;j++){
    const a=start+4*r+j,b=start+4*r+(j+1)%4;indices.push(a,b,b+4,a,b+4,a+4);
   }
   indices.push(start+12,start+13,start+14,start+12,start+14,start+15);
   x+=length;first=false;
  }
 }
 const g=new T.BufferGeometry();
 for(const [name,data,n] of [['position',positions,3],['uv',uv,2],['color',colors,3],['boardRoughness',finishes,1]])g.setAttribute(name,new T.Float32BufferAttribute(data,n));
 g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();return g;
}

export function createOakFloor(map){
 const plain=new T.MeshPhysicalMaterial({map,roughness:.56,clearcoat:.17,clearcoatRoughness:.4,envMapIntensity:.55});
 const oiled=new T.MeshPhysicalMaterial({map,vertexColors:true,roughness:.46,clearcoat:.20,clearcoatRoughness:.32,envMapIntensity:.63,bumpMap:map,bumpScale:.00045});
 oiled.onBeforeCompile=s=>{
  s.vertexShader='attribute float boardRoughness; varying float boardGloss;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nboardGloss=boardRoughness;');
  s.fragmentShader='varying float boardGloss;\n'+s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=boardGloss;');
 };
 oiled.customProgramCacheKey=()=>'oiled-oak-boards-v1';
 const mesh=new T.Mesh(new T.BufferGeometry(),plain);mesh.name='Indoor oak floor';mesh.rotation.x=-Math.PI/2;mesh.position.y=.001;mesh.receiveShadow=true;
 let previous='';
 return {mesh,update({width=6,depth=5,style='classic'}={}){
  const urban=style==='urban',key=[width,depth,urban].join('/');if(key===previous)return;previous=key;
  mesh.geometry.dispose();mesh.geometry=urban?oakBoards(width,depth):new T.PlaneGeometry(width,depth);
  mesh.material=urban?oiled:plain;map.repeat.set(urban?1:width/3,urban?1:depth/2);
 },dispose(){mesh.removeFromParent();mesh.geometry.dispose();map.dispose();plain.dispose();oiled.dispose()}};
}
