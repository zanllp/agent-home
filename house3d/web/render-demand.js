// Keep execution/heartbeats independent from drawing. A resting body settles once;
// screen-only frames reuse its pose and the existing directional shadow map.
export function createRenderDemand({settleMs=700}={}){
 let settleUntil=0,dirty=true,lastKey='',lastCamera=null;
 return {
  invalidate(){dirty=true},
  animate(now,{ready,controller,paused,auto,routeLength,phase,pose,weight=0}){
   if(!ready||!controller||paused)return false;
   const active=auto||routeLength>0||['approaching','entering','leaving'].includes(phase)||(phase==='active'&&['draw','play','water'].includes(pose))||(phase!=='active'&&weight>.0001);
   if(active)settleUntil=now+settleMs;
   return active||now<settleUntil;
  },
  frame({key,camera,bodyChanged=false,screenChanged=false}){
   // OrbitControls can introduce sub-pixel floating-point jitter at rest.
   const cameraChanged=camera&&(!lastCamera||camera.some((v,i)=>Math.abs(v-lastCamera[i])>1e-6));
   if(cameraChanged)lastCamera=Array.from(camera);
   const sceneChanged=dirty||key!==lastKey||!!cameraChanged||bodyChanged;
   dirty=false;lastKey=key;
   return {render:sceneChanged||screenChanged,shadows:sceneChanged};
  }
 };
}
