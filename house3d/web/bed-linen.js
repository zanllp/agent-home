import {DataTexture,Float32BufferAttribute,SRGBColorSpace,LinearFilter,LinearMipmapLinearFilter} from 'three';

// Bind the print to the flat cloth, so its woven checks and sprigs follow every fold.
export function finishBedLinen(quilt){
 const sprigs=[[-.058,-.07],[.068,.013],[.012,.108]];
 const n=384,data=new Uint8Array(n*n*4),p=quilt.geometry.attributes.position,uv=[];
 for(let i=0;i<p.count;i++)uv.push((p.getX(i)+.847)/1.694,(p.getZ(i)+.411)/1.46);
 quilt.geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){
  const u=i/n,v=j/n,thread=((i^j)&1)*3-1,band=v<.15||v>.85;
  const row=Math.floor(v*7),x=((u*9+(row%2)/2)%1)-.5,y=v*7%1-.5;
  const stem=Math.abs(x-.35*y)<.018&&Math.abs(y)<.16;
  const leaves=sprigs.some(([a,b])=>{
   const dx=x-a,dy=y-b;
   return ((dx+.55*dy)/.062)**2+((dy-.55*dx)/.038)**2<1;
  });
  const pick=v>.147&&v<.155||v>.844&&v<.851;
  const fibre=thread+(i%24<2?-4:0)+(j%27<2?-4:0);
  const rgb=pick?[192,174,142]:!band&&(stem||leaves)?[185,201,191]:[250,249,245];
  data.set([rgb[0]+fibre,rgb[1]+fibre,rgb[2]+fibre,255],4*(j*n+i));
 }
 const map=new DataTexture(data,n,n);map.colorSpace=SRGBColorSpace;map.magFilter=LinearFilter;
 map.minFilter=LinearMipmapLinearFilter;map.generateMipmaps=true;map.anisotropy=4;map.needsUpdate=true;
 quilt.material.map=map;quilt.material.roughness=.94;quilt.material.needsUpdate=true;
}
