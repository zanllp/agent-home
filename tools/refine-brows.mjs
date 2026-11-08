// Offline GLB material repair. libjpeg-turbo is an authoring tool, not a runtime dependency.
import {readFileSync, writeFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const [source,output]=process.argv.slice(2);
if(!source||!output)throw Error('Usage: node tools/refine-brows.mjs original.glb repaired.glb');
const raw=readFileSync(source);
if(createHash('sha256').update(raw).digest('hex')!=='78fd10ff01ca9e37c98a12f1c37369d4b3e3819e3d9859c92040a0ec4a1315ab')throw Error('Expected the sleeve-refined contact rig');
const n=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+n)),bin=raw.subarray(28+n);
const view=i=>{const v=doc.bufferViews[i];return bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength)};
function attribute(i){const a=doc.accessors[i],b=view(a.bufferView),C={5123:Uint16Array,5126:Float32Array}[a.componentType];return new C(b.buffer,b.byteOffset+(a.byteOffset||0),a.count*({VEC2:2,VEC3:3,SCALAR:1}[a.type]))}
const surface=doc.meshes.find(m=>m.name==='HeadHair').primitives.find(p=>p.material===0);
const xyz=attribute(surface.attributes.POSITION),uv=attribute(surface.attributes.TEXCOORD_0),indices=attribute(surface.indices);
const img=doc.images[0].bufferView,limit={maxBuffer:96*1024*1024};
let jpeg=view(img);
const ppm=execFileSync('djpeg',['-ppm'],{input:jpeg,...limit});
const header=/^P6\s+4096\s+4096\s+255\n/.exec(ppm.subarray(0,60).toString('ascii'));
if(!header)throw Error('Unexpected atlas size/format');
const size=4096,src=ppm.subarray(header[0].length),dst=Buffer.from(src);
const lerp=(a,b,t)=>a+(b-a)*t;
function curve(x,points){
 for(let i=1;i<points.length;i++)if(x<points[i][0])return lerp(points[i-1][1],points[i][1],Math.max(0,(x-points[i-1][0])/(points[i][0]-points[i-1][0])));
 return points.at(-1)[1];
}
function fade(a,b,t){const f=Math.max(0,Math.min(1,(t-a)/(b-a)));return f*f*(3-2*f)}
const lids=[
 [[125,296],[140,286],[156,278],[177,272],[196,269],[209,269],[225,273]],
 [[430,254],[450,251],[470,250],[480,250],[493,253],[509,259],[530,270]]];
