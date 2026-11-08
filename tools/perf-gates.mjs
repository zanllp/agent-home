// Work budgets are independent of the GPU timer extension. Never count an empty
// or half-loaded scene as a cheap pass.
export function evaluateHomePerf({idle,draw,paused,runner},limits){
 const errors=[];
 for(const [name,rows] of Object.entries({idle,draw,paused,runner})){
  if(!rows?.length){errors.push(name+': no complete samples');continue}
  for(const r of rows){
   if(!(r.window_ms>=14000&&r.ticks>0))errors.push(name+': incomplete measurement');
   if(!['frames','shadow_frames','calls','triangles','active_ticks'].every(k=>Number.isFinite(r[k])&&r[k]>=0))errors.push(name+': missing counters');
   if(name==='runner'&&(r.role!=='runner'||r.frames||r.calls||r.triangles))errors.push('runner: unexpected display render');
   if(name!=='runner'&&r.role!=='viewer')errors.push(name+': missing real viewer');
   if(name==='paused'&&r.frames>1)errors.push('paused: repeated scene redraw');
   if(name==='idle'&&(r.active_ticks>1||r.shadow_frames>2||r.frames<1||r.frames*1000/r.window_ms>limits.idleFps))errors.push('idle: body, screen or shadow cadence outside budget');
   if(name==='draw'){
    if(r.frames<20||r.active_ticks/r.ticks<.9||r.frames/r.ticks<.9||r.triangles/r.frames<100000)errors.push('draw: animated room not continuously rendered');
    for(const [k,max] of Object.entries({calls:limits.callsPerFrame,triangles:limits.trianglesPerFrame,shadow_frames:limits.shadowRatio}))if(r[k]/r.frames>max)errors.push('draw: '+k+' exceeds per-frame budget');
   }
  }
 }
 return [...new Set(errors)];
}

export function compareHomeTiming(current,reference){
 if(reference.errors?.length||JSON.stringify(current.machine)!==JSON.stringify(reference.machine)||current.scenario!==reference.scenario)return ['timing: incompatible baseline'];
 const summarize=rows=>{
  const sum=k=>rows.reduce((n,r)=>n+(r[k]??0),0),w=rows[0]?.buffer_width,h=rows[0]?.buffer_height;
  if(!w||!h||rows.some(r=>r.buffer_width!==w||r.buffer_height!==h)||!sum('frames')||!sum('submit_ms'))throw Error('timing: incomplete baseline or resized canvas');
  return {size:w+'x'+h,submit:sum('submit_ms')/sum('frames'),interval:Math.max(...rows.map(r=>r.frame_p95_ms)),gpu:sum('gpu_samples')>=10?sum('gpu_sample_ms')/sum('gpu_samples'):null};
 };
 const a=summarize(reference.samples.draw),b=summarize(current.samples.draw);
 if(a.size!==b.size)return ['timing: drawing buffer changed'];
 const out=[];if(b.submit>a.submit*1.3+.5)out.push('timing: CPU submit regression');
 if(b.interval>a.interval*1.25+5)out.push('timing: p95 frame interval regression');
 if(a.gpu!==null&&(b.gpu===null||b.gpu>a.gpu*1.3+1.5))out.push('timing: GPU sample missing or regressed');
 return out;
}
