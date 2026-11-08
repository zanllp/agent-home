import * as T from 'three';
// Roofs, panes and street level in the original local city illustration (1672 x 941).
const panes=[[1560,257,23,40],[1560,440,23,43],[41,347,14,39],[120,217,17,15],[235,453,10,13],[316,555,7,10],[430,564,10,14],[720,475,6,9],[875,539,11,9],[947,641,7,10],[1069,405,8,11],[1115,510,8,13],[1212,399,11,12],[1264,453,8,13],[1292,347,5,10],[1426,459,6,9]];
export const sunlight={morning:.69,day:1,dusk:.48,night:.045};
export const transmission={clear:1,unknown:1,cloudy:.64,rain:.36,snow:.55,haze:.49,fog:.42};
export function createOutdoorScene(city,tiles){
 const source=city.material.map;if(!source?.image)return null;
 let painted=null,previous='',particles=null,type=null,last=0,elapsed=0;
 const root=city.parent;
 function releaseParticles(){if(particles){particles.removeFromParent();particles.geometry.dispose();particles.material.dispose();particles=null}}
 function set({daylight='day',weather='unknown'}){
  const key=daylight+weather;if(key===previous)return;previous=key;
  const canvas=Object.assign(document.createElement('canvas'),{width:1672,height:941}),ctx=canvas.getContext('2d');ctx.drawImage(source.image,0,0,1672,941);
  if(daylight!=='day'){
   ctx.globalCompositeOperation='multiply';ctx.fillStyle={morning:'#dee8f0',dusk:'#f2ad82',night:'#293953'}[daylight];ctx.fillRect(0,0,1672,941);ctx.globalCompositeOperation='source-over';
   if(daylight==='night'){
    for(const [x,y,w,h] of panes){ctx.fillStyle='#ffcb83';ctx.shadowColor='#ffb96d';ctx.shadowBlur=7;ctx.fillRect(x-w/2,y-h/2,w,h)}ctx.shadowBlur=0;
    for(const [x,y] of [[255,628],[879,716],[1222,678]]){ctx.fillStyle='#343c48';ctx.fillRect(x,y,2,19);const glow=ctx.createRadialGradient(x,y,.5,x,y,9);glow.addColorStop(0,'#ffe4a4');glow.addColorStop(1,'#ffc67700');ctx.fillStyle=glow;ctx.fillRect(x-9,y-9,18,18)}
   }
  }
  const veil={cloudy:'#6d778139',rain:'#48596865',snow:'#c1ced764',haze:'#aa9a8170',fog:'#b5c2c180'}[weather];
  if(veil){ctx.fillStyle=veil;ctx.globalAlpha=daylight==='night'?.42:1;ctx.fillRect(0,0,1672,941)}
  painted?.dispose();painted=source.clone();
  // Texture.clone shares Source with its parent; detach before uploading the new canvas.
  painted.source=new T.Source(canvas);painted.needsUpdate=true;city.material.map=painted;city.material.needsUpdate=true;
  tiles.material.roughness=weather==='rain'?.23:.58;tiles.material.color.set(weather==='rain'?'#c4c4bc':weather==='snow'?'#f4f2e9':'#e8dec9');
  if(type!==weather){type=weather;releaseParticles();
   if(type==='rain'||type==='snow'){
    const n=type==='rain'?80:55,positions=new Float32Array(n*(type==='rain'?6:3)),geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));
    const common={color:type==='rain'?0xc4d7ea:0xfafaff,transparent:true,opacity:type==='rain'?.55:.86,depthWrite:false,stencilWrite:true,stencilRef:200,stencilFunc:T.EqualStencilFunc,stencilZPass:T.KeepStencilOp};
    particles=type==='rain'?new T.LineSegments(geometry,new T.LineBasicMaterial(common)):new T.Points(geometry,new T.PointsMaterial({...common,size:.035}));
    particles.position.copy(city.position);particles.position.z+=.05;particles.renderOrder=13;particles.frustumCulled=false;root.add(particles);last=-1;
   }
  }
 }
 function tick(dt){if(!particles)return false;elapsed+=dt;particles.visible=city.visible;if(!particles.visible||Math.floor(elapsed*8)===last)return false;last=Math.floor(elapsed*8);const a=particles.geometry.attributes.position.array;
  for(let i=0,k=0;k<a.length;i++){const f=(i*.6180339)%1,s=i*91.713,x=(f-.5)*14+.12*Math.sin(elapsed+s),y=4-((s+elapsed*(type==='rain'?3:.45))%8);a[k++]=x;a[k++]=y;a[k++]=0;if(type==='rain'){a[k++]=x+.03;a[k++]=y-.17;a[k++]=0}}
  particles.geometry.attributes.position.needsUpdate=true;return true;
 }
 return {set,tick,dispose(){releaseParticles();painted?.dispose();city.material.map=source}};
}