// Sample the undamaged lid/crease at its natural slope, not a flat skin colour.
// Each strip contains original UVs at 2-pixel intervals across the lid.
// Sampling the colour before interpolating avoids crossing unrelated UV islands.
const stripUV=[
 [
  [0.37856,0.49591],[0.37822,0.49589],[0.37788,0.49586],[0.37755,0.49584],
  [0.37721,0.49581],[0.37687,0.49579],[0.37652,0.49576],[0.37617,0.49574],
  [0.37582,0.49571],[0.37548,0.49569],[0.37516,0.49567],[0.37483,0.49564],
  [0.3745,0.49562],[0.37417,0.49559],[0.37384,0.49557],[0.37351,0.49554],
  [0.37318,0.49552],[0.37286,0.49549],[0.31138,0.67282],[0.31066,0.67307],
  [0.3725,0.4954],[0.3721,0.49538],[0.3717,0.49535],[0.37131,0.49533],
  [0.37091,0.49531],[0.37051,0.49529],[0.21526,0.26616],[0.21492,0.26598],
  [0.21458,0.2658],[0.21424,0.26563],[0.2139,0.26545],[0.21356,0.26527]
 ],
 [
  [0.37921,0.53762],[0.37887,0.53759],[0.37852,0.53757],[0.37818,0.53754],
  [0.37784,0.53752],[0.37749,0.5375],[0.37715,0.53747],[0.3768,0.53745],
  [0.37644,0.53742],[0.37609,0.5374],[0.37574,0.53738],[0.37539,0.53735],
  [0.37504,0.53733],[0.37469,0.5373],[0.37434,0.53728],[0.37398,0.53726],
  [0.37363,0.53723],[0.37328,0.53721],[0.37293,0.53718],[0.84949,0.44106],
  [0.84878,0.44082],[0.84819,0.4406],[0.37239,0.53706],[0.37198,0.53704],
  [0.37161,0.53701],[0.37126,0.53699],[0.3709,0.53697],[0.37055,0.53694],
  [0.18114,0.26566],[0.18151,0.26561],[0.18188,0.26556],[0.18225,0.26551]
 ]
];
function swatch([s,t]){
 const u=s*size-.5,v=t*size-.5;
 const ix=Math.floor(u),iy=Math.floor(v),fx=u-ix,fy=v-iy;
 return [0,1,2].map(k=>lerp(lerp(src[(iy*size+ix)*3+k],src[(iy*size+ix+1)*3+k],fx),lerp(src[((iy+1)*size+ix)*3+k],src[((iy+1)*size+ix+1)*3+k],fx),fy));
}
const strips=stripUV.map(points=>points.map(swatch));
function sample(strip,d){
 const f=Math.max(0,Math.min(strip.length-1,(d+40)/2)),i=Math.floor(f);
 return strip[i].map((v,k)=>lerp(v,strip[Math.min(i+1,strip.length-1)][k],f-i));
}
const touched=new Set();
// Bind-space coordinates shown as pixels in the fixed 720px orthographic inspection.
// Conversion is independent of the live camera, current pose, lighting or screen size.
for(let i=0;i<indices.length;i+=3){
 const corners=[0,1,2].map(k=>{const j=indices[i+k];return {x:360+2250*xyz[3*j],y:242.5+(0.706-xyz[3*j+1])*2250,z:xyz[3*j+2],u:uv[2*j]*size,v:uv[2*j+1]*size}});
 const [a,b,c]=corners;
 if(corners.every(p=>p.z<.12)||corners.every(p=>p.z>.176)||corners.every(p=>p.y<202)||corners.every(p=>p.y>310))continue;
 if(![[120,211],[436,537]].some(([x,X])=>corners.some(p=>p.x>=x)&&corners.some(p=>p.x<=X)))continue;
 const du=b.u-a.u,dv=b.v-a.v,eu=c.u-a.u,ev=c.v-a.v,det=du*ev-dv*eu;
 if(Math.abs(det)<.001)continue;
 const xs=corners.map(p=>p.u),ys=corners.map(p=>p.v);
 // Include a two-texel bleed for bilinear/mip sampling at split UV charts.
 for(let v=Math.max(0,Math.floor(Math.min(...ys)-2));v<=Math.min(size-1,Math.ceil(Math.max(...ys)+2));v++)
 for(let u=Math.max(0,Math.floor(Math.min(...xs)-2));u<=Math.min(size-1,Math.ceil(Math.max(...xs)+2));u++){
  const su=u+.5-a.u,sv=v+.5-a.v,f=(su*ev-sv*eu)/det,g=(du*sv-dv*su)/det;
  if(f< -2*Math.hypot(eu,ev)/Math.abs(det)||g< -2*Math.hypot(du,dv)/Math.abs(det)||1-f-g< -2*Math.hypot(eu-du,ev-dv)/Math.abs(det))continue;
  const x=a.x+f*(b.x-a.x)+g*(c.x-a.x),y=a.y+f*(b.y-a.y)+g*(c.y-a.y),z=a.z+f*(b.z-a.z)+g*(c.z-a.z);
  const side=+(x>360),h=y-curve(x,lids[side]);
  const span=side?fade(445,460,x)*(1-fade(512,532,x)):fade(126,149,x)*(1-fade(180,204,x));
  const depth=side?curve(x,[[440,.158],[475,.154],[505,.149],[532,.142]]):curve(x,[[125,.136],[155,.145],[180,.151],[205,.154]]);
  const alpha=span*fade(-36,-26,h)*(1-fade(10,17,h))*fade(.116,.13,z)*(1-fade(depth+.003,depth+.008,z));
  if(alpha<=.002)continue;
  const color=sample(strips[side],h),k=3*(v*size+u);
  for(let ch=0;ch<3;ch++)dst[k+ch]=Math.round(lerp(src[k+ch],color[ch],alpha));
  touched.add((v>>4)*256+(u>>4));
 }
}
if(!touched.size||touched.size>250)throw Error('Unexpected brow repair footprint: '+touched.size);
const tmp=mkdtempSync(join(tmpdir(),'brow-material-'));
try{
 // Only replace touched JPEG MCU blocks. Re-encoding the entire atlas changes
 // the hair highlights and every item of clothing, even at the highest quality.
 const tile=join(tmp,'tile.jpg');
 for(const id of [...touched].sort((a,b)=>a-b)){
  if(!touched.delete(id))continue;
  const x=(id%256)*16,y=(id>>8)*16;
  let w=16;while(x+w<size&&touched.delete(id+w/16))w+=16;
  const pixels=Buffer.alloc(w*16*3);
  for(let j=0;j<16;j++)dst.copy(pixels,j*w*3,((y+j)*size+x)*3,((y+j)*size+x+w)*3);
  const tmpJpg=execFileSync('cjpeg',['-quality','98','-sample','2x2'],{input:Buffer.concat([Buffer.from('P6\n'+w+' 16\n255\n'),pixels]),...limit});
  writeFileSync(tile,tmpJpg);
  jpeg=execFileSync('jpegtran',['-copy','all','-trim','-drop','+'+x+'+'+y,tile],{input:jpeg,...limit});
 }
 jpeg=execFileSync('jpegtran',['-copy','all','-optimize'],{input:jpeg,...limit});
}finally{rmSync(tmp,{recursive:true,force:true})}
const chunks=[];let length=0;
for(let i=0;i<doc.bufferViews.length;i++){
 const v=doc.bufferViews[i],block=i===img?jpeg:view(i),pad=(-length)&3;
 chunks.push(Buffer.alloc(pad),block);length+=pad;v.byteOffset=length;v.byteLength=block.length;length+=block.length;
}
doc.buffers[0].byteLength=length;
const bytes=Buffer.concat([...chunks,Buffer.alloc((-length)&3)]),json=Buffer.from(JSON.stringify(doc)),js=Buffer.concat([json,Buffer.alloc((-json.length)&3,32)]);
const hdr=Buffer.from(raw.subarray(0,20)),tail=Buffer.from(raw.subarray(20+n,28+n));hdr.writeUInt32LE(28+js.length+bytes.length,8);hdr.writeUInt32LE(js.length,12);tail.writeUInt32LE(bytes.length,0);
writeFileSync(output,Buffer.concat([hdr,js,tail,bytes]));
