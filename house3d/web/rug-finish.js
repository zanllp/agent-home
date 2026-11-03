import * as T from 'three';

// Keep the local variation of the woven yarn while dyeing the larger patches a quieter denim.
export function rugYarnTone(yarn,average){return (yarn-average)*.91+(average-134)*.51}
export function playRugTexture(image,size){
 const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
 const ctx=canvas.getContext('2d',{willReadFrequently:true}),w=canvas.width,h=canvas.height;
 ctx.drawImage(image,0,0,w,h);const weave=ctx.getImageData(0,0,w,h);
 const thumb=document.createElement('canvas');thumb.width=Math.max(1,w>>5);thumb.height=Math.max(1,h>>5);
 const small=thumb.getContext('2d');small.imageSmoothingQuality='high';small.drawImage(image,0,0,thumb.width,thumb.height);
 ctx.drawImage(thumb,0,0,w,h);const mean=ctx.getImageData(0,0,w,h).data;
 const [width,depth]=size,luma=(a,i)=>.24*a[i]+.60*a[i+1]+.16*a[i+2];
 for(let row=0;row<h;row++)for(let col=0;col<w;col++){
  const i=(row*w+col)*4,x=(col+.5)/w*width,z=(row+.5)/h*depth;
  const dx=Math.min(x,width-x),dz=Math.min(z,depth-z),edge=Math.min(dx,dz),along=dx<dz?z:x;
  let tone=rugYarnTone(luma(weave.data,i),luma(mean,i));
  // Twin narrow selvedges and a small stepped diamond repeat, measured in room metres.
  if(Math.abs(edge-.019)<.003||Math.abs(edge-.104)<.003)tone-=17;
  else if(edge>.031&&edge<.091){
   const s=Math.abs((along%.116)/.058-1),v=Math.abs(edge-.061)/.028;
   tone+=Math.abs(s+v-1)<.16?19:-5;
  }
  weave.data[i]=143+tone;weave.data[i+1]=154+tone;weave.data[i+2]=165+tone;
 }
 ctx.putImageData(weave,0,0);const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;return t;
}
