import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateHomePerf,compareHomeTiming} from '../tools/perf-gates.mjs';
const limits={callsPerFrame:2050,trianglesPerFrame:1500000,shadowRatio:.67,idleFps:15};
function fixture(){const f={role:'viewer',window_ms:15000,frames:300,ticks:300,active_ticks:300,calls:450000,triangles:360000000,shadow_frames:150,submit_ms:1600,frame_p95_ms:50,buffer_width:960,buffer_height:720};
 return {draw:[f],idle:[{...f,frames:120,active_ticks:0,shadow_frames:0}],paused:[{...f,frames:0,active_ticks:0,shadow_frames:0,calls:0,triangles:0}],runner:[{...f,role:'runner',frames:0,calls:0,triangles:0,shadow_frames:0}]}}
test('guards catch continuous idle shadows, fake empty view, paused redraw and more expensive active frames',()=>{
 assert.deepEqual(evaluateHomePerf(fixture(),limits),[]);
 for(const [name,patch] of [['draw',{frames:0}],['draw',{calls:990000}],['draw',{shadow_frames:300}],['idle',{shadow_frames:120}],['paused',{frames:100}],['runner',{calls:1}]]){
  const f=fixture();Object.assign(f[name][0],patch);assert.ok(evaluateHomePerf(f,limits).length);
 }
});
test('same-machine timing comparison fails a slowdown or resolution change',()=>{
 const a={scenario:'family',machine:['sample'],samples:fixture()},b=structuredClone(a);assert.deepEqual(compareHomeTiming(b,a),[]);
 b.samples.draw[0].submit_ms*=2;assert.ok(compareHomeTiming(b,a).some(s=>s.includes('CPU')));
 b.samples.draw[0].buffer_width=800;assert.ok(compareHomeTiming(b,a).some(s=>s.includes('buffer')));
});
