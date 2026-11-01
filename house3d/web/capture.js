export function captureSize(width,height,quality=1){const ratio=Math.min(1,1920/width,1440/height)*quality;return {width:Math.max(1,Math.round(width*ratio)),height:Math.max(1,Math.round(height*ratio))}}
export async function capturePng(source){
 const canvas=document.createElement('canvas'),context=canvas.getContext('2d');
 for(const quality of [1,.8,.64,.5]){const size=captureSize(source.width,source.height,quality);canvas.width=size.width;canvas.height=size.height;context.drawImage(source,0,0,size.width,size.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(blob&&blob.size<4.5*1024*1024)return blob}
 throw Error('图片太大了，请稍后再拍一次');
}
