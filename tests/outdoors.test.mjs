import test from 'node:test';
import assert from 'node:assert/strict';
import {outdoorService} from '../house3d/server/outdoors.mjs';
import {beijingDaylight,weatherCondition} from '../house3d/shared/outdoors.mjs';
test('Chaoyang clock independent of host clock zone and cloud/rain/snow/haze classification',()=>{
 for(const [utc,phase] of [[18,'night'],[22,'morning'],[4,'day'],[9,'dusk']])assert.equal(beijingDaylight(Date.UTC(2026,10,8,utc)),phase);
 for(const [w,sky] of [[0,'clear'],[1,'clear'],[2,'cloudy'],[3,'cloudy'],[45,'fog'],[51,'rain'],[71,'snow'],[86,'snow'],[95,'rain'],[999,null]])assert.equal(weatherCondition({weather_code:w}),sky);
 assert.equal(weatherCondition({weather_code:2,visibility:3200,relative_humidity_2m:56}),'haze');
 assert.equal(weatherCondition({weather_code:2,visibility:null,relative_humidity_2m:56}),'cloudy');
});
test('one shared request, throttled retries, no stale condition presented as current',async()=>{
 let ms=Date.UTC(2026,10,8,11),calls=0;
 const read=outdoorService({now:()=>ms,request:async url=>{assert.match(url,/latitude=39.92&longitude=116.44/);if(++calls>1)throw Error('offline');return {ok:true,json:async()=>({current:{time:ms/1000,weather_code:63}})}}});
 const [a,b]=await Promise.all([read(),read()]);assert.deepEqual(a,b);assert.equal(a.weather,'rain');assert.equal(a.daylight,'night');assert.equal(calls,1);
 ms+=16*60000;assert.equal((await read()).status,'stale');await read();assert.equal(calls,2);
 ms+=80*60000;assert.equal((await read()).weather,'unknown');
});
test('independent overrides and offline mode make no network request',async()=>{
 for(const [weather,expected] of [['snow','snow'],['off','unknown']]){
  const s=await outdoorService({request:()=>assert.fail('network'),weather,daylight:'dusk'})();
  assert.equal(s.weather,expected);assert.equal(s.daylight,'dusk');assert.equal(s.source,null);
 }
});
