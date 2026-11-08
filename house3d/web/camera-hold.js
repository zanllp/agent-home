// Viewer-local: only a changed OrbitControls gesture overrides the selected shot.
export function cameraHold(idleMs=30000){
 let held=false,moved=false,until=null;
 return {
  start(){if(!held)moved=false;held=true},
  change(){if(held)moved=true},
  end(now){if(held&&moved)until=now+idleMs;held=moved=false},
  blocked(now){return held||(until!==null&&now<until)},
  resume(now){if(held||until===null||now<until)return false;until=null;return true},
  reset(){held=moved=false;until=null}
 };
}
