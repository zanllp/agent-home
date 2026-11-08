import {beijingDaylight,weatherCondition} from '../shared/outdoors.mjs';
const url='https://api.open-meteo.com/v1/forecast?latitude=39.92&longitude=116.44&current=weather_code,cloud_cover,visibility,relative_humidity_2m,temperature_2m&timeformat=unixtime&timezone=Asia%2FShanghai';
export function outdoorService({request=fetch,now=Date.now,weather='auto',daylight='auto'}={}){
 if(!['auto','off','clear','cloudy','rain','snow','haze','fog'].includes(weather)||!['auto','morning','day','dusk','night'].includes(daylight))throw Error('Invalid HOUSE_WEATHER or HOUSE_DAYLIGHT');
 let last=null,next=0,pending=null,failed=false;
 async function refresh(){
  try{
   const r=await request(url,{signal:AbortSignal.timeout(6000),redirect:'error'});if(!r.ok)throw Error('Weather unavailable');
   const {current:c}=await r.json(),condition=c&&weatherCondition(c),at=c?.time*1000;
   if(!condition||!Number.isFinite(at)||at<now()-90*60000||at>now()+20*60000)throw Error('Invalid current weather');
   last={condition,observed_at:new Date(at).toISOString(),temperature_c:Number.isFinite(c.temperature_2m)?c.temperature_2m:null};failed=false;next=now()+15*60000;
  }catch{failed=true;next=now()+5*60000}
 }
 return async function read(){
  if(weather==='auto'&&now()>=next){pending??=refresh().finally(()=>{pending=null});await pending}
  const current=last&&now()-Date.parse(last.observed_at)<=90*60000?last:null;
  const manual=weather!=='auto'&&weather!=='off';
  return {district:'北京市朝阳区',timezone:'Asia/Shanghai',daylight:daylight==='auto'?beijingDaylight(now()):daylight,
   weather:manual?weather:current?.condition??'unknown',status:manual?'preset':weather==='off'?'off':current?(failed?'stale':'current'):'unavailable',
   source:weather==='auto'?'Open-Meteo':null,observed_at:current?.observed_at??null,temperature_c:current?.temperature_c??null,
   ...(current?.condition==='haze'?{basis:'Estimated appearance from visibility and humidity; not an air-quality reading'}:{})};
 };
}
