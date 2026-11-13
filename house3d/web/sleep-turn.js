// Only the controller owns this clock; spectators interpolate its published weight.
export function sleepTurnClock(random=Math.random){
 let job=null,last=null,elapsed=0,hold=0,from=0,value=0;
 return {sample(now,interaction,paused){
  if(interaction?.frame?.sofa)return value=0;
  if(interaction?.pose==='sleep'&&interaction.phase==='leaving')return value;
  if(interaction?.pose!=='sleep'||interaction.phase!=='active'){
   job=null;last=null;return value=0;
  }
  if(job!==interaction.jobId){
   job=interaction.jobId;elapsed=0;from=value=0;last=now;hold=15000+random()*10000;
  }
  if(!paused&&last!==null)elapsed+=Math.max(0,now-last);
  last=paused?null:now;
  if(elapsed<=hold)return value=from;
  const t=Math.min(1,(elapsed-hold)/3200);
  value=from+(1-2*from)*t*t*(3-2*t);
  if(t===1){from=value;elapsed=0;hold=32000+random()*26000}
  return value;
 }};
}

// The normalized group's local Y runs along the spine once the avatar lies down.
// Pivot inside the torso rather than swinging her head in an arc off the pillow.
export function applySleepTurn(normalized,weight){
 const angle=1.12*weight;
 normalized.rotation.y=angle;
 normalized.position.x=-.085*Math.sin(angle);
 normalized.position.z=.085*(1-Math.cos(angle))+.043*Math.sin(angle);
}
