// The canvas and hit-test coordinates stay full size; draw only its non-empty
// button region when a panel is closed. A two-pixel gutter retains edge AA.
export function fitOverlayQuad(mesh,w,h,button){
 const x=button?Math.max(0,button.x-2):0,y=button?Math.max(0,button.y-2):0;
 const right=button?Math.min(w,button.x+button.w+2):w,bottom=button?Math.min(h,button.y+button.h+2):h;
 mesh.scale.set(right-x,bottom-y,1);mesh.position.set((x+right-w)/2,(h-y-bottom)/2,0);
 const uv=mesh.geometry.attributes.uv;
 uv.setXY(0,x/w,1-y/h);uv.setXY(1,right/w,1-y/h);
 uv.setXY(2,x/w,1-bottom/h);uv.setXY(3,right/w,1-bottom/h);uv.needsUpdate=true;
}
