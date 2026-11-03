import * as T from 'three';

// Closed lofts rather than scaled boxes: the rear uprights splay into feet and
// then bend backwards above the seat. +Z is the seated person's forward axis.
function loft(parent,name,material,levels,count,point){
 const pos=[],uv=[],indices=[];
 for(const [j,level] of levels.entries())for(let i=0;i<count;i++){
  const p=point(level,i*2*Math.PI/count);pos.push(...p);uv.push(i/count,j/(levels.length-1));
  if(j){const a=(j-1)*count+i,b=(j-1)*count+(i+1)%count;indices.push(a,a+count,b,b,a+count,b+count)}
 }
 for(const j of [0,levels.length-1]){const k=j*count;for(let i=1;i<count-1;i++)j?indices.push(k,k+i+1,k+i):indices.push(k,k+i,k+i+1)}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
 const m=new T.Mesh(g,material);m.name=name;parent.add(m);return m;
}
const pow=(x,k)=>Math.sign(x)*Math.abs(x)**k;
export function makeMapleChair(g){
 const maple=new T.MeshStandardMaterial({color:'#caa173',roughness:.54,side:T.DoubleSide}),seat=new T.MeshStandardMaterial({color:'#e7dcca',roughness:.96,side:T.DoubleSide}),seam=new T.MeshStandardMaterial({color:'#cabda4',roughness:.96,side:T.DoubleSide});
 for(const side of [-1,1])for(const rear of [false,true]){
  const sign=rear?-1:1;
  const levels=[[.006,.218,sign*.222,.015],[.019,.217,sign*.220,.017],[.203,.201,sign*.201,.019],[.38,.169,sign*.166,.023]];
  if(rear)levels.push([.46,.176,-.174,.021],[.62,.191,-.195,.019],[.782,.204,-.202,.019],[.801,.204,-.202,.015]);
  loft(g,rear?'Steam bent stile':'Tapered foreleg',maple,levels,12,([h,x,z,r],a)=>[side*x+r*pow(Math.cos(a),.67),h,z+r*pow(Math.sin(a),.67)]);
 }
 function pad(name,mat,levels){
  return loft(g,name,mat,levels,48,([h,w,d],a)=>[w*pow(Math.cos(a),.52),h,d*pow(Math.sin(a),.52)]);
 }
 pad('Maple saddle rim',maple,[[.351,.205,.202],[.357,.214,.211],[.390,.217,.215],[.396,.211,.207]]);
 pad('Oatmeal linen cushion',seat,[[.391,.202,.202],[.397,.217,.208],[.413,.225,.218],[.431,.222,.215],[.441,.202,.197],[.448,.135,.132],[.449,.008,.008]]);
 const edge=Array.from({length:64},(_,i)=>{const a=2*Math.PI*i/64;return new T.Vector3(.2255*pow(Math.cos(a),.52),.413,.2185*pow(Math.sin(a),.52))});
 const welt=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(edge,true),96,.0017,5,true),seam);welt.name='Linen piping';g.add(welt);
 // Crest rail: a wide scoop that curves round the shoulders, with eased top and bottom edges.
 loft(g,'Bent maple crest',maple,[-1,-.986,-.95,-.79,-.58,-.31,0,.31,.58,.79,.95,.986,1],20,(u,a)=>{
  const end=Math.min(1,.76+14*(1-Math.abs(u))),h=.066*end,depth=.016*end;
  return [.237*u,.782+h*pow(Math.sin(a),.52)-.012*u*u,-.246+.053*u*u+depth*pow(Math.cos(a),.57)];
 });
}
