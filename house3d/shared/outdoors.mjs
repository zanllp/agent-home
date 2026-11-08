// Clock bands are local household lighting choices, not astronomical sunrise times.
export function beijingDaylight(ms){
 const hour=(new Date(ms).getUTCHours()+8)%24;
 return hour<5||hour>=19?'night':hour<9?'morning':hour<17?'day':'dusk';
}
export function weatherCondition(c){
 const w=c.weather_code;
 if(!Number.isInteger(w))return null;
 if([71,73,75,77,85,86].includes(w))return 'snow';
 if([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99].includes(w))return 'rain';
 if(w===45||w===48)return 'fog';
 if(![0,1,2,3].includes(w))return null;
 // An appearance estimate only; visibility alone is not an air-quality measurement.
 if(Number.isFinite(c.visibility)&&c.visibility>=0&&c.visibility<5000&&Number.isFinite(c.relative_humidity_2m)&&c.relative_humidity_2m<80)return 'haze';
 return w>=2?'cloudy':'clear';
}
