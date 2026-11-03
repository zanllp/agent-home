import {DataTexture,LinearFilter,LinearMipmapLinearFilter,SRGBColorSpace} from 'three';

// Four edge-glued boards: fine longitudinal fibres and a few wider, curved growth rings.
export function finishMapleTable(root,tint=0xffffff){
 const slab=root.getObjectByName('Maple-slab');if(!slab)return;
 const w=1024,h=512,pixels=new Uint8Array(w*h*4);
 const seams=[0,.23,.51,.77,1],tints=[2,-2,3,0];let seed=19;
 for(let y=0;y<h;y++){
  const v=(y+.5)/h,board=seams.findIndex(edge=>v<edge)-1,t=(v-seams[board])/(seams[board+1]-seams[board]);
  for(let x=0;x<w;x++){
   const u=(x+.5)/w,offset=board*1.79;
   const bend=t+(.12+.14*t)*Math.sin(u*4.8+offset)+.018*Math.sin(u*13+offset);
   const rings=Math.sqrt((u-.23*board)**2*1.56+(bend+.15)**2);
   const latewood=Math.pow(.5+.5*Math.cos(rings*43+offset),7);
   seed=(Math.imul(seed,1664525)+1013904223)>>>0;
   const grain=tints[board]-7*latewood+1.4*Math.sin(bend*191+u*.78)+1.6*((seed>>>24)/128-1)-2.4*Math.exp(-Math.min(t,1-t)*130);
   pixels.set([225+grain,184+grain,140+grain,255],(y*w+x)*4);
  }
 }
 const map=new DataTexture(pixels,w,h);map.colorSpace=SRGBColorSpace;map.magFilter=LinearFilter;map.minFilter=LinearMipmapLinearFilter;map.generateMipmaps=true;map.anisotropy=8;map.needsUpdate=true;
 slab.material.color.set(tint);slab.material.map=map;slab.material.needsUpdate=true;
}
