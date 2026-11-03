import {DataTexture,Float32BufferAttribute,LinearFilter,LinearMipmapLinearFilter,RepeatWrapping,SRGBColorSpace} from 'three';

// Widen only the upholstered span. Past the inside of the arms, translate the
// original mesh rigidly so the draped blanket still follows the same arm profile.
export function widenLoungeGeometry(source,extra){
 const g=source.clone(),p=g.attributes.position,n=g.attributes.normal;
 const linear=.55,edge=.66,blend=edge-linear,rate=extra/(2*(linear+blend/2));
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),r=Math.abs(x),u=Math.min(1,Math.max(0,(r-linear)/blend));
  const offset=r<linear?rate*r:rate*(linear+blend*(u-u*u/2));
  p.setX(i,x+Math.sign(x)*offset);
  const nx=n.getX(i)/(1+rate*(1-u)),ny=n.getY(i),nz=n.getZ(i),length=Math.hypot(nx,ny,nz);
  if(length)n.setXYZ(i,nx/length,ny/length,nz/length);
 }
 g.computeBoundingBox();g.computeBoundingSphere();return g;
}


function yarnMap(plush){
 const n=128,pixels=new Uint8Array(n*n*4);let seed=247;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  const noise=seed/2**32,warp=((x+2*(y>>2))%4===0?-.12:.02)+(y%4===0?-.10:0);
  const v=plush?.79+.21*noise-(noise<.10?.21:0):.90+warp+.08*(noise-.5);
  const level=Math.min(255,Math.round(v*255));pixels.set([level,level,level,255],4*(y*n+x));
 }
 const map=new DataTexture(pixels,n,n);map.wrapS=map.wrapT=RepeatWrapping;map.channel=1;
 map.minFilter=LinearMipmapLinearFilter;map.magFilter=LinearFilter;map.generateMipmaps=true;map.anisotropy=4;map.needsUpdate=true;return map;
}

// Dusty-blue velour with a few lighter spots on the crown, like a sewn whale calf.
function whaleVelour(){
 const w=512,h=192,bytes=new Uint8Array(w*h*4);
 const marks=[[.19,.69,.017,.013],[.235,.65,.014,.011],[.25,.73,.020,.015],[.32,.68,.011,.009],
  [.37,.81,.022,.012],[.41,.75,.018,.012],[.55,.71,.013,.012],[.60,.82,.017,.010]];
 let seed=61;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const u=x/w,v=y/h;let spot=0;
  for(const [a,b,rx,ry] of marks){
   const d=((u-a)/rx)**2+((Math.abs(v-.5)-(b-.5))/ry)**2;
   spot=Math.max(spot,Math.min(1,Math.max(0,(1.14-d)*2)));
  }
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  const nap=((seed>>>24)/255-.5)*15+2*Math.sin(x*2.5+y*.8);
  const seam=Math.abs(v-.5)<.005&&u>.085&&u<.83&&x%12<5?8:0;
  const i=(y*w+x)*4;bytes.set([141+nap+spot*48+seam,161+nap+spot*31+seam,181+nap+spot*17+seam,255],i);
 }
 const t=new DataTexture(bytes,w,h);t.colorSpace=SRGBColorSpace;t.minFilter=LinearMipmapLinearFilter;t.magFilter=LinearFilter;t.generateMipmaps=true;t.anisotropy=4;t.needsUpdate=true;return t;
}
// Keep the painted UVs and their seams. The weave uses a separate metre-based UV set.
export function finishLoungeCloth(root,plush=false){
 let yarn;const replacedBumps=new Set();
 const done=new Set();
 root.traverse(o=>{
  if(!o.isMesh)return;
  const body=/^Velour_whale/.test(o.name)||/^Velour_whale/.test(o.parent?.name);
  if(plush&&!body&&!/^(Soft_side_flipper|Tail_fluke)/.test(o.name))return;
  yarn??=yarnMap(plush);
  const g=o.geometry,p=g.attributes.position,uv=new Float32Array(p.count*2),frequency=plush?22:16;
  for(let i=0;i<p.count;i++){
   const x=p.getX(i)*o.scale.x,y=p.getY(i)*o.scale.y,z=p.getZ(i)*o.scale.z;
   uv[2*i]=(x-.37*z)*frequency;uv[2*i+1]=(y+.81*z)*frequency;
  }
  g.setAttribute('uv1',new Float32BufferAttribute(uv,2));
  if(plush&&body){
   const surface=new Float32Array(p.count*2);
   for(let i=0;i<p.count;i++){
    // The longitudinal seam runs along the back, halfway between the two printed sides.
    surface[i*2]=(p.getX(i)+.217)/.425;
    surface[i*2+1]=.5+Math.atan2(p.getZ(i),p.getY(i)-.136)/(2*Math.PI);
   }
   g.setAttribute('uv',new Float32BufferAttribute(surface,2));
  }
  for(const m of [].concat(o.material)){
   if(done.has(m))continue;done.add(m);
   if(m.bumpMap&&m.bumpMap!==yarn)replacedBumps.add(m.bumpMap);
   m.bumpMap=yarn;m.bumpScale=plush?.0006:.00036;m.aoMap=yarn;m.aoMapIntensity=plush?.58:.36;m.roughness=.98;
   if(!plush){
    // Let the original albedo supply cushion seams and dark feet; the loose cover is oatmeal, not tan leather.
    m.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
     float sofaValue=dot(diffuseColor.rgb,vec3(.24,.60,.16));
     float fabric=smoothstep(.10,.37,sofaValue);
     vec3 flax=vec3(.87,.79,.66)*(.65+.42*sofaValue);
     float yarn=texture2D(aoMap,vAoMapUv).r;
     diffuseColor.rgb=mix(diffuseColor.rgb,flax,.48*fabric)*(1.+(yarn-.88)*.28*fabric);
    `)};
    m.customProgramCacheKey=()=>'family-oatmeal-cover-v1';
   }
   if(plush&&body&&m.color.b>m.color.r){m.map=whaleVelour();m.color.set(0xffffff)}
   m.needsUpdate=true;
  }
 });
 replacedBumps.forEach(t=>t.dispose());
}
