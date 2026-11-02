import { deflateSync, inflateSync, crc32 } from 'node:zlib';

const palette = { ink:[44,66,88], mint:[94,176,166], green:[99,155,86], blue:[75,131,194], ochre:[241,174,58], coral:[223,107,110] };
export const drawingWidth = 480, drawingHeight = 360;
export const drawable = item => ['urban-picture-book-v1','urban-workbook-v1'].includes(item.asset_id);

const motifs=['sun','house','flower'];
export function validateDrawing(title, marks) {
  if (typeof title !== 'string' || !title.trim() || [...title].length > 32) throw Error('Use a title of 1–32 characters');
  if (!Array.isArray(marks) || !marks.length || marks.length > 32) throw Error('Use 1–32 crayon marks');
  marks.forEach((mark,i) => {
    const invalid = () => { throw Error('Invalid crayon mark '+(i+1)+': check shape, palette color and page bounds'); };
    if (!Array.isArray(mark)) invalid();
    const [op,color,...n] = mark;
    if (typeof color !== 'string' || !Object.hasOwn(palette,color) || !['line','oval','wash',...motifs].includes(op) || n.length < 4 || n.length > 20 || n.length % 2 || !n.every(x=>Number.isFinite(x)&&x>=0&&x<=100)) invalid();
    if (op !== 'line' && n.length !== 4) invalid();
    const [x,y,a,b] = n;
    if ((op==='oval' || motifs.includes(op)) && (!a || !b || x-a<0 || x+a>100 || y-b<0 || y+b>100)) invalid();
    if (op==='wash' && (a<=x || b<=y)) invalid();
  });
}

function chunk(name,data) {
  const out = Buffer.alloc(data.length+12);
  out.writeUInt32BE(data.length); out.write(name,4); data.copy(out,8);
  out.writeUInt32BE(crc32(out.subarray(4,-4)),out.length-4);
  return out;
}

function strokes(mark){
  const [op,color,x,y,a,b]=mark;
  if(!motifs.includes(op))return [mark];
  const oval=(u,v,rx,ry)=>['oval',color,x+u*a,y+v*b,rx*a,ry*b];
  const line=(...points)=>['line',color,...points.map((p,i)=>i%2?y+p*b:x+p*a)];
  if(op==='sun'){
    const rays=Array.from({length:8},(_,i)=>{const u=Math.cos(i*Math.PI/4),v=Math.sin(i*Math.PI/4);return line(.75*u,.75*v,u,v)});
    return [oval(0,0,.56,.56),...rays];
  }
  if(op==='house')return [line(-1,-.1,0,-1,1,-.1,-1,-.1),line(-.8,-.1,-.8,1,.8,1,.8,-.1),line(-.4,1,-.4,.4,0,.4,0,1),line(.22,.18,.54,.18,.54,.5,.22,.5,.22,.18)];
  const petals=Array.from({length:5},(_,i)=>oval(.48*Math.sin(i*2*Math.PI/5),-.42-.34*Math.cos(i*2*Math.PI/5),.26,.19));
  return [line(0,-.14,.04,.99),line(.02,.72,-.62,.42,-.34,.73,.02,.72),...petals,oval(0,-.42,.19,.14)];
}

// Input is exclusively our stored PNG (one IDAT chunk, RGB8, filter byte 0).
function readPaper(png,byteLength){
  const length=png.readUInt32BE(33);
  const scan=inflateSync(png.subarray(41,41+length),{maxOutputLength:byteLength});
  if(scan.length!==byteLength)throw Error('Unexpected stored drawing size');
  return scan;
}

// Render directly into PNG scanlines; repeated passes leave the paper grain visible.
/** @param {any[][]} marks @param {Buffer} [base] */
export function crayonPng(marks,base=undefined) {
  const w=drawingWidth, h=drawingHeight, stride=1+3*w, scan=base?readPaper(base,stride*h):Buffer.alloc(stride*h), grain=new Float32Array(w*h);
  let seed=31415;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const v=grain[y*w+x]=random(), shade=5*v+3*random(), i=y*stride+1+x*3;
    if(!base){scan[i]=253-shade;scan[i+1]=249-shade;scan[i+2]=235-shade;}
  }
  for (const [op,color,...n] of marks.flatMap(strokes)) {
    const points=[], rgb=palette[color], r=op==='wash'?3.5:2.3;
    const [x,y,a,b]=n;
    if(op==='line') for(let i=0;i<n.length;i+=2) points.push([n[i],n[i+1]]);
    if(op==='oval') for(let i=0;i<=36;i++) points.push([x+a*Math.cos(i*Math.PI/18),y+b*Math.sin(i*Math.PI/18)]);
    if(op==='wash') {
      const rows=Math.max(3,Math.ceil((b-y)/1.3));
      for(let j=0;j<rows;j++){const yy=y+(b-y)*j/(rows-1),l=[x,yy],u=[a,yy];points.push(...(j%2?[u,l]:[l,u]));}
    }
    const px=points.map(([u,v])=>[18+u*(w-36)/100,14+v*(h-28)/100]);
    for(let j=1;j<px.length;j++){
      const [sx,sy]=px[j-1],dx=px[j][0]-sx,dy=px[j][1]-sy,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/1.3));
      for(let k=0;k<=steps;k++){
        const t=k/steps,cx=sx+dx*t+.8*Math.sin(j+t),cy=sy+dy*t+.7*Math.sin(1.5*j+4*t);
        for(let iy=Math.floor(cy-r);iy<=cy+r;iy++) for(let ix=Math.floor(cx-r);ix<=cx+r;ix++){
          const d=((ix-cx)**2+(iy-cy)**2)/(r*r); if(d>=1)continue;
          const alpha=(op==='wash'?.22:.55)*(1-d)*Math.min(1,grain[iy*w+ix]*2.4),i=iy*stride+1+ix*3;
          for(let c=0;c<3;c++)scan[i+c]+=Math.round((rgb[c]-scan[i+c])*alpha);
        }
      }
    }
  }
  const hdr=Buffer.alloc(13);hdr.writeUInt32BE(w);hdr.writeUInt32BE(h,4);hdr[8]=8;hdr[9]=2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',hdr),chunk('IDAT',deflateSync(scan)),chunk('IEND',Buffer.alloc(0))]);
}
